# Circuit Map Plan 2c: The Add Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** He can walk a room placing outlets, switches and lights on the plan with one tap each, see them as markers on every tab, and fix one afterwards (type, room, note, switches, height, GFCI, not working, move, delete).

**Architecture:** A new Add tab (`view/place.js`). Choosing something to add starts a mode whose `plan.onTap` places a device; with nothing chosen a tap on a marker opens its sheet (`view/markersheet.js`). Markers are drawn by `drawMarkers` and, together with room outlines, by one call `drawFloor(app, floor)` that every plan-showing view uses; it reads what to ring, pulse or drag from `app.mode` and `app.ui`. Choice lists, tap de-duplication, hit testing and wording are pure and tested.

**Tech Stack:** As before: plain ES modules, SVG, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Place; Using it; Fixture catalog).

**Left for later plans on purpose:** the Breaker row of the marker sheet and "Which panel is this?" when placing a panel (Plan 3, with panels); the Mac side panel for the palette and details (2d: until then the sheets are used at every width); tapping a marker on the Map tab, search, list, Key, and the Rooms zoom button (2d); always-on labels beside markers (a marker shows its label when just placed and on hover; revisit in 2d with the details view).

**Conventions for every task**

- Work on the branch `plan-2c-place`.
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://localhost:8765.
- Views change the project only through `app.commit("what happened", (p) => m.something(p, ...))`.
- User text reaches the page only as a text child through `h()` or `svg()`.
- Stored positions are whole picture pixels.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**File map**

| File | Responsibility |
|---|---|
| `src/placing.js` (new) | Pure: marker shapes, hints, pick lists, recent choices, repeat-tap test, markers near a tap, room choices |
| `src/flow.js` (add to) | Wording: "Placed KIT-03...", "Adding: ...", warnings before a type or switch-count change, height |
| `src/view/markers.js` (new) | `drawMarkers`, `drawFloor`, `glyph` |
| `src/view/roomfields.js` (new) | The room name and label code fields, shared by Add room and "Which room?" |
| `src/view/palette.js` (new) | "What are you adding?" sheet, the 240 V and appliance lists, naming Something else |
| `src/view/place.js` (new) | The Add tab: recent row, switch count, placing, which room |
| `src/view/markersheet.js` (new) | A marker's sheet and the modes it starts: Move, Move to another floor, GFCI protects |
| `src/app.js`, `src/ui.js`, `src/view/setup.js`, `src/view/browse.js`, `src/view/rooms.js`, `src/view/lineup.js`, `styles.css` (modify) | Wiring, listed in Task 7 |

---

### Task 1: Placing helpers

**Files:**
- Create: `src/placing.js`
- Test: `tests/placing.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { TYPES } from "../src/catalog.js";
import { HINTS, PICK_LISTS, shapeOf, recentChoices, isRepeatTap, markersNear, roomChoices, suggestedNames } from "../src/placing.js";
import { sample } from "./helpers.js";

test("marker shapes follow the group: circle outlets, square switches, diamond lights, triangle the rest", () => {
  assert.deepEqual(["D", "S3", "RL", "SM", "X"].map(shapeOf), ["circle", "square", "diamond", "triangle", "triangle"]);
});

test("hints and pick lists are for real types", () => {
  for (const code of [...Object.keys(HINTS), ...Object.keys(PICK_LISTS)]) assert.ok(TYPES[code], code);
  assert.deepEqual(PICK_LISTS.R[0], ["Dryer", "Dryer outlet"]);
  assert.equal(PICK_LISTS.HA.at(-1)[1], null); // "Other" asks for a name
});

test("recentChoices is the last four different things placed, newest first", () => {
  const { p, main, kit } = sample();
  const add = (type, created, customName = "") => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, customName }, created);
  assert.deepEqual(recentChoices(p), []);
  add("D", 100); add("S", 200); add("D", 300); add("X", 400, "Sump pump"); add("L", 500); add("FL", 600);
  assert.deepEqual(recentChoices(p), [
    { type: "FL", customName: "" }, { type: "L", customName: "" }, { type: "X", customName: "Sump pump" }, { type: "D", customName: "" },
  ]);
});

test("a second tap within a second and a few pixels is a repeat", () => {
  const last = { at: 1000, sx: 100, sy: 100 };
  assert.equal(isRepeatTap(last, { at: 1500, sx: 104, sy: 103 }), true);
  assert.equal(isRepeatTap(last, { at: 2500, sx: 104, sy: 103 }), false);
  assert.equal(isRepeatTap(last, { at: 1500, sx: 140, sy: 100 }), false);
  assert.equal(isRepeatTap(null, { at: 1500, sx: 100, sy: 100 }), false);
});

test("markersNear lists the devices within reach of a tap, nearest first", () => {
  const devices = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 10, y: 0 }, { id: "c", x: 100, y: 0 }];
  assert.deepEqual(markersNear(devices, 6, 0, 8).map((d) => d.id), ["b", "a"]);
  assert.deepEqual(markersNear(devices, 50, 50, 8), []);
});

test("roomChoices lists this floor's rooms by name, the last one used first", () => {
  const { p, main, kit } = sample();
  const up = m.addFloor(p, "Upstairs", 1100);
  m.addRoom(p, { floorId: up.id, name: "Bed", code: "BED" }, 1100);
  assert.deepEqual(roomChoices(p, main.id).map((r) => r.name), ["Exterior", "Kitchen"]);
  assert.deepEqual(roomChoices(p, main.id, kit.id).map((r) => r.name), ["Kitchen", "Exterior"]);
});

test("names offered for Something else: the usual ones, then his own, without repeats", () => {
  const { p, main, kit } = sample();
  const add = (customName, created) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "X", x: 1, y: 1, customName }, created);
  add("Pool pump", 100); add("Sump pump", 200);
  const names = suggestedNames(p);
  assert.equal(names[0], "Attic fan");
  assert.equal(names.at(-1), "Pool pump");
  assert.equal(names.filter((n) => n === "Sump pump").length, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/placing.test.js`
Expected: FAIL, `Cannot find module ... src/placing.js`.

- [ ] **Step 3: Write `src/placing.js`**

