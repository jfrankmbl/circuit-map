import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { listFiles } from "../tools/stamp.mjs";
import { VERSION } from "../src/version.js";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

// Run sw.js against a fake worker scope and a fake cache storage.
function boot(existing = []) {
  const handlers = {}, stores = new Map(existing.map((n) => [n, new Set()])), fetched = [];
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Set());
      return { addAll: async (files) => files.forEach((f) => stores.get(name).add(f)) };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      const path = new URL(request.url).pathname.replace(/^\//, "") || "./";
      for (const set of stores.values()) if (set.has(path)) return { cached: path };
      return undefined;
    },
  };
  const self = { location: { origin: "https://x.test" }, addEventListener: (type, fn) => { handlers[type] = fn; } };
  vm.runInNewContext(source, { self, caches, URL, Promise, fetch: async (r) => { fetched.push(r.url); return { fetched: r.url }; } });
  const run = async (type, event) => {
    let pending;
    handlers[type]({ ...event, waitUntil: (p) => { pending = p; }, respondWith: (p) => { pending = p; } });
    return pending;
  };
  return { run, stores, fetched, handlers };
}

test("sw.js lists exactly the files on disk, and carries the version of src/version.js", () => {
  const files = JSON.parse(source.match(/const FILES = (\[[\s\S]*?\n\]);/)[1]);
  assert.deepEqual(files, listFiles(), "run: node tools/stamp.mjs");
  assert.equal(Number(source.match(/const VERSION = (\d+);/)[1]), VERSION, "run: node tools/stamp.mjs");
  assert.ok(files.includes("src/app.js") && files.includes("vendor/pdf.js/pdf.min.mjs") && files.includes("manifest.webmanifest"));
});

test("installing saves every file; activating removes older caches and keeps the new one", async () => {
  const w = boot(["circuit-map-v0", "other-site"]);
  await w.run("install", {});
  const files = JSON.parse(source.match(/const FILES = (\[[\s\S]*?\n\]);/)[1]);
  assert.deepEqual([...w.stores.get("circuit-map-v" + VERSION)], files);
  await w.run("activate", {});
  assert.deepEqual([...w.stores.keys()].sort(), ["circuit-map-v" + VERSION, "other-site"]);
});

test("a request is answered from the cache, with no network, even with a query string", async () => {
  const w = boot();
  await w.run("install", {});
  const hit = await w.run("fetch", { request: { method: "GET", url: "https://x.test/src/app.js?sw=1" } });
  assert.deepEqual(hit, { cached: "src/app.js" });
  assert.deepEqual(w.fetched, []);
});

test("other origins and non-GET requests are left alone", async () => {
  const w = boot();
  await w.run("install", {});
  assert.equal(await w.run("fetch", { request: { method: "GET", url: "https://elsewhere.test/a.js" } }), undefined);
  assert.equal(await w.run("fetch", { request: { method: "POST", url: "https://x.test/src/app.js" } }), undefined);
});
