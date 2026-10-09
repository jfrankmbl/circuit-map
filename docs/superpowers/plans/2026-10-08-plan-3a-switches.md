# Circuit Map Plan 3a: The Switches Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** He can record what each switch controls: tap a switch, tap its lights and outlets; see how many switches are still to do; and, from a light or outlet, see and change what switches it.

**Architecture:** A new Switches tab (`view/link.js`). Picking a switch starts a mode whose banner names it; taps on the plan link or unlink loads through `model.toggleLink`. The mode tells `drawFloor` which markers to ring (linked), which one is picked (the switch) and which to dim (things that cannot be switched), and the view draws thin lines from the switch to its loads in the overlay layer. Counting and wording are pure functions in `src/linking.js`.

**Tech Stack:** As before: plain ES modules, SVG, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Link).

**Roadmap.** Plan 3 is split like Plan 2:

| Plan | Delivers |
|---|---|
| 3a (this) | Switches tab |
| 3b | Breakers tab: panels, the panel picture, entering breakers, a breaker's page, "Something has no power", the Breaker row in the marker sheet, "Which panel is this?" |
| 3c | Test: the guided breaker test |
| 3d | Print (door card and full list) and Download spreadsheet |

**Left for later plans on purpose:** the "Next: test your breakers" button when every switch is set (3b, when the Breakers tab exists).

**Conventions for every task**

- Work on the branch `plan-3a-switches`.
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://localhost:8765.
- Views change the project only through `app.commit(...)`. User text reaches the page only as a text child through `h()` or `svg()`.
- The screens never say "toggle" or "link": they say "switch 2 on the plate" and "controls".
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Where a step says "Replace A with B", A appears exactly once in the file.

**File map**

| File | Responsibility |
|---|---|
| `src/linking.js` (new) | Pure: progress, what can be switched, names and rows for the sheets |
| `src/view/markers.js` (modify) | `dim`; `drawFloor` passes the mode's `dim` and `picked` |
| `src/view/link.js` (new) | The Switches tab |
| `src/app.js`, `styles.css` (modify) | The tab; the line and dim styles |

---

### Task 1: Counting and wording

