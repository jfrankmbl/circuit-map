import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { roomsText, doorCard, fullList, printRecord, printedStatus } from "../src/printing.js";
import { sample } from "./helpers.js";

const DAY = new Date(2026, 9, 6, 12).getTime(); // noon on 6 Oct 2026, whatever the time zone

// A 12-space panel: breaker 1 (two kitchen outlets tested, a hall light guessed), a double on 2/4 (a flood light),
// a tandem in 3 with only its top entered, space 5 empty, a GFCI breaker in 6.
function house() {
  const s = sample();
  const { p, main, kit, ext } = s;
  const hall = m.addRoom(p, { floorId: main.id, name: "Hall", code: "HAL" }, 1000);
  const place = (roomId, type) => m.placeDevice(p, { floorId: main.id, roomId, type, x: 1, y: 1 }, 1100);
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 12 }, 1200);
  const add = (slots, amps, label, kind) => m.addBreaker(p, { panelId: panel.id, slots, amps, label, kind }, 1200);
  const b1 = add(["1"], 15, "Kitchen"), pair = add(["2", "4"], 30, "Dryer"), top = add(["3a"], 15, "Hall");
  const empty = add(["5"], 0, "", "empty"), gfi = add(["6"], 20, "Counter", "GFCI");
  const a = place(kit.id, "D"), b = place(kit.id, "D"), light = place(hall.id, "L"), flood = place(ext.id, "FL");
  m.setBreaker(p, a.id, b1.id, true, 1300);
  m.setBreaker(p, b.id, b1.id, true, 1300);
  m.setBreaker(p, light.id, b1.id, false, 1300);
  m.setBreaker(p, flood.id, pair.id, true, 1300);
  return { ...s, hall, place, panel, b1, pair, top, empty, gfi, a, b, light, flood };
}

const blank = (number) => ({ number, label: "", facts: "", rooms: "" });

test("the rooms on a breaker: most devices first, three at most, and ? when any is a guess", () => {
  const { p, main, place, b1, pair, top } = house();
  assert.deepEqual([roomsText(p, b1), roomsText(p, pair), roomsText(p, top)], ["Kitchen, Hall ?", "Exterior", ""]);
  for (const [name, code] of [["Office", "OFF"], ["Bath", "BTH"], ["Den", "DEN"]]) {
    const room = m.addRoom(p, { floorId: main.id, name, code }, 1400);
    m.setBreaker(p, place(room.id, "D").id, b1.id, true, 1400);
  }
  assert.equal(roomsText(p, b1), "Kitchen, Bath, Den +2 more ?");
  // A device whose room has been deleted is still a guess to flag.
  const closet = m.addRoom(p, { floorId: main.id, name: "Closet", code: "CLO" }, 1500);
  m.setBreaker(p, place(closet.id, "D").id, top.id, false, 1500);
  m.removeRoom(p, closet.id, {}, 1500);
  assert.equal(roomsText(p, top), "?");
});

test("the door card is the panel in two columns, with a heading", () => {
  const { p, panel } = house();
  const card = doorCard(p, panel, DAY);
  assert.deepEqual([card.house, card.panel, card.fedFrom, card.printed, card.legend, card.wide],
    ["Dad's house", "Main panel", "", "Printed 6 Oct 2026", "? = not confirmed by testing yet", false]);
  const [left, right] = card.columns;
  assert.deepEqual(left, [
    { kind: "single", lines: [{ number: "1", label: "Kitchen", facts: "15 A", rooms: "Kitchen, Hall ?" }] },
    { kind: "tandem", lines: [{ number: "3 top", label: "Hall", facts: "15 A", rooms: "" }, blank("3 bottom")] },
    { kind: "empty", lines: [{ ...blank("5"), label: "empty" }] },
    { kind: "todo", lines: [blank("7")] },
    { kind: "todo", lines: [blank("9")] },
    { kind: "todo", lines: [blank("11")] },
  ]);
  assert.deepEqual(right.slice(0, 2), [
    { kind: "double", lines: [{ number: "2/4", label: "Dryer", facts: "30 A, 240 V", rooms: "Exterior" }] },
    { kind: "single", lines: [{ number: "6", label: "Counter", facts: "20 A, GFCI", rooms: "" }] },
  ]);
  assert.deepEqual(right.slice(2).map((c) => c.lines[0].number), ["8", "10", "12"]);
});

test("a subpanel says what feeds it, and a panel of more than 30 spaces uses the whole page", () => {
  const { p, pair } = house();
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 40 }, 1400);
  m.setFedFrom(p, sub.id, pair.id, 1400);
  const card = doorCard(p, sub, DAY);
  assert.deepEqual([card.fedFrom, card.wide], ["Fed from breaker 2/4 in Main panel", true]);
  assert.equal(roomsText(p, pair), "Feeds Garage subpanel. Exterior");
});

test("the full list has every device on each breaker, and says which are guesses", () => {
  const { p, panel, pair, flood } = house();
  assert.deepEqual(fullList(p, panel), [
    { title: "Breaker 1 (Kitchen), 15 A", none: "", rows: [
      { label: "HAL-01", type: "Ceiling light", room: "Hall", guess: "guess" },
      { label: "KIT-01", type: "Duplex outlet", room: "Kitchen", guess: "" },
      { label: "KIT-02", type: "Duplex outlet", room: "Kitchen", guess: "" },
    ] },
    { title: "Breaker 2/4 (Dryer), 30 A, 240 V", none: "", rows: [{ label: "EXT-01", type: "Flood light", room: "Exterior", guess: "" }] },
    { title: "Breaker 3 top (Hall), 15 A", none: "Nothing found on this breaker yet.", rows: [] },
    { title: "Breaker 6 (Counter), 20 A, GFCI", none: "Nothing found on this breaker yet.", rows: [] },
  ]);
  // With more than one floor a room is given with its floor. A breaker that feeds a subpanel says so.
  m.addFloor(p, "Upstairs", 1400);
  m.setBreaker(p, flood.id, "", false, 1400);
  m.setFedFrom(p, m.addPanel(p, { name: "Garage subpanel" }, 1400).id, pair.id, 1400);
  const list = fullList(p, panel);
  assert.equal(list[0].rows[0].room, "Hall, Main");
  assert.equal(list[1].none, "Feeds Garage subpanel. Its devices are on that panel's own list.");
});

test("last printed, and how many breakers have changed on the card since", () => {
  const { p, panel, b1, gfi, a, light } = house();
  assert.deepEqual(printedStatus(p, panel, undefined), { last: "", changed: "" });
  const record = printRecord(p, panel, DAY);
  assert.deepEqual(printedStatus(p, panel, record), { last: "Last printed 6 Oct 2026", changed: "" });
  // A change that does not show on the card does not count.
  m.update(p, "devices", a.id, { note: "loose" }, 2000);
  assert.equal(printedStatus(p, panel, record).changed, "");
  m.setBreaker(p, light.id, b1.id, true, 2000); // the "?" goes from breaker 1
  assert.equal(printedStatus(p, panel, record).changed, "1 breaker changed since. Print again?");
  m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 15, label: "Bath" }, 2100);
  m.remove(p, "breakers", gfi.id, 2200);
  assert.equal(printedStatus(p, panel, record).changed, "3 breakers changed since. Print again?");
});
