import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { spaceName, breakerName, breakerTitle, columns, panelCells, enteredText, nextOpenSpace, pairChoices, findBreakers,
  breakerSummary, feedChoices, powerOutCard, whereChoices } from "../src/panel.js";
import { circuitText } from "../src/browse.js";
import { sample } from "./helpers.js";

// A 12-space panel: breaker 1, a double on 2/4, a tandem in 3, space 5 empty.
function house() {
  const s = sample();
  const { p } = s;
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 12 }, 1100);
  const add = (slots, amps, label, kind) => m.addBreaker(p, { panelId: panel.id, slots, amps, label, kind }, 1200);
  const b1 = add(["1"], 15, "Kitchen lights");
  const pair = add(["2", "4"], 30, "Dryer");
  const top = add(["3a"], 15, "Hall");
  const bottom = add(["3b"], 15, "");
  const empty = add(["5"], 0, "", "empty");
  return { ...s, panel, b1, pair, top, bottom, empty };
}

test("spaces and breakers are named in his words", () => {
  const { b1, pair, top, bottom } = house();
  assert.deepEqual(["7", "7a", "7b"].map(spaceName), ["7", "7 top", "7 bottom"]);
  assert.deepEqual([b1, pair, top].map(breakerName), ["1", "2/4", "3 top"]);
  assert.equal(breakerTitle(b1), "Breaker 1 (Kitchen lights)");
  assert.equal(breakerTitle(bottom), "Breaker 3 bottom");
});

test("the two columns follow the panel's numbering", () => {
  assert.deepEqual(columns({ slotCount: 6, numbering: "oddEven" }), [[1, 3, 5], [2, 4, 6]]);
  assert.deepEqual(columns({ slotCount: 6, numbering: "down" }), [[1, 2, 3], [4, 5, 6]]);
  assert.deepEqual(columns({ slotCount: 5, numbering: "down" }), [[1, 2, 3], [4, 5]]);
});

test("the picture: singles, a double across two spaces, a tandem, an empty space, and spaces to add", () => {
  const { p, panel, pair, top, bottom } = house();
  const [left, right] = panelCells(p, panel);
  assert.deepEqual(left.map((c) => c.kind), ["single", "tandem", "empty", "todo", "todo", "todo"]);
  assert.deepEqual(right.map((c) => [c.kind, c.numbers, c.span]), [["double", [2, 4], 2], ["todo", [6], 1], ["todo", [8], 1], ["todo", [10], 1], ["todo", [12], 1]]);
  assert.deepEqual([left[1].top.id, left[1].bottom.id, left[1].span], [top.id, bottom.id, 2]);
  assert.equal(right[0].breaker.id, pair.id);
  // Under the other numbering 2 and 4 are no longer next to each other: the double shows in both, to be fixed.
  m.setNumbering(p, panel.id, "down", 2000);
  assert.deepEqual(panelCells(p, panel)[0].map((c) => c.kind), ["single", "single", "tandem", "single", "empty", "todo"]);
});

test("spaces entered, the next space to enter, and which spaces can pair", () => {
  const { p, panel } = house();
  assert.equal(enteredText(p, panel), "5 of 12 spaces entered");
  assert.deepEqual([nextOpenSpace(p, panel, 0), nextOpenSpace(p, panel, 6), nextOpenSpace(p, panel, 12)], [6, 7, 6]);
  assert.deepEqual(pairChoices(p, panel, 7), [9]);   // 5 is taken
  assert.deepEqual(pairChoices(p, panel, 6), [8]);   // 4 is taken
  assert.deepEqual(pairChoices(p, panel, 12), [10]);
});

test("a breaker is found by its space number or its label", () => {
  const { p, b1, pair, top, bottom } = house();
  const ids = (q) => findBreakers(p, q).map((r) => r.breaker.id);
  assert.deepEqual(ids("2"), [pair.id]);
  assert.deepEqual(ids("3"), [top.id, bottom.id]);
  assert.deepEqual(ids("kitchen"), [b1.id]);
  assert.deepEqual([ids(""), ids("5"), ids("garage")], [[], [], []]); // an empty space is not a breaker
  assert.equal(findBreakers(p, "dryer")[0].panel.name, "Main panel");
});

