import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, FORMAT_VERSION } from "../src/model.js";
import { fileName, serialize, parse } from "../src/file.js";

test("fileName carries the house name and a sortable date and time", () => {
  const p = createProject('Dad\'s "House": 1/2', 1);
  assert.equal(fileName(p, new Date(2026, 9, 6, 14, 5)), "Dad's House 12 2026-10-06 1405.circuitmap");
  p.name = "  ";
  assert.equal(fileName(p, new Date(2026, 0, 2, 3, 4)), "House 2026-01-02 0304.circuitmap");
});

test("serialize then parse gives back the project and its images", () => {
  const p = createProject("Home", 1);
  const images = { img1: "data:image/jpeg;base64,AAAA" };
  const back = parse(serialize(p, images));
  assert.deepEqual(back.project, p);
  assert.deepEqual(back.images, images);
});

test("images default to none", () => {
  const p = createProject("Home", 1);
  assert.deepEqual(parse(JSON.stringify({ app: "circuit-map", project: p })).images, {});
});

const codeOf = (text) => {
  try { parse(text); } catch (e) { return e.code; }
  return "no error";
};

test("bad files are refused with a reason", () => {
  const p = createProject("Home", 1);
  assert.equal(codeOf("not json"), "unreadable");
  assert.equal(codeOf(JSON.stringify({ hello: 1 })), "format");
  assert.equal(codeOf(JSON.stringify({ app: "circuit-map", project: { ...p, devices: "x" } })), "format");
  assert.equal(codeOf(JSON.stringify({ app: "circuit-map", project: { ...p, formatVersion: FORMAT_VERSION + 1 } })), "newer");
});
