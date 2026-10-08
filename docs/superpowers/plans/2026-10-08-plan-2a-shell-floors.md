# Circuit Map Plan 2a: App Shell and Floors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page that opens in a browser, starts a new house (or adopts a project file), adds floors with a picture each, shows the picture with pan and zoom, undoes changes, and keeps everything on the device between visits.

**Architecture:** `index.html` loads `src/app.js`, which owns one `app` object: the project, the store, the undo history and a shared plan view. Each tab is a function `view(app)` that returns a DOM element and is called again after every change; all edits go through `app.commit(name, fn)`, which snapshots for Undo, runs `fn(project)` (calls into `model.js`), saves and redraws. Anything that can be worked out without a browser (undo history, zoom maths, wording, picture sizing) lives in a DOM-free module with `node --test` tests; the DOM modules are checked by hand in a browser.

**Tech Stack:** Plain JavaScript ES modules, no build step, no dependencies. SVG for the plan, IndexedDB for storage, `<dialog>` for sheets. Node 22 for tests and a small static server.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (First launch; Screens > Setup; Using it; Saving, first bullet).

**Roadmap.** The original Plan 2 (shell, store, plan view, Setup, Place, Browse) is too much for one plan, so it is split. Each part leaves something that works:

| Plan | Delivers |
|---|---|
| 1 (done) | `catalog`, `model`, `ids`, `merge`, `file`, `csv` with unit tests |
| 2a (this) | Shell, store, undo, plan view, first launch, Floors (add, rename, reorder, picture, delete), a Map tab that shows the plan |
| 2b | Rooms (trace, edit outline, room page, delete, review list), Scale, Replace picture with the two-spot line-up (`refitFloor`) |
| 2c | Place: the Add tab, markers, marker sheet, Move |
| 2d | Browse: search, filters, details, list, Key |
| 3 | Link, Panel (with printable directory), Test, CSV button |
| 4 | Export / Import screens, PDF underlay, offline cache and update banner, manifest and icons, Home Screen card, GitHub Pages deploy |

**Left for later plans on purpose** (do not add them here): the Scale and Rooms parts of a floor's page and Replace picture on a floor that has rooms or devices (2b); the Add, Switches and Breakers tabs (2c, 3); PDF pictures, "Save a copy first", the Home Screen card, the header chip (4).

**Conventions for every task**

- Work on a branch: `git checkout -b plan-2a-shell` before Task 1.
- Run tests from the repo root, `C:\Users\Josh\Documents\circuit-map`: `node --test`
- Views never change the project directly. They call `app.commit("what happened", (p) => m.something(p, ...))`. The name finishes the sentence "Undo: ..." and "Undone: ...", so it is lower case and past tense ("added Basement").
- Text typed by the user is only ever added to the page as a text child through `h()` in `src/ui.js`. Never use `innerHTML`.
- Every button and field is at least 44 px tall; body text is 18 px and nothing is below 16 px.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**File map**

| File | Responsibility |
|---|---|
| `src/history.js` | Undo: the last 20 named snapshots (pure) |
| `src/viewport.js` | Pan and zoom maths between picture pixels and screen pixels (pure) |
| `src/flow.js` | Wording and small decisions the screens share: checklist, opening tab, counts, dates, the delete-floor question (pure) |
| `src/picture.js` | Read a chosen picture, rotate it, shrink it to 3000 px, turn it into a JPEG blob |
| `src/store.js` | IndexedDB: the project, device-only settings, picture blobs; an in-memory stand-in when storage is blocked |
| `src/ui.js` | DOM helpers: `h`, `svg`, `button`, `openSheet`, `ask`, `toast` |
| `src/view/plan.js` | The plan: picture underlay, pan, pinch, wheel, zoom buttons, tap |
| `src/view/floorswitch.js` | The row of floor buttons above a plan |
| `src/view/welcome.js` | First launch: two equal buttons, name the house, adopt a file |
| `src/view/setup.js` | Floors tab: list, add, rename, reorder, a floor's page, picture, delete |
| `src/view/browse.js` | Map tab (this plan: floor buttons and the plan only) |
| `src/app.js` | The shell: boot, `app`, tabs, Undo button, banner |
| `index.html`, `styles.css` | Page skeleton and styles |
| `tools/serve.mjs` | Static server for trying the app locally |

---

### Task 1: Undo history

**Files:**
- Create: `src/history.js`
- Test: `tests/history.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { createHistory, remember, forget, undo, undoLabel } from "../src/history.js";

test("undo puts the project back and names the step", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  assert.equal(undoLabel(hist), "");
  remember(hist, "added Main", p);
  const floor = m.addFloor(p, "Main", 10);
  assert.equal(undoLabel(hist), "Undo: added Main");
  assert.equal(undo(hist, p, 20), "added Main");
  assert.deepEqual([p.floors, p.deleted, undoLabel(hist)], [[], [{ id: floor.id, at: 20 }], ""]);
  assert.equal(undo(hist, p, 30), null);
});

test("steps undo newest first, and only the last 20 are kept", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  for (let i = 1; i <= 25; i++) {
    remember(hist, "added F" + i, p);
    m.addFloor(p, "F" + i, i);
  }
  assert.equal(hist.steps.length, 20);
  undo(hist, p, 100);
  assert.equal(p.floors.length, 24);
  assert.equal(undoLabel(hist), "Undo: added F24");
});

test("forget drops the step of a change that failed", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  remember(hist, "added Main", p);
  forget(hist);
  assert.equal(undoLabel(hist), "");
});

test("a remembered step is not touched by later edits", () => {
  const p = m.createProject("Home", 1), hist = createHistory();
  remember(hist, "renamed the house", p);
  m.rename(p, "New name", 5);
  undo(hist, p, 9);
  assert.deepEqual([p.name, p.updated], ["Home", 9]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/history.test.js`
Expected: FAIL, `Cannot find module ... src/history.js`.

- [ ] **Step 3: Write `src/history.js`**

```js
// Undo for one session: the project as it was before each of the last 20 changes, each with a name for the button.
import { restoreSnapshot } from "./model.js";

export function createHistory(limit = 20) {
  return { limit, steps: [] };
}

// Call before a change. name finishes "Undo: ...", for example "placed KIT-03".
export function remember(history, name, project) {
  history.steps.push({ name, snap: structuredClone(project) });
  if (history.steps.length > history.limit) history.steps.shift();
}

// The change that was about to be made failed, so there is nothing to undo.
export function forget(history) {
  history.steps.pop();
}

export function undoLabel(history) {
  const last = history.steps.at(-1);
  return last ? "Undo: " + last.name : "";
}

// Put the project back as it was before the newest change. Returns that change's name, or null with nothing to undo.
export function undo(history, project, now = Date.now()) {
  const step = history.steps.pop();
  if (!step) return null;
  restoreSnapshot(project, step.snap, now);
  return step.name;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/history.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/history.js tests/history.test.js docs/superpowers/plans/2026-10-08-plan-2a-shell-floors.md
git commit -m "feat: undo history"
```

---

### Task 2: Pan and zoom maths

**Files:**
- Create: `src/viewport.js`
- Test: `tests/viewport.test.js`

A view is `{ k, x, y }`: a picture pixel `(ix, iy)` is drawn at screen point `(x + ix * k, y + iy * k)`, measured from the top left of the plan box.

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, zoomAt, panBy, toImage, toScreen } from "../src/viewport.js";

