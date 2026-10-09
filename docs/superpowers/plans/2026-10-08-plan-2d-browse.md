# Circuit Map Plan 2d: The Map Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Map tab becomes the place to look things up: search and filter, tap a device for its details, a list by room, jumps between floors with a way back, a Key, the "plates to rewrite" list, and a Rooms button that zooms the plan to a room.

**Architecture:** Searching, grouping and the wording of a device's details are pure functions in `src/browse.js`. `view/browse.js` draws a search row, a filter row, then a body that is the plan or the list, with a details panel beside it (wide window) or under it (phone); typing in the search box redraws only the body so the keyboard stays up. Markers gain two drawing options, `only` (a set of ids to draw) and `picked` (one to ring). The plan gains `zoomTo`, `shows` and a Rooms button fed by `drawRooms`.

**Tech Stack:** As before: plain ES modules, SVG, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Browse; Using it: Zoom, Empty states, Jumps leave a way back; Labels that changed).

**Left for later plans on purpose:** Show on panel and real breaker text beyond what the data holds (Plan 3); Download spreadsheet (Plan 3); Swap labels in the plates list, which needs the import's "which device kept the number" (Plan 4); the palette as a side panel on the Add tab (the sheet is kept at every width).

**Conventions for every task**

- Work on the branch `plan-2d-browse`.
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://localhost:8765.
- Views change the project only through `app.commit(...)`. User text reaches the page only as a text child through `h()` or `svg()`.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Where a step says "Replace A with B", A appears exactly once in the file.

**File map**

| File | Responsibility |
|---|---|
| `src/browse.js` (new) | Pure: search, list by room, and the words for a device's details and a plate to rewrite |
| `src/outline.js`, `src/viewport.js` (add to) | `roomBox`; `fitRect` |
| `src/view/plan.js` (modify) | `zoomTo`, `shows`, `setRooms` and the Rooms button |
| `src/view/roomlayer.js` (replace) | Also tells the plan which rooms can be zoomed to |
| `src/view/markers.js` (modify) | `only` and `picked` |
| `src/view/browse.js` (replace) | The Map tab |
| `src/app.js` (modify) | The Delete key |
| `styles.css` (add to) | Search field, details panel, list, bar, key |

---

### Task 1: Search, list and details wording

