import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { createHistory, remember, forget, undo, undoLabel } from "../src/history.js";

test("undo puts the project back and names the step", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  assert.equal(undoLabel(hist), "");
  remember(hist, "added Main", p);
  const floor = m.addFloor(p, "Main", 10);
  assert.equal(undoLabel(hist), "Undo: added Main");
  assert.equal(undo(hist, p, 20), "added Main");
  assert.deepEqual([p.floors, p.deleted, undoLabel(hist)], [[], [{ id: floor.id, at: 20 }], ""]);
  assert.equal(undo(hist, p, 30), null);
});

test("steps undo newest first, and only the last 20 are kept", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  for (let i = 1; i <= 25; i++) {
    remember(hist, "added F" + i, p);
    m.addFloor(p, "F" + i, i);
  }
  assert.equal(hist.steps.length, 20);
  undo(hist, p, 100);
  assert.equal(p.floors.length, 24);
  assert.equal(undoLabel(hist), "Undo: added F24");
});

test("forget drops the step of a change that failed", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  remember(hist, "added Main", p);
  forget(hist);
  assert.equal(undoLabel(hist), "");
});

test("a remembered step is not touched by later edits", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  remember(hist, "renamed the house", p);
  m.rename(p, "New name", 5);
  undo(hist, p, 9);
  assert.deepEqual([p.name, p.updated], ["Home", 9]);
});
