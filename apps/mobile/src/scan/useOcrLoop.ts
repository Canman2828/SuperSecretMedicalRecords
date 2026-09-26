import { parseCriticalFields, type Annotation, type BBox, type OcrWord } from '@medifyrx/shared';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { BoxTracker } from './boxTracker';
import { imageBoxToScreenBox } from './coordinateMap';

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
        const photo = await cam.takePictureAsync({ quality: 0.4, shutterSound: false });
        if (!photo) return;
        uri = photo.uri;

        const result = await TextRecognition.recognize(photo.uri);
        const words: OcrWord[] = result.blocks.flatMap((block) =>
          block.lines.flatMap((line) =>
            line.elements.map((el) => ({
              text: el.text,
              bbox: {
                x: el.frame?.left ?? 0,
                y: el.frame?.top ?? 0,
                width: el.frame?.width ?? 0,
                height: el.frame?.height ?? 0,
              },
              confidence: 1, // ML Kit doesn't expose per-word confidence on iOS
            })),
          ),
        );

        // ML Kit returns boxes in the display-upright (portrait) orientation, but iOS
        // captures in landscape sensor pixels, so photo.width/height can be transposed
        // relative to the boxes. If the photo's orientation doesn't match the preview's,
        // swap the dimensions so the cover-scale math lines up. (Fixes "highlights land
        // in the corner / on the air".)
        const photoIsLandscape = photo.width > photo.height;
        const viewIsLandscape = viewSize.width > viewSize.height;
        const [imgW, imgH] =
          photoIsLandscape !== viewIsLandscape ? [photo.height, photo.width] : [photo.width, photo.height];

        const detections = parseCriticalFields(words, medsRef.current).map((a) => ({
          ...a,
          bbox: imageBoxToScreenBox(a.bbox, imgW, imgH, viewSize.width, viewSize.height),
        }));

        const now = Date.now();
        const doc = union(words.map((w) => imageBoxToScreenBox(w.bbox, imgW, imgH, viewSize.width, viewSize.height)));
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
