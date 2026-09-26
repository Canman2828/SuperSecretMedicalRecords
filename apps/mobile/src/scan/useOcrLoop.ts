import { parseCriticalFields, type Annotation, type OcrWord } from '@clearrx/shared';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { BoxTracker } from './boxTracker';
import { imageBoxToScreenBox } from './coordinateMap';

const OCR_INTERVAL_MS = 800; // design doc: 500–1000 ms, never every frame

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

        const detections = parseCriticalFields(words, medsRef.current).map((a) => ({
          ...a,
          bbox: imageBoxToScreenBox(a.bbox, photo.width, photo.height, viewSize.width, viewSize.height),
        }));

        setAnnotations(tracker.current.update(detections));
        setLastText(result.text);
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

  return { annotations, lastText };
}
