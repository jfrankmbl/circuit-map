import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { sample } from "./helpers.js";

test("createProject starts empty at the current format", () => {
  const p = m.createProject("Home", 5);
  assert.equal(p.formatVersion, m.FORMAT_VERSION);
  assert.equal(p.name, "Home");
  assert.equal(p.updated, 5);
  assert.ok(p.id.length > 10);
  for (const c of m.COLLECTIONS) assert.deepEqual(p[c], []);
  assert.deepEqual(p.deleted, []);
});

test("add, find and update stamp the time", () => {
  const { p, main } = sample();
  assert.equal(m.find(p, "floors", main.id).name, "Main");
  m.update(p, "floors", main.id, { name: "Ground" }, 2000);
  assert.equal(main.name, "Ground");
  assert.equal(main.updated, 2000);
  assert.equal(m.find(p, "floors", "nope"), null);
  assert.throws(() => m.update(p, "floors", "nope", {}, 1), /no floors record/);
});

test("rename stamps the project", () => {
  const { p } = sample();
  m.rename(p, "New name", 3000);
  assert.deepEqual([p.name, p.updated], ["New name", 3000]);
});

test("a basement is added at the bottom of the list", () => {
  const { p } = sample();
  const base = m.addFloor(p, "Basement", 1, true);
  assert.equal(base.order, -1);
  assert.deepEqual(m.sortedFloors(p).map((f) => f.name), ["Basement", "Main"]);
  assert.equal(m.addFloor(p, "Upstairs", 2).order, 1);
});

test("floors are numbered in the order added", () => {
  const { p } = sample();
  assert.equal(m.addFloor(p, "Upstairs", 1).order, 1);
});

test("a floor added after a delete does not reuse an order", () => {
  const { p } = sample();
  const b = m.addFloor(p, "B", 1);
  const c = m.addFloor(p, "C", 1);
  m.remove(p, "floors", b.id, 2);
  assert.equal(m.addFloor(p, "D", 3).order, c.order + 1);
});

test("moveFloor swaps neighbours, and does nothing past either end", () => {
  const { p, main } = sample();
  const up = m.addFloor(p, "Upstairs", 1);
  m.moveFloor(p, up.id, -1, 2000);
  assert.deepEqual(m.sortedFloors(p).map((f) => f.name), ["Upstairs", "Main"]);
  assert.equal(main.updated, 2000);
  m.moveFloor(p, up.id, -1, 3000);
  assert.deepEqual(m.sortedFloors(p).map((f) => f.name), ["Upstairs", "Main"]);
  assert.equal(up.updated, 2000);
});

test("room codes are checked and unique", () => {
  const { p, main } = sample();
  assert.throws(() => m.addRoom(p, { floorId: main.id, name: "Kitchen 2", code: "KIT" }, 1), /already used/);
  assert.throws(() => m.addRoom(p, { floorId: main.id, name: "Bad", code: "k1tchen" }, 1), /room code/);
});

test("roomsAt finds the outline containing a point, on that floor only", () => {
  const { p, main, kit } = sample();
  assert.deepEqual(m.roomsAt(p, main.id, 50, 50).map((r) => r.id), [kit.id]);
  assert.deepEqual(m.roomsAt(p, main.id, 150, 50), []);
  assert.deepEqual(m.roomsAt(p, "other-floor", 50, 50), []);
});

test("pointInOutline handles an L shape and too few corners", () => {
  const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
  assert.equal(m.pointInOutline(L, 5, 15), true);
  assert.equal(m.pointInOutline(L, 15, 15), false);
  assert.equal(m.pointInOutline([[0, 0], [10, 10]], 5, 5), false);
});

test("outlines that cross themselves are refused", () => {
  const { p, kit } = sample();
  assert.equal(m.outlineCrossesItself([[0, 0], [10, 10], [10, 0], [0, 10]]), true);
  assert.equal(m.outlineCrossesItself([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]), false);
  assert.throws(() => m.setOutline(p, kit.id, [[0, 0], [10, 10], [10, 0], [0, 10]], 2), /lines cross/);
  assert.throws(() => m.setOutline(p, kit.id, [[0, 0], [10, 10]], 2), /three corners/);
});

test("roomAt: a closet inside a room wins, partial overlap asks", () => {
  const { p, main, kit } = sample();
  const closet = m.addRoom(p, { floorId: main.id, name: "Closet", code: "CLO" }, 2);
  m.setOutline(p, closet.id, [[10, 10], [30, 10], [30, 30], [10, 30]], 2);
  assert.equal(m.roomAt(p, main.id, 20, 20).room.id, closet.id);
  assert.equal(m.roomAt(p, main.id, 60, 60).room.id, kit.id);
  assert.deepEqual(m.roomAt(p, main.id, 500, 500), { room: null, choices: [] });
  const hall = m.addRoom(p, { floorId: main.id, name: "Hall", code: "HAL" }, 3);
  m.setOutline(p, hall.id, [[50, 50], [150, 50], [150, 150], [50, 150]], 3);
  const both = m.roomAt(p, main.id, 70, 70);
  assert.equal(both.room, null);
  assert.equal(both.choices.length, 2);
});

test("scaleFromPoints gives pixels per inch", () => {
  assert.equal(m.scaleFromPoints([0, 0], [300, 400], 100), 5);
  assert.throws(() => m.scaleFromPoints([0, 0], [0, 0], 10), /two different points/);
  assert.throws(() => m.scaleFromPoints([0, 0], [1, 1], 0), /distance/);
});
