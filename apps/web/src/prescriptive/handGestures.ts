import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { DETECT_WIDTH, HAND_OPTIONS, MODEL_URL, WASM_URL } from './handConfig';
import type { WorkerIn, WorkerOut } from './handWorker';

// Camera-based hand gestures for the Prescriptive Camera view, using MediaPipe's Hand Landmarker.
// Every frame is analysed on this device; nothing is uploaded. The engine and model load from CDNs
// the first time hand controls are switched on (about 8 MB, then cached by the browser).
//
//   pinch + release quickly      → select the node under (or nearest to) the hand
//   pinch + move left / right    → spin the tree
//   pinch with both hands        → pull apart to zoom in, push together to zoom out
//
// Performance: tracking runs in a Web Worker on a small downscaled frame, with at most one frame in
// flight, so the 3D scene keeps its frame rate. If workers aren't available it falls back to the main thread.

/** Thumb-to-index distance, relative to hand size, that starts / ends a pinch (the gap avoids flicker). */
const PINCH_ON = 0.3;
const PINCH_OFF = 0.45;
/** A pinch counts as a "tap" (select) if released this quickly without moving further than this. */
const TAP_MS = 550;
const TAP_MOVE_PX = 34;

export interface HandCursor {
  x: number;
  y: number;
  pinching: boolean;
}

export interface GestureHandlers {
  /** Horizontal drag while one hand pinches, in viewport pixels (positive = to the right). */
  onDrag: (dx: number) => void;
  /** Two-hand pinch: ratio of the new hand distance to the previous one (> 1 = hands moving apart). */
  onZoom: (factor: number) => void;
  /** Quick pinch: select whatever is at (or nearest to) this viewport point. */
  onSelect: (x: number, y: number) => void;
  /** Where each hand's pinch point is (viewport px). Called every tracked frame; keep it cheap. */
  onCursors: (cursors: HandCursor[]) => void;
}

type Pt = { x: number; y: number };

/**
 * One Euro filter: smooths jitter when the hand is still but follows quickly when it moves,
 * which feels far less laggy than fixed smoothing. (Casiez et al., CHI 2012.)
 */
class OneEuro {
  private x?: number;
  private dx = 0;
  private t?: number;
  constructor(private minCutoff = 1.4, private beta = 0.012, private dCutoff = 1) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value: number, tMs: number) {
    if (this.x === undefined || this.t === undefined) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

interface HandState {
  x: number;
  y: number;
  fx: OneEuro;
  fy: OneEuro;
  pinching: boolean;
  start?: { t: number; x: number; y: number };
  lastX: number;
  moved: boolean;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

let mainThreadLandmarker: Promise<HandLandmarker> | null = null;
function loadMainThread(): Promise<HandLandmarker> {
  mainThreadLandmarker ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const make = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, { ...HAND_OPTIONS, baseOptions: { modelAssetPath: MODEL_URL, delegate } });
    return make('GPU').catch(() => make('CPU'));
  })();
  mainThreadLandmarker.catch(() => (mainThreadLandmarker = null));
  return mainThreadLandmarker;
}

export class HandGestures {
  private hands = new Map<string, HandState>();
  private twoHandDist: number | null = null;
  /** Once both hands have pinched, suppress select/spin until every pinch is released. */
  private twoHandLock = false;
  private running = false;
  private busy = false;
  private worker: Worker | null = null;
  private landmarker: HandLandmarker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private pumpHandle = 0;

  constructor(
    private video: HTMLVideoElement,
    /** true when the video is shown mirrored (front / laptop camera). */
    private mirrored: () => boolean,
    private handlers: GestureHandlers,
  ) {}

  async start() {
    this.running = true;
    try {
      this.worker = await this.startWorker();
    } catch {
      this.worker?.terminate();
      this.worker = null;
      this.landmarker = await loadMainThread();
    }
    if (!this.running) return this.stop();
    this.pump();
  }

  stop() {
    this.running = false;
    this.worker?.terminate();
    this.worker = null;
    cancelAnimationFrame(this.pumpHandle);
    this.handlers.onCursors([]);
  }

