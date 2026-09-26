import { useEffect, useRef, useState } from 'react';
import { INTRO } from './introConfig';

interface Props {
  /** The center node's pill icon on screen (viewport px), or null if not available. */
  getTarget: () => { x: number; y: number; length: number; angleDeg: number } | null;
  /** The white screen starts fading: the tree should fade its center node in over `ms` (0 = show everything now). */
  onHandoff: (ms: number) => void;
  /** The intro is finished (or skipped). */
  onDone: () => void;
}

type Phase = 'title' | 'sweep' | 'play' | 'handoff' | 'skipped';

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start playing once this many frames are in; the rest keep streaming in during playback. */
const BUFFER_FRAMES = 60;

interface FrameSet {
  /** undefined = still loading, null = failed (skipped during playback). */
  images: (HTMLImageElement | null | undefined)[];
  /** Resolves once the first BUFFER_FRAMES frames are loaded. */
  ready: Promise<void>;
}

/** Starts loading every frame (WebP copies if they exist, else the PNGs). Null if there are none. */
async function loadFrames(): Promise<FrameSet | null> {
  for (const ext of ['webp', 'png'] as const) {
    let first: HTMLImageElement;
    try {
      first = await load(INTRO.frameUrl(1, ext));
    } catch {
      continue;
    }
    const images: FrameSet['images'] = new Array(INTRO.frameCount).fill(undefined);
    images[0] = first;
    const need = Math.min(BUFFER_FRAMES, INTRO.frameCount);
    let contiguous = 1;
    let markReady = () => {};
    const ready = new Promise<void>((r) => (markReady = r));
    const settle = (i: number, img: HTMLImageElement | null) => {
      images[i] = img;
      while (contiguous < images.length && images[contiguous] !== undefined) contiguous++;
      if (contiguous >= need) markReady();
    };
    for (let i = 1; i < INTRO.frameCount; i++) {
      load(INTRO.frameUrl(i + 1, ext)).then((img) => settle(i, img), () => settle(i, null));
    }
    if (need <= 1) markReady();
    return { images, ready };
  }
  return null;
}

/**
 * The Prescriptive entrance: big title on white → title sweeps away → frame animation on white →
 * the last frame's pill glides, shrinks and turns onto the center node's pill icon as the white fades
 * to reveal the page. The navbar stays visible above it throughout.
 */
