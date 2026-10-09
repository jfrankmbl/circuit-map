import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { newSession, joinLabels, progressText, testHeader, stepCounts, canTest, hasConflict, conflictText, markDead, unmark,
  reconcile, alsoProtected, roomToMark, stillAssigned, finishSummary, nextToTest } from "../src/testing.js";
import { sample } from "./helpers.js";

// Kitchen: a switch, a light, two outlets and a GFCI outlet. A panel with breakers 1, 2 and 3.
function house() {
  const s = sample();
  const { p, main, kit } = s;
  const place = (type) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1 }, 1100);
  const sw = place("S"), light = place("L"), a = place("D"), b = place("D"), gfci = place("G");
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 12 }, 1200);
  const add = (slot, label) => m.addBreaker(p, { panelId: panel.id, slots: [slot], amps: 15, label }, 1200);
  const b1 = add("1", "Kitchen"), b2 = add("2", "Bath"), b3 = add("3", "");
  return { ...s, sw, light, a, b, gfci, panel, b1, b2, b3 };
}

test("labels join the way a person would say them", () => {
  assert.deepEqual([joinLabels([]), joinLabels(["A"]), joinLabels(["A", "B"]), joinLabels(["A", "B", "C"])], ["", "A", "A and B", "A, B and C"]);
});

test("the header names the breaker and says how far the testing has got", () => {
  const { p, main, kit, b1, b2, panel } = house();
  const head = testHeader(p, b1);
  assert.deepEqual([head.title, head.breakers, head.devices], ["Breaker 1, Kitchen, 15 A", "Breakers tested: 0 of 3", "0 of 4 devices have a breaker"]);
  m.markSwept(p, b1.id, 2000);
  assert.equal(progressText(p), "Breakers tested: 1 of 3");
  // An empty space and a breaker that feeds a subpanel are not tested, so they are not counted.
  m.addBreaker(p, { panelId: panel.id, slots: ["5"], amps: 0, kind: "empty" }, 2100);
  const sub = m.addPanel(p, { name: "Garage", slotCount: 6 }, 2100);
  m.setFedFrom(p, sub.id, b2.id, 2100);
  assert.equal(progressText(p), "Breakers tested: 1 of 2");
  assert.deepEqual(nextToTest(p).label, "");            // breaker 3; breaker 2 feeds a subpanel
  // A device with no breaker added after a test makes tested breakers count as untested again.
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 3000);
  assert.equal(progressText(p), "Breakers to test: 2. New devices added.");
});

test("steps 1 and 2 say how many switches and GFCI outlets are recorded", () => {
  const { p } = house();
  assert.deepEqual(stepCounts(p), { switches: 1, gfcis: 1, switchText: "1 recorded", gfciText: "1 recorded" });
  const empty = m.createProject("Empty", 1);
  assert.deepEqual([stepCounts(empty).switchText, canTest(empty), canTest(p)], ["None recorded", false, true]);
});

test("marking sets the breaker as tested and remembers what was there; unmarking puts it back", () => {
  const { p, light, a, b1, b2 } = house();
  m.setBreaker(p, a.id, b2.id, false, 1300); // a guess
  const t = newSession(b1.id);
  markDead(p, t, light.id, 2000);
  markDead(p, t, a.id, 2000);
  assert.deepEqual([light.breakerId, light.tested, a.breakerId, a.tested], [b1.id, true, b1.id, true]);
  assert.deepEqual(t.dead, { [light.id]: { breakerId: "", tested: false }, [a.id]: { breakerId: b2.id, tested: false } });
  unmark(p, t, a.id, 2100);
  assert.deepEqual([a.breakerId, a.tested, Object.keys(t.dead)], [b2.id, false, [light.id]]);
  // If Undo took a mark back in the project, the session forgets it too.
  m.setBreaker(p, light.id, "", false, 2200);
  reconcile(p, t);
  assert.deepEqual(t.dead, {});
});

test("a device an earlier test found on another breaker is a conflict; a guess is not", () => {
  const { p, a, b, b1, b2 } = house();
  m.setBreaker(p, a.id, b2.id, true, 1300);
  m.setBreaker(p, b.id, b2.id, false, 1300);
  const t = newSession(b1.id);
  assert.deepEqual([hasConflict(p, a, t), hasConflict(p, b, t)], [true, false]);
  assert.equal(conflictText(p, a, t), "KIT-03 was dead when breaker 2 was off too. Move it to breaker 1?");
});

test("a GFCI outlet offers what it protects, and a room offers everything not yet marked", () => {
  const { p, light, a, b, gfci, b1, b2 } = house();
  m.setProtection(p, a.id, gfci.id, 1300);
  m.setProtection(p, b.id, gfci.id, 1300);
  const t = newSession(b1.id);
  markDead(p, t, a.id, 2000);
  assert.deepEqual(alsoProtected(p, t, gfci), [b.id]);
  const room = m.sweepList(p, b1.id)[0];
  assert.deepEqual(roomToMark(p, t, room), [light.id, b.id, gfci.id]);
  m.setBreaker(p, b.id, b2.id, true, 2100); // found on another breaker: it has to be asked about, one at a time
  assert.deepEqual(roomToMark(p, t, room), [light.id, gfci.id]);
  assert.deepEqual(alsoProtected(p, t, gfci), []);
});

test("still assigned: devices on this breaker that had power, on the floors he walked", () => {
  const { p, main, light, a, b, b1 } = house();
  m.setBreaker(p, light.id, b1.id, false, 1300);
  m.setBreaker(p, a.id, b1.id, true, 1300);
  m.setBreaker(p, b.id, b1.id, false, 1300);
  const t = newSession(b1.id);
  markDead(p, t, b.id, 2000);
  assert.deepEqual(stillAssigned(p, t), { guessed: [], tested: [], text: "" }); // no floor ticked yet
  t.floors = [main.id];
  let left = stillAssigned(p, t);
  assert.deepEqual([left.guessed.map((d) => d.label), left.tested.map((d) => d.label)], [["KIT-02"], ["KIT-03"]]);
  assert.equal(left.text, "KIT-02 and KIT-03 were put on breaker 1 but still had power.");
  t.kept = [a.id];
  left = stillAssigned(p, t);
  assert.deepEqual([left.tested, left.text], [[], "KIT-02 was put on breaker 1 but still had power."]);
});

test("the summary lists what was found, which guesses were wrong, and how many breakers are left", () => {
  const { p, light, a, b1, b2 } = house();
  m.setBreaker(p, a.id, b2.id, false, 1300);
  const t = newSession(b1.id);
  assert.equal(finishSummary(p, t).found, "Nothing was found on breaker 1.");
  markDead(p, t, a.id, 2000);
  markDead(p, t, light.id, 2000);
  m.markSwept(p, b1.id, 2100);
  assert.deepEqual(finishSummary(p, t), {
    found: "2 devices found on breaker 1: KIT-02, KIT-03",
    guesses: ["KIT-03 was your guess of breaker 2"],
    left: 2,
  });
  assert.equal(nextToTest(p, b1.id).id, b2.id);
});
