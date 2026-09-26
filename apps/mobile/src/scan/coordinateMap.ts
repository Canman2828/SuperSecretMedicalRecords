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