**Files:**
- Create: `src/browse.js`
- Test: `tests/browse.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { searchDevices, listByRoom, circuitText, switchLines, switchedBy, titleText, plateRow } from "../src/browse.js";
import { sample } from "./helpers.js";

function house() {
  const s = sample();
  const { p, main, kit, ext } = s;
  const place = (roomId, type, created, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId, type, x: 1, y: 1, ...extra }, created);
  const sw = place(kit.id, "S", 1100, { toggles: 2 });
  const light = place(kit.id, "L", 1200);
  const outlet = place(kit.id, "D", 1300);
  const flood = place(ext.id, "FL", 1400);
  const pump = place(ext.id, "X", 1500, { customName: "Sump pump" });
  m.update(p, "devices", outlet.id, { note: "behind the fridge" }, 1600);
  return { ...s, sw, light, outlet, flood, pump };
}

const labels = (list) => list.map((d) => d.label);

test("search looks in label, type, room, name and note; every word must match; a group narrows it", () => {
  const { p } = house();
  assert.deepEqual(labels(searchDevices(p, "")), ["KIT-01", "KIT-02", "KIT-03", "EXT-01", "EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "kit-02")), ["KIT-02"]);
  assert.deepEqual(labels(searchDevices(p, "FRIDGE")), ["KIT-03"]);
  assert.deepEqual(labels(searchDevices(p, "exterior")), ["EXT-01", "EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "sump")), ["EXT-02"]);
  assert.deepEqual(labels(searchDevices(p, "kitchen light")), ["KIT-02"]);
  assert.deepEqual(labels(searchDevices(p, "garage")), []);
  assert.deepEqual(labels(searchDevices(p, "", "light")), ["KIT-02", "EXT-01"]);
  assert.deepEqual(labels(searchDevices(p, "", "other")), ["EXT-02"]); // "Other" includes things he named himself
  assert.deepEqual(labels(searchDevices(p, "kit", "outlet")), ["KIT-03"]);
});

test("the list is grouped by floor then room by name, labels in number order, no room last", () => {
  const { p, main, kit } = house();
  for (let i = 0; i < 8; i++) m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 2000 + i);
  const loose = p.devices.at(-1);
  m.setRoom(p, loose.id, "", false, 3000);
  const groups = listByRoom(p, p.devices);
  assert.deepEqual(groups.map((g) => [g.floorName, g.roomName]), [["Main", "Exterior"], ["Main", "Kitchen"], ["Main", "No room"]]);
  assert.deepEqual(labels(groups[1].devices).slice(-2), ["KIT-09", "KIT-10"]);
  assert.deepEqual(labels(groups[2].devices), ["KIT-11"]);
  assert.deepEqual(listByRoom(p, []), []);
});

test("the breaker line says what is known and how sure", () => {
  const { p, outlet, light } = house();
  assert.equal(circuitText(p, outlet), "Not known");
  const panel = m.addPanel(p, { name: "Main panel" }, 2000);
  const b = m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 20, label: "Kitchen" }, 2000);
  m.setBreaker(p, outlet.id, b.id, false, 2100);
  m.setBreaker(p, light.id, b.id, true, 2100);
  assert.equal(circuitText(p, outlet), "Breaker 7 (Kitchen), guess");
  assert.equal(circuitText(p, light), "Breaker 7 (Kitchen), tested");
});

test("a switch plate is described one switch at a time, and a load by what switches it", () => {
  const { p, main, kit, sw, light, outlet } = house();
  assert.deepEqual(switchLines(p, sw).map((s) => s.text), ["Switch 1: nothing recorded yet.", "Switch 2: nothing recorded yet."]);
  const other = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S3", x: 1, y: 1 }, 2000);
  m.toggleLink(p, { switchId: sw.id, toggle: 1, loadId: light.id }, 2100);
  m.toggleLink(p, { switchId: other.id, toggle: 1, loadId: light.id }, 2100);
  m.toggleLink(p, { switchId: sw.id, toggle: 2, loadId: outlet.id, loadPart: "top" }, 2100);
  const lines = switchLines(p, sw);
  assert.equal(lines[0].text, "Switch 1 controls KIT-02. Also switched from KIT-04 (Kitchen), switch 1.");
  assert.equal(lines[1].text, "Switch 2 controls KIT-03 (top half).");
  assert.deepEqual(lines[0].loads.map((l) => l.id), [light.id]);
  assert.deepEqual(switchedBy(p, light).map((s) => s.text), ["KIT-01, switch 1 (Main)", "KIT-04, switch 1 (Main)"]);
  assert.deepEqual(switchedBy(p, outlet).map((s) => s.text), ["KIT-01, switch 2 (Main), top half"]);
  assert.deepEqual(switchedBy(p, sw), []);
});

test("a device whose plate is out of date says so, and its row says what to write", () => {
  const { p, kit, flood } = house();
  assert.equal(titleText(flood), "EXT-01");
  m.setRoom(p, flood.id, kit.id, true, 2000);
  assert.equal(titleText(flood), "KIT-04 (plate says EXT-01)");
  assert.deepEqual(plateRow(p, flood), { todo: "Write KIT-04 on this plate", what: "Flood light, Kitchen, Main", why: "It says EXT-01." });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/browse.test.js`
Expected: FAIL, `Cannot find module ... src/browse.js`.

- [ ] **Step 3: Write `src/browse.js`**

