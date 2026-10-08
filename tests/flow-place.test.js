import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { placedText, addingText, typeChangeWarning, togglesWarning, heightText } from "../src/flow.js";
import { sample } from "./helpers.js";

test("placing says the label large and how full the room is; the banner says what is being added and where", () => {
  const { p, main, kit } = sample();
  const a = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  assert.equal(placedText(p, a), "Placed KIT-01. Kitchen has 1 device");
  const b = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 2, y: 2 }, 1200);
  assert.equal(placedText(p, b), "Placed KIT-02. Kitchen has 2 devices");
  assert.equal(addingText("Duplex outlet", kit), "Adding: Duplex outlet in Kitchen");
  assert.equal(addingText("Duplex outlet", null), "Adding: Duplex outlet. Tap the plan.");
});

test("changing a type warns only when links or a breaker would be lost", () => {
  const { p, main, kit } = sample();
  const place = (type, created) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1 }, created);
  const sw = place("S", 1100), light = place("L", 1200), outlet = place("D", 1300);
  assert.equal(typeChangeWarning(p, outlet, "G"), "");
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1400);
  assert.equal(typeChangeWarning(p, sw, "L"), "KIT-01 stops being a switch. Its 1 link will be removed.");
  assert.equal(typeChangeWarning(p, light, "S"), "KIT-02 becomes a switch. Its 1 link will be removed.");
  assert.equal(typeChangeWarning(p, sw, "DM"), "");
  const panel = m.addPanel(p, { name: "Main" }, 1500);
  const b = m.addBreaker(p, { panelId: panel.id, slots: ["1"], amps: 15 }, 1500);
  m.setBreaker(p, outlet.id, b.id, false, 1600);
  assert.equal(typeChangeWarning(p, outlet, "J"), "Its breaker will be cleared.");
});

test("taking switches off a plate warns when they control something", () => {
  const { p, main, kit } = sample();
  const plate = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1, toggles: 3 }, 1100);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 2, y: 2 }, 1200);
  assert.equal(togglesWarning(p, plate, 2), "");
  m.toggleLink(p, { switchId: plate.id, toggle: 3, loadId: light.id }, 1300);
  assert.equal(togglesWarning(p, plate, 2), "Switch 3 controls 1 device. Taking it off the plate clears that.");
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 1300);
  assert.equal(togglesWarning(p, plate, 1), "The switches being taken off control 2 devices. Taking them off the plate clears that.");
});

test("a height reads in inches, or Ceiling", () => {
  assert.deepEqual([heightText(12), heightText(0), heightText(null)], ["12 in", "0 in", "Ceiling"]);
});