test("fit centres the whole picture with a margin", () => {
  assert.deepEqual(fit(1000, 500, 524, 524, 12), { k: 0.5, x: 12, y: 137 });
  assert.deepEqual(fit(500, 1000, 524, 524, 12), { k: 0.5, x: 137, y: 12 });
});

test("zoomAt keeps the picture point under the finger where it was", () => {
  const before = { k: 1, x: 0, y: 0 };
  const after = zoomAt(before, 100, 50, 2, 0.1, 8);
  assert.deepEqual(after, { k: 2, x: -100, y: -50 });
  assert.deepEqual(toImage(after, 100, 50), toImage(before, 100, 50));
});

test("zoomAt stops at the limits", () => {
  const view = { k: 1, x: 0, y: 0 };
  assert.equal(zoomAt(view, 0, 0, 100, 0.1, 8).k, 8);
  assert.equal(zoomAt(view, 0, 0, 0.001, 0.1, 8).k, 0.1);
});

test("panBy slides the picture, and toImage and toScreen are opposites", () => {
  const view = panBy({ k: 2, x: 0, y: 0 }, 10, 20);
  assert.deepEqual(view, { k: 2, x: 10, y: 20 });
  assert.deepEqual(toImage(view, 30, 60), [10, 20]);
  assert.deepEqual(toScreen(view, 10, 20), [30, 60]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/viewport.test.js`
Expected: FAIL, `Cannot find module ... src/viewport.js`.

- [ ] **Step 3: Write `src/viewport.js`**

```js
// Pan and zoom. A view is { k, x, y }: picture pixel (ix, iy) is drawn at screen point (x + ix * k, y + iy * k).

// The view that shows the whole picture, centred, with `pad` screen pixels around it.
export function fit(imgW, imgH, boxW, boxH, pad = 12) {
  const k = Math.min((boxW - 2 * pad) / imgW, (boxH - 2 * pad) / imgH);
  return { k, x: (boxW - imgW * k) / 2, y: (boxH - imgH * k) / 2 };
}

// Zoom by `factor` about screen point (sx, sy), which stays over the same picture point.
export function zoomAt(view, sx, sy, factor, minK, maxK) {
  const k = Math.min(maxK, Math.max(minK, view.k * factor));
  const f = k / view.k;
  return { k, x: sx - (sx - view.x) * f, y: sy - (sy - view.y) * f };
}

export function panBy(view, dx, dy) {
  return { k: view.k, x: view.x + dx, y: view.y + dy };
}

export function toImage(view, sx, sy) {
  return [(sx - view.x) / view.k, (sy - view.y) / view.k];
}

export function toScreen(view, ix, iy) {
  return [view.x + ix * view.k, view.y + iy * view.k];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/viewport.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/viewport.js tests/viewport.test.js
git commit -m "feat: pan and zoom maths"
```

---

### Task 3: Shared wording and small decisions

**Files:**
- Create: `src/flow.js`
- Test: `tests/flow.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { checklist, startTab, plural, floorSummary, deleteFloorQuestion, floorAfterDelete, agoText, describeFile } from "../src/flow.js";
import { sample } from "./helpers.js";

test("the setup checklist ticks itself", () => {
  const p = m.createProject("Home", 1);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, false, false, false]);
  const floor = m.addFloor(p, "Main", 2);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, true, false, false]);
  m.update(p, "floors", floor.id, { imageId: "img" }, 3);
  m.addRoom(p, { floorId: floor.id, name: "Kitchen", code: "KIT" }, 4);
  assert.deepEqual(checklist(p).map((s) => s.done), [true, true, true, true]);
  assert.equal(checklist(p)[2].text, "Add a picture of the floor");
});

test("the app opens on Floors until some floor has a picture, then on Map", () => {
  const { p, main } = sample();
  assert.equal(startTab(p), "floors");
  m.update(p, "floors", main.id, { imageId: "img" }, 2000);
  assert.equal(startTab(p), "map");
});

test("counts read naturally", () => {
  assert.deepEqual([plural(0, "room"), plural(1, "room"), plural(2, "room")], ["0 rooms", "1 room", "2 rooms"]);
});

test("a floor's row says whether it has a picture and how many rooms", () => {
  const { p, main } = sample();
  assert.equal(floorSummary(p, main), "No picture yet, 2 rooms");
  m.update(p, "floors", main.id, { imageId: "img" }, 2000);
  assert.equal(floorSummary(p, main), "Has a picture, 2 rooms");
});

test("the delete-floor question says what goes with it", () => {
  const { p, main, kit } = sample();
  assert.equal(deleteFloorQuestion(p, main.id), "Delete Main? It has 2 rooms.");
  const sw = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1 }, 1100);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 2, y: 2 }, 1100);
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1200);
  assert.equal(deleteFloorQuestion(p, main.id), "Delete Main and its 2 devices? It has 2 rooms and 1 link.");
  const attic = m.addFloor(p, "Attic", 1300);
  assert.equal(deleteFloorQuestion(p, attic.id), "Delete Attic?");
});

test("after deleting a floor the one below is shown, or the one above if it was the lowest", () => {
  const { p, main } = sample();
  const up = m.addFloor(p, "Upstairs", 1100);
  const base = m.addFloor(p, "Basement", 1200, true);
  assert.equal(floorAfterDelete(p, up.id), main.id);
  assert.equal(floorAfterDelete(p, base.id), main.id);
  m.remove(p, "floors", up.id, 1300);
  m.remove(p, "floors", base.id, 1300);
  assert.equal(floorAfterDelete(p, main.id), "");
});