```js
// Looking things up: search, the list by room, and the words for one device's details. No DOM here.
import { find, sortedFloors, breakerKey, controls, controlledBy, otherSwitches } from "./model.js";
import { displayName, typeInfo } from "./catalog.js";

const byLabel = (a, b) => a.label.localeCompare(b.label, "en", { numeric: true });
const roomName = (project, d) => (find(project, "rooms", d.roomId) || { name: "no room" }).name;
const floorName = (project, d) => (find(project, "floors", d.floorId) || { name: "" }).name;
const HALF = { top: "top half", bottom: "bottom half" };

// Devices matching every word of `query` (in the label, what it is, its room or its note) and, if given, the group.
// The "other" group includes things he named himself.
export function searchDevices(project, query = "", group = "") {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return project.devices.filter((d) => {
    const g = typeInfo(d.type).group;
    if (group && g !== group && !(group === "other" && g === "custom")) return false;
    const text = [d.label, displayName(d), typeInfo(d.type).name, roomName(project, d), d.note].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// [{ floorId, floorName, roomName, devices }]: floors lowest first, rooms by name, devices with no room last.
export function listByRoom(project, devices) {
  const out = [];
  for (const floor of sortedFloors(project)) {
    const here = devices.filter((d) => d.floorId === floor.id);
    const rooms = project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name));
    for (const room of [...rooms, null]) {
      const list = here.filter((d) => (room ? d.roomId === room.id : !rooms.some((r) => r.id === d.roomId))).sort(byLabel);
      if (list.length) out.push({ floorId: floor.id, floorName: floor.name, roomName: room ? room.name : "No room", devices: list });
    }
  }
  return out;
}

// "Breaker 12 (Kitchen), tested", "Breaker 7 (Kitchen), guess" or "Not known".
export function circuitText(project, device) {
  const b = find(project, "breakers", device.breakerId);
  if (!b) return "Not known";
  return `Breaker ${breakerKey(b)}${b.label ? ` (${b.label})` : ""}, ${device.tested ? "tested" : "guess"}`;
}

// One entry per switch on the plate: { toggle, text, loads: [{ id, label }] }.
// "Switch 1 controls HAL-01. Also switched from HAL-02 (Upstairs hall), switch 1."
export function switchLines(project, device) {
  const lines = [];
  for (let toggle = 1; toggle <= device.toggles; toggle++) {
    const loads = controls(project, device.id, toggle).map((l) => {
      const load = find(project, "devices", l.loadId);
      return load && { id: load.id, label: load.label, text: load.label + (l.loadPart ? ` (${HALF[l.loadPart]})` : "") };
    }).filter(Boolean);
    const seen = new Set();
    const also = otherSwitches(project, device.id, toggle).map((o) => {
      const sw = find(project, "devices", o.switchId), key = o.switchId + "|" + o.toggle;
      if (!sw || seen.has(key)) return "";
      seen.add(key);
      return `${sw.label} (${roomName(project, sw)}), switch ${o.toggle}`;
    }).filter(Boolean);
    const text = loads.length
      ? `Switch ${toggle} controls ${loads.map((l) => l.text).join(", ")}.` + (also.length ? ` Also switched from ${also.join("; ")}.` : "")
      : `Switch ${toggle}: nothing recorded yet.`;
    lines.push({ toggle, text, loads });
  }
  return lines;
}

// What switches a light or outlet: [{ id, label, text }], "KIT-01, switch 1 (Main floor), top half".
export function switchedBy(project, device) {
  return controlledBy(project, device.id).map((l) => {
    const sw = find(project, "devices", l.switchId);
    return sw && { id: sw.id, label: sw.label, text: `${sw.label}, switch ${l.toggle} (${floorName(project, sw)})` + (l.loadPart ? `, ${HALF[l.loadPart]}` : "") };
  }).filter(Boolean).sort((a, b) => byLabel(a, b));
}

// "KIT-06 (plate says KIT-05)" while the plate is out of date.
export function titleText(device) {
  return device.plateLabel ? `${device.label} (plate says ${device.plateLabel})` : device.label;
}

// A row of the "Plates to rewrite" list: what to do first, then which device, then why.
export function plateRow(project, device) {
  return {
    todo: `Write ${device.label} on this plate`,
    what: `${displayName(device)}, ${roomName(project, device)}, ${floorName(project, device)}`,
    why: `It says ${device.plateLabel}.`,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/browse.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/browse.js tests/browse.test.js docs/superpowers/plans/2026-10-08-plan-2d-browse.md
git commit -m "feat: search, list and details wording"
```

---

### Task 2: Zooming to a room

**Files:**
- Modify: `src/outline.js`, `src/viewport.js` (append), `src/view/plan.js`
- Replace: `src/view/roomlayer.js`
- Test: `tests/zoom.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { roomBox } from "../src/outline.js";
import { fitRect, toScreen } from "../src/viewport.js";

test("roomBox is the smallest upright box around an outline", () => {
  assert.deepEqual(roomBox([[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]]), [0, 0, 20, 20]);
  assert.deepEqual(roomBox([[5, 7], [9, 3], [2, 4]]), [2, 3, 9, 7]);
});

test("fitRect zooms so a box fills the plan with a margin, centred, and never past the limit", () => {
  const view = fitRect([100, 100, 300, 200], 500, 500, 50, 8);
  assert.deepEqual(view, { k: 2, x: -150, y: -50 });
  assert.deepEqual(toScreen(view, 200, 150), [250, 250]); // the middle of the box is the middle of the plan
  assert.equal(fitRect([0, 0, 10, 10], 500, 500, 50, 8).k, 8);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/zoom.test.js`