**Files:**
- Create: `src/linking.js`
- Test: `tests/linking.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { canBeSwitched, switchName, switchProgress, progressText, linkBanner, controlRows, switchedRows, halfState } from "../src/linking.js";
import { sample } from "./helpers.js";

function house() {
  const s = sample();
  const { p, main, kit } = s;
  const place = (type, created, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, ...extra }, created);
  const plate = place("S", 1100, { toggles: 2 });
  const single = place("S3", 1200);
  const light = place("L", 1300);
  const outlet = place("D", 1400);
  const up = m.addFloor(p, "Upstairs", 1500);
  const hall = m.addRoom(p, { floorId: up.id, name: "Hall", code: "HAL" }, 1500);
  const hallLight = m.placeDevice(p, { floorId: up.id, roomId: hall.id, type: "L", x: 1, y: 1 }, 1600);
  return { ...s, plate, single, light, outlet, up, hallLight };
}

test("lights, outlets and appliances can be switched; switches, panels and the meter cannot", () => {
  assert.deepEqual(["L", "D", "HA", "X", "EF"].map(canBeSwitched), [true, true, true, true, true]);
  assert.deepEqual(["S", "DM", "BP", "SP", "MN"].map(canBeSwitched), [false, false, false, false, false]);
});

test("a switch is named by its place on the plate only when the plate has more than one", () => {
  const { plate, single } = house();
  assert.equal(switchName(plate, 2), "Switch 2 on KIT-01");
  assert.equal(switchName(single, 1), "KIT-02");
});

test("progress counts every switch on every plate and lists the ones that control nothing", () => {
  const { p, plate, single, light } = house();
  let progress = switchProgress(p);
  assert.deepEqual([progress.total, progress.set], [3, 0]);
  assert.equal(progressText(progress), "0 of 3 switches set");
  assert.deepEqual(progress.todo.map((t) => t.text), ["Switch 1 on KIT-01, Kitchen, Main", "Switch 2 on KIT-01, Kitchen, Main", "KIT-02, Kitchen, Main"]);
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: light.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 2000);
  assert.equal(progressText(switchProgress(p)), "2 of 3 switches set");
  m.toggleLink(p, { switchId: single.id, loadId: light.id }, 2000);
  progress = switchProgress(p);
  assert.deepEqual([progressText(progress), progress.todo], ["All 3 switches set", []]);
  assert.equal(progressText({ total: 0, set: 0 }), "");
  assert.equal(progressText({ total: 1, set: 0 }), "0 of 1 switch set");
  assert.equal(progressText({ total: 1, set: 1 }), "The switch is set");
});

test("the banner names the switch and lists what it controls on other floors", () => {
  const { p, main, up, plate, light, hallLight } = house();
  assert.equal(linkBanner(p, plate, 2, main.id), "Switch 2 on KIT-01: tap each light or outlet it controls.");
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: hallLight.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 2, loadId: light.id }, 2000);
  assert.equal(linkBanner(p, plate, 2, main.id), "Switch 2 on KIT-01: tap each light or outlet it controls. Also controls HAL-01 (Upstairs).");
  assert.equal(linkBanner(p, plate, 2, up.id), "Switch 2 on KIT-01: tap each light or outlet it controls. Also controls KIT-03 (Main).");
});

test("rows for what a switch controls, and for what switches a load", () => {
  const { p, plate, single, light, outlet } = house();
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: light.id }, 2000);
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "top" }, 2000);
  m.toggleLink(p, { switchId: single.id, loadId: light.id }, 2000);
  assert.deepEqual(controlRows(p, plate.id, 1).map((r) => r.text), ["KIT-03, Ceiling light, Main", "KIT-04, Duplex outlet, Main, top half"]);
  assert.equal(controlRows(p, plate.id, 1)[0].link.loadId, light.id);
  assert.deepEqual(switchedRows(p, light.id).map((r) => r.text), ["Switch 1 on KIT-01, Main", "KIT-02, Main"]);
  assert.deepEqual(switchedRows(p, outlet.id).map((r) => r.text), ["Switch 1 on KIT-01, Main, top half"]);
});

test("halfState says which parts of an outlet a switch controls", () => {
  const { p, plate, outlet } = house();
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: false, top: false, bottom: false });
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "top" }, 2000);
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: false, top: true, bottom: false });
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "" }, 2100);
  assert.deepEqual(halfState(p, plate.id, 1, outlet.id), { whole: true, top: false, bottom: false });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/linking.test.js`
Expected: FAIL, `Cannot find module ... src/linking.js`.

- [ ] **Step 3: Write `src/linking.js`**

