// Pan and zoom. A view is { k, x, y }: picture pixel (ix, iy) is drawn at screen point (x + ix * k, y + iy * k).

// The view that shows the whole picture, centred, with `pad` screen pixels around it.
export function fit(imgW, imgH, boxW, boxH, pad = 12) {
  const k = Math.min((boxW - 2 * pad) / imgW, (boxH - 2 * pad) / imgH);
  return { k, x: (boxW - imgW * k) / 2, y: (boxH - imgH * k) / 2 };
}

// Zoom by `factor` about screen point (sx, sy), which stays over the same picture point.
export function zoomAt(view, sx, sy, factor, minK, maxK) {
  const k = Math.min(maxK, Math.max(minK, view.k * factor));
  const f = k / view.k;
  return { k, x: sx - (sx - view.x) * f, y: sy - (sy - view.y) * f };
}

export function panBy(view, dx, dy) {
  return { k: view.k, x: view.x + dx, y: view.y + dy };
}

export function toImage(view, sx, sy) {
  return [(sx - view.x) / view.k, (sy - view.y) / view.k];
}

export function toScreen(view, ix, iy) {
  return [view.x + ix * view.k, view.y + iy * view.k];
}

// The view that shows the box [left, top, right, bottom] centred with `pad` screen pixels around it, zoomed in no
// further than maxK.
export function fitRect([left, top, right, bottom], boxW, boxH, pad = 32, maxK = 8) {
  const k = Math.min((boxW - 2 * pad) / Math.max(right - left, 1), (boxH - 2 * pad) / Math.max(bottom - top, 1), maxK);
  return { k, x: boxW / 2 - (k * (left + right)) / 2, y: boxH / 2 - (k * (top + bottom)) / 2 };
}
