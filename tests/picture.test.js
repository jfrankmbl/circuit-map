import { test } from "node:test";
import assert from "node:assert/strict";
import { targetSize } from "../src/picture.js";

test("a big picture is shrunk so its longest side is 3000, a small one is left alone", () => {
  assert.deepEqual(targetSize(6000, 4000), { width: 3000, height: 2000 });
  assert.deepEqual(targetSize(800, 600), { width: 800, height: 600 });
});

test("a quarter turn either way swaps width and height", () => {
  assert.deepEqual(targetSize(6000, 4000, 1), { width: 2000, height: 3000 });
  assert.deepEqual(targetSize(6000, 4000, -1), { width: 2000, height: 3000 });
  assert.deepEqual(targetSize(6000, 4000, 2), { width: 3000, height: 2000 });
});
