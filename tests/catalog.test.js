import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUPS, TYPES, typeInfo, displayName, isSwitch, hasHalves } from "../src/catalog.js";

test("every type belongs to a known group", () => {
  const groups = GROUPS.map((g) => g[0]);
  for (const [code, t] of Object.entries(TYPES)) assert.ok(groups.includes(t.group), code);
});

test("default heights follow the spec", () => {
  assert.equal(typeInfo("D").heightIn, 12);
  assert.equal(typeInfo("S").heightIn, 48);
  assert.equal(typeInfo("L").heightIn, null);
});

test("unknown type falls back to custom", () => {
  assert.equal(typeInfo("ZZ"), TYPES.X);
});

test("displayName prefers the custom name", () => {
  assert.equal(displayName({ type: "G", customName: "" }), "GFCI outlet");
  assert.equal(displayName({ type: "HA", customName: "Water heater" }), "Water heater");
});

test("only ordinary outlets can be switched in halves", () => {
  assert.equal(hasHalves("D"), true);
  assert.equal(hasHalves("R"), false);
  assert.equal(hasHalves("L"), false);
});

test("switches are not listed in a breaker sweep, outlets and lights are", () => {
  assert.equal(isSwitch("S3"), true);
  assert.equal(typeInfo("S3").sweep, false);
  assert.equal(typeInfo("D").sweep, true);
  assert.equal(typeInfo("RL").sweep, true);
  assert.equal(typeInfo("BP").sweep, false);
});
