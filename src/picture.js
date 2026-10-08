// A chosen floor picture: read it, turn it, shrink it, and make the JPEG that is stored.

export const MAX_SIDE = 3000;

// The stored size of a w x h picture after `turns` quarter turns (negative = left).
export function targetSize(w, h, turns = 0, max = MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h));
  const width = Math.max(1, Math.round(w * s)), height = Math.max(1, Math.round(h * s));
  return Math.abs(turns) % 2 ? { width: height, height: width } : { width, height };
}

// File -> ImageBitmap, upright as the camera meant it. Throws an Error whose message can be shown as it is.
export async function readPicture(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This picture can't be opened here. Open it in Preview, choose File > Export, pick JPEG, and try again.");
  }
}

// Draw the picture on the canvas at its stored size, turned by `turns` quarter turns.
export function drawPicture(canvas, bitmap, turns = 0) {
  const { width, height } = targetSize(bitmap.width, bitmap.height, turns);
  canvas.width = width;
  canvas.height = height;
  const odd = Math.abs(turns) % 2;
  const w = odd ? height : width, h = odd ? width : height;
  const ctx = canvas.getContext("2d");
  ctx.translate(width / 2, height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be saved."))), "image/jpeg", 0.85);
  });
}
