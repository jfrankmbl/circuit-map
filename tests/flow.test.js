import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { checklist, startTab, plural, floorSummary, deleteFloorQuestion, floorAfterDelete, agoText, describeFile } from "../src/flow.js";
import { sample } from "./helpers.js";

test("the setup checklist ticks itself", () => {
  const p = m.createProject("Home", 1);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, false, false, false]);
  const floor = m.addFloor(p, "Main", 2);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, true, false, false]);
  m.update(p, "floors", floor.id, { imageId: "img" }, 3);
  m.addRoom(p, { floorId: floor.id, name: "Kitchen", code: "KIT" }, 4);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, true, true, true]);
  assert.equal(checklist(p)[2].text, "Add a picture of the floor");
});

test("the app opens on Floors until some floor has a picture, then on Map", () => {
  const { p, main } = sample();
  assert.equal(startTab(p), "floors");
  m.update(p, "floors", main.id, { imageId: "img" }, 2000);
  assert.equal(startTab(p), "map");
});

test("counts read naturally", () => {
  assert.deepEqual([plural(0, "room"), plural(1, "room"), plural(2, "room")], ["0 rooms", "1 room", "2 rooms"]);
});

test("a floor's row says whether it has a picture and how many rooms", () => {
  const { p, main } = sample();
  assert.equal(floorSummary(p, main), "No picture yet, 2 rooms");
  m.update(p, "floors", main.id, { imageId: "img" }, 2000);
  assert.equal(floorSummary(p, main), "Has a picture, 2 rooms");
});

test("the delete-floor question says what goes with it", () => {
  const { p, main, kit } = sample();
  assert.equal(deleteFloorQuestion(p, main.id), "Delete Main? It has 2 rooms.");
  const sw = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1 }, 1100);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 2, y: 2 }, 1100);
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1200);
  assert.equal(deleteFloorQuestion(p, main.id), "Delete Main and its 2 devices? It has 2 rooms and 1 link.");
  const attic = m.addFloor(p, "Attic", 1300);
  assert.equal(deleteFloorQuestion(p, attic.id), "Delete Attic?");
});

test("after deleting a floor the one below is shown, or the one above if it was the lowest", () => {
  const { p, main } = sample();
  const up = m.addFloor(p, "Upstairs", 1100);
  const base = m.addFloor(p, "Basement", 1200, true);
  assert.equal(floorAfterDelete(p, up.id), main.id);
  assert.equal(floorAfterDelete(p, base.id), main.id);
  m.remove(p, "floors", up.id, 1300);
  m.remove(p, "floors", base.id, 1300);
  assert.equal(floorAfterDelete(p, main.id), "");
});

test("a project file is described with its date and how long ago", () => {
  const day = 86400000, now = new Date(2026, 9, 3, 12).getTime();
  assert.deepEqual([0, 1, 5, 21, 90, 800].map((d) => agoText(now - d * day, now)),
    ["today", "yesterday", "5 days ago", "3 weeks ago", "3 months ago", "2 years ago"]);
  const desc = { name: "Dad's house", floors: 2, devices: 63, updated: new Date(2026, 8, 12, 12).getTime() };
  assert.equal(describeFile(desc, now), "Dad's house, 2 floors, 63 devices, last changed 12 Sep 2026, 3 weeks ago.");
});