```js
// What the Add tab needs to know that is not about the page: shapes, lists to choose from, and small tests.
// A "choice" is what he is adding: { type, customName }.
import { typeInfo } from "./catalog.js";
import { recentCustomNames } from "./model.js";

// One-line hints under types he may not know.
export const HINTS = {
  G: "has Test and Reset buttons",
  S3: "one of two switches for the same light",
  DM: "turn knob or slider",
  J: "a cover with nothing on it",
};

// Types that ask "which one?" first. Each entry is [button text, the name the marker gets]; null asks him to type one.
export const PICK_LISTS = {
  R: [["Dryer", "Dryer outlet"], ["Range", "Range outlet"], ["EV charger", "EV charger outlet"], ["Other 240 V", null]],
  HA: [["Water heater", "Water heater"], ["Furnace", "Furnace"], ["Disposal", "Disposal"], ["Dishwasher", "Dishwasher"], ["Other", null]],
};

const CUSTOM_SUGGESTIONS = ["Attic fan", "Sump pump", "Garage door opener", "Well pump", "Heat lamp"];

// Names offered for "Something else": the usual ones, then names he has used in this house, newest first.
export function suggestedNames(project) {
  return [...CUSTOM_SUGGESTIONS, ...recentCustomNames(project).filter((n) => !CUSTOM_SUGGESTIONS.includes(n))];
}

const SHAPES = { outlet: "circle", switch: "square", light: "diamond", other: "triangle", custom: "triangle" };

export function shapeOf(type) {
  return SHAPES[typeInfo(type).group];
}

// The last few different things placed, newest first, for the row above the plan.
export function recentChoices(project, limit = 4) {
  const out = [];
  for (const d of [...project.devices].sort((a, b) => b.created - a.created)) {
    if (out.some((c) => c.type === d.type && c.customName === d.customName)) continue;
    out.push({ type: d.type, customName: d.customName });
    if (out.length === limit) break;
  }
  return out;
}

// A tap is { at (ms), sx, sy (screen pixels) }. A second one within a second and a few pixels of the last is a
// double tap, and must not place a second device.
export function isRepeatTap(last, tap) {
  return !!last && tap.at - last.at < 1000 && Math.hypot(tap.sx - last.sx, tap.sy - last.sy) < 12;
}

// The devices within `reach` picture pixels of (x, y), nearest first.
export function markersNear(devices, x, y, reach) {
  const far = (d) => Math.hypot(d.x - x, d.y - y);
  return devices.filter((d) => far(d) <= reach).sort((a, b) => far(a) - far(b));
}

// The rooms to offer for "Which room?": this floor's, by name, with the last one used first.
export function roomChoices(project, floorId, lastRoomId = "") {
  return project.rooms.filter((r) => r.floorId === floorId)
    .sort((a, b) => (b.id === lastRoomId) - (a.id === lastRoomId) || a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/placing.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/placing.js tests/placing.test.js docs/superpowers/plans/2026-10-08-plan-2c-place.md
git commit -m "feat: placing helpers"
```

---

### Task 2: Wording for placing and changing

**Files:**
- Modify: `src/flow.js` (imports changed, functions appended)
- Test: `tests/flow-place.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { placedText, addingText, typeChangeWarning, togglesWarning, heightText } from "../src/flow.js";
import { sample } from "./helpers.js";

test("placing says the label large and how full the room is; the banner says what is being added and where", () => {
  const { p, main, kit } = sample();
  const a = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  assert.equal(placedText(p, a), "Placed KIT-01. Kitchen has 1 device");
  const b = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 2, y: 2 }, 1200);
  assert.equal(placedText(p, b), "Placed KIT-02. Kitchen has 2 devices");
  assert.equal(addingText("Duplex outlet", kit), "Adding: Duplex outlet in Kitchen");
  assert.equal(addingText("Duplex outlet", null), "Adding: Duplex outlet. Tap the plan.");
});

test("changing a type warns only when links or a breaker would be lost", () => {
  const { p, main, kit } = sample();
  const place = (type, created) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1 }, created);
  const sw = place("S", 1100), light = place("L", 1200), outlet = place("D", 1300);
  assert.equal(typeChangeWarning(p, outlet, "G"), "");
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1400);
  assert.equal(typeChangeWarning(p, sw, "L"), "KIT-01 stops being a switch. Its 1 link will be removed.");
  assert.equal(typeChangeWarning(p, light, "S"), "KIT-02 becomes a switch. Its 1 link will be removed.");
  assert.equal(typeChangeWarning(p, sw, "DM"), "");
  const panel = m.addPanel(p, { name: "Main" }, 1500);
  const b = m.addBreaker(p, { panelId: panel.id, slots: ["1"], amps: 15 }, 1500);
  m.setBreaker(p, outlet.id, b.id, false, 1600);
  assert.equal(typeChangeWarning(p, outlet, "J"), "Its breaker will be cleared.");
});

test("taking switches off a plate warns when they control something", () => {
  const { p, main, kit } = sample();
  const plate = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1, toggles: 3 }, 1100);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 2, y: 2 }, 1200);
  assert.equal(togglesWarning(p, plate, 2), "");
  m.toggleLink(p, { switchId: plate.id, toggle: 3, loadId: light.id }, 1300);
  assert.equal(togglesWarning(p, plate, 2), "Switch 3 controls 1 device. Taking it off the plate clears that.");
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 1300);
  assert.equal(togglesWarning(p, plate, 1), "The switches being taken off control 2 devices. Taking them off the plate clears that.");
});

test("a height reads in inches, or Ceiling", () => {
  assert.deepEqual([heightText(12), heightText(0), heightText(null)], ["12 in", "0 in", "Ceiling"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/flow-place.test.js`
Expected: FAIL, `does not provide an export named 'addingText'` (or another of the new names).

- [ ] **Step 3: Extend `src/flow.js`**

Replace the first import line (`import { find, affected, sortedFloors } from "./model.js";`) with:

```js
import { find, affected, sortedFloors, linksLostByTypeChange, linksOnRemovedToggles } from "./model.js";
import { typeInfo, isSwitch } from "./catalog.js";
```

Append to the end of the file:

```js

// ---- placing and changing devices

// Shown large after each tap, so he can write the label on the plate.
export function placedText(project, device) {
  const room = find(project, "rooms", device.roomId);
  const count = project.devices.filter((d) => d.roomId === device.roomId).length;
  return room ? `Placed ${device.label}. ${room.name} has ${plural(count, "device")}` : `Placed ${device.label}.`;
}

// name is what is being added ("Duplex outlet", "Dryer outlet"); room is the room taps are going into, if known.
export function addingText(name, room) {
  return room ? `Adding: ${name} in ${room.name}` : `Adding: ${name}. Tap the plan.`;
}

// What would be lost if this device became `type`, in words; "" if nothing would.
export function typeChangeWarning(project, device, type) {
  const links = linksLostByTypeChange(project, device.id, type).length;
  const parts = [];
  if (links) {
    const change = isSwitch(type) ? "becomes a switch" : "stops being a switch";
    parts.push(`${device.label} ${change}. Its ${plural(links, "link")} will be removed.`);
  }
  if (device.breakerId && !typeInfo(type).sweep) parts.push("Its breaker will be cleared.");
  return parts.join(" ");
}

// What would be lost by cutting a switch plate down to `count` switches; "" if nothing would.
export function togglesWarning(project, device, count) {
  const links = linksOnRemovedToggles(project, device.id, count);
  if (!links) return "";
  return device.toggles - count === 1
    ? `Switch ${device.toggles} controls ${plural(links, "device")}. Taking it off the plate clears that.`
    : `The switches being taken off control ${plural(links, "device")}. Taking them off the plate clears that.`;
}

export function heightText(heightIn) {
  return heightIn == null ? "Ceiling" : `${heightIn} in`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS, 115 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/flow.js tests/flow-place.test.js
git commit -m "feat: wording for placing and changing devices"
```

---

### Task 3: Markers

**Files:**
- Create: `src/view/markers.js`
- Modify: `styles.css` (append)

