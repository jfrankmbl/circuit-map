import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { chipText, sendStatus, needsBackup, sizeText, unsent, cameInFrom, importParts, nothingNew, needsCare, fieldWords, changedLine, differentHouse, MOVING } from "../src/sending.js";
import { merge } from "../src/merge.js";
import { sample } from "./helpers.js";

const DAY = 86400000, NOON = new Date(2026, 9, 6, 12).getTime(); // noon on 6 Oct 2026, whatever the time zone

test("the chip says how many changes have not been sent, and is short on a phone", () => {
  assert.deepEqual(chipText(0), { wide: "Nothing new to send", narrow: "Send" });
  assert.deepEqual(chipText(1), { wide: "1 change not sent", narrow: "Send 1" });
  assert.deepEqual(chipText(12), { wide: "12 changes not sent", narrow: "Send 12" });
});

test("the sheet says how much is waiting and when the house was last sent", () => {
  const { p, main, kit } = sample(); // a floor and two rooms
  assert.equal(sendStatus(m.createProject("New", 1), 0, NOON), "Nothing to send yet.");
  assert.equal(sendStatus(p, 0, NOON), "3 changes not sent. This house has not been sent or backed up from this device yet.");
  const sent = NOON - 3 * DAY;
  assert.equal(sendStatus(p, sent, NOON), "Nothing new to send. Last sent 3 Oct 2026, 3 days ago.");
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, sent + 1);
  assert.equal(sendStatus(p, sent, NOON), "1 change not sent. Last sent 3 Oct 2026, 3 days ago.");
});

test("the backup nudge: work that has waited a week, or more than 50 changes, unless he said Later today", () => {
  const p = m.createProject("Home", NOON - 10 * DAY);
  assert.equal(needsBackup(p, 0, 0, NOON), false); // nothing in it
  const floor = m.addFloor(p, "Main", NOON - 6 * DAY);
  assert.equal(needsBackup(p, 0, 0, NOON), false); // never sent, but its oldest change is 6 days old
  assert.equal(needsBackup(p, 0, 0, NOON + 2 * DAY), true);
  assert.equal(needsBackup(p, 0, NOON + 1.5 * DAY, NOON + 2 * DAY), false); // Later, half a day ago
  assert.equal(needsBackup(p, NOON - 5 * DAY, 0, NOON + 2 * DAY), false); // sent since: nothing is waiting
  m.update(p, "floors", floor.id, { name: "Ground" }, NOON - DAY);
  assert.equal(needsBackup(p, NOON - 8 * DAY, 0, NOON), true); // last sent 8 days ago, one change since
  assert.equal(needsBackup(p, NOON - 2 * DAY, 0, NOON), false);
  for (let i = 0; i < 50; i++) m.addFloor(p, `Floor ${i}`, NOON - 1000);
  assert.equal(needsBackup(p, NOON - 2 * DAY, 0, NOON), true); // 51 changes
});

test("a file's size in words", () => {
  assert.deepEqual([sizeText(300), sizeText(40400), sizeText(3240000)], ["1 KB", "40 KB", "3.2 MB"]);
});

test("what came in from a file is not counted as unsent", () => {
  const { p: phone, main, kit, ext } = sample();
  const mac = structuredClone(phone);
  const theirs = m.placeDevice(mac, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 2000);
  m.remove(mac, "rooms", ext.id, 2100);
  const { project } = merge(phone, mac);
  const cameIn = cameInFrom(project, mac);
  assert.equal(unsent(project, 1500), 2); // the new device and the room's deletion
  assert.equal(unsent(project, 1500, cameIn), 0);
  m.update(project, "devices", theirs.id, { note: "mine" }, 3000); // this device's own edit counts
  assert.equal(unsent(project, 1500, cameIn), 1);
});

test("the import question names only what is not zero", () => {
  const s = { added: 12, updated: 0, removed: 0, renumbered: [] };
  assert.deepEqual(importParts(s).map((p) => p.text), ["12 new"]);
  const t = { added: 12, updated: 3, removed: 2, renumbered: [{}, {}] };
  assert.deepEqual(importParts(t).map((p) => [p.key, p.text]),
    [["added", "12 new"], ["updated", "3 changed"], ["removed", "2 deleted"], ["renumbered", "2 relabelled"]]);
  assert.equal(nothingNew({ added: 0, updated: 0, removed: 0, renumbered: [] }), true);
  assert.equal(nothingNew(s), false);
  assert.deepEqual([needsCare(s), needsCare(t), needsCare({ ...s, renumbered: [{}] })], [false, true, false]);
});

test("changed fields are named in his words", () => {
  assert.deepEqual(fieldWords(["heightIn", "note"]), ["height", "note"]);
  assert.deepEqual(fieldWords(["x", "y", "breakerId", "tested", "toggles", "gfciId", "notWorking"]),
    ["position", "breaker", "test result", "number of switches", "GFCI", "Not working"]);
  assert.equal(changedLine({ name: "KIT-03", fields: ["note", "roomId", "wibble"] }), "KIT-03: note, room, wibble");
});

test("a file from a different house says what each side holds", () => {
  const a = { name: "Dad's house", floors: 2, devices: 63 }, b = { name: "My house", floors: 1, devices: 12 };
  assert.equal(differentHouse(b, a),
    "This file is a different house: Dad's house, 2 floors, 63 devices. This device has My house, 1 floor, 12 devices.");
});

test("the Moving your project steps are there for both directions", () => {
  assert.equal(MOVING.phoneToMac.length, 3);
  assert.equal(MOVING.macToPhone.length, 2);
  assert.match(MOVING.tip, /^Tip: finish on one device/);
});

test("the chip adds the plates to rewrite while changes are waiting", () => {
  assert.deepEqual(chipText(12, 2), { wide: "12 not sent, 2 plates", narrow: "Send 12 ✎2" });
  assert.equal(chipText(1, 1).wide, "1 not sent, 1 plate");
  assert.deepEqual(chipText(0, 2), chipText(0));
});
