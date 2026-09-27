// Settings for the Prescriptive intro:
//   1. "Prescriptive" in big type on a plain white screen (the navbar stays), then it sweeps away sideways
//   2. the transparent frame animation plays on the white screen
//   3. the last frame's pill glides, shrinks and turns onto the center node's pill icon while the white fades out
//
// Put the frames in:  apps/web/public/prescriptive-intro/
// named:              0001.png, 0002.png, … 0183.png
// Then run `python apps/web/scripts/optimize-intro-frames.py` to make small .webp copies (~10 MB instead of
// ~250 MB). The page uses the .webp files when present and falls back to the .png files.
// If no first frame can be loaded, the animation is skipped and the title hands straight over to the page.

export const INTRO = {
  frameCount: 183,
  /** Playback speed: the frames' original 30 fps (about 6 seconds for 183 frames). */
  fps: 30,
  /** URL of frame `i` (1 … frameCount). */
  frameUrl: (i: number, ext: 'webp' | 'png') => `${import.meta.env.VITE_STATIC_ASSET_ROOT}/prescriptive-intro/${String(i).padStart(4, '0')}.${ext}`,

  /**
   * The pill in the LAST frame (measured from 0183.png):
   * x / y = its center as a fraction of the frame's width / height,
   * length = its long side as a fraction of the frame's width,
   * angleDeg = how far it's tilted clockwise from horizontal.
   */
  pill: { x: 0.501, y: 0.485, length: 0.716, angleDeg: 13 },

  /** Title: how long it takes to appear, how long it's shown before sweeping away, and how long the sweep takes. */
  titleInMs: 450,
  titleHoldMs: 650,
  titleSweepMs: 550,
  /** How long the last frame takes to glide onto the center node while the white screen fades. */
  fadeMs: 1100,
  /** If the frames still aren't loaded this long after the page opens, skip the animation. */
  maxLoadMs: 12000,
};