- [ ] **Step 1: Write `src/view/markers.js`**

```js
// Devices on the plan. A marker is drawn small and keeps its size at any zoom; its shape says what kind of thing it
// is (and so does its colour, but never only its colour).
import * as m from "../model.js";
import { displayName, typeInfo, isSwitch } from "../catalog.js";
import { shapeOf } from "../placing.js";
import { svg } from "../ui.js";
import { fixedAt } from "./plan.js";
import { drawRooms } from "./roomlayer.js";

const SHAPE = {
  circle: (cls) => svg("circle", { class: cls, r: 9 }),
  square: (cls) => svg("rect", { class: cls, x: -9, y: -9, width: 18, height: 18, rx: 2 }),
  diamond: (cls) => svg("path", { class: cls, d: "M0 -11 L11 0 L0 11 L-11 0 Z" }),
  triangle: (cls) => svg("path", { class: cls, d: "M0 -11 L11 8 L-11 8 Z" }),
};

// The shape twice: a wide white line under a thin dark one, so it shows on any picture, light or dark.
function shape(type) {
  const draw = SHAPE[shapeOf(type)];
  return svg("g", { class: "marker-shape " + typeInfo(type).group }, draw("halo"), draw("body"));
}

// The shape by itself, for a button.
export function glyph(type) {
  return svg("svg", { class: "glyph", viewBox: "-14 -14 28 28", width: 28, height: 28, "aria-hidden": "true" }, shape(type));
}

// Draw the devices of `floor` (none if it is null).
// pulse: the id of a device just placed (it wears a ring and its label for two seconds).
// moving: { id, x, y } for the device being moved, drawn there and draggable.
// ringed: a Set of ids to ring and tick.
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null } = {}) {
  const devices = floor ? app.project.devices.filter((d) => d.floorId === floor.id) : [];
  app.plan.layers.markers.replaceChildren(...devices.map((d) => {
    const room = m.find(app.project, "rooms", d.roomId);
    const held = moving && moving.id === d.id;
    const ring = d.id === pulse || (ringed && ringed.has(d.id));
    const at = held ? moving : d;
    return fixedAt(at.x, at.y, {
      class: "marker" + (d.id === pulse ? " pulse" : "") + (held ? " moving" : ""),
      "data-handle": held ? d.id : null,
    },
      svg("title", {}, `${d.label}, ${displayName(d)}${room ? ", " + room.name : ""}`),
      held && svg("circle", { class: "reach", r: 22 }),
      ring && svg("circle", { class: "ring", r: 17 }),
      shape(d.type),
      isSwitch(d.type) && svg("text", { class: "marker-text" }, String(d.toggles)),
      d.notWorking && svg("text", { class: "marker-badge", x: 9, y: -7 }, "!"),
      d.plateLabel && svg("text", { class: "marker-badge", x: -22, y: -7 }, "✎"),
      ringed && ringed.has(d.id) && svg("text", { class: "marker-badge", x: 9, y: 18 }, "✓"),
      d.id === pulse && svg("text", { class: "marker-label", y: 32 }, d.label));
  }));
}

// Everything on a floor: its room outlines and its devices. The mode in progress and the views say what to
// leave out, ring, pulse or drag.
export function drawFloor(app, floor) {
  const mode = app.mode || {};
  const shown = mode.noRooms ? null : floor;
  drawRooms(app, shown, mode.hideRoom);
  drawMarkers(app, shown, { pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null });
}
```

- [ ] **Step 2: Append to `styles.css`**

```css

/* Markers. Fixed colours, as for outlines. */
.marker-shape .halo { fill: none; stroke: #fff; stroke-width: 6px; }
.marker-shape .body { stroke: #111; stroke-width: 2px; }
.outlet .body { fill: #0b57d0; }
.switch .body { fill: #188038; }
.light .body { fill: #f9ab00; }
.other .body, .custom .body { fill: #8430ce; }
.marker-text { font: 700 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fff; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.marker-badge, .marker-label { font: 700 16px system-ui, -apple-system, "Segoe UI", sans-serif; stroke: #fff; stroke-width: 4px; paint-order: stroke; pointer-events: none; }
.marker-badge { fill: #b3261e; }
.marker-label { fill: #111; text-anchor: middle; }
.ring { fill: none; stroke: #b3261e; stroke-width: 3px; }
.pulse .ring { animation: pulse 0.7s ease-out 3; }
@keyframes pulse { from { transform: scale(0.6); opacity: 1; } to { transform: scale(1.7); opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .pulse .ring { animation: none; } } /* a steady ring instead */
.marker.moving .body { stroke: #b3261e; stroke-width: 3px; }
.glyph { flex: none; }

/* The Add tab and its sheets */
.pick-row { display: flex; align-items: center; gap: 8px; padding: 4px 16px; overflow-x: auto; }
.pick-row button { flex: none; }
button.recent, button.type-button { display: flex; align-items: center; gap: 8px; text-align: left; }
button.type-button { width: 100%; }
.type-button > span { display: flex; flex-direction: column; }
.type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.scroll { max-height: 50vh; overflow: auto; }
.scroll h3 { margin: 12px 0 6px; font-size: 18px; }
.plan-hint { margin: 0; padding: 4px 16px; }
#mode-banner .result { display: block; font-size: 22px; }
dialog.sheet.marker h2 { font-size: 32px; }
details > summary { display: flex; align-items: center; min-height: 44px; font-weight: 600; cursor: pointer; }
details > * + * { margin-top: 12px; }
```

- [ ] **Step 3: Check and commit**

Run: `node --check src/view/markers.js && node --test`
Expected: no output from the check; 115 tests pass.

```bash
git add src/view/markers.js styles.css
git commit -m "feat: markers on the plan"
```

---

### Task 4: Choosing what to add

**Files:**
- Create: `src/view/roomfields.js`, `src/view/palette.js`
- Modify: `src/ui.js` (`openSheet` takes a class)

- [ ] **Step 1: Let a sheet carry a class**

In `src/ui.js`, replace these two lines:

```js
export function openSheet(title, build) {
  const dialog = h("dialog", { class: "sheet" });
```

with:

```js
export function openSheet(title, build, cls = "") {
  const dialog = h("dialog", { class: "sheet " + cls });
```

- [ ] **Step 2: Write `src/view/roomfields.js`**

```js
// The two fields that make a room: its name and its label code. The code is suggested from the name until he types
// one himself, is turned into capitals, and a problem with it is said in words.
import { suggestCode } from "../ids.js";
import { codeProblem } from "../flow.js";
import { h } from "../ui.js";

export function roomFields(app) {
  const name = h("input", { type: "text", autocomplete: "off", autocorrect: "off", enterKeyHint: "next" });
  const code = h("input", { type: "text", autocomplete: "off", autocapitalize: "characters", maxLength: 4, enterKeyHint: "done" });
  const problem = h("p", { class: "error", role: "alert" });
  let typedCode = false;
  name.addEventListener("input", () => {
    if (!typedCode) code.value = name.value.trim() ? suggestCode(name.value, app.project.rooms.map((r) => r.code)) : "";
  });
  code.addEventListener("input", () => {
    typedCode = code.value !== "";
    code.value = code.value.toUpperCase();
    problem.textContent = "";
  });
  return {
    name,
    fields: [h("label", {}, "Room name", name), h("label", {}, "Label code (used on labels like KIT-01)", code), problem],
    // { name, code } if both are usable; otherwise says why, puts the cursor there and returns null.
    read() {
      const roomName = name.value.trim(), roomCode = code.value.trim();
      if (!roomName) {
        problem.textContent = "Give the room a name.";
        name.focus();
        return null;
      }
      const why = codeProblem(app.project, roomCode);
      if (why) {
        problem.textContent = why;
        code.focus();
        return null;
      }
      return { name: roomName, code: roomCode };
    },
  };
}
```