Expected: FAIL, `does not provide an export named 'roomBox'`.

- [ ] **Step 3: Append to `src/outline.js`**

```js

// The smallest upright box around an outline: [left, top, right, bottom].
export function roomBox(outline) {
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
```

- [ ] **Step 4: Append to `src/viewport.js`**

```js

// The view that shows the box [left, top, right, bottom] centred with `pad` screen pixels around it, zoomed in no
// further than maxK.
export function fitRect([left, top, right, bottom], boxW, boxH, pad = 32, maxK = 8) {
  const k = Math.min((boxW - 2 * pad) / Math.max(right - left, 1), (boxH - 2 * pad) / Math.max(bottom - top, 1), maxK);
  return { k, x: boxW / 2 - (k * (left + right)) / 2, y: boxH / 2 - (k * (top + bottom)) / 2 };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/zoom.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 6: Give the plan `zoomTo`, `shows` and a Rooms button (`src/view/plan.js`)**

Replace:

```js
import { h, svg, button } from "../ui.js";
import { fit, zoomAt, panBy, toImage } from "../viewport.js";
```

with:

```js
import { h, svg, button, openSheet } from "../ui.js";
import { fit, fitRect, zoomAt, panBy, toImage, toScreen } from "../viewport.js";
```

Replace:

```js
    show, fit: fitView, setMessage,
```

with:

```js
    show, fit: fitView, setMessage, zoomTo, shows, setRooms,
```

Replace:

```js
  // Show a picture blob, or nothing (null). Fits it to the box. A newer call wins over a slower older one.
```

with:

```js
  // Zoom so the picture box [left, top, right, bottom] fills the plan.
  function zoomTo(rect) {
    const b = box();
    if (!plan.size || !b.width) return;
    plan.view = fitRect(rect, b.width, b.height, 32, Math.max(8, fit(plan.size.width, plan.size.height, b.width, b.height).k * 8));
    apply();
  }

  // Is picture point (x, y) on screen right now?
  function shows(x, y) {
    const b = box(), [sx, sy] = toScreen(plan.view, x, y);
    return sx >= 0 && sy >= 0 && sx <= b.width && sy <= b.height;
  }

  // The rooms the Rooms button offers: [{ name, box }]. With none the button is hidden.
  let rooms = [];
  function setRooms(list) {
    rooms = list;
    roomsButton.hidden = !list.length;
  }

  // Pinching is hard one-handed: Rooms lists this floor's rooms, and tapping one zooms the plan to it.
  const roomsButton = button("Rooms", () => openSheet("Zoom to a room", (close) => [
    h("div", { class: "rows scroll" }, rooms.map((r) => button(r.name, () => {
      close();
      zoomTo(r.box);
    }))),
    button("Cancel", close),
  ]));
  roomsButton.hidden = true;

  // Show a picture blob, or nothing (null). Fits it to the box. A newer call wins over a slower older one.
```

Replace:

```js
      button("Fit", fitView)));
```

with:

```js
      button("Fit", fitView),
      roomsButton));
```

- [ ] **Step 7: Replace `src/view/roomlayer.js` with**

```js
// Room outlines on the plan: a faint tint with the room's name at a point inside it.
import { svg } from "../ui.js";
import { fixedAt } from "./plan.js";
import { labelPoint, roomBox } from "../outline.js";

