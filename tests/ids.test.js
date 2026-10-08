import { test } from "node:test";
import assert from "node:assert/strict";
import { labelNumber, nextLabel, suggestCode, fixLabelCollisions } from "../src/ids.js";

const dev = (id, label, created) => ({ id, label, created });

test("labelNumber reads the trailing number", () => {
  assert.equal(labelNumber("KIT-07"), 7);
  assert.equal(labelNumber("KIT"), 0);
});

test("nextLabel is one past the highest in that code, padded to two digits", () => {
  const project = { devices: [dev("a", "KIT-01"), dev("b", "KIT-09"), dev("c", "KIT2-30"), dev("d", "LIV-04")] };
  assert.equal(nextLabel(project, "KIT"), "KIT-10");
  assert.equal(nextLabel(project, "LIV"), "LIV-05");
  assert.equal(nextLabel(project, "GAR"), "GAR-01");
});

test("suggestCode shortens names and avoids codes already taken", () => {
  assert.equal(suggestCode("Kitchen"), "KIT");
  assert.equal(suggestCode("Guest Bath"), "GB");
  assert.equal(suggestCode("main bedroom closet"), "MBC");
  assert.equal(suggestCode("2nd Bath"), "R2B");
  assert.equal(suggestCode(""), "RM");
  assert.equal(suggestCode("Kitchen", ["KIT"]), "KIT2");
  assert.equal(suggestCode("Kitchen", ["KIT", "KIT2"]), "KIT3");
});

test("fixLabelCollisions renumbers the device created later", () => {
  const project = { devices: [dev("b", "KIT-02", 200), dev("a", "KIT-02", 100), dev("c", "KIT-01", 50)] };
  const changes = fixLabelCollisions(project);
  assert.deepEqual(changes, [{ id: "b", from: "KIT-02", to: "KIT-03", keptId: "a" }]);
  assert.equal(project.devices.find((d) => d.id === "b").plateLabel, "KIT-02");
  assert.equal(project.devices.find((d) => d.id === "a").label, "KIT-02");
  assert.equal(project.devices.find((d) => d.id === "b").label, "KIT-03");
});

test("fixLabelCollisions handles a three-way collision", () => {
  const project = { devices: [dev("a", "KIT-01", 1), dev("b", "KIT-01", 2), dev("c", "KIT-01", 3)] };
  fixLabelCollisions(project);
  assert.deepEqual(project.devices.map((d) => d.label), ["KIT-01", "KIT-02", "KIT-03"]);
});