- [ ] **Step 3: Write `src/view/palette.js`**

```js
// Choosing a kind of thing: the sheet of large buttons by group, the short lists for 240 V outlets and hard-wired
// appliances, and naming "Something else". onChoose gets a choice: { type, customName }.
import { GROUPS, TYPES } from "../catalog.js";
import { HINTS, PICK_LISTS, suggestedNames } from "../placing.js";
import { h, button, openSheet } from "../ui.js";
import { glyph } from "./markers.js";

export function openPalette(app, title, onChoose) {
  openSheet(title, (close) => {
    const pick = (type) => {
      close();
      if (PICK_LISTS[type]) openPickList(type, onChoose);
      else if (type === "X") openNameSheet(suggestedNames(app.project), (name) => onChoose({ type, customName: name }));
      else onChoose({ type, customName: "" });
    };
    const typeButton = ([code, t]) => h("button", { type: "button", class: "type-button", onclick: () => pick(code) },
      glyph(code),
      h("span", {}, h("strong", {}, t.name), HINTS[code] && h("span", { class: "small" }, HINTS[code])));
    return [
      h("div", { class: "scroll" }, GROUPS.filter(([group]) => group !== "custom").map(([group, label]) => [
        h("h3", {}, label),
        h("div", { class: "type-grid" }, Object.entries(TYPES).filter(([, t]) => t.group === group).map(typeButton)),
      ])),
      // Always at the foot, outside the scrolling part, so it never has to be hunted for.
      h("div", { class: "buttons" },
        h("button", { type: "button", class: "recent", onclick: () => pick("X") }, glyph("X"), "Something else"),
        button("Cancel", close)),
    ];
  });
}

function openPickList(type, onChoose) {
  openSheet(type === "R" ? "Which 240 V outlet?" : "Which appliance?", (close) => [
    h("div", { class: "rows" }, PICK_LISTS[type].map(([text, name]) => button(text, () => {
      close();
      if (name) onChoose({ type, customName: name });
      else openNameSheet([], (typed) => onChoose({ type, customName: typed }));
    }))),
    button("Cancel", close),
  ]);
}

// "What is it called?" Tapping a suggestion chooses it at once; an empty name is not accepted.
function openNameSheet(suggestions, onName) {
  openSheet("What is it called?", (close) => {
    const input = h("input", { type: "text", autocomplete: "off", autocorrect: "off", enterKeyHint: "done" });
    const problem = h("p", { class: "error", role: "alert" });
    const done = (typed) => {
      const name = typed.trim();
      if (!name) {
        problem.textContent = "Type a name for it.";
        return;
      }
      close();
      onName(name);
    };
    requestAnimationFrame(() => input.focus());
    return h("form", { onsubmit: (e) => { e.preventDefault(); done(input.value); } },
      suggestions.length > 0 && h("div", { class: "buttons" }, suggestions.map((s) => button(s, () => done(s)))),
      h("label", {}, "Name", input),
      problem,
      h("div", { class: "buttons" }, h("button", { type: "submit", class: "main" }, "Done"), button("Cancel", close)));
  });
}
```

- [ ] **Step 4: Check and commit**

Run: `node --check src/ui.js && node --check src/view/roomfields.js && node --check src/view/palette.js && node --test`
Expected: no output from the checks; 115 tests pass.

```bash
git add src/ui.js src/view/roomfields.js src/view/palette.js
git commit -m "feat: palette, pick lists and room fields"
```

---

### Task 5: A marker's sheet

**Files:**
- Create: `src/view/markersheet.js`

- [ ] **Step 1: Write `src/view/markersheet.js`**

