// Geometry for room outlines. An outline is a list of [x, y] corners in picture pixels.

// Where to write the room's name: the middle of the widest stretch of the outline along the line half way down it.
// The middle of the bounding box will not do: for an L shape it can fall outside the room.
export function labelPoint(outline) {
  const ys = outline.map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = [];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  }
  return best ? [(best[0] + best[1]) / 2, y] : [...outline[0]];
}

// The middle of each side; entry i is between corner i and the next corner.
export function midpoints(outline) {
  return outline.map(([x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length];
    return [(x + nx) / 2, (y + ny) / 2];
  });
}

// A new corner after corner i.
export function insertCorner(outline, i, point) {
  return [...outline.slice(0, i + 1), point, ...outline.slice(i + 1)];
}

export function removeCorner(outline, i) {
  return outline.filter((_, n) => n !== i);
}

export function moveCorner(outline, i, point) {
  return outline.map((p, n) => (n === i ? point : p));
}

// The smallest upright box around an outline: [left, top, right, bottom].
export function roomBox(outline) {
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
