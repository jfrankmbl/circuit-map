import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject } from "../src/model.js";
import { memoryStore } from "../src/store.js";

test("the in-memory store keeps a copy of the project, settings and pictures", async () => {
  const store = memoryStore();
  assert.equal(await store.loadProject(), null);
  const p = createProject("Home", 1);
  await store.saveProject(p);
  p.name = "Changed after saving";
  assert.equal((await store.loadProject()).name, "Home");
  assert.equal(await store.getSetting("lastExport", 0), 0);
  await store.setSetting("lastExport", 99);
  assert.equal(await store.getSetting("lastExport", 0), 99);
  await store.putImage("a", "picture a");
  await store.putImage("b", "picture b");
  await store.pruneImages(["b"]);
  assert.deepEqual([await store.getImage("a"), await store.getImage("b")], [null, "picture b"]);
});