```js
// A marker's sheet: what it is and everything that can be changed about it. Every change saves at once (there is no
// Save, only Done) and the sheet is drawn again from the saved device. Also the modes it starts on the Add tab:
// Move, Move to another floor, and saying what a GFCI outlet protects.
import * as m from "../model.js";
import { nextLabel } from "../ids.js";
import { displayName, typeInfo, isSwitch } from "../catalog.js";
import { markersNear, roomChoices } from "../placing.js";
import { plural, typeChangeWarning, togglesWarning, heightText } from "../flow.js";
import { h, button, openSheet, ask, toast } from "../ui.js";
import { drawFloor } from "./markers.js";
import { openPalette } from "./palette.js";

const REACH = 22; // screen pixels: half of a 44-point target

// opts: { more: open the More part, focusNote: put the cursor in Note }
export function openMarkerSheet(app, id, opts = {}) {
  const p = app.project, d = m.find(p, "devices", id);
  if (!d) return;
  const room = m.find(p, "rooms", d.roomId), floor = m.find(p, "floors", d.floorId);
  const floors = m.sortedFloors(p), group = typeInfo(d.type).group;

  openSheet(d.label, (close) => {
    // Save one change and draw the sheet again.
    const change = (name, fn, next = {}) => {
      close();
      app.commit(name, fn);
      openMarkerSheet(app, id, next);
    };
    const row = (label, value, run) => button([h("strong", {}, label), h("span", { class: "small" }, value)], run, "row");

    const note = h("input", {
      type: "text", value: d.note, autocomplete: "off", enterKeyHint: "done",
      placeholder: d.notWorking ? "What is wrong? (bulb out, tripped GFCI...)" : "",
      onchange: () => app.commit(`changed the note on ${d.label}`, (p) => m.update(p, "devices", id, { note: note.value.trim() })),
    });
    if (opts.focusNote) requestAnimationFrame(() => note.focus());

    const setSwitches = (count) => {
      const set = () => change(`set ${d.label} to ${count === 1 ? "1 switch" : count + " switches"}`, (p) => m.setToggles(p, id, count));
      const warning = count < d.toggles ? togglesWarning(p, d, count) : "";
      if (!warning) return set();
      close();
      ask("Take it off the plate?", warning, [
        { text: `Keep ${d.toggles} switches`, cls: "main", run: () => openMarkerSheet(app, id) },
        { text: "Take it off", run: set },
      ]);
    };

    const height = h("input", {
      type: "number", min: 0, step: "any", inputMode: "decimal", value: d.heightIn == null ? "" : d.heightIn,
      onchange: () => change(`changed the height of ${d.label}`,
        (p) => m.update(p, "devices", id, { heightIn: height.value === "" ? null : Math.max(0, Number(height.value)) }), { more: true }),
    });
    const setHeight = (heightIn) => change(`changed the height of ${d.label}`, (p) => m.update(p, "devices", id, { heightIn }), { more: true });
    const gfci = m.find(p, "devices", d.gfciId);

    return [
      h("p", {}, `${displayName(d)}, ${room ? room.name : "no room"}${floors.length > 1 ? ", " + floor.name : ""}`),
      d.notWorking && h("p", { class: "error" }, "Not working"),
      d.plateLabel && h("div", { class: "buttons" },
        h("span", {}, `The plate still says ${d.plateLabel}.`),
        button("I've rewritten it", () => change(`rewrote the plate of ${d.label}`, (p) => m.confirmPlate(p, id)))),
      // Correcting a position is the common job, so these come first.
      h("div", { class: "buttons" },
        button("Move", () => { close(); startMoving(app, id); }),
        floors.length > 1 && button("Move to another floor", () => { close(); startMovingFloor(app, id); })),
      row("Type", displayName(d), () => { close(); openPalette(app, "What is it?", (choice) => changeType(app, id, choice)); }),
      row("Room", room ? room.name : "No room", () => { close(); changeRoom(app, id); }),
      h("label", {}, "Note", note),
      isSwitch(d.type) && h("div", { class: "buttons", role: "group", "aria-label": "Switches on this plate" },
        h("strong", {}, "Switches on this plate"),
        [1, 2, 3, 4].map((n) => h("button", { type: "button", "aria-pressed": String(d.toggles === n), onclick: () => n !== d.toggles && setSwitches(n) }, String(n)))),
      h("details", { open: !!opts.more },
        h("summary", {}, "More"),
        h("label", {}, `Height above the floor, in inches (now: ${heightText(d.heightIn)})`, height),
        h("div", { class: "buttons" }, [12, 18, 48].map((n) => button(String(n), () => setHeight(n))), button("Ceiling", () => setHeight(null))),
        (group === "outlet" || group === "light") && row("Behind a GFCI outlet", gfci ? gfci.label : "None", () => { close(); chooseGfci(app, id); }),
        d.type === "G" && h("div", { class: "buttons" },
          h("span", {}, `Protects ${plural(m.protectedBy(p, id).length, "device")}`),
          button("Change", () => { close(); startProtecting(app, id); })),
        // The word is shown, not just a switch.
        button(`Not working right now: ${d.notWorking ? "On" : "Off"}`, () =>
          change(d.notWorking ? `marked ${d.label} as working` : `marked ${d.label} as not working`,
            (p) => m.setNotWorking(p, id, !d.notWorking), { more: true, focusNote: !d.notWorking }))),
      h("div", { class: "buttons" }, button("Done", close, "main")),
      // Apart from the rest, in plain text; undone, not confirmed.
      button("Delete", () => {
        close();
        app.commit(`deleted ${d.label}`, (p) => m.remove(p, "devices", id));
        toast(`Deleted ${d.label}.`, { text: "Undo", run: () => app.undo() });
      }, "plain danger"),
    ];
  }, "marker");
}

function changeType(app, id, choice) {
  const d = m.find(app.project, "devices", id);
  const set = () => {
    app.commit(`changed ${d.label} to ${displayName(choice)}`, (p) => m.changeType(p, id, choice.type, choice.customName));
    openMarkerSheet(app, id);
  };
  const warning = typeChangeWarning(app.project, d, choice.type);
  if (!warning) return set();
  ask("Change what it is?", warning, [
    { text: "Cancel", cls: "main", run: () => openMarkerSheet(app, id) },
    { text: `Change it to ${displayName(choice)}`, run: set },
  ]);
}

// Changing the room never changes the label by itself: a label may already be written on the plate.
function changeRoom(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  const set = (roomId, relabel, name) => () => {
    app.commit(name, (p) => m.setRoom(p, id, roomId, relabel));
    openMarkerSheet(app, id);
  };
  openSheet("Which room is it in?", (close) => [
    h("div", { class: "rows scroll" },
      roomChoices(p, d.floorId, d.roomId).map((r) => button(r.name + (r.id === d.roomId ? " (now)" : ""), () => {
        close();
        if (r.id === d.roomId) return openMarkerSheet(app, id);
        const keep = set(r.id, false, `moved ${d.label} to ${r.name}`);
        if (d.label.startsWith(r.code + "-")) return keep();
        const fresh = nextLabel(p, r.code);
        ask(`Move ${d.label} to ${r.name}?`, "", [
          { text: `Keep the label ${d.label}`, cls: "main", run: keep },
          { text: `Relabel it ${fresh}`, run: set(r.id, true, `moved ${d.label} to ${r.name} as ${fresh}`) },
          { text: "Cancel", run: () => openMarkerSheet(app, id) },
        ]);
      })),
      d.roomId && button("No room", () => { close(); set("", false, `took ${d.label} out of its room`)(); })),
    button("Cancel", () => { close(); openMarkerSheet(app, id); }),
  ]);
}

// Which GFCI outlet's Reset button also controls this device: None, then the GFCI outlets, the same room first.
function chooseGfci(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  const set = (gfciId, name) => () => {
    app.commit(name, (p) => m.setProtection(p, id, gfciId));
    openMarkerSheet(app, id, { more: true });
  };
  const gfcis = p.devices.filter((g) => g.type === "G" && g.id !== id)
    .sort((a, b) => (b.roomId === d.roomId) - (a.roomId === d.roomId) || a.label.localeCompare(b.label, "en", { numeric: true }));
  openSheet("Behind which GFCI outlet?", (close) => [
    h("div", { class: "rows scroll" },
      button("None", () => { close(); set("", `took ${d.label} off its GFCI outlet`)(); }),
      gfcis.map((g) => button(`${g.label}, ${(m.find(p, "rooms", g.roomId) || { name: "no room" }).name}`, () => {
        close();
        set(g.id, `put ${d.label} behind ${g.label}`)();
      }))),
    gfcis.length === 0 && h("p", { class: "small" }, "No GFCI outlets placed yet."),
    button("Cancel", () => { close(); openMarkerSheet(app, id, { more: true }); }),
  ]);
}

// Moving mode. A marker moves only here, so swiping to pan the plan never drags one. Drag it, or tap where it goes.
export function startMoving(app, id) {
  const d = m.find(app.project, "devices", id);
  if (!d) return;
  const at = { id, x: d.x, y: d.y };
  const moveTo = ({ x, y }) => {
    at.x = Math.round(x);
    at.y = Math.round(y);
    drawFloor(app, app.floor());
  };
  const done = () => {
    const moved = at.x !== d.x || at.y !== d.y;
    if (moved) app.commit(`moved ${d.label}`, (p) => m.update(p, "devices", id, { x: at.x, y: at.y }));
    app.endMode();
    const room = moved && m.roomAt(app.project, d.floorId, at.x, at.y).room;
    if (!room || room.id === d.roomId) return;
    // It ended in another room's outline. The room follows; the label only if he says so.
    const set = (relabel, name) => () => app.commit(name, (p) => m.setRoom(p, id, room.id, relabel));
    const keep = set(false, `moved ${d.label} to ${room.name}`);
    if (d.label.startsWith(room.code + "-")) return keep();
    const fresh = nextLabel(app.project, room.code);
    ask(`Now in ${room.name}`, `Keep the label ${d.label}, or relabel it ${fresh}?`, [
      { text: `Keep the label ${d.label}`, cls: "main", run: keep },
      { text: `Relabel it ${fresh}`, run: set(true, `moved ${d.label} to ${room.name} as ${fresh}`) },
    ]);
  };
  Object.assign(app, { tab: "add", floorId: d.floorId });
  app.plan.handles = { move: (_, point) => moveTo(point), drop: () => {}, tap: () => {} };
  app.plan.onTap = moveTo;
  app.setMode({
    moving: at,
    text: `Moving ${d.label}. Drag it, or tap where it goes, then Done.`,
    buttons: [{ text: "Done", cls: "main", run: done }, { text: "Cancel", run: () => app.endMode() }],
  });
}

// Choose the floor, then tap where it goes there. The label, links and breaker all stay; the room is taken from
// the outline tapped, as when placing.
function startMovingFloor(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  openSheet(`Move ${d.label} to which floor?`, (close) => [
    h("div", { class: "rows" }, m.sortedFloors(p).filter((f) => f.id !== d.floorId).map((f) => button(f.name, () => {
      close();
      Object.assign(app, { tab: "add", floorId: f.id });
      app.plan.handles = null;
      app.plan.onTap = ({ x, y }) => {
        const room = m.roomAt(app.project, f.id, x, y).room;
        app.commit(`moved ${d.label} to ${f.name}`, (p) => m.moveToFloor(p, id, f.id, Math.round(x), Math.round(y), room ? room.id : ""));
        app.endMode();
        toast(`${d.label} is now on ${f.name}.`);
      };
      app.setMode({ lockFloor: true, text: `Tap where ${d.label} goes on ${f.name}`, buttons: [{ text: "Cancel", run: () => app.endMode() }] });
    }))),
    button("Cancel", () => { close(); openMarkerSheet(app, id); }),
  ]);
}

// "KIT-04: tap each outlet or light that goes dead when this GFCI trips". Each tap saves; tapping again undoes it.
function startProtecting(app, gfciId) {
  const g = m.find(app.project, "devices", gfciId);
  const show = () => app.setMode({
    ringed: new Set(m.protectedBy(app.project, gfciId).map((d) => d.id)),
    text: `${g.label}: tap each outlet or light that goes dead when this GFCI trips`,
    buttons: [{ text: "Done", cls: "main", run: () => app.endMode() }],
  });
  Object.assign(app, { tab: "add", floorId: g.floorId });
  app.plan.handles = null;
  app.plan.onTap = ({ x, y }) => {
    const floor = app.floor();
    const d = markersNear(app.project.devices.filter((x) => x.floorId === floor.id && x.id !== gfciId), x, y, REACH / app.plan.view.k)[0];
    if (!d) return;
    const on = d.gfciId === gfciId;
    app.commit(on ? `took ${d.label} off ${g.label}` : `put ${d.label} behind ${g.label}`, (p) => m.setProtection(p, d.id, on ? "" : gfciId));
    show();
  };
  show();
}
```

