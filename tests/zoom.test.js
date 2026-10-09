import { test } from "node:test";
import assert from "node:assert/strict";
import { roomBox } from "../src/outline.js";
import { fitRect, toScreen } from "../src/viewport.js";

test("roomBox is the smallest upright box around an outline", () => {
  assert.deepEqual(roomBox([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]), [0, 0, 20, 20]);
  assert.deepEqual(roomBox([[5, 7], [9, 3], [2, 4]]), [2, 3, 9, 7]);
});

test("fitRect zooms so a box fills the plan with a margin, centred, and never past the limit", () => {
  const view = fitRect([100, 100, 300, 200], 500, 500, 50, 8);
  assert.deepEqual(view, { k: 2, x: -150, y: -50 });
  assert.deepEqual(toScreen(view, 200, 150), [250, 250]); // the middle of the box is the middle of the plan
  assert.equal(fitRect([0, 0, 10, 10], 500, 500, 50, 8).k, 8);
});
