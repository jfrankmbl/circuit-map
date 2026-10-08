# Circuit Map Plan 2b: Rooms, Scale and Replacing a Picture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a floor's page he can add rooms and trace them on the picture, fix an outline, set the scale, and replace the picture with a better one while everything already on the floor is lined up to it.

**Architecture:** Anything done by tapping the plan is a *mode*: `app.setMode({ text, buttons, cancel, floorId })` puts words and buttons in the banner, the floor's page turns into a full-screen plan, and the mode listens through `app.plan.onTap` and `app.plan.handles`. A mode draws into `app.plan.layers.overlay`; `app.endMode()` clears all three. Room outlines are drawn by one function, `drawRooms`, on every screen that shows the plan. Geometry and wording stay in DOM-free modules with tests.

**Tech Stack:** As Plan 2a: plain ES modules, SVG, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Setup, from "Replace picture on a floor" to the end of item 1).

**Left for later plans on purpose:** tapping a device in the outline review list to open its sheet, and the "Tap it and choose Move" hint after a line-up (both need the marker sheet, Plan 2c); the checklist shrinking to "Next: add outlets and switches" (needs the Add tab, Plan 2c); the Rooms zoom button (2c).

**Conventions for every task**

- Work on the branch `plan-2b-rooms`.
- Run tests from the repo root: `node --test`. Try the app with `node tools/serve.mjs`, then http://localhost:8765.
- Views change the project only through `app.commit("what happened", (p) => m.something(p, ...))`.
- Text typed by the user reaches the page only as a text child through `h()` or `svg()`. Never `innerHTML`.
- Positions stored in the project are whole picture pixels (`Math.round`).
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**File map**

| File | Responsibility |
|---|---|
| `src/outline.js` (new) | Outline geometry: where to put a room's name, edge midpoints, add / remove / move a corner (pure) |
| `src/flow.js` (add to) | Wording for rooms, the outline review, the line-up; feet and inches; "spots too close" |
| `src/ui.js` (add to) | `nameField` (moved here from `setup.js`) |
| `src/view/plan.js` (replace) | Adds draggable handles, marks that keep their size when zoomed (`fixedAt`, `dot`) |
| `src/view/roomlayer.js` (new) | `drawRooms`: outlines and names on the plan |
| `src/app.js` (replace) | Adds modes: `setMode`, `endMode`, the banner, Esc |
| `src/view/trace.js` (new) | Tracing a room and editing its outline |
| `src/view/rooms.js` (new) | The Rooms part of a floor's page, Add room, a room's page, Delete room, the outline review |
| `src/view/scale.js` (new) | The Scale part of a floor's page |
| `src/view/lineup.js` (new) | Lining up a replacement picture from two spots |
| `src/view/setup.js` (replace) | Floor page gains Scale and Rooms; Replace picture always offered |
| `src/view/browse.js` (replace) | Map draws the room outlines |
| `styles.css` (add to) | Banner buttons, outlines, corners, number fields |

---

### Task 1: Outline geometry

**Files:**
- Create: `src/outline.js`
- Test: `tests/outline.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInOutline } from "../src/model.js";
import { labelPoint, midpoints, insertCorner, removeCorner, moveCorner } from "../src/outline.js";

const SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100]];
const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];

test("a room's name goes at a point inside its outline, even for an L shape", () => {
  assert.deepEqual(labelPoint(SQUARE), [50, 50]);
  assert.deepEqual(labelPoint(L), [5, 10]);
  assert.equal(pointInOutline(L, ...labelPoint(L)), true);
  assert.equal(pointInOutline(L, 10, 10), false); // the middle of the bounding box is on the notch, not inside
});

test("midpoints gives the middle of each side, in corner order", () => {
  assert.deepEqual(midpoints(SQUARE), [[50, 0], [100, 50], [50, 100], [0, 50]]);
});

test("adding, removing and moving a corner leave the original outline alone", () => {
  const tri = [[0, 0], [10, 0], [0, 10]];
  assert.deepEqual(insertCorner(tri, 0, [5, 0]), [[0, 0], [5, 0], [10, 0], [0, 10]]);
  assert.deepEqual(insertCorner(tri, 2, [0, 5]), [[0, 0], [10, 0], [0, 10], [0, 5]]);
  assert.deepEqual(removeCorner(tri, 1), [[0, 0], [0, 10]]);
  assert.deepEqual(moveCorner(tri, 2, [1, 9]), [[0, 0], [10, 0], [1, 9]]);
  assert.deepEqual(tri, [[0, 0], [10, 0], [0, 10]]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/outline.test.js`
Expected: FAIL, `Cannot find module ... src/outline.js`.

- [ ] **Step 3: Write `src/outline.js`**

```js
// Geometry for room outlines. An outline is a list of [x, y] corners in picture pixels.

// Where to write the room's name: the middle of the widest stretch of the outline along the line half way down it.
// The middle of the bounding box will not do: for an L shape it can fall outside the room.
export function labelPoint(outline) {
  const ys = outline.map((p) => p[1]);
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs = [];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  }
  return best ? [(best[0] + best[1]) / 2, y] : [...outline[0]];
}

// The middle of each side; entry i is between corner i and the next corner.
export function midpoints(outline) {
  return outline.map(([x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length];
    return [(x + nx) / 2, (y + ny) / 2];
  });
}

// A new corner after corner i.
export function insertCorner(outline, i, point) {
  return [...outline.slice(0, i + 1), point, ...outline.slice(i + 1)];
}

export function removeCorner(outline, i) {
  return outline.filter((_, n) => n !== i);
}

export function moveCorner(outline, i, point) {
  return outline.map((p, n) => (n === i ? point : p));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/outline.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/outline.js tests/outline.test.js docs/superpowers/plans/2026-10-08-plan-2b-rooms.md
git commit -m "feat: outline geometry"
```

---

### Task 2: Wording for rooms, review and line-up

**Files:**
- Modify: `src/flow.js` (one import line changed, functions appended)
- Test: `tests/flow-rooms.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/flow-rooms.test.js`
Expected: FAIL, `does not provide an export named 'codeProblem'` (or another of the new names).

