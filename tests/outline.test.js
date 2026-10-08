import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInOutline } from "../src/model.js";
import { labelPoint, midpoints, insertCorner, removeCorner, moveCorner } from "../src/outline.js";

const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]];
const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];

test("a room's name goes at a point inside its outline, even for an L shape", () => {
  assert.deepEqual(labelPoint(SQUARE), [50, 50]);
  assert.deepEqual(labelPoint(L), [5, 10]);
  assert.equal(pointInOutline(L, ...labelPoint(L)), true);
  assert.equal(pointInOutline(L, 10, 10), false); // the middle of the bounding box is on the notch, not inside
});

test("midpoints gives the middle of each side, in corner order", () => {
  assert.deepEqual(midpoints(SQUARE), [[50, 0], [100, 50], [50, 100], [0, 50]]);
});

test("adding, removing and moving a corner leave the original outline alone", () => {
  const tri = [[0, 0], [10, 0], [0, 10]];
  assert.deepEqual(insertCorner(tri, 0, [5, 0]), [[0, 0], [5, 0], [10, 0], [0, 10]]);
  assert.deepEqual(insertCorner(tri, 2, [0, 5]), [[0, 0], [10, 0], [0, 10], [0, 5]]);
  assert.deepEqual(removeCorner(tri, 1), [[0, 0], [0, 10]]);
  assert.deepEqual(moveCorner(tri, 2, [1, 9]), [[0, 0], [10, 0], [1, 9]]);
  assert.deepEqual(tri, [[0, 0], [10, 0], [0, 10]]);
});