- [ ] **Step 2: Check and commit**

Run: `node --check src/view/markersheet.js && node --test`
Expected: no output from the check; 115 tests pass.

```bash
git add src/view/markersheet.js
git commit -m "feat: marker sheet with move, GFCI and not-working"
```

---

### Task 6: The Add tab

**Files:**
- Create: `src/view/place.js`

- [ ] **Step 1: Write `src/view/place.js`**

```js
// The Add tab: choose what you are adding, then tap the plan. The same thing stays chosen, so a room of outlets is
// one tap each. With nothing chosen, tapping a marker opens its sheet.
import * as m from "../model.js";
import { nextLabel } from "../ids.js";
import { displayName, isSwitch } from "../catalog.js";
import { recentChoices, isRepeatTap, markersNear, roomChoices } from "../placing.js";
import { placedText, addingText } from "../flow.js";
import { h, button, openSheet } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor, glyph } from "./markers.js";
import { openPalette } from "./palette.js";
import { roomFields } from "./roomfields.js";
import { openMarkerSheet } from "./markersheet.js";

const REACH = 22; // screen pixels: half of a 44-point target
let pulseTimer = 0;

// What the tab remembers: the thing being added, the switch count last used, the room taps are going into, the
// "Placed ..." line, and the last tap (to ignore a double tap).
const state = (app) => (app.ui.place ||= { choice: null, toggles: 1, roomId: "", result: "", last: null });

export function placeView(app) {
  const floor = app.floor(), st = state(app);
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!floor.imageId) {
    return h("section", { class: "plan-screen" }, floorSwitch(app),
      h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."), button("Choose a picture", () => toFloors(floor.id), "main")));
  }
  app.showPicture(floor);
  drawFloor(app, floor);
  if (!app.mode) app.plan.onTap = (tap) => tapMarker(app, tap);

  const recent = recentChoices(app.project);
  const same = (c) => !!st.choice && c.type === st.choice.type && c.customName === st.choice.customName;
  // One extra row above the plan, never two: the switch count while a switch is chosen, the recent things otherwise.
  const row = st.choice && isSwitch(st.choice.type)
    ? h("div", { class: "pick-row", role: "group", "aria-label": "Switches on this plate" },
      h("span", {}, "Switches on this plate"),
      [1, 2, 3, 4].map((n) => h("button", { type: "button", "aria-pressed": String(st.toggles === n), onclick: () => { st.toggles = n; app.render(); } }, String(n))))
    : recent.length > 0 && h("div", { class: "pick-row" },
      recent.map((c) => h("button", { type: "button", class: "recent", "aria-pressed": String(same(c)), onclick: () => choose(app, c) }, glyph(c.type), displayName(c))));

  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    h("div", { class: "pick-row" }, button("What are you adding?", () => openPalette(app, "What are you adding?", (c) => choose(app, c)), "main")),
    row,
    !app.mode && h("p", { class: "plan-hint" }, app.project.devices.length
      ? "Pick what you are adding, or tap a marker to change it."
      : "Pick what you are adding, then tap the plan where it is."),
    app.plan.el);
}

// Start (or switch to) adding this kind of thing.
function choose(app, choice) {
  const st = state(app);
  st.choice = choice;
  st.result = "";
  app.plan.handles = null;
  app.plan.onTap = (tap) => placeAt(app, tap);
  showAdding(app);
}

// The banner: "Adding: Duplex outlet in Garage", the last label placed in large type, a way to change room, Done.
function showAdding(app) {
  const st = state(app), floor = app.floor();
  const kept = m.find(app.project, "rooms", st.roomId);
  const room = kept && floor && kept.floorId === floor.id ? kept : null;
  app.setMode({
    cancel: () => { st.choice = null; st.result = ""; },
    text: addingText(displayName(st.choice), room),
    result: st.result,
    buttons: [
      room && { text: "Change room", run: () => askRoom(app, floor, (r) => { st.roomId = r.id; st.result = ""; showAdding(app); }) },
      { text: "Done", cls: "main", run: () => app.cancelMode() },
    ].filter(Boolean),
  });
}

// While adding, a tap always places, even next to an existing marker.
function placeAt(app, tap) {
  const st = state(app), floor = app.floor(), p = app.project;
  if (!floor || !floor.imageId) return;
  const now = { at: Date.now(), sx: tap.x * app.plan.view.k, sy: tap.y * app.plan.view.k };
  if (isRepeatTap(st.last, now)) return;
  st.last = now;
  const x = Math.round(tap.x), y = Math.round(tap.y);
  // The room is the outline tapped (the inner one of two nested). Outside every outline, or where outlines partly
  // overlap, it is the room already answered for this run, or else he is asked.
  const kept = m.find(p, "rooms", st.roomId);
  const room = m.roomAt(p, floor.id, x, y).room || (kept && kept.floorId === floor.id ? kept : null);
  if (room) place(app, floor, room, x, y);
  else askRoom(app, floor, (r) => place(app, floor, r, x, y));
}

function place(app, floor, room, x, y) {
  const st = state(app), { type, customName } = st.choice;
  st.roomId = room.id;
  const device = app.commit(`placed ${nextLabel(app.project, room.code)}`, (p) =>
    m.placeDevice(p, { floorId: floor.id, roomId: room.id, type, x, y, customName, toggles: st.toggles }));
  st.result = placedText(app.project, device);
  // The new marker wears a ring and its label for two seconds.
  app.ui.pulse = device.id;
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => {
    app.ui.pulse = "";
    app.render();
  }, 2000);
  showAdding(app);
}

// "Which room is it in?": this floor's rooms, the last one used first, and New room (which has no outline).
function askRoom(app, floor, onRoom) {
  openSheet("Which room is it in?", (close) => {
    const rooms = roomChoices(app.project, floor.id, state(app).roomId);
    const fresh = roomFields(app);
    return [
      rooms.length > 0 && h("div", { class: "rows scroll" }, rooms.map((r) => button(r.name, () => { close(); onRoom(r); }))),
      h("form", {
        onsubmit: (e) => {
          e.preventDefault();
          const made = fresh.read();
          if (!made) return;
          close();
          onRoom(app.commit(`added ${made.name}`, (p) => m.addRoom(p, { floorId: floor.id, name: made.name, code: made.code })));
        },
      },
        h("h3", {}, "New room"),
        fresh.fields,
        h("div", { class: "buttons" }, h("button", { type: "submit", class: rooms.length ? "" : "main" }, "Add this room"), button("Cancel", close))),
    ];
  });
}

// Nothing is being added: a tap on a marker opens its sheet. If the tap reaches more than one, he chooses.
function tapMarker(app, { x, y }) {
  const floor = app.floor();
  const near = markersNear(app.project.devices.filter((d) => d.floorId === floor.id), x, y, REACH / app.plan.view.k);
  if (near.length === 1) {
    openMarkerSheet(app, near[0].id);
  } else if (near.length > 1) {
    openSheet("Which one?", (close) => [
      h("div", { class: "rows" }, near.map((d) => button(`${d.label}, ${displayName(d)}`, () => { close(); openMarkerSheet(app, d.id); }))),
      button("Cancel", close),
    ]);
  }
}
```