```js
// What the Switches tab needs to know that is not about the page: how far he has got, what can be switched, and
// the words for a switch and for what it controls. A "toggle" here is one switch on a plate, numbered from 1.
import { find, controls, controlledBy, unlinkedToggles } from "./model.js";
import { displayName, isSwitch } from "./catalog.js";

const HALF = { top: "top half", bottom: "bottom half" };
const nameOf = (project, coll, id, fallback) => (find(project, coll, id) || { name: fallback }).name;
const half = (link) => (link.loadPart ? `, ${HALF[link.loadPart]}` : "");

// Anything that uses power can be switched; a switch, a panel or the meter cannot.
export function canBeSwitched(type) {
  return !isSwitch(type) && !["BP", "SP", "MN"].includes(type);
}

// "Switch 2 on KIT-01", or just "KIT-01" for a plate with one switch.
export function switchName(device, toggle) {
  return device.toggles > 1 ? `Switch ${toggle} on ${device.label}` : device.label;
}

// { total, set, todo }: every switch on every plate, how many control something, and the rest as rows to tap.
export function switchProgress(project) {
  const total = project.devices.reduce((n, d) => n + d.toggles, 0);
  const todo = unlinkedToggles(project).map(({ deviceId, toggle }) => {
    const d = find(project, "devices", deviceId);
    return { deviceId, toggle, text: `${switchName(d, toggle)}, ${nameOf(project, "rooms", d.roomId, "no room")}, ${nameOf(project, "floors", d.floorId, "")}` };
  });
  return { total, set: total - todo.length, todo };
}

export function progressText({ total, set }) {
  if (!total) return "";
  if (set === total) return total === 1 ? "The switch is set" : `All ${total} switches set`;
  return `${set} of ${total} ${total === 1 ? "switch" : "switches"} set`;
}

// The banner while linking. floorId is the floor showing; what the switch controls on other floors is listed,
// because those markers cannot be seen.
export function linkBanner(project, device, toggle, floorId) {
  const elsewhere = controls(project, device.id, toggle).map((l) => find(project, "devices", l.loadId))
    .filter((d) => d && d.floorId !== floorId);
  const also = elsewhere.length ? ` Also controls ${elsewhere.map((d) => `${d.label} (${nameOf(project, "floors", d.floorId, "")})`).join(", ")}.` : "";
  return `${switchName(device, toggle)}: tap each light or outlet it controls.${also}`;
}

// "What it controls": [{ link, text }], "KIT-03, Ceiling light, Main floor".
export function controlRows(project, switchId, toggle) {
  return controls(project, switchId, toggle).map((link) => {
    const d = find(project, "devices", link.loadId);
    return d && { link, text: `${d.label}, ${displayName(d)}, ${nameOf(project, "floors", d.floorId, "")}${half(link)}` };
  }).filter(Boolean);
}

// "Switched by": [{ link, text }], "Switch 1 on KIT-01, Main floor".
export function switchedRows(project, loadId) {
  return controlledBy(project, loadId).map((link) => {
    const sw = find(project, "devices", link.switchId);
    return sw && { link, text: `${switchName(sw, link.toggle)}, ${nameOf(project, "floors", sw.floorId, "")}${half(link)}` };
  }).filter(Boolean);
}

// Which parts of an outlet this switch controls now, for the ticks on Whole / Top / Bottom.
export function halfState(project, switchId, toggle, loadId) {
  const parts = controls(project, switchId, toggle).filter((l) => l.loadId === loadId).map((l) => l.loadPart);
  return { whole: parts.includes(""), top: parts.includes("top"), bottom: parts.includes("bottom") };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/linking.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/linking.js tests/linking.test.js docs/superpowers/plans/2026-10-08-plan-3a-switches.md
git commit -m "feat: switch progress and wording"
```

---

### Task 2: Dimmed markers, and the mode's picked marker

**Files:**
- Modify: `src/view/markers.js`, `styles.css`

- [ ] **Step 1: Edit `src/view/markers.js`**

Replace:

```js
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null, only = null, picked = "" } = {}) {
```

with:

```js
// dim: a Set of ids drawn faint with a dashed outline (things that cannot be used in the current mode).
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null, only = null, picked = "", dim = null } = {}) {
```

Replace:

```js
      class: "marker" + (d.id === pulse ? " pulse" : "") + (held ? " moving" : ""),
```

with:

```js
      class: "marker" + (d.id === pulse ? " pulse" : "") + (held ? " moving" : "") + (dim && dim.has(d.id) ? " dim" : ""),
```

Replace:

```js
  drawMarkers(app, shown, { pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null, ...extra });
```

with:

```js
  drawMarkers(app, shown, {
    pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null,
    picked: mode.picked || "", dim: mode.dim || null, ...extra,
  });
```

- [ ] **Step 2: Append to `styles.css`**

```css

/* The Switches tab */
.marker.dim { opacity: 0.45; }
.marker.dim .body { stroke-dasharray: 3 2; }
.link-line { stroke: #b3261e; stroke-width: 2px; vector-effect: non-scaling-stroke; pointer-events: none; }
```

- [ ] **Step 3: Check and commit**

Run: `node --check src/view/markers.js && node --test`
Expected: no output from the check; 128 tests pass.

```bash
git add src/view/markers.js styles.css
git commit -m "feat: dimmed markers and a mode's picked marker"
```

---

### Task 3: The Switches tab

**Files:**
- Create: `src/view/link.js`
- Modify: `src/app.js`

- [ ] **Step 1: Write `src/view/link.js`**

