import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImagePicker from 'expo-image-picker';

// Compremedic capture: take a photo or pick one from the library, read its text on-device (ML Kit),
// and return the image bytes (base64) so the user can choose to save the document to their account.

export interface Capture {
  /** Text read from the image on-device. May be '' if nothing was found; the user can type it in. */
  text: string;
  /** Base64-encoded image bytes, no `data:` prefix — ready for api.uploadDocument. */
  imageBase64: string;
  mimeType: string;
  uri: string;
}

export type CaptureOutcome =
  | { status: 'ok'; capture: Capture }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

// Downscale + compress so the base64 upload stays well under the route's body limit.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  quality: 0.5,
  base64: true,
  mediaTypes: ['images'],
  exif: false,
};

async function ocr(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  // Keep the printed line breaks readable but join each block into one paragraph.
  return result.blocks.map((b) => b.lines.map((l) => l.text).join(' ')).join('\n').trim();
}

async function run(
  requestPermission: () => Promise<ImagePicker.PermissionResponse>,
  launch: () => Promise<ImagePicker.ImagePickerResult>,
): Promise<CaptureOutcome> {
  const permission = await requestPermission();
  if (!permission.granted) return { status: 'denied' };

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await launch();
  } catch {
    return { status: 'error', message: 'Could not open the camera or photo library.' };
  }
  if (result.canceled) return { status: 'canceled' };

  const asset = result.assets[0];
  if (!asset?.base64) return { status: 'error', message: 'That image could not be read.' };

  try {
    const text = await ocr(asset.uri);
    return {
      status: 'ok',
      capture: {
        text,
        imageBase64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
        uri: asset.uri,
      },
    };
  } catch {
    return { status: 'error', message: 'Something went wrong reading that photo. Please try again.' };
  }
}

export function captureFromCamera(): Promise<CaptureOutcome> {
  return run(
    () => ImagePicker.requestCameraPermissionsAsync(),
    () => ImagePicker.launchCameraAsync(PICKER_OPTIONS),
  );
}

export function captureFromLibrary(): Promise<CaptureOutcome> {
  return run(
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    () => ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS),
  );
}
