import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { searchDevices, listByRoom, circuitText, switchLines, switchedBy, titleText, plateRow } from "../src/browse.js";
import { sample } from "./helpers.js";

function house() {
  const s = sample();
  const { p, main, kit, ext } = s;
  const place = (roomId, type, created, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId, type, x: 1, y: 1, ...extra }, created);
  const sw = place(kit.id, "S", 1100, { toggles: 2 });
  const light = place(kit.id, "L", 1200);
  const outlet = place(kit.id, "D", 1300);
  const flood = place(ext.id, "FL", 1400);
  const pump = place(ext.id, "X", 1500, { customName: "Sump pump" });
  m.update(p, "devices", outlet.id, { note: "behind the fridge" }, 1600);
  return { ...s, sw, light, outlet, flood, pump };
}

const labels = (list) => list.map((d) => d.label);

test("search looks in label, type, room, name and note; every word must match; a group narrows it", () => {
  const { p } = house();
  assert.deepEqual(labels(searchDevices(p, "")), ["KIT-01", "KIT-02", "KIT-03", "EXT-01", "EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "kit-02")), ["KIT-02"]);
  assert.deepEqual(labels(searchDevices(p, "FRIDGE")), ["KIT-03"]);
  assert.deepEqual(labels(searchDevices(p, "exterior")), ["EXT-01", "EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "sump")), ["EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "kitchen light")), ["KIT-02"]);
  assert.deepEqual(labels(searchDevices(p, "garage")), []);
  assert.deepEqual(labels(searchDevices(p, "", "light")), ["KIT-02", "EXT-01"]);
  assert.deepEqual(labels(searchDevices(p, "", "other")), ["EXT-02"]); // "Other" includes things he named himself
  assert.deepEqual(labels(searchDevices(p, "kit", "outlet")), ["KIT-03"]);
});

test("the list is grouped by floor then room by name, labels in number order, no room last", () => {
  const { p, main, kit } = house();
  for (let i = 0; i < 8; i++) m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 2000 + i);
  const loose = p.devices.at(-1);
  m.setRoom(p, loose.id, "", false, 3000);
  const groups = listByRoom(p, p.devices);
  assert.deepEqual(groups.map((g) => [g.floorName, g.roomName]), [["Main", "Exterior"], ["Main", "Kitchen"], ["Main", "No room"]]);
  assert.deepEqual(labels(groups[1].devices).slice(-2), ["KIT-09", "KIT-10"]);
  assert.deepEqual(labels(groups[2].devices), ["KIT-11"]);
  assert.deepEqual(listByRoom(p, []), []);
});

test("the breaker line says what is known and how sure", () => {
  const { p, outlet, light } = house();
  assert.equal(circuitText(p, outlet), "Not known");
  const panel = m.addPanel(p, { name: "Main panel" }, 2000);
  const b = m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 20, label: "Kitchen" }, 2000);
  m.setBreaker(p, outlet.id, b.id, false, 2100);
  m.setBreaker(p, light.id, b.id, true, 2100);
  assert.equal(circuitText(p, outlet), "Breaker 7 (Kitchen), guess");
  assert.equal(circuitText(p, light), "Breaker 7 (Kitchen), tested");
});

test("a switch plate is described one switch at a time, and a load by what switches it", () => {
  const { p, main, kit, sw, light, outlet } = house();
  assert.deepEqual(switchLines(p, sw).map((s) => s.text), ["Switch 1: nothing recorded yet.", "Switch 2: nothing recorded yet."]);
  const other = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S3", x: 1, y: 1 }, 2000);
  m.toggleLink(p, { switchId: sw.id, toggle: 1, loadId: light.id }, 2100);
  m.toggleLink(p, { switchId: other.id, toggle: 1, loadId: light.id }, 2100);
  m.toggleLink(p, { switchId: sw.id, toggle: 2, loadId: outlet.id, loadPart: "top" }, 2100);
  const lines = switchLines(p, sw);
  assert.equal(lines[0].text, "Switch 1 controls KIT-02. Also switched from KIT-04 (Kitchen), switch 1.");
  assert.equal(lines[1].text, "Switch 2 controls KIT-03 (top half).");
  assert.deepEqual(lines[0].loads.map((l) => l.id), [light.id]);
  assert.deepEqual(switchedBy(p, light).map((s) => s.text), ["KIT-01, switch 1 (Main)", "KIT-04, switch 1 (Main)"]);
  assert.deepEqual(switchedBy(p, outlet).map((s) => s.text), ["KIT-01, switch 2 (Main), top half"]);
  assert.deepEqual(switchedBy(p, sw), []);
});

test("a device whose plate is out of date says so, and its row says what to write", () => {
  const { p, kit, flood } = house();
  assert.equal(titleText(flood), "EXT-01");
  m.setRoom(p, flood.id, kit.id, true, 2000);
  assert.equal(titleText(flood), "KIT-04 (plate says EXT-01)");
  assert.deepEqual(plateRow(p, flood), { todo: "Write KIT-04 on this plate", what: "Flood light, Kitchen, Main", why: "It says EXT-01." });
});

test("a plate row offers Swap labels when another device already uses the old label", () => {
  const { p, kit, flood } = house();
  m.setRoom(p, flood.id, kit.id, true, 2000);
  const clash = m.placeDevice(p, { floorId: flood.floorId, roomId: m.find(p, "rooms", m.find(p, "devices", flood.id).roomId).id, type: "D", x: 3, y: 3 }, 2100);
  m.update(p, "devices", clash.id, { label: "EXT-01" }, 2200);
  const row = plateRow(p, m.find(p, "devices", flood.id));
  assert.equal(row.otherId, clash.id);
  assert.equal(row.why, "It says EXT-01, and another duplex outlet in Kitchen already uses EXT-01.");
  assert.equal(row.swap, "This one keeps EXT-01; the other duplex outlet becomes KIT-04");
  m.swapLabels(p, flood.id, clash.id, 2300);
  assert.deepEqual([m.find(p, "devices", flood.id).label, m.find(p, "devices", clash.id).plateLabel], ["EXT-01", "EXT-01"]);
});
