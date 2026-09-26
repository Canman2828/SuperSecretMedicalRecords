import { parseCriticalFields, type Annotation, type BBox, type OcrWord } from '@medifyrx/shared';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { BoxTracker } from './boxTracker';
import { boxesLookRotated, imageBoxToScreenBox, rawBoxToUpright } from './coordinateMap';

const OCR_INTERVAL_MS = 800; // design doc: 500–1000 ms, never every frame
const DOC_ALPHA = 0.35; // same smoothing as BoxTracker
const DOC_KEEP_ALIVE_MS = 900;

const union = (boxes: BBox[]): BBox | null => {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width));
  const y2 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};
const lerpBox = (a: BBox, b: BBox): BBox => ({
  x: a.x + (b.x - a.x) * DOC_ALPHA,
  y: a.y + (b.y - a.y) * DOC_ALPHA,
  width: a.width + (b.width - a.width) * DOC_ALPHA,
  height: a.height + (b.height - a.height) * DOC_ALPHA,
});

interface Options {
  cameraRef: RefObject<CameraView | null>;
  viewSize: { width: number; height: number };
  knownMedications: string[];
  enabled: boolean;
}

/**
 * Slow recognition, smooth rendering:
 * snap a low-res still every ~800ms -> on-device OCR (Apple/Google ML Kit, no network)
 * -> deterministic parser -> map to screen -> smooth with BoxTracker.
 */
export function useOcrLoop({ cameraRef, viewSize, knownMedications, enabled }: Options) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [lastText, setLastText] = useState('');
  /** Screen-space outline of all recognized text: where the document is. AR panels anchor to it. */
  const [docBox, setDocBox] = useState<BBox | null>(null);
  const docSeen = useRef(0);
  const busy = useRef(false);
  const tracker = useRef(new BoxTracker());
  const medsRef = useRef(knownMedications);
  medsRef.current = knownMedications;

  useEffect(() => {
    if (!enabled || viewSize.width === 0) return;

    const tick = async () => {
      const cam = cameraRef.current;
      if (!cam || busy.current) return; // skip while the previous pass is still running
      busy.current = true;
      let uri: string | undefined;
      try {
        // exif: true so we get the Orientation tag needed to un-rotate ML Kit's boxes.
        const photo = await cam.takePictureAsync({ quality: 0.4, shutterSound: false, exif: true });
        if (!photo) return;
        uri = photo.uri;

        const result = await TextRecognition.recognize(photo.uri);
        const frame = (f?: { left: number; top: number; width: number; height: number }): BBox => ({
          x: f?.left ?? 0,
          y: f?.top ?? 0,
          width: f?.width ?? 0,
          height: f?.height ?? 0,
        });
        const lines = result.blocks.flatMap((block) => block.lines);

        // photo.width/height are upright (expo-camera reports the oriented size, already cropped
        // to the preview's aspect ratio), but ML Kit's boxes are in the raw landscape sensor buffer.
        // Rotate them upright when they look sideways. Missing EXIF on a portrait photo = the usual 6.
        const rotated = boxesLookRotated(lines.map((l) => frame(l.frame)));
        const exifOrientation = Number(photo.exif?.Orientation) || (photo.height > photo.width ? 6 : 1);
        const toUpright = (b: BBox) => (rotated ? rawBoxToUpright(b, exifOrientation, photo.width, photo.height) : b);

        // One word list per printed line, so a highlight never merges words from two lines
        // (a span that wraps onto the next line would otherwise become one tall box).
        const lineWords: OcrWord[][] = lines.map((line) =>
          line.elements.map((el) => ({
            text: el.text,
            bbox: toUpright(frame(el.frame)),
            confidence: 1, // ML Kit doesn't expose per-word confidence on iOS
          })),
        );
        const words = lineWords.flat();

        const toScreen = (b: BBox) => imageBoxToScreenBox(b, photo.width, photo.height, viewSize.width, viewSize.height);
        const detections = lineWords
          .flatMap((line) => parseCriticalFields(line, medsRef.current))
          .map((a) => ({ ...a, bbox: toScreen(a.bbox) }));

        const now = Date.now();
        const doc = union(words.map((w) => toScreen(w.bbox)));
        if (doc) docSeen.current = now;
        setDocBox((prev) => (doc ? (prev ? lerpBox(prev, doc) : doc) : now - docSeen.current < DOC_KEEP_ALIVE_MS ? prev : null));

        setAnnotations(tracker.current.update(detections, now));
        if (result.text.trim()) setLastText(result.text);
      } catch (err) {
        console.warn('OCR pass failed', err);
      } finally {
        // Privacy: never keep camera frames around.
        if (uri) {
          try {
            new File(uri).delete();
          } catch {
            /* already gone */
          }
        }
        busy.current = false;
      }
    };

    const id = setInterval(tick, OCR_INTERVAL_MS);
    return () => {
      clearInterval(id);
      tracker.current.reset();
    };
  }, [enabled, viewSize.width, viewSize.height, cameraRef]);

  return { annotations, lastText, docBox };
}