```js
// The Switches tab: what each switch controls. Tap a switch, then tap each light or outlet it controls; tap again to
// undo. Or tap a light or outlet first to see what switches it. Many switches can control one load (3-ways and
// 4-ways are just that), and one switch can control loads on other floors.
import * as m from "../model.js";
import { isSwitch, hasHalves } from "../catalog.js";
import { markersNear } from "../placing.js";
import { switchLines } from "../browse.js";
import { canBeSwitched, switchName, switchProgress, progressText, linkBanner, controlRows, switchedRows, halfState } from "../linking.js";
import { h, svg, button, openSheet, toast } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor } from "./markers.js";

const REACH = 22; // screen pixels: half of a 44-point target

// The marker nearest a tap on the floor showing, if one is within reach.
function nearest(app, { x, y }) {
  const floor = app.floor();
  return markersNear(app.project.devices.filter((d) => d.floorId === floor.id), x, y, REACH / app.plan.view.k)[0] || null;
}

export function linkView(app) {
  const p = app.project, floor = app.floor();
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => app.go("floors"), "main"));
  }
  const progress = switchProgress(p);
  if (!progress.total) {
    return h("section", { class: "page" }, h("p", {}, "No switches placed yet. Add them on the Add tab."), button("Go to Add", () => app.go("add"), "main"));
  }
  const linking = app.mode && app.mode.link;
  let main;
  if (floor.imageId) {
    app.showPicture(floor);
    drawFloor(app, floor);
    if (linking) {
      // The floor may have changed since the banner was written; it lists what is on the other floors.
      const sw = m.find(p, "devices", linking.switchId);
      if (sw) app.mode.text = linkBanner(p, sw, linking.toggle, floor.id);
      drawLines(app, floor, linking);
    } else if (!app.mode) {
      app.plan.onTap = (tap) => tapIdle(app, tap);
    }
    main = app.plan.el;
  } else {
    main = h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."));
  }
  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    h("div", { class: "pick-row" },
      h("strong", {}, progressText(progress)),
      progress.todo.length > 0 && button(`Still to do (${progress.todo.length})`, () => todoSheet(app, progress.todo))),
    !app.mode && h("p", { class: "plan-hint" }, "Tap a switch, then tap what it controls. Or tap a light or outlet to see what switches it."),
    main);
}

// A thin line from the picked switch to each thing it controls on this floor.
function drawLines(app, floor, { switchId, toggle }) {
  const p = app.project, sw = m.find(p, "devices", switchId);
  const loads = sw && sw.floorId === floor.id
    ? m.controls(p, switchId, toggle).map((l) => m.find(p, "devices", l.loadId)).filter((d) => d && d.floorId === floor.id)
    : [];
  app.plan.layers.overlay.replaceChildren(...loads.map((d) => svg("line", { class: "link-line", x1: sw.x, y1: sw.y, x2: d.x, y2: d.y })));
}

// Nothing is picked: a switch starts linking it; a light or outlet shows what switches it.
function tapIdle(app, tap) {
  const d = nearest(app, tap);
  if (!d) return;
  if (isSwitch(d.type)) pickSwitch(app, d, (toggle) => startLinking(app, d.id, toggle));
  else if (canBeSwitched(d.type)) switchedBySheet(app, d.id);
  else toast("That can't be switched.");
}

// A plate with several switches asks which one, showing what each controls now.
function pickSwitch(app, plate, onToggle) {
  if (plate.toggles < 2) return onToggle(1);
  openSheet(`${plate.label}: which switch?`, (close) => [
    h("p", { class: "small" }, "Switch 1 is the leftmost as you face the plate (the top one on an upright plate)."),
    h("div", { class: "rows" }, switchLines(app.project, plate).map((s) => button(s.text, () => {
      close();
      onToggle(s.toggle);
    }))),
    button("Cancel", close),
  ]);
}

// "Switch 2 on KIT-01: tap each light or outlet it controls." Linked ones wear a ring and a tick.
function startLinking(app, switchId, toggle) {
  const show = () => {
    const p = app.project, sw = m.find(p, "devices", switchId);
    if (!sw) return app.endMode();
    const linked = m.controls(p, switchId, toggle);
    app.setMode({
      link: { switchId, toggle },
      picked: switchId,
      ringed: new Set(linked.map((l) => l.loadId)),
      dim: new Set(p.devices.filter((d) => !isSwitch(d.type) && !canBeSwitched(d.type)).map((d) => d.id)),
      text: linkBanner(p, sw, toggle, app.floor().id),
      buttons: [
        linked.length > 0 && { text: `What it controls (${linked.length})`, run: () => controlsSheet(app, switchId, toggle, show) },
        { text: "Done", cls: "main", run: () => app.endMode() },
      ].filter(Boolean),
    });
  };
  app.plan.handles = null;
  app.plan.onTap = (tap) => {
    const d = nearest(app, tap), sw = m.find(app.project, "devices", switchId);
    if (!d || !sw) return;
    // Tapping another switch changes which one is picked.
    if (isSwitch(d.type)) return pickSwitch(app, d, (t) => startLinking(app, d.id, t));
    if (!canBeSwitched(d.type)) return toast("That can't be switched.");
    const link = (part) => {
      const on = m.controls(app.project, switchId, toggle).some((l) => l.loadId === d.id && l.loadPart === part);
      app.commit(on ? `took ${d.label} off ${switchName(sw, toggle)}` : `put ${d.label} on ${switchName(sw, toggle)}`,
        (p) => m.toggleLink(p, { switchId, toggle, loadId: d.id, loadPart: part }));
      show();
    };
    if (hasHalves(d.type)) halvesSheet(app, switchId, toggle, d, link);
    else link("");
  };
  show();
}

// An ordinary outlet can be switched whole or by halves. Whole first and largest: it is the usual answer.
function halvesSheet(app, switchId, toggle, outlet, onPart) {
  const now = halfState(app.project, switchId, toggle, outlet.id);
  openSheet(`${outlet.label}: which part does it switch?`, (close) => {
    const choose = (run) => () => { close(); run(); };
    return [
      h("div", { class: "buttons equal" },
        h("button", { type: "button", class: "main", "aria-pressed": String(now.whole), onclick: choose(() => onPart("")) }, "Whole outlet")),
      h("div", { class: "buttons" },
        h("button", { type: "button", "aria-pressed": String(now.top), onclick: choose(() => onPart("top")) }, "Top half"),
        h("button", { type: "button", "aria-pressed": String(now.bottom), onclick: choose(() => onPart("bottom")) }, "Bottom half")),
      h("p", { class: "small" }, "A tick means it is switched now; tap it again to undo."),
      button("Cancel", close),
    ];
  });
}

// "What it controls": every load, on any floor, each with Remove. after() redraws the banner.
function controlsSheet(app, switchId, toggle, after) {
  const sw = m.find(app.project, "devices", switchId), rows = controlRows(app.project, switchId, toggle);
  openSheet(`What ${switchName(sw, toggle)} controls`, (close) => [
    rows.length
      ? h("ul", { class: "rows scroll" }, rows.map((r) => h("li", {}, h("span", {}, r.text), button("Remove", () => {
        close();
        app.commit(`took ${r.text.split(",")[0]} off ${switchName(sw, toggle)}`, (p) => m.remove(p, "links", r.link.id));
        after();
        if (rows.length > 1) controlsSheet(app, switchId, toggle, after);
      }))))
      : h("p", {}, "Nothing recorded yet."),
    button("Done", close, "main"),
  ]);
}

// From the load: what switches it, with Remove, and Add a switch.
function switchedBySheet(app, loadId) {
  const d = m.find(app.project, "devices", loadId), rows = switchedRows(app.project, loadId);
  openSheet(`${d.label} is switched by`, (close) => [
    rows.length
      ? h("ul", { class: "rows scroll" }, rows.map((r) => h("li", {}, h("span", {}, r.text), button("Remove", () => {
        close();
        app.commit(`took ${d.label} off ${r.text.split(",")[0]}`, (p) => m.remove(p, "links", r.link.id));
        switchedBySheet(app, loadId);
      }))))
      : h("p", {}, "No switch recorded yet."),
    h("div", { class: "buttons" },
      button("Add a switch", () => { close(); startPickingSwitch(app, loadId); }, "main"),
      button("Done", close)),
  ]);
}

// "Tap the switch that controls KIT-03." It can be on another floor: the floor buttons still work.
function startPickingSwitch(app, loadId) {
  const d = m.find(app.project, "devices", loadId);
  app.plan.handles = null;
  app.plan.onTap = (tap) => {
    const sw = nearest(app, tap);
    if (!sw) return;
    if (!isSwitch(sw.type)) return toast("Tap a switch.");
    pickSwitch(app, sw, (toggle) => {
      const link = (part) => {
        const already = m.controls(app.project, sw.id, toggle).some((l) => l.loadId === loadId && l.loadPart === part);
        if (!already) app.commit(`put ${d.label} on ${switchName(sw, toggle)}`, (p) => m.toggleLink(p, { switchId: sw.id, toggle, loadId, loadPart: part }));
        app.endMode();
        switchedBySheet(app, loadId);
      };
      if (hasHalves(d.type)) halvesSheet(app, sw.id, toggle, d, link);
      else link("");
    });
  };
  app.setMode({
    picked: loadId,
    text: `Tap the switch that controls ${d.label}. It can be on another floor.`,
    buttons: [{ text: "Cancel", run: () => app.endMode() }],
  });
}

// "Still to do": the switches that control nothing yet. Tapping one goes to its floor and starts linking it.
function todoSheet(app, todo) {
  openSheet("Still to do", (close) => [
    h("div", { class: "rows scroll" }, todo.map((t) => button(t.text, () => {
      close();
      app.floorId = m.find(app.project, "devices", t.deviceId).floorId;
      startLinking(app, t.deviceId, t.toggle);
    }))),
    button("Cancel", close),
  ]);
}
```