test("a breaker's summary counts what is on it by kind, and what it reaches through a subpanel", () => {
  const { p, main, kit, panel, b1, pair } = house();
  const place = (type, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, ...extra }, 1300);
  assert.equal(breakerSummary(p, b1.id).text, "");
  for (const d of [place("D"), place("L"), place("X", { customName: "Sump pump" })]) m.setBreaker(p, d.id, b1.id, true, 1400);
  assert.equal(breakerSummary(p, b1.id).text, "3 devices: 1 outlet, 1 light, 1 something else");
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 6 }, 1500);
  m.setFedFrom(p, sub.id, pair.id, 1500);
  const s1 = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20, label: "Garage" }, 1500);
  m.setBreaker(p, place("D").id, s1.id, false, 1600);
  const sum = breakerSummary(p, pair.id);
  assert.deepEqual([sum.text, sum.more, sum.feeds.map((f) => f.name), sum.downstream.length], ["", "and 1 more through Garage subpanel", ["Garage subpanel"], 1]);
  // What can feed a panel: breakers in other panels, but never one the panel itself feeds.
  assert.deepEqual(feedChoices(p, panel.id), []);
  assert.deepEqual(feedChoices(p, sub.id).map((c) => c.text),
    ["1 Kitchen lights 15 A, Main panel", "2/4 Dryer 30 A, Main panel", "3 top Hall 15 A, Main panel", "3 bottom (no label) 15 A, Main panel"]);
  assert.equal(circuitText(p, p.devices.at(-1)), "Breaker 1 (Garage), guess");
});

test("the power-out card: what to check first, the likely breaker and how sure, and what is unknown", () => {
  const { p, main, kit, ext, b1, pair } = house();
  const place = (type) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1 }, 1300);
  const sw = place("S"), light = place("L"), outlet = place("D"), gfci = place("G"), stray = place("D");
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1400);
  m.setProtection(p, outlet.id, gfci.id, 1400);
  m.setBreaker(p, outlet.id, b1.id, true, 1500);
  m.setBreaker(p, light.id, b1.id, false, 1500);
  let card = powerOutCard(p, { roomId: kit.id });
  assert.equal(card.title, "Kitchen has no power");
  assert.deepEqual(card.check, ["KIT-04 protects 1 device: press Reset.", "KIT-01: is it on?"]);
  assert.deepEqual([card.likely.title, card.likely.sure, card.likely.kindLine, card.likely.subLine], ["Breaker 1 (Kitchen lights), 15 A", "1 tested, 1 guessed", "", ""]);
  assert.deepEqual([card.also, card.unknown, card.none], [[], "2 devices in this room have no breaker recorded.", ""]);
  // A second breaker, a GFCI breaker, and "not working".
  m.update(p, "breakers", b1.id, { kind: "GFCI" }, 1600);
  m.setBreaker(p, stray.id, pair.id, false, 1600);
  m.setNotWorking(p, gfci.id, true, 1600);
  card = powerOutCard(p, { roomId: kit.id });
  assert.equal(card.likely.kindLine, "It is a GFCI breaker: press the Test button on it, then switch it Off and On.");
  assert.deepEqual(card.also.map((a) => a.text), ["Also: Breaker 2/4 (Dryer), 30 A, 1 device"]);
  assert.equal(card.check.at(-1), "KIT-04 is marked Not working.");
  assert.equal(card.unknown, "");
  // Nothing known; one device; a breaker on a subpanel.
  assert.equal(powerOutCard(p, { roomId: ext.id }).none, "No breaker is recorded for this room yet. Try a room next to it, or test your breakers to find out.");
  assert.equal(powerOutCard(p, { deviceId: outlet.id }).title, "KIT-03 has no power");
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 6 }, 1700);
  m.setFedFrom(p, sub.id, pair.id, 1700);
  const s1 = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20 }, 1700);
  m.setBreaker(p, outlet.id, s1.id, true, 1800);
  assert.equal(powerOutCard(p, { deviceId: outlet.id }).likely.subLine,
    "This is on Garage subpanel, which is fed by breaker 2/4 in Main panel. If the whole subpanel is off, check that one first.");
});

test("Where? offers the rooms by floor, the last one asked first, and devices by label when he types", () => {
  const { p, main, kit } = house();
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1300);
  assert.deepEqual(whereChoices(p).map((c) => c.text), ["Exterior, Main", "Kitchen, Main"]);
  assert.deepEqual(whereChoices(p, "", kit.id).map((c) => c.text), ["Kitchen, Main", "Exterior, Main"]);
  const hits = whereChoices(p, "kit");
  assert.deepEqual(hits.map((c) => c.text), ["Kitchen, Main", "KIT-01, Duplex outlet"]);
  assert.deepEqual([!!hits[0].roomId, !!hits[1].deviceId], [true, true]);
});