// Draw the outlines of `floor` (none if it is null). except: a room id to leave out, while its outline is being edited.
export function drawRooms(app, floor, except = "") {
  const rooms = floor ? app.project.rooms.filter((r) => r.floorId === floor.id && r.outline.length >= 3 && r.id !== except) : [];
  app.plan.layers.outlines.replaceChildren(...rooms.flatMap((r) => {
    const [x, y] = labelPoint(r.outline);
    return [
      svg("polygon", { class: "room", points: r.outline.map((p) => p.join(",")).join(" ") }),
      fixedAt(x, y, {}, svg("text", { class: "room-name", "text-anchor": "middle", "dominant-baseline": "central" }, r.name)),
    ];
  }));
  // The plan's Rooms button zooms to any of these.
  app.plan.setRooms(rooms.map((r) => ({ name: r.name, box: roomBox(r.outline) })).sort((a, b) => a.name.localeCompare(b.name)));
}
```

- [ ] **Step 8: Check and commit**

Run: `node --check src/view/plan.js && node --check src/view/roomlayer.js && node --test`
Expected: no output from the checks; 122 tests pass.

```bash
git add src/outline.js src/viewport.js src/view/plan.js src/view/roomlayer.js tests/zoom.test.js
git commit -m "feat: Rooms button zooms the plan to a room"
```

---

### Task 3: Drawing only some markers, and a picked one

**Files:**
- Modify: `src/view/markers.js`

- [ ] **Step 1: Edit `src/view/markers.js`**

Replace:

```js
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null } = {}) {
  const devices = floor ? app.project.devices.filter((d) => d.floorId === floor.id) : [];
```

with:

```js
// only: a Set of ids; devices not in it are left out (a search or filter).
// picked: the id of the device whose details are showing (it wears a ring and its label).
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null, only = null, picked = "" } = {}) {
  const devices = floor ? app.project.devices.filter((d) => d.floorId === floor.id && (!only || only.has(d.id))) : [];
```

Replace:

```js
    const ring = d.id === pulse || (ringed && ringed.has(d.id));
```

with:

```js
    const ring = d.id === pulse || d.id === picked || (ringed && ringed.has(d.id));
```

Replace:

```js
      d.id === pulse && svg("text", { class: "marker-label", y: 32 }, d.label));
```

with:

```js
      (d.id === pulse || d.id === picked) && svg("text", { class: "marker-label", y: 32 }, d.label));
```

Replace:

```js
export function drawFloor(app, floor) {
```

with:

```js
// extra: { only, picked } from the view (see drawMarkers).
export function drawFloor(app, floor, extra = {}) {
```

Replace:

```js
  drawMarkers(app, shown, { pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null });
```

with:

```js
  drawMarkers(app, shown, { pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null, ...extra });
```

- [ ] **Step 2: Check and commit**

Run: `node --check src/view/markers.js && node --test`
Expected: no output from the check; 122 tests pass.

```bash
git add src/view/markers.js
git commit -m "feat: draw only matching markers and ring the picked one"
```

---

### Task 4: The Map tab

**Files:**
- Replace: `src/view/browse.js`
- Modify: `src/app.js`, `styles.css`

- [ ] **Step 1: Replace `src/view/browse.js` with**

```js
// The Map tab: look things up. Search and filter, tap a device for its details, or read the list by room.
import * as m from "../model.js";
import { displayName, isSwitch } from "../catalog.js";
import { markersNear } from "../placing.js";
import { plural, heightText } from "../flow.js";
import { searchDevices, listByRoom, circuitText, switchLines, switchedBy, titleText, plateRow } from "../browse.js";
import { h, button, openSheet, ask, toast } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor, glyph } from "./markers.js";
import { openMarkerSheet } from "./markersheet.js";

const REACH = 22; // screen pixels: half of a 44-point target
const FILTERS = [["", "All"], ["outlet", "Outlets"], ["switch", "Switches"], ["light", "Lights"], ["other", "Other"]];

// What the tab remembers: the search, the group filter, list or plan, the device whose details show, where a jump
// came from (for the Back button), and whether the plates bar was put off.
const state = (app) => (app.ui.map ||= { query: "", group: "", list: false, selected: "", back: null, platesLater: false });

function select(app, id) {
  const st = state(app);
  if (st.selected === id) return;
  st.selected = id;
  app.render();
}

export function browseView(app) {
  const st = state(app), p = app.project, floor = app.floor();
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!m.find(p, "devices", st.selected)) st.selected = "";

  const status = h("p", { class: "plan-hint", role: "status" });
  const body = h("div", { class: "map-body" });

  // The plan, drawing only what the search found.
  const planEl = (devices, searching) => {
    if (!floor.imageId) {
      return h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."), button("Choose a picture", () => toFloors(floor.id), "main"));
    }
    const here = devices.filter((d) => d.floorId === floor.id);
    app.showPicture(floor);
    drawFloor(app, floor, { only: searching ? new Set(here.map((d) => d.id)) : null, picked: st.selected });
    app.plan.onTap = ({ x, y }) => {
      const near = markersNear(here, x, y, REACH / app.plan.view.k);
      if (near.length < 2) return select(app, near.length ? near[0].id : "");
      openSheet("Which one?", (close) => [
        h("div", { class: "rows" }, near.map((d) => button(`${d.label}, ${displayName(d)}`, () => { close(); select(app, d.id); }))),
        button("Cancel", close),
      ]);
    };
    return app.plan.el;
  };

  // Everything under the search rows. Typing in the search box calls this by itself, so the keyboard stays up.
  const fill = () => {
    const query = st.query.trim(), searching = !!(query || st.group);
    const devices = searchDevices(p, query, st.group);
    const onFloor = (f) => devices.filter((d) => d.floorId === f.id).length;
    status.replaceChildren(...(
      !p.devices.length ? ["Nothing placed yet. Add outlets, switches and lights on the Add tab. ", button("Go to Add", () => app.go("add"))]
      : searching && !devices.length ? [`Nothing matches ${query ? `"${query}"` : "that"}. Check the spelling or clear the search.`]
      : searching && st.list ? [`${plural(devices.length, "device")} found.`]
      : searching ? [`${plural(devices.length, "device")} found, ${onFloor(floor)} on this floor. `,
        ...m.sortedFloors(p).filter((f) => f.id !== floor.id && onFloor(f)).map((f) => button(`${f.name} (${onFloor(f)})`, () => app.setFloor(f.id)))]
      : []));
    const selected = m.find(p, "devices", st.selected);
    body.replaceChildren(st.list ? listEl(app, devices) : planEl(devices, searching), ...(selected ? [detailsEl(app, selected)] : []));
  };

  const search = h("input", {
    type: "search", value: st.query, placeholder: "Search label, room, type or note", "aria-label": "Search",
    autocomplete: "off", autocorrect: "off", enterKeyHint: "search",
    oninput: () => {
      st.query = search.value;
      fill();
    },
  });
  const pick = (current, value, text, run) => h("button", { type: "button", "aria-pressed": String(current === value), onclick: run }, text);
  const back = st.back;
  fill();
  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    back && h("div", { class: "pick-row" }, button(back.text, () => {
      Object.assign(st, { list: back.list, query: back.query, group: back.group, selected: "", back: null });
      app.setFloor(back.floorId);
    })),
    platesBar(app),
    h("div", { class: "pick-row" },
      search,
      pick(st.list, false, "Plan", () => { st.list = false; app.render(); }),
      pick(st.list, true, "List", () => { st.list = true; app.render(); }),
      button("Key", keySheet)),
    h("div", { class: "pick-row", role: "group", "aria-label": "Show" },
      FILTERS.map(([group, text]) => pick(st.group, group, text, () => { st.group = group; app.render(); }))),
    status,
    body);
}