- [ ] **Step 2: Register the tab in `src/app.js`**

Replace:

```js
import { placeView } from "./view/place.js";
```

with:

```js
import { placeView } from "./view/place.js";
import { linkView } from "./view/link.js";
```

Replace:

```js
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["map", "Map", browseView]];
```

with:

```js
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["link", "Switches", linkView], ["map", "Map", browseView]];
```

- [ ] **Step 3: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (128 pass), then `node tools/serve.mjs` and http://localhost:8765. Set up two floors with pictures. On the first: a 2-switch plate, a single 3-way switch, a ceiling light, a duplex outlet and a breaker panel marker. On the second: a ceiling light. The console must stay free of errors.

1. Tabs read Floors, Add, Switches, Map. With no switches placed, Switches says "No switches placed yet. Add them on the Add tab."
2. With the devices above: "0 of 3 switches set", a "Still to do (3)" button, and the hint about tapping a switch.
3. Tap the 3-way switch: banner "<label>: tap each light or outlet it controls." with Done; the switch wears a ring and its label; the panel marker is faint with a dashed outline. Tap the light: it gets a ring and tick and a thin line from the switch; the header reads "1 of 3 switches set"; the banner gains "What it controls (1)"; Undo reads "Undo: put <light> on <switch>". Tap the light again: ring, tick and line go.
4. Tap the panel marker: "That can't be switched."
5. Tap the 2-switch plate: a sheet "<label>: which switch?" with "Switch 1: nothing recorded yet." and the same for 2, and the note about which is switch 1. Choose 2: banner "Switch 2 on <label>: ...".
6. Tap the duplex outlet: a sheet Whole outlet (large), Top half, Bottom half. Top half: the outlet is ringed. Tap it again: Top half is ticked; choose Whole outlet: now Whole is the ticked one (it replaced Top).
7. Switch to the second floor with the floor buttons: the banner stays; tap the light there: ringed. Switch back: the banner now ends "Also controls <label> (<second floor>)."
8. "What it controls (2)" lists both with their type and floor and a Remove on each; Remove on the upstairs light takes it off without changing floor.
9. Done. Tap the ceiling light with nothing picked: "<label> is switched by" lists the switches from step 3 onwards (or "No switch recorded yet."), each with Remove, and Add a switch. Add a switch: banner "Tap the switch that controls <label>. It can be on another floor."; tap a non-switch: "Tap a switch."; tap the 3-way: the sheet returns listing it.
10. Still to do lists what is left; tapping a row starts linking that switch. When every switch controls something the header reads "All 3 switches set" and the button is gone.
11. On Map, tap the 2-switch plate: its details read "Switch 2 controls <outlet>." (and "Also switched from ..." where two switches share a load); a light's details list "Switched by".
12. On Add, open the linked 3-way's sheet and change its Type to Ceiling light: the warning "<label> stops being a switch. Its 1 link will be removed." appears with Cancel filled.

- [ ] **Step 4: Commit**

```bash
git add src/view/link.js src/app.js
git commit -m "feat: the Switches tab"
```

---

## Done when

- `node --test` passes with 0 failures (128 tests).
- Every browser check in Task 3 passes, with no console errors.
- Three commits on `plan-3a-switches`, ready to merge.

Then write Plan 3b (the Breakers tab).