- [ ] **Step 2: Check and commit**

Run: `node --check src/view/place.js && node --test`
Expected: no output from the check; 115 tests pass.

```bash
git add src/view/place.js
git commit -m "feat: the Add tab"
```

---

### Task 7: Wire it in

**Files:**
- Modify: `src/app.js`, `src/view/setup.js`, `src/view/browse.js`, `src/view/rooms.js`, `src/view/lineup.js`

- [ ] **Step 1: `src/app.js`**

After `import { setupView } from "./view/setup.js";` add:

```js
import { placeView } from "./view/place.js";
```

Replace the `const TABS = ...` line with:

```js
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["map", "Map", browseView]];

// On these tabs the phone is kept awake where the browser allows it, so the screen does not lock during a walk.
const AWAKE_TABS = ["add"];
```

In `render`, replace the line `$("screen").replaceChildren(tab[2](app));` with:

```js
  if (!app.mode) {
    // No mode is listening, so the view about to be drawn decides what a tap on the plan does.
    app.plan.onTap = null;
    app.plan.handles = null;
  }
  $("screen").replaceChildren(tab[2](app));
  keepAwake(AWAKE_TABS.includes(tab[0]));
```

and replace the line that starts `    ? [h("span", {}, app.mode.text), ...app.mode.buttons` with:

```js
    ? [h("span", {}, app.mode.text, app.mode.result && h("strong", { class: "result" }, app.mode.result)),
      ...app.mode.buttons.map((b) => button(b.text, b.run, b.cls || ""))]
```

Before `async function boot() {` add:

```js
let wakeLock = null, askingForLock = false;

async function keepAwake(on) {
  try {
    if (on && !wakeLock && !askingForLock && navigator.wakeLock && document.visibilityState === "visible") {
      askingForLock = true;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch {
    // The browser said no (low battery, or no support). Nothing to do.
  } finally {
    askingForLock = false;
  }
}

// The browser drops the lock when the app is put away; ask again when it comes back.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && app.project) render();
});

```

- [ ] **Step 2: `src/view/setup.js`**

Replace `import { drawRooms } from "./roomlayer.js";` with:

```js
import { drawFloor } from "./markers.js";
```

Replace `    drawRooms(app, app.mode.noRooms ? null : floor, app.mode.hideRoom);` with `    drawFloor(app, floor);` and `    drawRooms(app, floor);` with `    drawFloor(app, floor);`.

Replace the whole `checklistEl` function with (once the four steps are done it shrinks to one line, until something has been placed):

```js
function checklistEl(app) {
  const steps = checklist(app.project);
  if (!steps.every((s) => s.done)) {
    return h("ol", { class: "checklist" }, steps.map((s) => h("li", { class: s.done ? "done" : "" }, (s.done ? "✓ " : "") + s.text)));
  }
  return app.project.devices.length ? null : button("Next: add outlets and switches", () => app.go("add"), "main");
}
```

and its call `    checklistEl(p),` with `    checklistEl(app),`.

- [ ] **Step 3: `src/view/browse.js`**

Replace `import { drawRooms } from "./roomlayer.js";` with `import { drawFloor } from "./markers.js";`, and `  drawRooms(app, floor);` with `  drawFloor(app, floor);`.

- [ ] **Step 4: `src/view/rooms.js`**

Add to the imports:

```js
import { roomFields } from "./roomfields.js";
import { openMarkerSheet } from "./markersheet.js";
```

and remove `import { suggestCode } from "../ids.js";` and `codeProblem` is still used by `roomPage`, so leave the `flow.js` import as it is.

Replace the whole `addRoomSheet` function with:

