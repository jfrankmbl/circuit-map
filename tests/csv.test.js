import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { devicesCsv, breakersCsv } from "../src/csv.js";
import { sample } from "./helpers.js";

test("one row per device, sorted by label, with circuit and switching", () => {
  const { p, main, kit, ext } = sample();
  const sw = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1 }, 1);
  const outlet = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 2, y: 2 }, 2);
  const flood = m.placeDevice(p, { floorId: main.id, roomId: ext.id, type: "FL", x: 3, y: 3 }, 3);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "top" }, 4);
  m.toggleLink(p, { switchId: sw.id, loadId: flood.id }, 4);
  const panel = m.addPanel(p, { name: "Main panel" }, 5);
  const pair = m.addBreaker(p, { panelId: panel.id, slots: ["13", "15"], amps: 30 }, 5);
  m.setBreaker(p, outlet.id, pair.id, true, 6);
  m.setBreaker(p, flood.id, pair.id, false, 6);
  m.update(p, "devices", outlet.id, { note: 'says "kitchen", loose' }, 7);

  const lines = devicesCsv(p).split("\r\n");
  assert.equal(lines[0], "label,floor,room,type,height_in,panel,breaker,breaker_label,amps,tested,controls,switched_by,behind_gfci,not_working,note");
  assert.equal(lines[1], "EXT-01,Main,Exterior,Flood light,,Main panel,13/15,,30,guess,,KIT-01,,,");
  assert.equal(lines[2], "KIT-01,Main,Kitchen,Switch,48,,,,,,KIT-02 top EXT-01,,,,");
  assert.equal(lines[3], 'KIT-02,Main,Kitchen,Duplex outlet,12,Main panel,13/15,,30,yes,,KIT-01,,,"says ""kitchen"", loose"');
  assert.equal(lines[4], "");
  assert.equal(lines.length, 5);
});

test("breakers list: label, size, how many devices and how sure, and what feeds a subpanel", () => {
  const { p, main, kit } = sample();
  const outlet = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 2, y: 2 }, 2);
  const panel = m.addPanel(p, { name: "Main panel" }, 3);
  const dryer = m.addBreaker(p, { panelId: panel.id, slots: ["13", "15"], amps: 30, label: 'Dryer, "big"' }, 3);
  m.setBreaker(p, outlet.id, dryer.id, true, 4);
  m.setBreaker(p, light.id, dryer.id, false, 4);
  const sub = m.addPanel(p, { name: "Garage" }, 5);
  m.setFedFrom(p, sub.id, dryer.id, 5);
  m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20, label: "Lights" }, 6);
  const lines = breakersCsv(p).split("\r\n");
  assert.equal(lines[0], "panel,spaces,amps,type,label,devices_on_it,tested,guessed,fed_from");
  assert.equal(lines[1], 'Main panel,13/15,30,standard,"Dryer, ""big""",2,1,1,');
  assert.equal(lines[2], "Garage,1,20,standard,Lights,0,0,0,Main panel 13/15");
  assert.equal(lines.length, 4);
});

test("labels sort by number, and text that looks like a formula is defused", () => {
  const { p, main, kit } = sample();
  for (let i = 0; i < 10; i++) m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: i, y: 0 }, i);
  m.update(p, "devices", p.devices[0].id, { note: "=SUM(A1)" }, 20);
  const lines = devicesCsv(p).split("\r\n");
  assert.ok(lines[1].startsWith("KIT-01,"));
  assert.ok(lines[1].endsWith(",'=SUM(A1)"));
  assert.ok(lines[2].startsWith("KIT-02,"));
  assert.ok(lines[10].startsWith("KIT-10,"));
});
