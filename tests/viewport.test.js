import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, zoomAt, panBy, toImage, toScreen } from "../src/viewport.js";

test("fit centres the whole picture with a margin", () => {
  assert.deepEqual(fit(1000, 500, 524, 524, 12), { k: 0.5, x: 12, y: 137 });
  assert.deepEqual(fit(500, 1000, 524, 524, 12), { k: 0.5, x: 137, y: 12 });
});

test("zoomAt keeps the picture point under the finger where it was", () => {
  const before = { k: 1, x: 0, y: 0 };
  const after = zoomAt(before, 100, 50, 2, 0.1, 8);
  assert.deepEqual(after, { k: 2, x: -100, y: -50 });
  assert.deepEqual(toImage(after, 100, 50), toImage(before, 100, 50));
});

test("zoomAt stops at the limits", () => {
  const view = { k: 1, x: 0, y: 0 };
  assert.equal(zoomAt(view, 0, 0, 100, 0.1, 8).k, 8);
  assert.equal(zoomAt(view, 0, 0, 0.001, 0.1, 8).k, 0.1);
});

test("panBy slides the picture, and toImage and toScreen are opposites", () => {
  const view = panBy({ k: 2, x: 0, y: 0 }, 10, 20);
  assert.deepEqual(view, { k: 2, x: 10, y: 20 });
  assert.deepEqual(toImage(view, 30, 60), [10, 20]);
  assert.deepEqual(toScreen(view, 10, 20), [30, 60]);
});