// Every device found, grouped by floor and room. Tapping one shows its details.
function listEl(app, devices) {
  const st = state(app), floors = app.project.floors.length;
  return h("div", { class: "list" }, listByRoom(app.project, devices).map((g) => [
    h("h3", {}, floors > 1 ? `${g.floorName}: ${g.roomName}` : g.roomName),
    h("ul", { class: "rows" }, g.devices.map((d) => h("li", {},
      h("button", { type: "button", class: "row", "aria-pressed": String(d.id === st.selected), onclick: () => select(app, d.id) },
        h("strong", {}, titleText(d)),
        h("span", { class: "small" }, displayName(d) + (d.notWorking ? ", not working" : "")))))),
  ]));
}

// One device: where it is, its breaker, height, note, what it controls and what switches it.
function detailsEl(app, d) {
  const p = app.project, st = state(app);
  const room = m.find(p, "rooms", d.roomId), floor = m.find(p, "floors", d.floorId), gfci = m.find(p, "devices", d.gfciId);
  const line = (label, ...value) => h("p", {}, h("strong", {}, label + ": "), value);
  const show = (id, label) => button(`Show ${label}`, () => showOnPlan(app, id));
  const switches = isSwitch(d.type) ? [] : switchedBy(p, d);
  return h("aside", { class: "details", "aria-label": "Details" },
    h("h2", {}, titleText(d)),
    h("p", {}, `${displayName(d)}, ${room ? room.name : "no room"}, ${floor.name}`),
    d.notWorking && h("p", { class: "error" }, "Not working"),
    line("Breaker", circuitText(p, d)),
    line("Height", heightText(d.heightIn)),
    d.note && line("Note", d.note),
    gfci && line("Behind GFCI outlet", gfci.label, " ", show(gfci.id, gfci.label)),
    d.type === "G" && line("Protects", plural(m.protectedBy(p, d.id).length, "device")),
    isSwitch(d.type) && switchLines(p, d).map((s) => h("p", {}, s.text, s.loads.map((l) => [" ", show(l.id, l.label)]))),
    switches.length > 0 && [
      h("p", {}, h("strong", {}, "Switched by")),
      h("ul", {}, switches.map((s) => h("li", {}, s.text, " ", show(s.id, s.label)))),
    ],
    h("div", { class: "buttons" },
      button("Edit", () => openMarkerSheet(app, d.id), "main"),
      (st.list || d.floorId !== app.floor().id) && button("Show on plan", () => showOnPlan(app, d.id)),
      button("Close", () => select(app, ""))));
}