  private startWorker(): Promise<Worker> {
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('./handWorker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => reject(new Error('hand worker timed out')), 20000);
      w.onerror = (e) => {
        clearTimeout(timer);
        reject(e);
      };
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === 'ready') {
          clearTimeout(timer);
          w.onmessage = (ev: MessageEvent<WorkerOut>) => this.onWorkerMessage(ev.data);
          resolve(w);
        } else if (m.type === 'error') {
          clearTimeout(timer);
          reject(new Error(m.message));
        }
      };
      w.postMessage({ type: 'init' } satisfies WorkerIn);
    });
  }

  private onWorkerMessage(m: WorkerOut) {
    this.busy = false;
    if (m.type === 'result' && this.running) this.process(m.landmarks, m.hands, performance.now());
  }

  /** Send the newest camera frame to the tracker whenever it's free (frames are dropped, never queued). */
  private pump = () => {
    if (!this.running) return;
    this.pumpHandle = requestAnimationFrame(this.pump);
    const v = this.video;
    if (this.busy || v.readyState < 2 || !v.videoWidth) return;
    const w = DETECT_WIDTH;
    const h = Math.round((DETECT_WIDTH * v.videoHeight) / v.videoWidth);
    const ts = performance.now();

    if (this.worker) {
      this.busy = true;
      createImageBitmap(v, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
        .then((bitmap) => {
          if (!this.worker) return bitmap.close();
          this.worker.postMessage({ type: 'frame', bitmap, ts } satisfies WorkerIn, [bitmap]);
        })
        .catch(() => (this.busy = false));
      return;
    }
    if (this.landmarker) {
      // Main-thread fallback: still detect on a small canvas rather than the full-size video.
      this.canvas ??= document.createElement('canvas');
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.canvas.getContext('2d')!.drawImage(v, 0, 0, w, h);
      const r = this.landmarker.detectForVideo(this.canvas, ts);
      this.process(
        r.landmarks,
        r.handedness.map((x, i) => x[0]?.categoryName ?? `hand${i}`),
        ts,
      );
    }
  };

  /** Video-normalised point → viewport pixels, matching the element's object-fit: cover + mirroring. */
  private toScreen(p: Pt) {
    const v = this.video;
    const r = v.getBoundingClientRect();
    const scale = Math.max(r.width / v.videoWidth, r.height / v.videoHeight);
    const w = v.videoWidth * scale;
    const h = v.videoHeight * scale;
    const x = this.mirrored() ? 1 - p.x : p.x;
    return { x: r.left + (r.width - w) / 2 + x * w, y: r.top + (r.height - h) / 2 + p.y * h };
  }

  private process(landmarks: Pt[][], names: string[], now: number) {
    const seen = new Set<string>();
    landmarks.forEach((lm, i) => {
      const key = names[i] ?? `hand${i}`;
      seen.add(key);
      this.updateHand(key, lm, now);
    });
    // Hands that left the frame: drop them without selecting anything.
    for (const key of [...this.hands.keys()]) if (!seen.has(key)) this.hands.delete(key);

    const pinching = [...this.hands.values()].filter((h) => h.pinching);
    if (pinching.length === 2) {
      this.twoHandLock = true;
      const d = dist(pinching[0], pinching[1]);
      if (this.twoHandDist && d > 0) this.handlers.onZoom(d / this.twoHandDist);
      this.twoHandDist = d;
    } else {
      this.twoHandDist = null;
      if (pinching.length === 0) this.twoHandLock = false;
    }
    this.handlers.onCursors([...this.hands.values()].map(({ x, y, pinching }) => ({ x, y, pinching })));
  }

  private updateHand(key: string, lm: Pt[], now: number) {
    // Pinch strength: thumb tip (4) to index tip (8), relative to palm size (wrist 0 → middle knuckle 9),
    // measured in video pixels so it doesn't depend on the camera's aspect ratio.
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const px = (p: Pt) => ({ x: p.x * vw, y: p.y * vh });
    const ratio = dist(px(lm[4]), px(lm[8])) / Math.max(1, dist(px(lm[0]), px(lm[9])));
    const point = this.toScreen({ x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 });

    let h = this.hands.get(key);
    if (!h) {
      h = { x: point.x, y: point.y, fx: new OneEuro(), fy: new OneEuro(), pinching: false, lastX: point.x, moved: false };
      this.hands.set(key, h);
    }
    h.x = h.fx.filter(point.x, now);
    h.y = h.fy.filter(point.y, now);

    const wasPinching = h.pinching;
    h.pinching = wasPinching ? ratio < PINCH_OFF : ratio < PINCH_ON;

    if (h.pinching && !wasPinching) {
      h.start = { t: now, x: h.x, y: h.y };
      h.lastX = h.x;
      h.moved = false;
    } else if (h.pinching && h.start) {
      if (Math.hypot(h.x - h.start.x, h.y - h.start.y) > TAP_MOVE_PX) h.moved = true;
      // One-hand pinch-and-drag spins the tree (not while zooming with two hands).
      if (h.moved && !this.twoHandLock) this.handlers.onDrag(h.x - h.lastX);
      h.lastX = h.x;
    } else if (!h.pinching && wasPinching && h.start) {
      const quick = now - h.start.t < TAP_MS && !h.moved && !this.twoHandLock;
      if (quick) this.handlers.onSelect(h.start.x, h.start.y);
      h.start = undefined;
    }
  }
}