- [ ] **Step 3: Extend `src/flow.js`**

Replace the import line at the top (`import { find, affected, sortedFloors } from "./model.js";`) with:

```js
import { find, affected, sortedFloors } from "./model.js";
import { CODE_PATTERN } from "./ids.js";
```

Append to the end of the file:

```js

// ---- rooms

export function roomSummary(project, room) {
  const devices = project.devices.filter((d) => d.roomId === room.id).length;
  return plural(devices, "device") + (room.outline.length ? "" : ", no outline");
}

export function deleteRoomQuestion(project, room) {
  const devices = project.devices.filter((d) => d.roomId === room.id).length;
  return devices ? `Delete ${room.name}? It has ${plural(devices, "device")}.` : `Delete ${room.name}?`;
}

// What is wrong with a label code, in words; "" if it can be used. roomId is the room being edited, if any.
export function codeProblem(project, code, roomId = "") {
  if (!CODE_PATTERN.test(code)) return "Use 2 to 4 capital letters or numbers, starting with a letter (like KIT or BR2).";
  const other = project.rooms.find((r) => r.code === code && r.id !== roomId);
  return other ? `${code} is already used by ${other.name}. Pick another.` : "";
}

// After an outline is edited. found is model.outlineMismatches(project, roomId). "" for a group with nothing in it.
export function mismatchText(room, found) {
  const out = found.outside.length, inn = found.inside.length;
  return {
    outside: out ? `${plural(out, "device")} ${out === 1 ? "is" : "are"} now outside ${room.name}.` : "",
    inside: inn ? `${plural(inn, "device")} from ${inn === 1 ? "another room is" : "other rooms are"} now inside it.` : "",
  };
}

// ---- scale and replacing a picture

// moved is what model.refitFloor returns.
export function refitText(moved) {
  return `Moved ${plural(moved.devices, "device")} and ${plural(moved.rooms, "room")} to fit the new picture.`;
}

// Two line-up spots must be at least a twentieth of the picture's width apart, or the fit is too rough to trust.
export function spotsTooClose(a, b, pictureWidth) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) < pictureWidth / 20;
}

// The two number boxes, "feet" and "inches", as inches. 0 when nothing usable was typed.
export function toInches(feet, inches) {
  const total = (Number(feet) || 0) * 12 + (Number(inches) || 0);
  return total > 0 ? total : 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: PASS, 104 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/flow.js tests/flow-rooms.test.js
git commit -m "feat: wording for rooms, outline review and line-up"
```

---

### Task 3: Handles, fixed-size marks and the room layer

**Files:**
- Replace: `src/view/plan.js`
- Create: `src/view/roomlayer.js`
- Modify: `src/ui.js` (append `nameField`), `styles.css` (append)

- [ ] **Step 1: Replace `src/view/plan.js` with**

What is new: `plan.handles`, the `grab` logic in the pointer listeners, the `--k` variable set in `apply`, and the exported `fixedAt` and `dot`.

```js
// The plan: a floor's picture that can be panned and zoomed, with layers above it for outlines and markers.
// One finger or the mouse drags it; two fingers, the wheel or the buttons zoom; a touch that does not move is a tap.
// Anything in a layer with a data-handle attribute can be dragged or tapped by itself (see plan.handles).
import { h, svg, button } from "../ui.js";
import { fit, zoomAt, panBy, toImage } from "../viewport.js";

const TAP_SLOP = 6;    // a touch that moves further than this many pixels is a pan or a drag, not a tap
const TOUCH_LIFT = 44; // a handle dragged by a finger sits this far above the fingertip, so it can be seen

// Something drawn at picture point (x, y) that stays the same size on screen however far the plan is zoomed.
// The kids are drawn around (0, 0) in screen pixels.
export function fixedAt(x, y, attrs, ...kids) {
  return svg("g", { transform: `translate(${x} ${y})`, ...attrs }, svg("g", { class: "fixed" }, kids));
}

// A round mark with a 44-pixel reach. cls styles the visible circle; handle (optional) makes it draggable and
// tappable under that id; text (optional) is drawn inside it.
export function dot(x, y, cls, handle = null, text = "") {
  return fixedAt(x, y, handle == null ? {} : { "data-handle": handle },
    svg("circle", { class: "reach", r: 22 }),
    svg("circle", { class: cls, r: 10 }),
    text && svg("text", { class: "dot-text", "text-anchor": "middle", "dominant-baseline": "central" }, text));
}

export function createPlan() {
  const underlay = svg("image", { preserveAspectRatio: "none" });
  const layers = { outlines: svg("g"), markers: svg("g"), overlay: svg("g") };
  const world = svg("g", {}, underlay, layers.outlines, layers.markers, layers.overlay);
  const root = svg("svg", { class: "plan-svg", role: "img", "aria-label": "Floor plan" }, world);
  const message = h("p", { class: "plan-message", role: "status" });

  const plan = {
    el: null,
    layers,          // drawn into in picture pixels: outlines (rooms), markers (devices), overlay (the current mode)
    onTap: null,     // set by a mode: ({ x, y, inside }) in picture pixels, for a tap that is not on a handle
    handles: null,   // set by a mode: { move(id, { x, y }), drop(id, { x, y }), tap(id) } for [data-handle] elements
    size: null,      // { width, height } of the picture, or null with none
    view: { k: 1, x: 0, y: 0 },
    show, fit: fitView, setMessage,
  };

  let needsFit = false, token = 0, url = "";
  const box = () => root.getBoundingClientRect();
  const apply = () => {
    world.setAttribute("transform", `translate(${plan.view.x} ${plan.view.y}) scale(${plan.view.k})`);
    root.style.setProperty("--k", plan.view.k); // .fixed marks scale by 1 / k to keep their size
  };

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
    try {
      // The load event, not img.decode(): decode() waits for the page to be visible.
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = next;
      });
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
  let grab = null;            // { id, lift } while a handle is held

  // Where a held handle is, in picture pixels: under the mouse, or above the fingertip.
  const grabPoint = (e, held) => {
    const b = box();
    const [x, y] = toImage(plan.view, e.clientX - b.left, e.clientY - b.top - held.lift);
    return { x, y };
  };

  root.addEventListener("pointerdown", (e) => {
    root.setPointerCapture(e.pointerId);
    const handle = plan.handles && pointers.size === 0 && e.target.closest("[data-handle]");
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      start = [e.clientX, e.clientY];
      moved = false;
      grab = handle ? { id: handle.dataset.handle, lift: e.pointerType === "touch" ? TOUCH_LIFT : 0 } : null;
    } else {
      moved = true; // a second finger: this is a pinch, never a tap
      grab = null;
    }
  });

  root.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = [e.clientX, e.clientY];
    if (pointers.size === 1) {
      if (!moved && Math.hypot(cur[0] - start[0], cur[1] - start[1]) < TAP_SLOP) return;
      moved = true;
      if (grab) {
        if (plan.handles) plan.handles.move(grab.id, grabPoint(e, grab));
      } else {
        plan.view = panBy(plan.view, cur[0] - prev[0], cur[1] - prev[1]);
        apply();
      }
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
    const held = grab;
    grab = null;
    if (e.type !== "pointerup" || pointers.size) return;
    if (held) {
      if (!plan.handles) return;
      if (moved) plan.handles.drop(held.id, grabPoint(e, held));
      else plan.handles.tap(held.id);
      return;
    }
    if (moved || !plan.size || !plan.onTap) return;
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
      h("button", { type: "button", "aria-label": "Zoom out", onclick: () => zoom(1 / 1.5) }, "−"),
      button("Fit", fitView)));

  // The picture may be loaded before the plan is on screen and has a size; fit it once it has one.
  new ResizeObserver(() => {
    if (needsFit) fitView();
  }).observe(plan.el);

  apply();
  return plan;
}
```