test("a project file is described with its date and how long ago", () => {
  const day = 86400000, now = new Date(2026, 9, 3, 12).getTime();
  assert.deepEqual([0, 1, 5, 21, 90, 800].map((d) => agoText(now - d * day, now)),
    ["today", "yesterday", "5 days ago", "3 weeks ago", "3 months ago", "2 years ago"]);
  const desc = { name: "Dad's house", floors: 2, devices: 63, updated: new Date(2026, 8, 12, 12).getTime() };
  assert.equal(describeFile(desc, now), "Dad's house, 2 floors, 63 devices, last changed 12 Sep 2026, 3 weeks ago.");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/flow.test.js`
Expected: FAIL, `Cannot find module ... src/flow.js`.

- [ ] **Step 3: Write `src/flow.js`**

```js
// Wording and small decisions that more than one screen needs. No DOM here, so it can be tested.
import { find, affected, sortedFloors } from "./model.js";

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// The four setup steps shown across the top of Floors until all are done.
export function checklist(project) {
  return [
    { text: "Name the house", done: true },
    { text: "Add a floor", done: project.floors.length > 0 },
    { text: "Add a picture of the floor", done: project.floors.some((f) => f.imageId) },
    { text: "Add the rooms", done: project.rooms.length > 0 },
  ];
}

// The tab the app opens on: Floors until some floor has a picture, Map from then on.
export function startTab(project) {
  return project.floors.some((f) => f.imageId) ? "map" : "floors";
}

export function floorSummary(project, floor) {
  const rooms = project.rooms.filter((r) => r.floorId === floor.id).length;
  return `${floor.imageId ? "Has a picture" : "No picture yet"}, ${plural(rooms, "room")}`;
}

export function deleteFloorQuestion(project, floorId) {
  const floor = find(project, "floors", floorId);
  const { rooms = 0, devices = 0, links = 0 } = affected(project, "floors", floorId);
  const question = devices ? `Delete ${floor.name} and its ${plural(devices, "device")}?` : `Delete ${floor.name}?`;
  const parts = [rooms && plural(rooms, "room"), links && plural(links, "link")].filter(Boolean);
  return parts.length ? `${question} It has ${parts.join(" and ")}.` : question;
}

// Which floor to show once this one is deleted: the one below, or the one above if it is the lowest. "" if it is the only one.
export function floorAfterDelete(project, floorId) {
  const list = sortedFloors(project);
  const i = list.findIndex((f) => f.id === floorId);
  const next = list[i - 1] || list[i + 1];
  return next ? next.id : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayText(time) {
  const d = new Date(time);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function agoText(time, now = Date.now()) {
  const days = Math.round((now - time) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// desc is model.describeProject(project). "Dad's house, 2 floors, 63 devices, last changed 12 Sep 2026, 3 weeks ago."
export function describeFile(desc, now = Date.now()) {
  return `${desc.name}, ${plural(desc.floors, "floor")}, ${plural(desc.devices, "device")}, ` +
    `last changed ${dayText(desc.updated)}, ${agoText(desc.updated, now)}.`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/flow.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/flow.js tests/flow.test.js
git commit -m "feat: shared wording for setup screens"
```

---

### Task 4: Picture sizing and reading

**Files:**
- Create: `src/picture.js`
- Test: `tests/picture.test.js`

Only `targetSize` can be tested without a browser. The other three functions touch `createImageBitmap` and `<canvas>` inside their bodies only, so Node can still import the file.

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { targetSize } from "../src/picture.js";

test("a big picture is shrunk so its longest side is 3000, a small one is left alone", () => {
  assert.deepEqual(targetSize(6000, 4000), { width: 3000, height: 2000 });
  assert.deepEqual(targetSize(800, 600), { width: 800, height: 600 });
});

test("a quarter turn either way swaps width and height", () => {
  assert.deepEqual(targetSize(6000, 4000, 1), { width: 2000, height: 3000 });
  assert.deepEqual(targetSize(6000, 4000, -1), { width: 2000, height: 3000 });
  assert.deepEqual(targetSize(6000, 4000, 2), { width: 3000, height: 2000 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/picture.test.js`
Expected: FAIL, `Cannot find module ... src/picture.js`.

- [ ] **Step 3: Write `src/picture.js`**

```js
// A chosen floor picture: read it, turn it, shrink it, and make the JPEG that is stored.

export const MAX_SIDE = 3000;

// The stored size of a w x h picture after `turns` quarter turns (negative = left).
export function targetSize(w, h, turns = 0, max = MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h));
  const width = Math.max(1, Math.round(w * s)), height = Math.max(1, Math.round(h * s));
  return Math.abs(turns) % 2 ? { width: height, height: width } : { width, height };
}

// File -> ImageBitmap, upright as the camera meant it. Throws an Error whose message can be shown as it is.
export async function readPicture(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This picture can't be opened here. Open it in Preview, choose File > Export, pick JPEG, and try again.");
  }
}

// Draw the picture on the canvas at its stored size, turned by `turns` quarter turns.
export function drawPicture(canvas, bitmap, turns = 0) {
  const { width, height } = targetSize(bitmap.width, bitmap.height, turns);
  canvas.width = width;
  canvas.height = height;
  const odd = Math.abs(turns) % 2;
  const w = odd ? height : width, h = odd ? width : height;
  const ctx = canvas.getContext("2d");
  ctx.translate(width / 2, height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be saved."))), "image/jpeg", 0.85);
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/picture.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/picture.js tests/picture.test.js
git commit -m "feat: floor picture sizing and reading"
```

---

### Task 5: Store

**Files:**
- Create: `src/store.js`
- Test: `tests/store.test.js`

`openStore()` uses IndexedDB and is checked in the browser in Task 7. `memoryStore()` has the same seven functions, is what the app falls back to when storage is blocked (private browsing), and is what the test covers.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/store.test.js`
Expected: FAIL, `Cannot find module ... src/store.js`.

- [ ] **Step 3: Write `src/store.js`**

```js
// Where the project lives on this device: IndexedDB, with pictures as blobs. Nothing here leaves the device.
// Both stores have the same functions: loadProject, saveProject, getSetting, setSetting, getImage, putImage, pruneImages.

const DB_NAME = "circuit-map";

const done = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function openStore() {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore("kv");
    open.result.createObjectStore("images");
  };
  const db = await done(open);
  // Ask the browser not to clear this site's data when space runs short. It may say no; that is fine.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const read = (store) => db.transaction(store).objectStore(store);
  const write = (store) => db.transaction(store, "readwrite").objectStore(store);
  return {
    loadProject: async () => (await done(read("kv").get("project"))) || null,
    saveProject: (project) => done(write("kv").put(project, "project")),
    // Settings are things this device remembers that are not part of the house (the time of the last Export, say).
    getSetting: async (name, fallback) => {
      const value = await done(read("kv").get("setting:" + name));
      return value === undefined ? fallback : value;
    },
    setSetting: (name, value) => done(write("kv").put(value, "setting:" + name)),
    getImage: async (id) => (await done(read("images").get(id))) || null,
    putImage: (id, blob) => done(write("images").put(blob, id)),
    // Drop pictures no floor uses any more. Called once when the app opens, so Undo can still bring one back until then.
    pruneImages: async (keepIds) => {
      const keys = await done(read("images").getAllKeys());
      for (const key of keys) if (!keepIds.includes(key)) await done(write("images").delete(key));
    },
  };
}

// Used when IndexedDB cannot be opened. Everything is lost when the page closes, and the app says so in a banner.
export function memoryStore() {
  let project = null;
  const settings = new Map(), images = new Map();
  return {
    loadProject: async () => project && structuredClone(project),
    saveProject: async (p) => { project = structuredClone(p); },
    getSetting: async (name, fallback) => (settings.has(name) ? settings.get(name) : fallback),
    setSetting: async (name, value) => { settings.set(name, value); },
    getImage: async (id) => images.get(id) || null,
    putImage: async (id, blob) => { images.set(id, blob); },
    pruneImages: async (keepIds) => {
      for (const id of [...images.keys()]) if (!keepIds.includes(id)) images.delete(id);
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/store.test.js`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/store.js tests/store.test.js
git commit -m "feat: on-device store"
```

---

### Task 6: DOM helpers, the plan view and the floor buttons

**Files:**
- Create: `src/ui.js`, `src/view/plan.js`, `src/view/floorswitch.js`

These three need a browser, so there is no failing test first. They are checked for syntax here and by hand from Task 7 on.

- [ ] **Step 1: Write `src/ui.js`**

```js
// Small DOM helpers. A string passed as a child is always added as text, never as HTML, so names typed by the user are safe.

function fill(el, attrs, kids) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.setAttribute("class", value);
    else if (el instanceof HTMLElement && key in el) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// h("p", { class: "small" }, "text", otherElement, [more, children])
export const h = (tag, attrs = {}, ...kids) => fill(document.createElement(tag), attrs, kids);
export const svg = (tag, attrs = {}, ...kids) => fill(document.createElementNS("http://www.w3.org/2000/svg", tag), attrs, kids);
export const button = (text, onclick, cls = "") => h("button", { type: "button", class: cls, onclick }, text);

// A sheet from the bottom of the screen (a centred box on a wide window). build(close) returns its content.
// Esc and the returned function both close it.
export function openSheet(title, build) {
  const dialog = h("dialog", { class: "sheet" });
  // Removed here as well as on the close event (which is what Esc fires): the event can come late or not at all.
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener("close", () => dialog.remove());
  dialog.append(h("h2", {}, title), ...[build(close)].flat(Infinity).filter(Boolean));
  document.body.append(dialog);
  dialog.showModal();
  return close;
}

// A question. choices: [{ text, cls, run }]; the sheet closes, then run (if any) is called.
export function ask(title, text, choices) {
  openSheet(title, (close) => [
    text && h("p", {}, text),
    h("div", { class: "buttons" }, choices.map((c) => button(c.text, () => {
      close();
      if (c.run) c.run();
    }, c.cls || ""))),
  ]);
}

let toastTimer = 0;

export function clearToast() {
  clearTimeout(toastTimer);
  document.getElementById("toast").replaceChildren();
}

// A short message above the tab bar. With an action ({ text, run }, usually Undo) it stays for 30 seconds, or until
// the next change; without one, 4 seconds.
export function toast(text, action) {
  clearToast();
  document.getElementById("toast").append(h("div", { class: "toast" },
    h("span", {}, text),
    action && button(action.text, () => {
      clearToast();
      action.run();
    })));
  toastTimer = setTimeout(clearToast, action ? 30000 : 4000);
}
```

- [ ] **Step 2: Write `src/view/plan.js`**

```js
// The plan: a floor's picture that can be panned and zoomed, with layers above it for outlines and markers.
// One finger or the mouse drags it; two fingers, the wheel or the buttons zoom; a touch that does not move is a tap.
import { h, svg, button } from "../ui.js";
import { fit, zoomAt, panBy, toImage } from "../viewport.js";

const TAP_SLOP = 6; // a touch that moves further than this many pixels is a pan, not a tap

export function createPlan() {
  const underlay = svg("image", { preserveAspectRatio: "none" });
  const layers = { outlines: svg("g"), markers: svg("g"), overlay: svg("g") };
  const world = svg("g", {}, underlay, layers.outlines, layers.markers, layers.overlay);
  const root = svg("svg", { class: "plan-svg", role: "img", "aria-label": "Floor plan" }, world);
  const message = h("p", { class: "plan-message", role: "status" });

  const plan = {
    el: null,
    layers,          // later plans draw into these, in picture pixels
    onTap: null,     // set by the view on show: ({ x, y, inside }) in picture pixels
    size: null,      // { width, height } of the picture, or null with none
    view: { k: 1, x: 0, y: 0 },
    show, fit: fitView, setMessage,
  };

  let needsFit = false, token = 0, url = "";
  const box = () => root.getBoundingClientRect();
  const apply = () => world.setAttribute("transform", `translate(${plan.view.x} ${plan.view.y}) scale(${plan.view.k})`);

  function setMessage(text) {
    message.textContent = text;
  }

  function fitView() {
    const b = box();
    needsFit = !plan.size || !b.width || !b.height;
    if (needsFit) return;
    plan.view = fit(plan.size.width, plan.size.height, b.width, b.height);
    apply();
  }

  // Zoom about a screen point (the middle of the plan if none is given), from half the fitted size up to 8x.
  function zoom(factor, sx, sy) {
    const b = box();
    if (!plan.size || !b.width) return;
    const fitted = fit(plan.size.width, plan.size.height, b.width, b.height).k;
    plan.view = zoomAt(plan.view, sx ?? b.width / 2, sy ?? b.height / 2, factor, fitted / 2, Math.max(8, fitted * 8));
    apply();
  }

  // Show a picture blob, or nothing (null). Fits it to the box. A newer call wins over a slower older one.
  async function show(blob) {
    const mine = ++token;
    if (!blob) {
      plan.size = null;
      underlay.removeAttribute("href");
      if (url) URL.revokeObjectURL(url);
      url = "";
      setMessage("");
      return;
    }
    const next = URL.createObjectURL(blob);
    const img = new Image();
    img.src = next;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(next);
      if (mine === token) setMessage("This picture could not be shown.");
      return;
    }
    if (mine !== token) {
      URL.revokeObjectURL(next);
      return;
    }
    if (url) URL.revokeObjectURL(url);
    url = next;
    plan.size = { width: img.naturalWidth, height: img.naturalHeight };
    underlay.setAttribute("href", url);
    underlay.setAttribute("width", plan.size.width);
    underlay.setAttribute("height", plan.size.height);
    setMessage("");
    fitView();
  }

  const pointers = new Map(); // pointerId -> [clientX, clientY]
  let start = [0, 0], moved = false;

  root.addEventListener("pointerdown", (e) => {
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      start = [e.clientX, e.clientY];
      moved = false;
    } else {
      moved = true; // a second finger: this is a pinch, never a tap
    }
  });

  root.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = [e.clientX, e.clientY];
    if (pointers.size === 1) {
      if (!moved && Math.hypot(cur[0] - start[0], cur[1] - start[1]) < TAP_SLOP) return;
      moved = true;
      plan.view = panBy(plan.view, cur[0] - prev[0], cur[1] - prev[1]);
      apply();
    } else if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
      const after = Math.hypot(cur[0] - other[0], cur[1] - other[1]);
      const b = box();
      plan.view = panBy(plan.view, (cur[0] - prev[0]) / 2, (cur[1] - prev[1]) / 2);
      if (before > 0) zoom(after / before, (cur[0] + other[0]) / 2 - b.left, (cur[1] + other[1]) / 2 - b.top);
      apply();
    }
    pointers.set(e.pointerId, cur);
  });

  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    if (e.type !== "pointerup" || moved || pointers.size || !plan.size || !plan.onTap) return;
    const b = box();
    const [x, y] = toImage(plan.view, e.clientX - b.left, e.clientY - b.top);
    plan.onTap({ x, y, inside: x >= 0 && y >= 0 && x <= plan.size.width && y <= plan.size.height });
  };
  root.addEventListener("pointerup", lift);
  root.addEventListener("pointercancel", lift);

  // The wheel zooms. A trackpad pinch arrives as a wheel event with ctrlKey set and small deltas.
  root.addEventListener("wheel", (e) => {
    e.preventDefault();
    const b = box();
    zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });

  plan.el = h("div", { class: "plan" }, root, message,
    h("div", { class: "zoom-buttons" },
      h("button", { type: "button", "aria-label": "Zoom in", onclick: () => zoom(1.5) }, "+"),
      h("button", { type: "button", "aria-label": "Zoom out", onclick: () => zoom(1 / 1.5) }, "\u2212"),
      button("Fit", fitView)));

  // The picture may be loaded before the plan is on screen and has a size; fit it once it has one.
  new ResizeObserver(() => {
    if (needsFit) fitView();
  }).observe(plan.el);

  return plan;
}
```

- [ ] **Step 3: Write `src/view/floorswitch.js`**

```js
// The floor buttons above a plan, lowest floor first: a row of up to four, and one button opening a list beyond that.
import * as m from "../model.js";
import { h, button, openSheet } from "../ui.js";

export function floorSwitch(app) {
  const floors = m.sortedFloors(app.project), current = app.floor();
  if (!current) return null;
  if (floors.length <= 4) {
    return h("div", { class: "floor-switch", role: "group", "aria-label": "Floor" },
      floors.map((f) => h("button", { type: "button", "aria-pressed": String(f.id === current.id), onclick: () => app.setFloor(f.id) }, f.name)));
  }
  return h("div", { class: "floor-switch" },
    button("Floor: " + current.name, () => openSheet("Choose a floor", (close) =>
      h("div", { class: "rows" }, floors.map((f) => button(f.name + (f.id === current.id ? " (showing now)" : ""), () => {
        close();
        app.setFloor(f.id);
      }))))));
}
```

- [ ] **Step 4: Check the syntax**

Run: `node --check src/ui.js && node --check src/view/plan.js && node --check src/view/floorswitch.js && node --test`
Expected: no output from the three checks; the test run passes as before (95 tests, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/view/plan.js src/view/floorswitch.js
git commit -m "feat: DOM helpers, plan view and floor buttons"
```

---

### Task 7: The shell and first launch

**Files:**
- Create: `index.html`, `styles.css`, `tools/serve.mjs`, `src/app.js`, `src/view/welcome.js`
- Modify: `package.json` (add a `start` script)

- [ ] **Step 1: Write `tools/serve.mjs` and add the script**

`tools/serve.mjs`:

```js
// A static file server for trying the app on this computer: npm start, then open http://localhost:8765
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(8765, "127.0.0.1", () => console.log("Circuit Map at http://localhost:8765"));
```

In `package.json` replace the `scripts` line with:

```json
  "scripts": { "test": "node --test", "start": "node tools/serve.mjs" }
```

- [ ] **Step 2: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Circuit Map</title>
<link rel="stylesheet" href="styles.css">
</head>
<body class="no-project">
<header id="header"><h1 id="house"></h1></header>
<div id="top-banner" role="alert" hidden></div>
<nav id="tabs" aria-label="Sections"></nav>
<div id="mode-bar"><div id="mode-banner" role="status"></div><button id="undo" type="button" disabled>Undo</button></div>
<main id="screen"></main>
<div id="toast" role="status"></div>
<script type="module" src="src/app.js"></script>
</body>
</html>
```

The order on screen is set in the stylesheet, not here: on a phone the mode bar and tabs sit under the screen; on a wide window they sit above it.

- [ ] **Step 3: Write `styles.css`**

```css
:root {
  color-scheme: light dark;
  --bg: #fff; --fg: #111; --muted: #555; --line: #999; --panel: #f1f1f1;
  --accent: #0b57d0; --accent-fg: #fff; --danger: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111; --fg: #f2f2f2; --muted: #b5b5b5; --line: #777; --panel: #242424;
    --accent: #8ab4f8; --accent-fg: #111; --danger: #f2b8b5;
  }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { height: 100%; margin: 0; }
body {
  display: flex; flex-direction: column;
  font: 18px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg); color: var(--fg);
}

/* Phone order: header, banner, screen, mode bar, tabs. Wide order: header, banner, tabs, mode bar, screen. */
#header { order: 1; display: flex; align-items: center; gap: 12px; padding: 8px 16px; padding-top: max(8px, env(safe-area-inset-top)); border-bottom: 1px solid var(--line); }
#header h1 { flex: 1; margin: 0; font-size: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#top-banner { order: 2; padding: 10px 16px; background: var(--danger); color: var(--bg); font-weight: 600; }
#screen { order: 3; flex: 1; min-height: 0; overflow: auto; }
#mode-bar { order: 4; display: flex; align-items: center; gap: 12px; padding: 6px 16px; border-top: 1px solid var(--line); }
#mode-banner { flex: 1; max-height: 2.8em; overflow: hidden; }
#tabs { order: 5; display: flex; border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
#tabs button { flex: 1; min-height: 52px; border: 0; border-radius: 0; background: none; }
#tabs button[aria-current="page"] { font-weight: 700; box-shadow: inset 0 4px 0 var(--accent); }
@media (min-width: 700px) {
  #tabs { order: 2; border-top: 0; border-bottom: 1px solid var(--line); padding-bottom: 0; }
  #tabs button { flex: none; padding: 8px 24px; }
  #tabs button[aria-current="page"] { box-shadow: inset 0 -4px 0 var(--accent); }
  #mode-bar { order: 3; border-top: 0; border-bottom: 1px solid var(--line); }
  #screen { order: 4; }
}
body.no-project #header, body.no-project #tabs, body.no-project #mode-bar { display: none; }

button, input { font: inherit; color: inherit; }
button { min-width: 44px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
button.main { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-weight: 600; }
button.plain { background: none; border: 0; text-decoration: underline; align-self: flex-start; }
button.danger { color: var(--danger); }
button.row { display: flex; flex-direction: column; align-items: flex-start; width: 100%; text-align: left; }
button:disabled { opacity: 0.5; }
button[aria-pressed="true"] { border-width: 2px; border-color: var(--accent); font-weight: 700; }
button[aria-pressed="true"]::before { content: "\2713\00a0"; }
input[type="text"] { display: block; width: 100%; min-height: 44px; margin-top: 4px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); }
label { display: block; font-weight: 600; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.page { display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin: 0 auto; padding: 16px; }
.page h1, .page h2, .page p { margin: 0; }
.page h2 { font-size: 20px; }
.page > button { align-self: flex-start; }
.small { font-size: 16px; font-weight: 400; color: var(--muted); }
.error { color: var(--danger); font-weight: 600; }
.buttons { display: flex; flex-wrap: wrap; gap: 12px; }
.buttons.equal { flex-direction: column; }
.buttons.equal button { width: 100%; min-height: 64px; }
.rows { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.rows li { display: flex; flex-direction: column; gap: 8px; }
.checklist { margin: 0; padding: 12px 12px 12px 40px; border-radius: 10px; background: var(--panel); }
.checklist .done { color: var(--muted); }
.wide-only { display: none; }
@media (min-width: 700px) { .wide-only { display: inline; } }

.plan-screen { display: flex; flex-direction: column; height: 100%; }
.floor-switch { display: flex; gap: 8px; padding: 8px 16px; overflow-x: auto; }
.plan { position: relative; flex: 1; min-height: 50vh; overflow: hidden; background: var(--panel); }
.floor-page .plan { flex: none; height: 60vh; }
.plan-svg { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
.plan-message { position: absolute; top: 40%; left: 16px; right: 16px; margin: 0; text-align: center; pointer-events: none; }
.zoom-buttons { position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
.zoom-buttons button { background: var(--bg); }

dialog.sheet { width: 100%; max-width: 640px; max-height: 90vh; margin: auto auto 0; padding: 16px; border: 0; border-radius: 16px 16px 0 0; background: var(--bg); color: var(--fg); }
dialog.sheet > * { margin: 0; }
dialog.sheet > * + * { margin-top: 12px; }
dialog.sheet h2 { font-size: 20px; }
dialog.sheet::backdrop { background: rgba(0, 0, 0, 0.45); }
@media (min-width: 700px) { dialog.sheet { margin: auto; border-radius: 16px; } }
.preview { display: block; max-width: 100%; max-height: 45vh; margin: 0 auto; border: 1px solid var(--line); }

#toast { position: fixed; left: 0; right: 0; bottom: 124px; display: flex; justify-content: center; padding: 0 16px; pointer-events: none; }
.toast { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; min-height: 60px; border-radius: 12px; background: var(--fg); color: var(--bg); pointer-events: auto; }
.toast button { background: var(--bg); color: var(--fg); }
```

- [ ] **Step 4: Write `src/view/welcome.js`**

```js
// First launch: nothing on this device yet. Two buttons of the same weight, so after a wiped phone the obvious
// button is not the one that makes an empty house.
import * as m from "../model.js";
import { parse } from "../file.js";
import { describeFile } from "../flow.js";
import { h, button } from "../ui.js";

export function welcomeView(app) {
  if (app.ui.naming) return nameScreen(app);
  if (app.ui.offered) return offerScreen(app);
  const picker = h("input", { type: "file", hidden: true, onchange: () => picker.files[0] && readFile(app, picker.files[0]) });
  const el = h("section", { class: "page" },
    h("h1", {}, "Circuit Map"),
    h("p", {}, "Map the outlets, switches, lights and breakers of your house on your own floor plan."),
    h("div", { class: "buttons equal" },
      button("Start a new house", () => {
        app.ui.naming = true;
        app.render();
      }, "main"),
      button("I already have a project file", () => picker.click(), "main")),
    picker,
    app.ui.fileError && h("p", { class: "error", role: "alert" }, app.ui.fileError),
    h("p", { class: "small" },
      "Used this app before? Your house may have been cleared by Safari, or this may be a new phone. Choose I already " +
      "have a project file and pick your latest .circuitmap file (look in Files, Downloads or iCloud Drive, or ask " +
      "your other device to send it).",
      h("span", { class: "wide-only" }, " Or drop the file here.")));
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) readFile(app, e.dataTransfer.files[0]);
  });
  return el;
}

async function readFile(app, file) {
  try {
    app.ui.offered = parse(await file.text());
    app.ui.fileError = "";
  } catch (err) {
    app.ui.fileError = err.code ? err.message : "This file could not be read.";
  }
  app.render();
}

function offerScreen(app) {
  const { project, images } = app.ui.offered;
  return h("section", { class: "page" },
    h("p", {}, describeFile(m.describeProject(project)) + " Use this one?"),
    h("div", { class: "buttons" },
      button("Use it", () => app.adopt(project, images), "main"),
      button("Choose another file", () => {
        app.ui.offered = null;
        app.render();
      })));
}

function nameScreen(app) {
  const input = h("input", { type: "text", value: "My house", autocomplete: "off", enterKeyHint: "done" });
  const el = h("form", {
    class: "page",
    onsubmit: (e) => {
      e.preventDefault();
      app.adopt(m.createProject(input.value.trim() || "My house"));
    },
  },
    h("label", {}, "What do you call this house?", input),
    h("div", { class: "buttons" },
      h("button", { type: "submit", class: "main" }, "Start"),
      button("Back", () => {
        app.ui.naming = false;
        app.render();
      })));
  // Selected, so typing replaces "My house". The form is not on the page until the caller adds it.
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  return el;
}
```

- [ ] **Step 5: Write `src/app.js`**

```js
// The shell: opens the store, loads the project, draws the tabs and the Undo button, and gives each view the `app`
// object. A view is a function (app) => element, called again after every change.
import * as m from "./model.js";
import { openStore, memoryStore } from "./store.js";
import { createHistory, remember, forget, undo, undoLabel } from "./history.js";
import { startTab } from "./flow.js";
import { h, toast, clearToast } from "./ui.js";
import { createPlan } from "./view/plan.js";
import { welcomeView } from "./view/welcome.js";

// [id, the word on the tab bar, view]. Tabs appear here as they are built.
const TABS = [];

const $ = (id) => document.getElementById(id);

export const app = {
  store: null,
  project: null,      // null until a house is started or a file adopted
  tab: "",
  floorId: "",        // the floor being shown; see floor()
  notSaved: false,    // true when the device refuses to store the project
  history: createHistory(),
  plan: createPlan(), // one plan for every tab, so zoom and position survive a redraw
  shownImage: "",     // the imageId the plan is showing
  ui: {},             // what views remember between redraws (the open page, reorder mode ...)

  // Make a change. fn(project) edits through model.js; name finishes "Undo: ...". Saves and redraws.
  commit(name, fn) {
    remember(app.history, name, app.project);
    let result;
    try {
      result = fn(app.project);
    } catch (err) {
      forget(app.history);
      throw err;
    }
    clearToast();
    app.save();
    render();
    return result;
  },

  save() {
    app.store.saveProject(app.project).catch(() => {
      if (app.notSaved) return;
      app.notSaved = true;
      render();
    });
  },

  undo() {
    const name = undo(app.history, app.project);
    if (!name) return;
    app.save();
    render();
    toast("Undone: " + name);
  },

  go(tab) {
    app.tab = tab;
    render();
  },

  // The floor being shown. Falls back to the lowest floor; null when the house has none.
  floor() {
    return m.find(app.project, "floors", app.floorId) || m.sortedFloors(app.project)[0] || null;
  },

  setFloor(id) {
    app.floorId = id;
    render();
  },

  // Put a floor's picture in the shared plan. Does nothing if it is already there.
  async showPicture(floor) {
    const id = floor.imageId;
    if (app.shownImage === id) return;
    app.shownImage = id;
    app.plan.show(null);
    app.plan.setMessage("Loading picture...");
    const blob = await app.store.getImage(id);
    if (app.shownImage !== id) return;
    if (blob) await app.plan.show(blob);
    else app.plan.setMessage("This floor's picture is missing. Choose it again on the Floors tab.");
  },

  // Start using a project: a new house, or one read from a file (images: { imageId: data URL }).
  async adopt(project, images = {}) {
    for (const [id, dataUrl] of Object.entries(images)) {
      await app.store.putImage(id, await (await fetch(dataUrl)).blob());
    }
    Object.assign(app, { project, history: createHistory(), ui: {}, floorId: "", shownImage: "", tab: startTab(project) });
    app.save();
    render();
  },

  render,
};

function render() {
  const p = app.project;
  document.body.classList.toggle("no-project", !p);
  $("top-banner").hidden = !app.notSaved;
  $("top-banner").textContent = app.notSaved ? "Changes are not being saved on this device." : "";
  if (!p) {
    $("screen").replaceChildren(welcomeView(app));
    return;
  }
  $("house").textContent = p.name;
  const tab = TABS.find((t) => t[0] === app.tab) || TABS[0];
  $("tabs").replaceChildren(...TABS.map(([id, label]) =>
    h("button", { type: "button", "aria-current": tab[0] === id ? "page" : null, onclick: () => app.go(id) }, label)));
  $("screen").replaceChildren(tab ? tab[2](app) : h("p", { class: "page" }, "Nothing to show yet."));
  const label = undoLabel(app.history);
  $("undo").textContent = label || "Undo";
  $("undo").disabled = !label;
}

$("undo").addEventListener("click", () => app.undo());

// Cmd-Z or Ctrl-Z, unless he is typing in a field (where it should undo typing) or a sheet is open.
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.querySelector("dialog[open]")) return;
  e.preventDefault();
  app.undo();
});

async function boot() {
  try {
    app.store = await openStore();
  } catch {
    app.store = memoryStore();
    app.notSaved = true;
  }
  app.project = await app.store.loadProject();
  if (app.project) {
    await app.store.pruneImages(app.project.floors.map((f) => f.imageId).filter(Boolean));
    app.tab = startTab(app.project);
  }
  render();
}

boot();
```

- [ ] **Step 6: Check it in a browser**

Run: `node --check src/app.js && node --check src/view/welcome.js && node --test` (expected: 95 tests pass), then `npm start` and open `http://localhost:8765`.

Expected, with the browser console open and showing no errors:
1. A page headed Circuit Map with two buttons of the same size, "Start a new house" and "I already have a project file", and the small "Used this app before?" paragraph. No tabs, no header, no Undo bar.
2. "Start a new house" shows "What do you call this house?" with "My house" selected. Type `Test house`, press Enter. The header reads "Test house", an Undo button (disabled) shows, and the screen says "Nothing to show yet." (the tabs come in the next two tasks).
3. Reload the page. It opens straight on "Test house": the project was saved.
4. In the browser's developer tools, delete the `circuit-map` IndexedDB database and reload: the welcome screen is back.
5. Save this text as `bad.circuitmap` and pick it with "I already have a project file": `not a project`. The page says "This file could not be read." in red and nothing else changes.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css tools/serve.mjs package.json src/app.js src/view/welcome.js
git commit -m "feat: app shell and first launch"
```

---

### Task 8: The Floors tab

**Files:**
- Create: `src/view/setup.js`
- Modify: `src/app.js` (one import, one `TABS` entry)

- [ ] **Step 1: Write `src/view/setup.js`**

```js
// The Floors tab: the list of floors, and one floor's page (name, picture, delete).
import * as m from "../model.js";
import { checklist, floorSummary, deleteFloorQuestion, floorAfterDelete } from "../flow.js";
import { readPicture, drawPicture, canvasBlob } from "../picture.js";
import { h, button, openSheet, ask, toast } from "../ui.js";

const FLOOR_NAMES = ["Basement", "Main floor", "Upstairs", "Attic"];

export function setupView(app) {
  const floor = m.find(app.project, "floors", app.ui.floorPage || "");
  return floor ? floorPage(app, floor) : floorList(app);
}

function openFloor(app, id) {
  app.ui.floorPage = id;
  app.floorId = id;
  app.render();
}

// A text field that saves when he leaves it or taps the keyboard's Done. An empty name is put back as it was.
function nameField(value, save) {
  const input = h("input", {
    type: "text", value, autocomplete: "off", enterKeyHint: "done",
    onchange: () => {
      const next = input.value.trim();
      if (next && next !== value) save(next);
      else input.value = value;
    },
  });
  return input;
}

function checklistEl(project) {
  const steps = checklist(project);
  if (steps.every((s) => s.done)) return null;
  return h("ol", { class: "checklist" }, steps.map((s) => h("li", { class: s.done ? "done" : "" }, (s.done ? "\u2713 " : "") + s.text)));
}

function floorList(app) {
  const p = app.project, floors = m.sortedFloors(p);
  const reorder = !!app.ui.reorder && floors.length > 1;
  const row = (f, i) => h("li", {},
    button([h("strong", {}, f.name), h("span", { class: "small" }, floorSummary(p, f))], () => openFloor(app, f.id), "row"),
    reorder && h("div", { class: "buttons" },
      h("button", { type: "button", disabled: i === 0, onclick: () => app.commit(`moved ${f.name} up`, (p) => m.moveFloor(p, f.id, -1)) }, "Move up"),
      h("button", { type: "button", disabled: i === floors.length - 1, onclick: () => app.commit(`moved ${f.name} down`, (p) => m.moveFloor(p, f.id, 1)) }, "Move down")));
  return h("section", { class: "page" },
    checklistEl(p),
    h("label", {}, "House name", nameField(p.name, (name) => app.commit("renamed the house", (p) => m.rename(p, name)))),
    h("h2", {}, "Floors"),
    floors.length
      ? [h("p", { class: "small" }, "Lowest floor first."), h("ul", { class: "rows" }, floors.map(row))]
      : h("p", {}, "No floors yet. Add one."),
    h("div", { class: "buttons" },
      button("Add floor", () => addFloorSheet(app), "main"),
      floors.length > 1 && button(reorder ? "Done" : "Reorder", () => {
        app.ui.reorder = !reorder;
        app.render();
      })));
}

function addFloorSheet(app) {
  openSheet("Add floor", (close) => {
    const add = (typed) => {
      const name = typed.trim();
      if (!name) return;
      close();
      // A basement is the lowest floor, so it goes first; any other new floor goes last.
      const floor = app.commit(`added ${name}`, (p) => m.addFloor(p, name, Date.now(), name === "Basement"));
      openFloor(app, floor.id);
    };
    const taken = new Set(app.project.floors.map((f) => f.name));
    const input = h("input", { type: "text", autocomplete: "off", enterKeyHint: "done" });
    return [
      h("div", { class: "buttons" }, FLOOR_NAMES.filter((n) => !taken.has(n)).map((n) => button(n, () => add(n)))),
      h("form", { onsubmit: (e) => { e.preventDefault(); add(input.value); } },
        h("label", {}, "Or type a name", input),
        h("div", { class: "buttons", style: "margin-top: 12px" },
          h("button", { type: "submit", class: "main" }, "Add"),
          button("Cancel", close))),
    ];
  });
}

function floorPage(app, floor) {
  const p = app.project;
  const picker = h("input", {
    type: "file", accept: "image/*,application/pdf", hidden: true,
    onchange: () => {
      const file = picker.files[0];
      picker.value = "";
      if (file) choosePicture(app, floor, file);
    },
  });
  // Replacing the picture under rooms or devices needs the line-up step, which comes with rooms in Plan 2b.
  const used = p.rooms.some((r) => r.floorId === floor.id) || p.devices.some((d) => d.floorId === floor.id);
  let picture;
  if (floor.imageId) {
    app.showPicture(floor);
    picture = [app.plan.el, !used && button("Replace picture", () => picker.click())];
  } else {
    picture = [
      h("p", {}, "Next: add a picture of the floor."),
      button("Choose a picture", () => picker.click(), "main"),
      h("p", { class: "small" }, "No plan of this space? Put its things on the nearest floor, in a room called Attic."),
    ];
  }
  return h("section", { class: "page floor-page" },
    button("Back to floors", () => {
      app.ui.floorPage = "";
      app.render();
    }),
    h("label", {}, "Floor name", nameField(floor.name, (name) => app.commit(`renamed ${floor.name}`, (p) => m.update(p, "floors", floor.id, { name })))),
    h("h2", {}, "Picture"),
    picture,
    picker,
    button("Delete floor", () => deleteFloor(app, floor), "plain danger"));
}

// Show the chosen picture with Rotate buttons; Use this picture shrinks it, stores it and puts it on the floor.
async function choosePicture(app, floor, file) {
  if (file.type === "application/pdf") {
    toast("A PDF can't be opened yet. Take a screenshot of the page and choose that.");
    return;
  }
  let bitmap;
  try {
    bitmap = await readPicture(file);
  } catch (err) {
    ask("That picture can't be used", err.message, [{ text: "OK", cls: "main" }]);
    return;
  }
  let turns = 0;
  const canvas = h("canvas", { class: "preview" });
  const draw = () => drawPicture(canvas, bitmap, turns);
  draw();
  openSheet("Use this picture?", (close) => {
    const status = h("p", { role: "status" });
    const use = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      status.textContent = "Preparing picture...";
      try {
        const imageId = m.newId();
        await app.store.putImage(imageId, await canvasBlob(canvas));
        close();
        app.commit(`added a picture to ${floor.name}`, (p) => m.update(p, "floors", floor.id, { imageId }));
      } catch {
        status.textContent = "The picture could not be saved. Try again.";
        btn.disabled = false;
      }
    };
    return [
      canvas,
      status,
      h("div", { class: "buttons" },
        button("Rotate left", () => { turns--; draw(); }),
        button("Rotate right", () => { turns++; draw(); })),
      h("div", { class: "buttons" }, button("Use this picture", use, "main"), button("Cancel", close)),
    ];
  });
}

function deleteFloor(app, floor) {
  ask("Delete floor", deleteFloorQuestion(app.project, floor.id), [
    { text: "Cancel", cls: "main" },
    {
      text: `Delete ${floor.name}`, cls: "plain danger",
      run: () => {
        app.ui.floorPage = "";
        app.floorId = floorAfterDelete(app.project, floor.id);
        app.commit(`deleted ${floor.name}`, (p) => m.remove(p, "floors", floor.id));
        // The picture stays in the store until the app is next opened, so Undo brings the whole floor back.
        toast(`Deleted ${floor.name}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}
```

- [ ] **Step 2: Register the tab in `src/app.js`**

After the line `import { welcomeView } from "./view/welcome.js";` add:

```js
import { setupView } from "./view/setup.js";
```

Replace `const TABS = [];` with:

```js
const TABS = [["floors", "Floors", setupView]];
```

- [ ] **Step 3: Check it in a browser**

Run: `node --check src/view/setup.js && node --test` (expected: 95 pass), then `npm start`, open `http://localhost:8765`. If a house is left from Task 7, delete the `circuit-map` database in developer tools first and start "Test house" again. Have any JPEG or PNG of a floor plan ready (a phone photo of a sketch is ideal), and one taken sideways if you can.

Expected, with no console errors:
1. Floors tab: a checklist with "Name the house" ticked and three steps not, the house name in a field, "No floors yet. Add one." and an Add floor button.
2. Add floor shows Basement, Main floor, Upstairs, Attic and a field. Tap Main floor: its page opens with "Next: add a picture of the floor." The Undo button reads "Undo: added Main floor".
3. Choose a picture, pick the image. A sheet shows it with Rotate left, Rotate right, Use this picture, Cancel. Rotate right turns it a quarter turn clockwise each tap. Use this picture: the sheet closes and the picture shows on the page, whole and centred.
4. On the picture: drag pans; the mouse wheel zooms about the pointer; + and the minus button zoom about the middle; Fit shows it whole again. On a touch screen (or the browser's phone emulation with touch), two fingers pinch. The page behind does not scroll or zoom while doing so.
5. Back to floors. The row reads "Main floor" over "Has a picture, 0 rooms". The checklist shows three ticks.
6. Add floor: Basement, then Back to floors. Basement is listed above Main floor. Add floor again no longer offers Basement or Main floor; type `Garage loft`, Add. It is listed last.
7. Reorder shows Move up / Move down on each row, with Move up disabled on the first row and Move down on the last. Move Garage loft up once; Done hides the buttons.
8. Change the house name to `Dad's <b>house</b>` and press Enter. The header shows exactly that text, angle brackets and all, not bold.
9. Open Garage loft, Delete floor. The sheet says "Delete Garage loft?" with Cancel as the filled button. Delete Garage loft: back on the list without it, and a toast "Deleted Garage loft." with Undo. Tap Undo: it is back.
10. Press Undo until it is disabled; each press names the step it undid and the list steps back to empty. Reload: the page shows what was last on screen.
11. Narrow the window below 700 px: the tab bar and Undo bar move to the bottom. Switch the system to dark mode: dark background, light text, the picture unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/view/setup.js src/app.js
git commit -m "feat: Floors tab with pictures"
```

---

### Task 9: The Map tab

**Files:**
- Create: `src/view/browse.js`
- Modify: `src/app.js` (one import, one `TABS` entry)

- [ ] **Step 1: Write `src/view/browse.js`**

```js
// The Map tab. In this plan it shows the floor buttons and the plan; markers, search and details come with Plans 2c and 2d.
import { h, button } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";

export function browseView(app) {
  const floor = app.floor();
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" },
      h("p", {}, "No floors yet. Add one."),
      button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!floor.imageId) {
    return h("section", { class: "plan-screen" },
      floorSwitch(app),
      h("div", { class: "page" },
        h("p", {}, "This floor has no picture yet."),
        button("Choose a picture", () => toFloors(floor.id), "main")));
  }
  app.showPicture(floor);
  return h("section", { class: "plan-screen" }, floorSwitch(app), app.plan.el);
}
```

- [ ] **Step 2: Register the tab in `src/app.js`**

After the line `import { setupView } from "./view/setup.js";` add:

```js
import { browseView } from "./view/browse.js";
```

Replace the `const TABS = ...` line with:

```js
const TABS = [["floors", "Floors", setupView], ["map", "Map", browseView]];
```

- [ ] **Step 3: Check it in a browser**

Run: `node --check src/view/browse.js && node --test` (expected: 95 pass), then `npm start`, open `http://localhost:8765` and set up a house with two floors, a picture on the first only.

Expected, with no console errors:
1. Reload. The app opens on Map (a floor has a picture), showing two floor buttons, lowest first, the shown one ticked and outlined, and the plan filling the rest of the screen.
2. Zoom in, switch to Floors and back to Map: the plan is still zoomed where it was left.
3. Tap the other floor's button: "This floor has no picture yet." and Choose a picture, which opens that floor's page on the Floors tab. Add a picture there; back on Map both floors show their own picture.
4. Add three more floors (five in all): the row of buttons becomes one button, "Floor: <name>", opening a list with "(showing now)" beside the current one.
5. Delete every floor: Map says "No floors yet. Add one." with Go to Floors.
6. In developer tools, look at IndexedDB > circuit-map > images: one entry per picture added. Reload, and look again: only pictures of floors that still exist are left.

- [ ] **Step 4: Commit**

```bash
git add src/view/browse.js src/app.js
git commit -m "feat: Map tab showing the plan"
```

---

### Task 10: Adopting a project file, and the README

**Files:**
- Modify: `README.md`

Nothing new is built here. This checks the one path the earlier tasks could not, and records how to run the app.

- [ ] **Step 1: Make a project file to adopt**

Run from the repo root:

```bash
node -e "import('./src/model.js').then(async (m) => { const { serialize, fileName } = await import('./src/file.js'); const p = m.createProject('File house'); const f = m.addFloor(p, 'Main floor'); m.update(p, 'floors', f.id, { imageId: 'pic1' }); const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; const name = fileName(p); require('fs').writeFileSync(name, serialize(p, { pic1: png })); console.log(name); })"
```

Expected: it prints a name like `File house 2026-10-08 1405.circuitmap` and the file is in the repo root (`.gitignore` already leaves `*.circuitmap` out).

- [ ] **Step 2: Check it in a browser**

`npm start`, open `http://localhost:8765`, delete the `circuit-map` database in developer tools and reload.

Expected:
1. "I already have a project file", pick the file: "File house, 1 floor, 0 devices, last changed <today's date>, today. Use this one?" with Use it and Choose another file.
2. Use it: the app opens on Map (the floor has a picture) with the header "File house" and a tiny one-pixel picture in the middle of the plan; + makes it grow.
3. Reload: still File house.
4. On a wide window, delete the database again, reload, and drag the file onto the welcome page: the same question appears.

Delete the `.circuitmap` file afterwards.

- [ ] **Step 3: Update `README.md`**

Replace the last line (`Tests: ...`) with:

```markdown
Try it: `npm start`, then open http://localhost:8765 (Node 22 or later; nothing to install).

Tests: `node --test`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: how to run the app"
```

---

## Done when

- `node --test` passes with 0 failures (95 tests: the 77 from Plan 1 and 18 new).
- Every browser check in Tasks 7 to 10 has been done and passed, in a wide window and at phone width, light and dark.
- A house started in the browser, with two floors and a picture on each, is still there after closing and reopening the tab.
- Ten commits on `plan-2a-shell`, ready to merge.

Then write Plan 2b (rooms, scale, replace picture with the two-spot line-up) against `app.commit`, `app.plan.layers`, `app.plan.onTap` and `m.refitFloor`.