// Jump to a device on the plan. If that changes floor or leaves the list, a Back button says where he came from.
function showOnPlan(app, id) {
  const st = state(app), d = m.find(app.project, "devices", id), from = app.floor();
  if (!d) return;
  if (st.list || d.floorId !== from.id) {
    st.back = { list: st.list, query: st.query, group: st.group, floorId: from.id, text: st.list ? "Back to the list" : `Back to ${from.name}` };
  }
  // The search is cleared so the marker is sure to be drawn.
  Object.assign(st, { list: false, query: "", group: "", selected: id });
  Object.assign(app, { tab: "map", floorId: d.floorId });
  app.render();
  if (!app.plan.shows(d.x, d.y)) app.plan.fit();
}

// "2 plates to rewrite": labels that changed while the old one is still written on the cover plate.
function platesBar(app) {
  const st = state(app), count = m.platesToRewrite(app.project).length;
  if (!count || st.platesLater) return null;
  return h("div", { class: "bar" },
    h("strong", {}, `${plural(count, "plate")} to rewrite`),
    button("Show", () => platesSheet(app)),
    button("Remind me later", () => { st.platesLater = true; app.render(); }));
}

function platesSheet(app) {
  const plates = m.platesToRewrite(app.project);
  if (!plates.length) return;
  openSheet("Plates to rewrite", (close) => [
    h("ul", { class: "rows scroll" }, plates.map((d) => {
      const row = plateRow(app.project, d);
      return h("li", {},
        h("strong", {}, row.todo),
        h("span", {}, row.what),
        h("span", { class: "small" }, row.why),
        h("div", { class: "buttons" },
          button("Show on plan", () => { close(); showOnPlan(app, d.id); }),
          button("I've rewritten it", () => {
            close();
            app.commit(`rewrote the plate of ${d.label}`, (p) => m.confirmPlate(p, d.id));
            platesSheet(app);
          })));
    })),
    plates.length > 1 && button(`I've rewritten all ${plates.length}`, () => {
      close();
      ask(`Mark all ${plates.length} as done?`, "", [
        { text: "Yes, all rewritten", cls: "main", run: () => app.commit(`rewrote ${plural(plates.length, "plate")}`, (p) => { for (const d of plates) m.confirmPlate(p, d.id); }) },
        { text: "Cancel", run: () => platesSheet(app) },
      ]);
    }),
    button("Done", close, "main"),
  ]);
}

// Every marker shape and mark, with its meaning in words.
function keySheet() {
  const item = (mark, text) => h("li", { class: "key-row" }, mark, h("span", {}, text));
  const mark = (text) => h("strong", { class: "key-mark" }, text);
  openSheet("Key", (close) => [
    h("ul", { class: "rows" },
      item(glyph("D"), "Circle: an outlet"),
      item(glyph("S"), "Square: a switch plate. The number inside is how many switches are on it."),
      item(glyph("L"), "Diamond: a light or ceiling fan"),
      item(glyph("SM"), "Triangle: anything else (an alarm, fan, appliance, panel, or something you named)"),
      item(mark("!"), "Not working right now"),
      item(mark("✎"), "Its label changed: the plate needs rewriting"),
      item(mark("◯"), "A ring: the one you picked, or just placed")),
    button("Done", close, "main"),
  ]);
}