```js
// Name and label code; then, with a picture to trace on, tap its corners.
export function addRoomSheet(app, floor) {
  openSheet("Add room", (close) => {
    const fresh = roomFields(app);
    const add = (trace) => {
      const made = fresh.read();
      if (!made) return;
      close();
      const room = app.commit(`added ${made.name}`, (p) => m.addRoom(p, { floorId: floor.id, name: made.name, code: made.code }));
      if (trace) startTracing(app, floor, room);
    };
    requestAnimationFrame(() => fresh.name.focus());
    return h("form", { onsubmit: (e) => { e.preventDefault(); add(!!floor.imageId); } },
      fresh.fields,
      h("div", { class: "buttons" },
        floor.imageId
          ? [h("button", { type: "submit", class: "main" }, "Add, then tap its corners"), button("Add without an outline", () => add(false))]
          : h("button", { type: "submit", class: "main" }, "Add"),
        button("Cancel", close)));
  });
}
```

In `reviewOutline`, move the `row` line inside the `openSheet` callback and make each row a button that opens the device's sheet. Replace:

```js
  const row = (d) => h("li", {}, `${d.label}, ${displayName(d)}, ${(m.find(app.project, "rooms", d.roomId) || { name: "no room" }).name}`);
  openSheet(`The ${room.name} outline changed`, (close) => [
```

with:

```js
  openSheet(`The ${room.name} outline changed`, (close) => {
    const row = (d) => h("li", {}, button(`${d.label}, ${displayName(d)}, ${(m.find(app.project, "rooms", d.roomId) || { name: "no room" }).name}`, () => {
      close();
      openMarkerSheet(app, d.id);
    }));
    return [
```

and the end of that function, `    button("Done", close, "main"),` followed by `  ]);`, with:

```js
    button("Done", close, "main"),
    ];
  });
```

The `CODE_LABEL` constant stays (the room's page uses it).

- [ ] **Step 5: `src/view/lineup.js`**

Replace `" Check the room outlines and fix any that sit wrong with Edit outline."` with:

```js
" Anything that sits wrong? Tap it on the Add tab and choose Move."
```

- [ ] **Step 6: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (115 pass), then `node tools/serve.mjs` and http://localhost:8765. Start a house with two floors, a picture on each, and on the first floor a traced room `Kitchen` (KIT) covering part of the picture and a room `Exterior` (EXT) with no outline. The console must stay free of errors.

Adding:
1. Floors shows "Next: add outlets and switches" instead of the checklist; it opens the Add tab. Tabs read Floors, Add, Map.
2. Add shows the floor buttons, a "What are you adding?" button, and "Pick what you are adding, then tap the plan where it is."
3. "What are you adding?" lists Outlets, Switches, Lights, Other with a shape beside each name (circle, square, diamond, triangle), hints under GFCI outlet, 3-way switch, Dimmer and Junction box, and Something else at the foot without scrolling.
4. Choose Duplex outlet. Banner: "Adding: Duplex outlet. Tap the plan." with Done. Tap inside the Kitchen outline: a blue circle with a pulsing ring and "KIT-01" under it for two seconds; banner "Adding: Duplex outlet in Kitchen" with "Placed KIT-01. Kitchen has 1 device" in large type and a Change room button; Undo reads "Undo: placed KIT-01".
5. Tap twice quickly in one spot: one device, not two. Tap elsewhere in the Kitchen: KIT-03 after KIT-02. Dragging pans without placing.
6. Tap outside every outline: still placed in Kitchen (the room for this run). Done, choose Duplex outlet again from the recent row (it shows ticked and outlined), tap outside every outline... it is still Kitchen for this run. Use Change room, pick Exterior: banner "... in Exterior"; the next tap outside gives EXT-01. A tap inside the Kitchen outline switches back to Kitchen by itself.
7. "Which room is it in?" has a New room form: `Garage` suggests `GAR`; Add this room places the device as GAR-01.
8. Choose Switch: the recent row is replaced by "Switches on this plate" 1 2 3 4 with 1 ticked. Pick 3 and tap the plan: a green square with "3" inside.
9. Choose 240 V outlet: a list Dryer, Range, EV charger, Other 240 V. Dryer: banner "Adding: Dryer outlet". Choose Something else: suggestions Attic fan, Sump pump...; an empty name says "Type a name for it."; `Pool pump` places a purple triangle, and Pool pump is offered next time.

The marker sheet:
10. Done, then tap a marker: a sheet headed with its label in large type, its type and room, Move, Move to another floor, Type, Room, Note, More, Done and Delete (plain, at the foot). Tap between two close markers: "Which one?" lists both.
11. Note: type `loose`, leave the field, Done, reopen: it is kept. Undo reads "Undo: changed the note on ...".
12. Type: change an outlet to GFCI outlet; the sheet reopens saying GFCI outlet.
13. Room: choose Exterior on a KIT device: "Move KIT-02 to Exterior?" with Keep the label KIT-02 (filled), Relabel it EXT-02, Cancel. Relabel: the sheet shows the new label and "The plate still says KIT-02." with I've rewritten it; the marker wears a pencil mark. I've rewritten it clears both.
14. On the 3-switch plate, the sheet has Switches on this plate with 3 ticked; choosing 2 changes the number in the marker.
15. More: Height shows the default (12 for an outlet); the 48 button sets it; Ceiling clears it. "Not working right now: Off" turns to On, the sheet says Not working in red, the cursor is in Note with the hint, and the marker shows "!". Behind a GFCI outlet lists None and the GFCI outlet from step 12; choosing it shows its label on the row.
16. On the GFCI outlet's sheet, More shows "Protects 1 device" and Change: banner "<label>: tap each outlet or light that goes dead when this GFCI trips"; the protected one wears a ring and tick; tapping another adds a ring, tapping again removes it. Done.
17. Move: banner "Moving KIT-01. Drag it, or tap where it goes, then Done." Drag the marker (it follows; the plan does not pan while dragging it, but dragging elsewhere pans), or tap a spot. Done: it stays. Move one from inside the Kitchen outline to outside all outlines: no question. Move an EXT device into the Kitchen outline: "Now in Kitchen" with Keep the label and Relabel it.
18. Move to another floor: choose the other floor; it shows with "Tap where KIT-01 goes on <floor>"; tap: toast "KIT-01 is now on <floor>."; the marker is there and gone from the first floor.
19. Delete: the marker goes; toast "Deleted KIT-03." with Undo, which brings it back.

Elsewhere:
20. Map and a floor's page on Floors show the markers too. Hovering a marker with the mouse shows "KIT-01, Duplex outlet, Kitchen".
21. Floors > Kitchen > Edit outline: drag a corner so a device falls outside, Done: the sheet lists it; tapping its row opens that device's sheet.
22. Reload: everything placed is still there. Phone width: the rows above the plan scroll sideways rather than wrap, and the plan keeps at least half the height while adding.

- [ ] **Step 7: Commit**

```bash
git add src/app.js src/view/setup.js src/view/browse.js src/view/rooms.js src/view/lineup.js
git commit -m "feat: wire the Add tab, markers and marker sheet into the app"
```

---

## Done when

- `node --test` passes with 0 failures (115 tests).
- Every browser check in Task 7 passes, with no console errors.
- Seven commits on `plan-2c-place`, ready to merge.

Then write Plan 2d (Browse: details view with Edit, search and filters, list by room, Key, Rooms zoom button, side panel on a wide window).