- [ ] **Step 2: Write `src/view/roomlayer.js`**

```js
// Room outlines on the plan: a faint tint with the room's name at a point inside it.
import { svg } from "../ui.js";
import { fixedAt } from "./plan.js";
import { labelPoint } from "../outline.js";

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
}
```

- [ ] **Step 3: Append `nameField` to `src/ui.js`**

```js

// A text field that saves when he leaves it or taps the keyboard's Done. An empty name is put back as it was.
export function nameField(value, save) {
  const input = h("input", {
    type: "text", value, autocomplete: "off", autocorrect: "off", enterKeyHint: "done",
    onchange: () => {
      const next = input.value.trim();
      if (next && next !== value) save(next);
      else input.value = value;
    },
  });
  return input;
}
```

- [ ] **Step 4: Change and append styles in `styles.css`**

Replace the line that starts `#mode-banner {` with:

```css
#mode-banner { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
```

Replace `input[type="text"] {` (the start of that rule; leave the rest of the line) with:

```css
input[type="text"], input[type="number"] {
```

Append to the end of the file:

```css

/* On the plan. Colours here are fixed, not themed: the picture under them is never inverted for dark mode. */
.fixed { transform: scale(calc(1 / var(--k, 1))); }
.room { fill: rgba(11, 87, 208, 0.12); stroke: #0b57d0; stroke-width: 2px; vector-effect: non-scaling-stroke; }
.room.editing { fill: rgba(11, 87, 208, 0.2); stroke-dasharray: 8 5; }
.room-name { font: 600 16px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #111; stroke: #fff; stroke-width: 4px; paint-order: stroke; pointer-events: none; }
.trace-line { fill: none; stroke: #0b57d0; stroke-width: 3px; vector-effect: non-scaling-stroke; }
.reach { fill: transparent; }
.corner { fill: #fff; stroke: #0b57d0; stroke-width: 3px; }
.corner.first, .spot, .add-corner { fill: #0b57d0; stroke: #fff; stroke-width: 3px; }
.corner.picked { fill: #b3261e; stroke: #fff; }
.add-corner { opacity: 0.85; }
.dot-text { font: 700 14px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #fff; pointer-events: none; }
[data-handle] { cursor: grab; }

dialog.sheet form > * + * { margin-top: 12px; }
dialog.sheet ul { margin: 0; padding-left: 24px; }

/* The bar under the plan: the mode text takes a full line, its buttons follow, and Undo keeps to the right. */
#mode-bar { flex-wrap: wrap; }
#mode-banner:empty { display: none; }
#mode-banner > span { flex: 1 1 100%; }
#undo { margin-left: auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 699px) { #mode-banner { flex: 1 1 100%; } }
```

- [ ] **Step 5: Check and commit**

Run: `node --check src/view/plan.js && node --check src/view/roomlayer.js && node --check src/ui.js && node --test`
Expected: no output from the checks; 104 tests pass.

```bash
git add src/view/plan.js src/view/roomlayer.js src/ui.js styles.css
git commit -m "feat: draggable handles, fixed-size marks and the room layer"
```

---

### Task 4: Modes in the shell

**Files:**
- Replace: `src/app.js`

- [ ] **Step 1: Replace `src/app.js` with**

What is new: `app.mode`, `setMode`, `endMode`; `go` and `undo` end a mode first; `render` draws the banner; Esc cancels a mode.

