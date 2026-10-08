import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { TYPES } from "../src/catalog.js";
import { HINTS, PICK_LISTS, shapeOf, recentChoices, isRepeatTap, markersNear, roomChoices, suggestedNames } from "../src/placing.js";
import { sample } from "./helpers.js";

test("marker shapes follow the group: circle outlets, square switches, diamond lights, triangle the rest", () => {
  assert.deepEqual(["D", "S3", "RL", "SM", "X"].map(shapeOf), ["circle", "square", "diamond", "triangle", "triangle"]);
});

test("hints and pick lists are for real types", () => {
  for (const code of [...Object.keys(HINTS), ...Object.keys(PICK_LISTS)]) assert.ok(TYPES[code], code);
  assert.deepEqual(PICK_LISTS.R[0], ["Dryer", "Dryer outlet"]);
  assert.equal(PICK_LISTS.HA.at(-1)[1], null); // "Other" asks for a name
});

test("recentChoices is the last four different things placed, newest first", () => {
  const { p, main, kit } = sample();
  const add = (type, created, customName = "") => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, customName }, created);
  assert.deepEqual(recentChoices(p), []);
  add("D", 100); add("S", 200); add("D", 300); add("X", 400, "Sump pump"); add("L", 500); add("FL", 600);
  assert.deepEqual(recentChoices(p), [
    { type: "FL", customName: "" }, { type: "L", customName: "" }, { type: "X", customName: "Sump pump" }, { type: "D", customName: "" },
  ]);
});

test("a second tap within a second and a few pixels is a repeat", () => {
  const last = { at: 1000, sx: 100, sy: 100 };
  assert.equal(isRepeatTap(last, { at: 1500, sx: 104, sy: 103 }), true);
  assert.equal(isRepeatTap(last, { at: 2500, sx: 104, sy: 103 }), false);
  assert.equal(isRepeatTap(last, { at: 1500, sx: 140, sy: 100 }), false);
  assert.equal(isRepeatTap(null, { at: 1500, sx: 100, sy: 100 }), false);
});

test("markersNear lists the devices within reach of a tap, nearest first", () => {
  const devices = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 }, { id: "c", x: 100, y: 0 }];
  assert.deepEqual(markersNear(devices, 6, 0, 8).map((d) => d.id), ["b", "a"]);
  assert.deepEqual(markersNear(devices, 50, 50, 8), []);
});

test("roomChoices lists this floor's rooms by name, the last one used first", () => {
  const { p, main, kit } = sample();
  const up = m.addFloor(p, "Upstairs", 1100);
  m.addRoom(p, { floorId: up.id, name: "Bed", code: "BED" }, 1100);
  assert.deepEqual(roomChoices(p, main.id).map((r) => r.name), ["Exterior", "Kitchen"]);
  assert.deepEqual(roomChoices(p, main.id, kit.id).map((r) => r.name), ["Kitchen", "Exterior"]);
});

test("names offered for Something else: the usual ones, then his own, without repeats", () => {
  const { p, main, kit } = sample();
  const add = (customName, created) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "X", x: 1, y: 1, customName }, created);
  add("Pool pump", 100); add("Sump pump", 200);
  const names = suggestedNames(p);
  assert.equal(names[0], "Attic fan");
  assert.equal(names.at(-1), "Pool pump");
  assert.equal(names.filter((n) => n === "Sump pump").length, 1);
});
