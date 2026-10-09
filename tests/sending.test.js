import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { chipText, sendStatus, needsBackup, sizeText } from "../src/sending.js";
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
