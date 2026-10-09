import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { canBeSwitched, switchName, switchProgress, progressText, linkBanner, controlRows, switchedRows, halfState } from "../src/linking.js";
import { sample } from "./helpers.js";

function house() {
  const s = sample();
  const { p, main, kit } = s;
  const place = (type, created, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, ...extra }, created);
  const plate = place("S", 1100, { toggles: 2 });
  const single = place("S3", 1200);
  const light = place("L", 1300);
  const outlet = place("D", 1400);
  const up = m.addFloor(p, "Upstairs", 1500);
  const hall = m.addRoom(p, { floorId: up.id, name: "Hall", code: "HAL" }, 1500);
  const hallLight = m.placeDevice(p, { floorId: up.id, roomId: hall.id, type: "L", x: 1, y: 1 }, 1600);
  return { ...s, plate, single, light, outlet, up, hallLight };
}

test("lights, outlets and appliances can be switched; switches, panels and the meter cannot", () => {
  assert.deepEqual(["L", "D", "HA", "X", "EF"].map(canBeSwitched), [true, true, true, true, true]);
  assert.deepEqual(["S", "DM", "BP", "SP", "MN"].map(canBeSwitched), [false, false, false, false, false]);
});

test("a switch is named by its place on the plate only when the plate has more than one", () => {
  const { plate, single } = house();
  assert.equal(switchName(plate, 2), "Switch 2 on KIT-01");
  assert.equal(switchName(single, 1), "KIT-02");
});

test("progress counts every switch on every plate and lists the ones that control nothing", () => {
  const { p, plate, single, light } = house();
  let progress = switchProgress(p);
  assert.deepEqual([progress.total, progress.set], [3, 0]);
  assert.equal(progressText(progress), "0 of 3 switches set");
  assert.deepEqual(progress.todo.map((t) => t.text), ["Switch 1 on KIT-01, Kitchen, Main", "Switch 2 on KIT-01, Kitchen, Main", "KIT-02, Kitchen, Main"]);
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: light.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 2000);
  assert.equal(progressText(switchProgress(p)), "2 of 3 switches set");
  m.toggleLink(p, { switchId: single.id, loadId: light.id }, 2000);
  progress = switchProgress(p);
  assert.deepEqual([progressText(progress), progress.todo], ["All 3 switches set", []]);
  assert.equal(progressText({ total: 0, set: 0 }), "");
  assert.equal(progressText({ total: 1, set: 0 }), "0 of 1 switch set");
  assert.equal(progressText({ total: 1, set: 1 }), "The switch is set");
});

test("the banner names the switch and lists what it controls on other floors", () => {
  const { p, main, up, plate, light, hallLight } = house();
  assert.equal(linkBanner(p, plate, 2, main.id), "Switch 2 on KIT-01: tap each light or outlet it controls.");
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: hallLight.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 2000);
  assert.equal(linkBanner(p, plate, 2, main.id), "Switch 2 on KIT-01: tap each light or outlet it controls. Also controls HAL-01 (Upstairs).");
  assert.equal(linkBanner(p, plate, 2, up.id), "Switch 2 on KIT-01: tap each light or outlet it controls. Also controls KIT-03 (Main).");
});

test("rows for what a switch controls, and for what switches a load", () => {
  const { p, plate, single, light, outlet } = house();
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: light.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "top" }, 2000);
  m.toggleLink(p, { switchId: single.id, loadId: light.id }, 2000);
  assert.deepEqual(controlRows(p, plate.id, 1).map((r) => r.text), ["KIT-03, Ceiling light, Main", "KIT-04, Duplex outlet, Main, top half"]);
  assert.equal(controlRows(p, plate.id, 1)[0].link.loadId, light.id);
  assert.deepEqual(switchedRows(p, light.id).map((r) => r.text), ["Switch 1 on KIT-01, Main", "KIT-02, Main"]);
  assert.deepEqual(switchedRows(p, outlet.id).map((r) => r.text), ["Switch 1 on KIT-01, Main, top half"]);
});

test("halfState says which parts of an outlet a switch controls", () => {
  const { p, plate, outlet } = house();
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: false, top: false, bottom: false });
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "top" }, 2000);
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: false, top: true, bottom: false });
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "" }, 2100);
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: true, top: false, bottom: false });
});
