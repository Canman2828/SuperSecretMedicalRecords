import type { BBox } from '@medifyrx/shared';

/**
 * OCR boxes are in photo-pixel space. The camera preview fills the screen with
 * "cover" scaling (cropped, not letterboxed), so boxes must be scaled AND offset.
 * This is the #1 source of "highlights are in the wrong place" bugs — test it first.
 */
export function imageBoxToScreenBox(
  box: BBox,
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
): BBox {
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
  const offsetX = (imageWidth * scale - viewWidth) / 2;
  const offsetY = (imageHeight * scale - viewHeight) / 2;
  return {
    x: box.x * scale - offsetX,
    y: box.y * scale - offsetY,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/**
 * ML Kit (via @react-native-ml-kit on iOS) reports boxes in the camera's raw sensor buffer,
 * which is landscape, while the photo and preview are upright. So on a portrait capture every
 * box comes back rotated 90°: tall and narrow, bunched along one edge of the screen.
 * This rotates a raw-buffer box into upright photo coordinates using the EXIF orientation.
 */
export function rawBoxToUpright(box: BBox, exifOrientation: number, uprightWidth: number, uprightHeight: number): BBox {
  switch (exifOrientation) {
    case 6: // raw is rotated 90° CCW from upright (normal portrait capture)
      return { x: uprightWidth - (box.y + box.height), y: box.x, width: box.height, height: box.width };
    case 8: // raw is rotated 90° CW from upright
      return { x: box.y, y: uprightHeight - (box.x + box.width), width: box.height, height: box.width };
    case 3: // upside down
      return { x: uprightWidth - (box.x + box.width), y: uprightHeight - (box.y + box.height), width: box.width, height: box.height };
    default:
      return box;
  }
}

/**
 * Text lines are wider than they are tall. If most lines come back taller than wide,
 * the boxes are in the rotated raw buffer and need `rawBoxToUpright`.
 */
export function boxesLookRotated(lineBoxes: BBox[]): boolean {
  let tall = 0;
  let wide = 0;
  for (const b of lineBoxes) {
    if (b.height > b.width) tall += 1;
    else if (b.width > b.height) wide += 1;
  }
  return tall > wide;
}