export function PrescriptiveIntro({ getTarget, onHandoff, onDone }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const [top, setTop] = useState(0);
  const cbs = useRef({ getTarget, onHandoff, onDone });
  cbs.current = { getTarget, onHandoff, onDone };

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      removeSkip();
      cbs.current.onDone();
    };

    // Any key or click jumps straight to the page.
    const skip = (e: Event) => {
      if (cancelled) return;
      if (e instanceof KeyboardEvent && [' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.key)) e.preventDefault();
      cancelled = true;
      cancelAnimationFrame(raf);
      removeSkip();
      cbs.current.onHandoff(0);
      setPhase('skipped');
      window.setTimeout(() => cbs.current.onDone(), 250);
    };
    const removeSkip = () => {
      removeEventListener('keydown', skip, true);
      removeEventListener('pointerdown', skip, true);
    };
    addEventListener('keydown', skip, true);
    addEventListener('pointerdown', skip, true);

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cbs.current.onHandoff(0);
      finish();
      return;
    }

    // Everything below the navbar is the stage for the title and the animation.
    const navBottom = () => Math.ceil(document.querySelector('.nav-wrap')?.getBoundingClientRect().bottom ?? 0);
    setTop(navBottom());

    // Frames start loading now, while the title is on screen.
    const frames = loadFrames()
      .then((set) => (set ? Promise.race([set.ready.then(() => set), wait(INTRO.maxLoadMs).then(() => null)]) : null))
      .catch(() => null);

    (async () => {
      // 1. Title: hold it until the first second of frames has loaded (usually already done).
      await wait(INTRO.titleHoldMs);
      const set = await frames;
      if (cancelled) return;

      // 2. Sweep the title away.
      setPhase('sweep');
      await wait(INTRO.titleSweepMs);
      if (cancelled) return;

      if (!set) {
        // No animation available: fade the white screen straight into the page.
        setPhase('handoff');
        cbs.current.onHandoff(0);
        backdrop.current!.style.opacity = '0';
        await wait(700);
        finish();
        return;
      }

      // 3. Play the frames on the white screen, fitted into the area below the navbar.
      setPhase('play');
      const c = canvas.current!;
      const ctx = c.getContext('2d')!;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const fit = () => {
        c.width = innerWidth * dpr;
        c.height = innerHeight * dpr;
        const areaTop = navBottom() + 12;
        const areaH = innerHeight - areaTop - 16;
        const img = set.images[0]!;
        const s = Math.min(innerWidth / img.naturalWidth, areaH / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        return { x: (innerWidth - w) / 2, y: areaTop + (areaH - h) / 2, w, h };
      };
      let box = fit();
      const onResize = () => (box = fit());
      addEventListener('resize', onResize);
      const draw = (i: number) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        // Nearest loaded frame at or before i (a frame that failed to load is skipped over).
        let j = i;
        while (j > 0 && !set.images[j]) j--;
        ctx.drawImage(set.images[j]!, box.x, box.y, box.w, box.h);
      };

      // Play at INTRO.fps. If streaming falls behind, hold on the current frame until the next one arrives.
      const last = set.images.length - 1;
      let head = 0;
      let prev = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          if (cancelled) return resolve();
          const dt = Math.max(0, now - prev);
          prev = now;
          const next = Math.min(last, Math.floor(head) + 1);
          if (set.images[next] !== undefined) head = Math.min(last, head + (dt / 1000) * INTRO.fps);
          draw(Math.floor(head));
          if (head < last) raf = requestAnimationFrame(tick);
          else resolve();
        };
        raf = requestAnimationFrame(tick);
      });
      removeEventListener('resize', onResize);
      if (cancelled) return;

      // 4. Hand-off: glide + shrink + turn the pill onto the center node's pill while the white fades.
      setPhase('handoff');
      const px = box.x + INTRO.pill.x * box.w;
      const py = box.y + INTRO.pill.y * box.h;
      const target = cbs.current.getTarget();
      const onScreen = target && target.y > navBottom() && target.y < innerHeight && target.x > 0 && target.x < innerWidth;
      const ms = INTRO.fadeMs;
      c.style.transformOrigin = `${px}px ${py}px`;
      c.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.15,1), opacity ${ms * 0.45}ms ease-in ${ms * 0.55}ms`;
      backdrop.current!.style.transition = `opacity ${ms}ms ease`;
      cbs.current.onHandoff(ms);
      requestAnimationFrame(() => {
        if (onScreen) {
          const scale = target.length / (INTRO.pill.length * box.w);
          const turn = target.angleDeg - INTRO.pill.angleDeg;
          c.style.transform = `translate(${target.x - px}px, ${target.y - py}px) rotate(${turn}deg) scale(${scale})`;
        }
        c.style.opacity = '0';
        backdrop.current!.style.opacity = '0';
      });
      await wait(ms + 60);
      finish();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      removeSkip();
    };
  }, []);

  // Once the white starts fading, let clicks through to the page.
  return (
    <div className={`intro-stage ${phase}`} ref={stage} aria-hidden="true">
      <div className="intro-backdrop" ref={backdrop} />
      <div className="intro-title-wrap" style={{ top }}>
        <h1 className={`intro-title${phase !== 'title' ? ' sweep' : ''}`} style={{ animationDuration: `${phase === 'title' ? INTRO.titleInMs : INTRO.titleSweepMs}ms` }}>
          Prescriptive
        </h1>
      </div>
      <canvas ref={canvas} className="intro-canvas" />
      <p className="intro-skip">Press any key or click to skip</p>
    </div>
  );
}