```js
// The shell: opens the store, loads the project, draws the tabs, the banner and the Undo button, and gives each view
// the `app` object. A view is a function (app) => element, called again after every change.
import * as m from "./model.js";
import { openStore, memoryStore } from "./store.js";
import { createHistory, remember, forget, undo, undoLabel } from "./history.js";
import { startTab } from "./flow.js";
import { h, button, toast, clearToast } from "./ui.js";
import { createPlan } from "./view/plan.js";
import { welcomeView } from "./view/welcome.js";
import { setupView } from "./view/setup.js";
import { browseView } from "./view/browse.js";

// [id, the word on the tab bar, view]. Tabs appear here as they are built.
const TABS = [["floors", "Floors", setupView], ["map", "Map", browseView]];

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

  // What he is in the middle of doing on the plan, or null. { text, buttons: [{ text, run, cls }], cancel, floorId, ... }
  // text and buttons fill the banner; cancel() is what Esc, Undo and changing tab do. A mode may add its own fields.
  mode: null,

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
    if (app.mode) app.cancelMode();
    const name = undo(app.history, app.project);
    if (!name) return;
    app.save();
    render();
    toast("Undone: " + name);
  },

  go(tab) {
    if (app.mode) app.cancelMode();
    app.tab = tab;
    render();
  },

  // Start a mode, or change what the current one says. The mode sets plan.onTap and plan.handles itself.
  setMode(mode) {
    app.mode = mode;
    render();
  },

  // Finish the mode: the banner empties and the plan stops listening.
  endMode() {
    if (!app.mode) return;
    app.mode = null;
    app.plan.onTap = null;
    app.plan.handles = null;
    app.plan.layers.overlay.replaceChildren();
    render();
  },

  cancelMode() {
    if (app.mode && app.mode.cancel) app.mode.cancel();
    app.endMode();
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
    Object.assign(app, { project, history: createHistory(), ui: {}, mode: null, floorId: "", shownImage: "", tab: startTab(project) });
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
  $("screen").replaceChildren(tab[2](app));
  $("mode-banner").replaceChildren(...(app.mode
    ? [h("span", {}, app.mode.text), ...app.mode.buttons.map((b) => button(b.text, b.run, b.cls || ""))]
    : []));
  const label = undoLabel(app.history);
  $("undo").textContent = label || "Undo";
  $("undo").disabled = !label;
}

$("undo").addEventListener("click", () => app.undo());

document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return; // a sheet handles its own keys
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "Escape" && app.mode) {
    app.cancelMode();
  } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
    // In a field Cmd-Z should undo typing, so it is left alone there.
    e.preventDefault();
    app.undo();
  }
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

- [ ] **Step 2: Check and commit**

Run: `node --check src/app.js && node --test`
Expected: no output from the check; 104 tests pass.

```bash
git add src/app.js
git commit -m "feat: modes with a banner in the shell"
```

---

### Task 5: Tracing, editing and the Rooms screens

**Files:**
- Create: `src/view/trace.js`, `src/view/rooms.js`

The two files import each other (`rooms.js` starts a trace; `trace.js` reopens Add room and opens the review). That is fine with ES modules because each only calls the other's functions later, from a button.

- [ ] **Step 1: Write `src/view/trace.js`**

```js
// Two modes on the plan: tracing a room corner by corner, and editing an outline by dragging its corners.
import * as m from "../model.js";
import { midpoints, insertCorner, removeCorner, moveCorner } from "../outline.js";
import { svg, toast } from "../ui.js";
import { dot } from "./plan.js";
import { addRoomSheet, reviewOutline } from "./rooms.js";

const FIRST_CORNER_REACH = 22; // screen pixels: a tap this close to the first corner finishes the room
const points = (outline) => outline.map((p) => p.join(",")).join(" ");

