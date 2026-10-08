import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { roomSummary, deleteRoomQuestion, codeProblem, mismatchText, refitText, toInches, spotsTooClose } from "../src/flow.js";
import { sample } from "./helpers.js";

test("a room's row counts its devices and says when it has no outline", () => {
  const { p, main, kit, ext } = sample();
  assert.equal(roomSummary(p, kit), "0 devices");
  assert.equal(roomSummary(p, ext), "0 devices, no outline");
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  assert.equal(roomSummary(p, kit), "1 device");
});

test("the delete-room question mentions devices only when there are some", () => {
  const { p, main, kit, ext } = sample();
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  assert.equal(deleteRoomQuestion(p, kit), "Delete Kitchen? It has 1 device.");
  assert.equal(deleteRoomQuestion(p, ext), "Delete Exterior?");
});

test("a label code is checked in words", () => {
  const { p, kit } = sample();
  assert.equal(codeProblem(p, "DEN"), "");
  assert.equal(codeProblem(p, "KIT"), "KIT is already used by Kitchen. Pick another.");
  assert.equal(codeProblem(p, "KIT", kit.id), ""); // its own code is not a clash
  assert.match(codeProblem(p, "k"), /2 to 4 capital letters or numbers/);
  assert.match(codeProblem(p, ""), /2 to 4 capital letters or numbers/);
});

test("the outline review says how many devices no longer match", () => {
  const room = { name: "Kitchen" };
  assert.deepEqual(mismatchText(room, { outside: [1, 2, 3], inside: [1, 2] }),
    { outside: "3 devices are now outside Kitchen.", inside: "2 devices from other rooms are now inside it." });
  assert.deepEqual(mismatchText(room, { outside: [1], inside: [1] }),
    { outside: "1 device is now outside Kitchen.", inside: "1 device from another room is now inside it." });
  assert.deepEqual(mismatchText(room, { outside: [], inside: [] }), { outside: "", inside: "" });
});

test("the line-up says what it moved, and refuses spots closer than a twentieth of the picture's width", () => {
  assert.equal(refitText({ devices: 38, rooms: 4 }), "Moved 38 devices and 4 rooms to fit the new picture.");
  assert.equal(spotsTooClose([0, 0], [100, 0], 3000), true);
  assert.equal(spotsTooClose([0, 0], [150, 0], 3000), false);
});

test("feet and inches boxes add up to inches, and nonsense is nothing", () => {
  assert.equal(toInches("12", "6"), 150);
  assert.equal(toInches("", "30.5"), 30.5);
  assert.deepEqual([toInches("", ""), toInches("-1", ""), toInches("abc", "")], [0, 0, 0]);
});
