import type { Annotation, BBox } from '@clearrx/shared';

// Keeps highlights steady between OCR passes (design doc §14):
// match by text + position, smooth coordinates, and survive brief misses.

const ALPHA = 0.35; // weight of the new detection
const KEEP_ALIVE_MS = 900;
const MAX_CENTER_DIST = 80; // px, in screen space

interface Tracked {
  ann: Annotation;
  lastSeen: number;
}

const center = (b: BBox) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const lerp = (a: number, b: number) => ALPHA * b + (1 - ALPHA) * a;

export class BoxTracker {
  private tracked: Tracked[] = [];

  update(detections: Annotation[], now = Date.now()): Annotation[] {
    const used = new Set<Tracked>();

    for (const det of detections) {
      const c = center(det.bbox);
      let best: Tracked | undefined;
      let bestDist = Infinity;
      for (const t of this.tracked) {
        if (used.has(t) || t.ann.normalizedText !== det.normalizedText) continue;
        const tc = center(t.ann.bbox);
        const d = Math.hypot(tc.x - c.x, tc.y - c.y);
        if (d < bestDist && d < MAX_CENTER_DIST) {
          best = t;
          bestDist = d;
        }
      }

      if (best) {
        const prev = best.ann.bbox;
        best.ann = {
          ...det,
          id: best.ann.id, // stable id so React doesn't remount the highlight
          bbox: {
            x: lerp(prev.x, det.bbox.x),
            y: lerp(prev.y, det.bbox.y),
            width: lerp(prev.width, det.bbox.width),
            height: lerp(prev.height, det.bbox.height),
          },
        };
        best.lastSeen = now;
        used.add(best);
      } else {
        const t = { ann: det, lastSeen: now };
        this.tracked.push(t);
        used.add(t);
      }
    }

    this.tracked = this.tracked.filter((t) => now - t.lastSeen < KEEP_ALIVE_MS);
    return this.tracked.map((t) => t.ann);
  }

  reset() {
    this.tracked = [];
  }
}
