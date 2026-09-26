// Runs MediaPipe hand tracking off the main thread so the 3D tree keeps rendering smoothly.
// Receives small downscaled camera frames (ImageBitmap) and returns hand landmarks.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_OPTIONS, MODEL_URL, WASM_URL } from './handConfig';

export type WorkerIn = { type: 'init' } | { type: 'frame'; bitmap: ImageBitmap; ts: number };
export type WorkerOut =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; landmarks: { x: number; y: number }[][]; hands: string[] };

let landmarker: HandLandmarker | null = null;
const post = (m: WorkerOut) => (self as unknown as { postMessage: (m: WorkerOut) => void }).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      // Module workers can't use importScripts, so load MediaPipe's ES-module build of the wasm.
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL, true);
      const make = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(fileset, { ...HAND_OPTIONS, baseOptions: { modelAssetPath: MODEL_URL, delegate } });
      landmarker = await make('GPU').catch(() => make('CPU'));
      post({ type: 'ready' });
    } catch (err) {
      post({ type: 'error', message: String(err) });
    }
    return;
  }
  if (msg.type === 'frame') {
    try {
      if (!landmarker) return;
      const r = landmarker.detectForVideo(msg.bitmap, msg.ts);
      post({
        type: 'result',
        landmarks: r.landmarks.map((hand) => hand.map(({ x, y }) => ({ x, y }))),
        hands: r.handedness.map((h, i) => h[0]?.categoryName ?? `hand${i}`),
      });
    } catch (err) {
      post({ type: 'error', message: String(err) });
    } finally {
      msg.bitmap.close();
    }
  }
};