// Tap each corner of `room` on the plan. Pan and zoom still work, so a closet can be zoomed into first.
export function startTracing(app, floor, room) {
  const plan = app.plan, corners = [];

  const draw = () => plan.layers.overlay.replaceChildren(
    svg("polyline", { class: "trace-line", points: points(corners) }),
    ...corners.map(([x, y], i) => dot(x, y, i === 0 ? "corner first" : "corner")));

  const cancel = () => toast(`${room.name} has no outline yet. Trace it later from its page.`);

  const finish = () => {
    try {
      app.commit(`traced ${room.name}`, (p) => m.setOutline(p, room.id, corners.map((c) => [...c])));
    } catch (err) {
      toast(err.message); // "The lines cross. Undo the last corner or drag a corner."
      return;
    }
    app.endMode();
    app.setMode({
      floorId: floor.id, text: `${room.name} added.`,
      buttons: [
        { text: "Add another room", cls: "main", run: () => { app.endMode(); addRoomSheet(app, floor); } },
        { text: "Done", run: () => app.endMode() },
      ],
    });
  };

  const refresh = () => {
    app.setMode({
      floorId: floor.id, hideRoom: room.id, cancel,
      text: corners.length < 3 ? `Tracing ${room.name}: tap each corner`
        : `Tracing ${room.name}: tap each corner. Tap the first corner again to finish.`,
      buttons: [
        corners.length > 0 && { text: "Undo corner", run: () => { corners.pop(); refresh(); } },
        corners.length >= 3 && { text: "Finish room", cls: "main", run: finish },
        { text: "Cancel", run: () => app.cancelMode() },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = null;
  plan.onTap = ({ x, y }) => {
    if (corners.length >= 3 && Math.hypot(x - corners[0][0], y - corners[0][1]) * plan.view.k < FIRST_CORNER_REACH) {
      finish();
      return;
    }
    corners.push([Math.round(x), Math.round(y)]);
    refresh();
  };
  app.ui.roomPage = "";
  refresh();
}

// Drag a corner to move it; tap a "+" to add a corner on that side; tap a corner to pick it, then Remove corner.
// A plain tap never removes anything, since a tap often means a drag was aimed badly.
export function startEditing(app, floor, room) {
  const plan = app.plan;
  let outline = room.outline.map((p) => [...p]), picked = -1;

  const draw = () => plan.layers.overlay.replaceChildren(
    svg("polygon", { class: "room editing", points: points(outline) }),
    ...midpoints(outline).map(([x, y], i) => dot(x, y, "add-corner", "+" + i, "+")),
    ...outline.map(([x, y], i) => dot(x, y, i === picked ? "corner picked" : "corner", String(i))));

  const done = () => {
    const changed = JSON.stringify(outline) !== JSON.stringify(room.outline);
    if (changed) {
      try {
        app.commit(`changed the ${room.name} outline`, (p) => m.setOutline(p, room.id, outline));
      } catch (err) {
        toast(err.message);
        return;
      }
    }
    app.endMode();
    if (changed) reviewOutline(app, room);
  };

  const startOver = () => {
    app.endMode();
    app.commit(`cleared the ${room.name} outline`, (p) => m.update(p, "rooms", room.id, { outline: [] }));
    startTracing(app, floor, room);
    toast("Outline cleared.", { text: "Undo", run: () => app.undo() });
  };

  const refresh = () => {
    app.setMode({
      floorId: floor.id, hideRoom: room.id,
      text: `Editing the ${room.name} outline: drag a corner to move it`,
      buttons: [
        picked >= 0 && outline.length > 3 && { text: "Remove corner", run: () => { outline = removeCorner(outline, picked); picked = -1; refresh(); } },
        { text: "Done", cls: "main", run: done },
        { text: "Start over", run: startOver },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = {
    move: (id, { x, y }) => {
      if (id[0] === "+") return;
      outline = moveCorner(outline, Number(id), [Math.round(x), Math.round(y)]);
      draw();
    },
    drop: () => {},
    tap: (id) => {
      if (id[0] === "+") {
        const side = Number(id.slice(1));
        outline = insertCorner(outline, side, midpoints(outline)[side].map(Math.round));
        picked = side + 1;
      } else {
        picked = picked === Number(id) ? -1 : Number(id);
      }
      refresh();
    },
  };
  plan.onTap = () => {
    if (picked < 0) return;
    picked = -1;
    refresh();
  };
  app.ui.roomPage = "";
  refresh();
}
```

- [ ] **Step 2: Write `src/view/rooms.js`**

```js
// Rooms: the list on a floor's page, Add room, one room's page, Delete room, and the review after an outline changes.
import * as m from "../model.js";
import { suggestCode } from "../ids.js";
import { displayName } from "../catalog.js";
import { plural, roomSummary, deleteRoomQuestion, codeProblem, mismatchText } from "../flow.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { startTracing, startEditing } from "./trace.js";

const CODE_LABEL = "Label code (used on labels like KIT-01)";

// The Rooms part of a floor's page.
export function roomsSection(app, floor) {
  const rooms = app.project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name));
  return [
    h("h2", {}, "Rooms"),
    rooms.length
      ? h("ul", { class: "rows" }, rooms.map((r) => h("li", {},
        button([h("strong", {}, r.name), h("span", { class: "small" }, roomSummary(app.project, r))], () => {
          app.ui.roomPage = r.id;
          app.render();
        }, "row"))))
      : h("p", {}, "No rooms yet. Add one, then tap its corners on the plan."),
    button("Add room", () => addRoomSheet(app, floor), "main"),
  ];
}

// Name and label code; the code is suggested from the name until he types one himself.
export function addRoomSheet(app, floor) {
  openSheet("Add room", (close) => {
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
    const add = (trace) => {
      const roomName = name.value.trim(), roomCode = code.value.trim();
      if (!roomName) {
        problem.textContent = "Give the room a name.";
        name.focus();
        return;
      }
      const why = codeProblem(app.project, roomCode);
      if (why) {
        problem.textContent = why;
        code.focus();
        return;
      }
      close();
      const room = app.commit(`added ${roomName}`, (p) => m.addRoom(p, { floorId: floor.id, name: roomName, code: roomCode }));
      if (trace) startTracing(app, floor, room);
    };
    requestAnimationFrame(() => name.focus());
    // Tracing needs a picture to trace on.
    return h("form", { onsubmit: (e) => { e.preventDefault(); add(!!floor.imageId); } },
      h("label", {}, "Room name", name),
      h("label", {}, CODE_LABEL, code),
      problem,
      h("div", { class: "buttons" },
        floor.imageId
          ? [h("button", { type: "submit", class: "main" }, "Add, then tap its corners"), button("Add without an outline", () => add(false))]
          : h("button", { type: "submit", class: "main" }, "Add"),
        button("Cancel", close)));
  });
}

// One room: Name, Label code, its outline, Delete room.
export function roomPage(app, floor, room) {
  const p = app.project;
  const hasDevices = p.devices.some((d) => d.roomId === room.id);
  const problem = h("p", { class: "error", role: "alert" });
  const code = h("input", {
    type: "text", value: room.code, autocomplete: "off", autocapitalize: "characters", maxLength: 4, enterKeyHint: "done",
    oninput: () => {
      code.value = code.value.toUpperCase();
      problem.textContent = "";
    },
    onchange: () => {
      const next = code.value.trim();
      if (next === room.code) return;
      const why = codeProblem(p, next, room.id);
      if (why) problem.textContent = why;
      else app.commit(`changed the label code of ${room.name}`, (p) => m.editRoom(p, room.id, { code: next }));
    },
  });
  return h("section", { class: "page" },
    button(`Back to ${floor.name}`, () => {
      app.ui.roomPage = "";
      app.render();
    }),
    h("label", {}, "Room name", nameField(room.name, (name) => app.commit(`renamed ${room.name}`, (p) => m.editRoom(p, room.id, { name })))),
    // Labels are written on cover plates, so once a room has devices its code is shown as plain text, not a dead field.
    hasDevices
      ? h("div", {}, h("strong", {}, `Label code: ${room.code}`),
        h("p", { class: "small" }, `Labels in this room already use ${room.code}, so the code can't change.`))
      : [h("label", {}, CODE_LABEL, code), problem],
    h("p", { class: "small" }, roomSummary(p, room)),
    floor.imageId && (room.outline.length
      ? button("Edit outline", () => startEditing(app, floor, room))
      : button("Tap its corners on the plan", () => startTracing(app, floor, room), "main")),
    button("Delete room", () => deleteRoom(app, room), "plain danger"));
}

function deleteRoom(app, room) {
  const remove = (options) => () => {
    app.ui.roomPage = "";
    app.commit(`deleted ${room.name}`, (p) => m.removeRoom(p, room.id, options));
    toast(`Deleted ${room.name}.`, { text: "Undo", run: () => app.undo() });
  };
  const hasDevices = app.project.devices.some((d) => d.roomId === room.id);
  ask("Delete room", deleteRoomQuestion(app.project, room), hasDevices
    ? [
      { text: "Keep the devices", cls: "main", run: remove({}) }, // they stay on the plan with no room
      { text: "Cancel" },
      { text: "Delete the devices too", cls: "plain danger", run: remove({ deleteDevices: true }) },
    ]
    : [{ text: "Delete", cls: "main", run: remove({}) }, { text: "Cancel" }]);
}

// After an outline is edited: say which devices no longer match it. Changing an outline never moves, relabels or
// reassigns a device by itself; "Move all" is his choice, and keeps their labels.
export function reviewOutline(app, room) {
  const found = m.outlineMismatches(app.project, room.id);
  const text = mismatchText(room, found);
  if (!text.outside && !text.inside) return;
  const row = (d) => h("li", {}, `${d.label}, ${displayName(d)}, ${(m.find(app.project, "rooms", d.roomId) || { name: "no room" }).name}`);
  openSheet(`The ${room.name} outline changed`, (close) => [
    text.outside && [h("p", {}, text.outside), h("ul", {}, found.outside.map(row))],
    text.inside && [
      h("p", {}, text.inside),
      h("ul", {}, found.inside.map(row)),
      button(`Move all to ${room.name}`, () => {
        close();
        app.commit(`moved ${plural(found.inside.length, "device")} into ${room.name}`, (p) => {
          for (const d of found.inside) m.setRoom(p, d.id, room.id, false);
        });
      }),
    ],
    h("p", { class: "small" }, "Nothing has been moved or relabelled."),
    button("Done", close, "main"),
  ]);
}
```

- [ ] **Step 3: Check and commit**

Run: `node --check src/view/trace.js && node --check src/view/rooms.js && node --test`
Expected: no output from the checks; 104 tests pass.

```bash
git add src/view/trace.js src/view/rooms.js
git commit -m "feat: rooms, tracing and outline editing"
```

---

### Task 6: Scale

**Files:**
- Create: `src/view/scale.js`

- [ ] **Step 1: Write `src/view/scale.js`**

```js
// The Scale part of a floor's page. Optional: only used to show real distances. Positions never depend on it.
import * as m from "../model.js";
import { toInches } from "../flow.js";
import { h, svg, button, openSheet, toast } from "../ui.js";
import { dot } from "./plan.js";

export function scaleSection(app, floor) {
  if (!floor.imageId) return null;
  return [
    h("h2", {}, "Scale (optional)"),
    h("p", { class: "small" }, floor.pxPerIn
      ? "The scale is set, so real distances can be shown."
      : "Only needed to show real distances. Tap two points on the plan and type how far apart they really are."),
    h("div", { class: "buttons" },
      button(floor.pxPerIn ? "Set the scale again" : "Set the scale", () => startScale(app, floor)),
      floor.pxPerIn > 0 && button("Clear the scale", () =>
        app.commit(`cleared the scale of ${floor.name}`, (p) => m.update(p, "floors", floor.id, { pxPerIn: 0 })))),
  ];
}

function startScale(app, floor) {
  const plan = app.plan, ends = [];

  const draw = () => plan.layers.overlay.replaceChildren(
    ...(ends.length === 2 ? [svg("line", { class: "trace-line", x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1] })] : []),
    ...ends.map(([x, y], i) => dot(x, y, "spot", null, String(i + 1))));

  const refresh = () => {
    app.setMode({
      floorId: floor.id,
      text: ends.length === 0 ? "Setting the scale: tap one end of something you know the length of, like a wall"
        : ends.length === 1 ? "Setting the scale: now tap the other end" : "Setting the scale",
      buttons: [{ text: "Cancel", run: () => app.endMode() }],
    });
    draw();
  };

  const askDistance = () => openSheet("How far apart are they really?", (close) => {
    const feet = h("input", { type: "number", min: 0, inputMode: "numeric" });
    const inches = h("input", { type: "number", min: 0, step: "any", inputMode: "decimal" });
    const problem = h("p", { class: "error", role: "alert" });
    requestAnimationFrame(() => feet.focus());
    return h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        const total = toInches(feet.value, inches.value);
        if (!total) {
          problem.textContent = "Type the distance in feet, inches, or both.";
          return;
        }
        close();
        app.endMode();
        app.commit(`set the scale of ${floor.name}`, (p) =>
          m.update(p, "floors", floor.id, { pxPerIn: m.scaleFromPoints(ends[0], ends[1], total) }));
        toast("Scale set.");
      },
    },
      h("label", {}, "feet", feet),
      h("label", {}, "inches", inches),
      problem,
      h("div", { class: "buttons" },
        h("button", { type: "submit", class: "main" }, "Set the scale"),
        button("Cancel", () => { close(); app.endMode(); })));
  });

  plan.handles = null;
  plan.onTap = ({ x, y }) => {
    if (ends.length === 2) ends.length = 0; // the sheet was closed with Esc: start the two points again
    if (ends.length === 1 && Math.hypot(x - ends[0][0], y - ends[0][1]) < 1) {
      toast("Pick two different points.");
      return;
    }
    ends.push([x, y]);
    refresh();
    if (ends.length === 2) askDistance();
  };
  refresh();
}
```

- [ ] **Step 2: Check and commit**

Run: `node --check src/view/scale.js && node --test`
Expected: no output from the check; 104 tests pass.

```bash
git add src/view/scale.js
git commit -m "feat: set a floor's scale from two points"
```

---

### Task 7: Lining up a replacement picture

**Files:**
- Create: `src/view/lineup.js`

- [ ] **Step 1: Write `src/view/lineup.js`**

```js
// A floor's picture is being replaced and the floor already has rooms or devices (a sketch replaced by a proper
// drawing, say). He taps the same two spots on the old picture and on the new one, and everything on the floor is
// moved, resized and turned to match. Nothing is changed until Use these spots; Cancel leaves the old picture.
import * as m from "../model.js";
import { refitText, spotsTooClose } from "../flow.js";
import { toast } from "../ui.js";
import { dot } from "./plan.js";

const PROMPTS = {
  old: ["Line up the new picture. Tap a spot you can find on both pictures, like a far corner of the house.",
    "Now tap a second spot, far from the first."],
  new: ["This is the new picture. Tap the same first spot on it.", "Now tap the same second spot."],
};

// blob: the new picture, already turned and shrunk.
export function startLineUp(app, floor, blob) {
  const plan = app.plan;
  const spots = { old: [], new: [] };
  let on = "old"; // which picture is showing

  const draw = () => plan.layers.overlay.replaceChildren(...spots[on].map(([x, y], i) => dot(x, y, "spot", null, String(i + 1))));

  // Store the picture and put it on the floor. fit: the four spots for model.refitFloor, or null to move nothing.
  const save = async (fit) => {
    const imageId = m.newId();
    try {
      await app.store.putImage(imageId, blob);
    } catch {
      toast("The picture could not be saved. Try again.");
      return;
    }
    const moved = app.commit(`replaced the picture of ${floor.name}`, (p) => {
      const result = fit ? m.refitFloor(p, floor.id, fit) : null;
      m.update(p, "floors", floor.id, { imageId });
      return result;
    });
    app.endMode();
    // The old picture stays in the store until the app is next opened, so Undo brings it back.
    toast(moved ? refitText(moved) + " Check the room outlines and fix any that sit wrong with Edit outline." : "Picture replaced.",
      { text: "Undo", run: () => app.undo() });
  };

  const refresh = () => {
    const here = spots[on];
    const ready = on === "new" && here.length === 2;
    app.setMode({
      floorId: floor.id,
      ownPicture: on === "new",  // the floor's page must not put the old picture back
      noRooms: on === "new",     // outlines are still in the old picture's positions
      cancel: () => { app.shownImage = ""; }, // so the old picture is loaded again
      text: ready ? "Both spots are marked." : PROMPTS[on][here.length],
      buttons: [
        ready && { text: "Use these spots", cls: "main", run: () => save({ fromA: spots.old[0], fromB: spots.old[1], toA: spots.new[0], toB: spots.new[1] }) },
        here.length > 0 && { text: "Undo spot", run: () => { here.pop(); refresh(); } },
        on === "old" && here.length === 0 && { text: "Same picture, same size", cls: "plain", run: () => save(null) },
        { text: "Cancel", run: () => app.cancelMode() },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = null;
  plan.onTap = async ({ x, y }) => {
    const here = spots[on];
    if (here.length === 2) return;
    if (here.length === 1 && spotsTooClose(here[0], [x, y], plan.size.width)) {
      toast("Pick two spots further apart.");
      return;
    }
    here.push([x, y]);
    if (on === "old" && here.length === 2) {
      on = "new";
      app.shownImage = "line-up"; // not any floor's imageId, so the next showPicture reloads
      refresh();
      await plan.show(blob);
      return;
    }
    refresh();
  };
  refresh();
}
```

- [ ] **Step 2: Check and commit**

Run: `node --check src/view/lineup.js && node --test`
Expected: no output from the check; 104 tests pass.

```bash
git add src/view/lineup.js
git commit -m "feat: line up a replacement picture from two spots"
```

---

### Task 8: Wire it into the Floors and Map tabs

**Files:**
- Replace: `src/view/setup.js`, `src/view/browse.js`

- [ ] **Step 1: Replace `src/view/setup.js` with**

What is new: `nameField` now comes from `ui.js`; a floor's page shows a full-screen plan while a mode is on, a room's page when one is open, and otherwise gains Scale and Rooms; Replace picture is always offered and goes to the line-up when the floor is in use.

```js
// The Floors tab: the list of floors, and one floor's page (name, picture, scale, rooms, delete).
import * as m from "../model.js";
import { checklist, floorSummary, deleteFloorQuestion, floorAfterDelete } from "../flow.js";
import { readPicture, drawPicture, canvasBlob } from "../picture.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { drawRooms } from "./roomlayer.js";
import { roomsSection, roomPage } from "./rooms.js";
import { scaleSection } from "./scale.js";
import { startLineUp } from "./lineup.js";

const FLOOR_NAMES = ["Basement", "Main floor", "Upstairs", "Attic"];

export function setupView(app) {
  const floor = m.find(app.project, "floors", app.ui.floorPage || "");
  return floor ? floorPage(app, floor) : floorList(app);
}

function openFloor(app, id) {
  app.ui.floorPage = id;
  app.ui.roomPage = "";
  app.floorId = id;
  app.render();
}

function checklistEl(project) {
  const steps = checklist(project);
  if (steps.every((s) => s.done)) return null;
  return h("ol", { class: "checklist" }, steps.map((s) => h("li", { class: s.done ? "done" : "" }, (s.done ? "✓ " : "") + s.text)));
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
      ? h("ul", { class: "rows" }, floors.map(row))
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
        h("div", { class: "buttons" },
          h("button", { type: "submit", class: "main" }, "Add"),
          button("Cancel", close))),
    ];
  });
}

function floorPage(app, floor) {
  const p = app.project;

  // In the middle of something on this floor's plan (tracing, editing, scale, line-up): the plan takes the screen.
  if (app.mode && app.mode.floorId === floor.id) {
    if (!app.mode.ownPicture) app.showPicture(floor);
    drawRooms(app, app.mode.noRooms ? null : floor, app.mode.hideRoom);
    return h("section", { class: "plan-screen" }, app.plan.el);
  }

  const room = m.find(p, "rooms", app.ui.roomPage || "");
  if (room && room.floorId === floor.id) return roomPage(app, floor, room);

  const picker = h("input", {
    type: "file", accept: "image/*,application/pdf", hidden: true,
    onchange: () => {
      const file = picker.files[0];
      picker.value = "";
      if (file) choosePicture(app, floor, file);
    },
  });
  let picture;
  if (floor.imageId) {
    app.showPicture(floor);
    drawRooms(app, floor);
    picture = [app.plan.el, button("Replace picture", () => picker.click())];
  } else {
    picture = [
      h("p", {}, "Next: add a picture of the floor."),
      button("Choose a picture", () => picker.click(), "main"),
    ];
  }
  return h("section", { class: "page floor-page" },
    button("Back to floors", () => {
      app.ui.floorPage = "";
      app.ui.roomPage = "";
      app.render();
    }),
    h("label", {}, "Floor name", nameField(floor.name, (name) => app.commit(`renamed ${floor.name}`, (p) => m.update(p, "floors", floor.id, { name })))),
    h("h2", {}, "Picture"),
    picture,
    picker,
    scaleSection(app, floor),
    roomsSection(app, floor),
    button("Delete floor", () => deleteFloor(app, floor), "plain danger"));
}

// Show the chosen picture with Rotate buttons. Use this picture shrinks it and puts it on the floor; if the floor
// already has a picture with rooms or devices on it, the line-up step comes first so they follow the new one.
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
  const p = app.project;
  const lineUp = !!floor.imageId && (p.rooms.some((r) => r.floorId === floor.id && r.outline.length) || p.devices.some((d) => d.floorId === floor.id));
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
        const blob = await canvasBlob(canvas);
        if (lineUp) {
          close();
          startLineUp(app, floor, blob);
          return;
        }
        const imageId = m.newId();
        await app.store.putImage(imageId, blob);
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

- [ ] **Step 2: Replace `src/view/browse.js` with**

```js
// The Map tab. For now it shows the floor buttons and the plan with its room outlines; markers, search and details
// come with Plans 2c and 2d.
import { h, button } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawRooms } from "./roomlayer.js";

export function browseView(app) {
  const floor = app.floor();
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
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
  drawRooms(app, floor);
  return h("section", { class: "plan-screen" }, floorSwitch(app), app.plan.el);
}
```

- [ ] **Step 3: Check it in a browser**

Run: `node --check src/view/setup.js && node --check src/view/browse.js && node --test` (104 pass), then `node tools/serve.mjs` and open http://localhost:8765. Start a house, add "Main floor" and give it a picture. Keep the console open; it must stay free of errors throughout.

Rooms:
1. The floor's page now has Picture, Scale (optional) and Rooms, in that order. Rooms says "No rooms yet. Add one, then tap its corners on the plan."
2. Add room: typing `Kitchen` fills the code with `KIT`. Clear the code and type `k1`: it becomes `K1`. Put `KIT` back. "Add, then tap its corners": the plan fills the screen and the banner reads "Tracing Kitchen: tap each corner" with Cancel.
3. Tap four corners. Each tap adds a dot and the line grows; Undo corner takes the last away; from three corners there is a Finish room button and the banner mentions the first corner. Dragging still pans and the wheel still zooms, without adding corners. Tap the first corner: the banner reads "Kitchen added." with Add another room and Done, and the room shows as a blue tint with its name inside, the same size on screen at any zoom.
4. Add another room, `Kitchen 2`: the code offered is `K2`. Change it to `KIT`: "KIT is already used by Kitchen. Pick another." in red and the sheet stays. Keep `K2`, trace it as a bow tie (four corners whose lines cross) and Finish room: a toast says "The lines cross. Undo the last corner or drag a corner." and tracing continues. Cancel: toast "Kitchen 2 has no outline yet...". Its row reads "0 devices, no outline".
5. Open Kitchen: rename it to `Big kitchen` and leave the field; the header of the page and the name on the plan follow. Change the code to `BK`: accepted.
6. Edit outline: corners are white dots, sides carry a blue "+". Drag a corner: it follows the pointer and the shape redraws. Tap a "+": a corner appears there, shown picked (red), and Remove corner is offered; tap it and the corner goes. Tap a corner once: it turns red, nothing is removed. Done: back on the floor's page with the new shape. Undo reads "Undo: changed the Big kitchen outline".
7. Edit outline again, Start over: "Outline cleared." with Undo and tracing starts. Tap Undo in the toast: the outline is back and tracing has ended.
8. Open Kitchen 2, Delete room: "Delete Kitchen 2?" with Delete and Cancel. Delete, then Undo in the toast brings it back.
9. Press Esc while tracing or editing: the mode ends, nothing is saved. Switch to Map while tracing: the mode ends and Map shows the plan with the outlines and names.

Scale:
10. Set the scale: banner "Setting the scale: tap one end of something you know the length of, like a wall". Tap two points: dots 1 and 2 with a line, and a sheet "How far apart are they really?" with boxes labelled feet and inches. Set the scale with both empty: "Type the distance in feet, inches, or both." Type 12 feet: toast "Scale set.", the section says the scale is set and offers Set the scale again and Clear the scale.

Replacing the picture:
11. Replace picture, choose a different image (a rotated or resized copy of the first is ideal), Use this picture. The banner asks for a spot on both pictures, with "Same picture, same size" and Cancel; the old picture and its outlines show. Tap a spot, then tap very close to it: "Pick two spots further apart." Tap far away: the new picture appears, with no outlines, asking for the same first spot.
12. Tap the two matching spots: "Both spots are marked." with Use these spots. Use these spots: the floor's page shows the new picture with the outlines moved onto it, and a toast "Moved 0 devices and 1 room to fit the new picture. ..." with Undo. Undo: the old picture and the old outline positions are back.
13. Replace picture again and choose Cancel at the first prompt: the old picture and outlines are untouched. Again, and choose "Same picture, same size": the picture changes and the outlines stay exactly where they were.
14. On a floor with a picture but no rooms, Replace picture swaps the picture with no line-up step.

Everywhere:
15. Narrow the window below 700 px: the banner and its buttons sit above the tab bar, wrap onto extra lines if they need to, and every button is at least 44 px tall.

- [ ] **Step 4: Commit**

```bash
git add src/view/setup.js src/view/browse.js
git commit -m "feat: rooms, scale and picture line-up on the Floors tab"
```

---

## Done when

- `node --test` passes with 0 failures (104 tests).
- Every browser check in Task 8 passes, with no console errors.
- Eight commits on `plan-2b-rooms`, ready to merge.

Then write Plan 2c (the Add tab: palette, placing, markers, the marker sheet, Move) against `app.setMode`, `app.plan.handles`, `dot` / `fixedAt`, `drawRooms` and the model's `placeDevice`, `roomAt`, `setRoom`, `moveToFloor`.