// The Delete key on the Map tab removes the picked device. Undone, not confirmed.
export function deleteSelected(app) {
  const st = state(app), d = m.find(app.project, "devices", st.selected);
  if (!d) return;
  st.selected = "";
  app.commit(`deleted ${d.label}`, (p) => m.remove(p, "devices", d.id));
  toast(`Deleted ${d.label}.`, { text: "Undo", run: () => app.undo() });
}
```

- [ ] **Step 2: The Delete key (`src/app.js`)**

Replace:

```js
import { browseView } from "./view/browse.js";
```

with:

```js
import { browseView, deleteSelected } from "./view/browse.js";
```

Replace:

```js
  if (e.key === "Escape" && app.mode) {
    app.cancelMode();
```

with:

```js
  if (e.key === "Escape" && app.mode) {
    app.cancelMode();
  } else if (e.key === "Delete" && !typing && !app.mode && app.project && app.tab === "map") {
    deleteSelected(app);
```

- [ ] **Step 3: Append to `styles.css`**

```css

/* The Map tab */
input[type="search"] { flex: 1; min-width: 9em; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); }
.map-body { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.map-body .plan { min-height: 40vh; }
.details { flex: none; max-height: 45vh; overflow: auto; padding: 12px 16px; border-top: 1px solid var(--line); }
.details > * { margin: 0; }
.details > * + * { margin-top: 8px; }
.details h2 { font-size: 24px; }
.details ul { padding-left: 24px; }
.list { flex: 1; overflow: auto; padding: 0 16px 16px; }
.list h3 { margin: 16px 0 8px; font-size: 18px; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px; background: var(--panel); }
.rows li.key-row { flex-direction: row; align-items: center; gap: 12px; }
.key-mark { flex: none; width: 28px; text-align: center; font-size: 20px; color: var(--danger); }
@media (min-width: 700px) {
  .map-body { flex-direction: row; }
  .details { width: 340px; max-height: none; border-top: 0; border-left: 1px solid var(--line); }
}
```

- [ ] **Step 4: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (122 pass), then `node tools/serve.mjs` and http://localhost:8765. Set up a house with two floors with pictures; on the first, rooms Kitchen (traced) and Exterior (no outline); place a few outlets, a 2-switch plate and a light in the Kitchen, a flood light in Exterior, and an outlet on the second floor. Give one outlet the note `behind the fridge`. The console must stay free of errors.

1. With nothing placed, Map says "Nothing placed yet. Add outlets, switches and lights on the Add tab." with Go to Add. Once things are placed that line is gone.
2. Map shows the floor buttons, a search box with Plan | List and Key beside it, a row All / Outlets / Switches / Lights / Other with All ticked, and the plan with every marker. The zoom buttons include Rooms: it lists Kitchen; tapping it zooms the plan to that room. Fit shows the whole floor again.
3. Type `fridge`: while typing, the box keeps the cursor; only the matching marker is drawn; the line reads "1 device found, 1 on this floor." Type `outlet`: the count includes the other floor, with a button "<other floor> (1)" that switches to it. Type `garage`: "Nothing matches "garage". Check the spelling or clear the search." Clear the box: every marker is back.
4. Lights: only diamonds are drawn and Lights is ticked. All puts everything back.
5. Tap a marker: it wears a ring and its label, and its details show (beside the plan on a wide window, under it at phone width): label, type, room and floor, "Breaker: Not known", height, the note if it has one, Edit and Close. For the switch plate: "Switch 1: nothing recorded yet." and the same for switch 2. Tap empty plan: the details close.
6. Edit opens the marker sheet; change the note there and Done: the details show the new note.
7. List: every device grouped under "<floor>: <room>" headings, labels in number order. Tapping a row shows its details with Show on plan. Show on plan: the plan shows with the marker ringed and a "Back to the list" button, which returns to the list.
8. In the list, pick the device on the other floor and Show on plan: the floor changes; Back to the list brings back the list. From the plan, a Show button in details that changes floor leaves "Back to <floor>".
9. On the Add tab, move a device to another room and choose Relabel. Map shows a bar "1 plate to rewrite" with Show and Remind me later. Show lists "Write <new label> on this plate", the device and "It says <old label>." with Show on plan and I've rewritten it; the details title reads "<new> (plate says <old>)". I've rewritten it clears the bar. Remind me later hides the bar.
10. Key lists the four shapes and the three marks with their meanings.
11. With a device picked on Map, press the Delete key: it is removed and "Deleted <label>." offers Undo, which brings it back.
12. Phone width: the rows above the plan scroll sideways rather than wrap, the plan keeps a usable height, and the details panel scrolls by itself.

- [ ] **Step 5: Commit**

```bash
git add src/view/browse.js src/app.js styles.css
git commit -m "feat: the Map tab: search, details, list, key and plates to rewrite"
```

---

## Done when

- `node --test` passes with 0 failures (122 tests).
- Every browser check in Task 4 passes, with no console errors.
- Four commits on `plan-2d-browse`, ready to merge.

Then write Plan 3 (Switches tab, Breakers tab with the printable directory, the breaker Test, and the spreadsheet download).
