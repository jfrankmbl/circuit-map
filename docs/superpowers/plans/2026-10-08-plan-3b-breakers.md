# Circuit Map Plan 3b: The Breakers Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** He can describe his panel(s): add a panel, enter each breaker from the door label top to bottom, see the panel drawn like the real one, open a breaker to see what is on it, say which breaker a device is on (as a guess), and, with the lights out, ask "Something has no power" and be told what to check.

**Architecture:** A new Breakers tab (`view/panel.js`) with four screens kept in `app.ui.panel.page`: the panel picture (default), a breaker's page, panel settings, and the power-out card. The picture is HTML buttons in two columns, laid out by the pure `panelCells`. Two things done by tapping a space are modes: pairing the second half of a double breaker, and picking a breaker for a device from its marker sheet. All counting, layout and wording is in `src/panel.js` with tests.

**Tech Stack:** As before: plain ES modules, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Panel; Place > The marker sheet, Breaker row; Place > Panels).

**Left for later plans on purpose:** Test this breaker and every "Test breakers" button (3c); Print or save as PDF (3d); tapping a device on the plan as the answer to "Where?" (search by label covers it).

**Conventions for every task**

- Work on the branch `plan-3b-breakers`.
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://localhost:8765.
- Views change the project only through `app.commit(...)`. User text reaches the page only as a text child through `h()`.
- The screens say "space", never "slot"; "7 top" and "7 bottom" for the halves of a tandem.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Where a step says "Replace A with B", A appears exactly once in the file.

**File map**

| File | Responsibility |
|---|---|
| `src/panel.js` (new) | Pure: names, the two columns, the cells of the picture, next space, pairing, search, a breaker's summary, feed choices, the power-out card, "Where?" choices |
| `src/browse.js` (modify) | `circuitText` uses the same breaker name as everywhere else |
| `src/view/panel.js` (new) | The Breakers tab, `startPickingBreaker`, `showOnPanel`, `askWhichPanel` |
| `src/view/markersheet.js`, `src/view/browse.js`, `src/view/place.js`, `src/view/link.js`, `src/app.js`, `styles.css` (modify) | Breaker row; Show on panel; "Which panel is this?"; "Next: test your breakers"; the tab |

---

### Task 1: Panel layout, counting and wording

**Files:**
- Create: `src/panel.js`
- Modify: `src/browse.js`
- Test: `tests/panel.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { spaceName, breakerName, breakerTitle, columns, panelCells, enteredText, nextOpenSpace, pairChoices, findBreakers,
  breakerSummary, feedChoices, powerOutCard, whereChoices } from "../src/panel.js";
import { circuitText } from "../src/browse.js";
import { sample } from "./helpers.js";

// A 12-space panel: breaker 1, a double on 2/4, a tandem in 3, space 5 empty.
function house() {
  const s = sample();
  const { p } = s;
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 12 }, 1100);
  const add = (slots, amps, label, kind) => m.addBreaker(p, { panelId: panel.id, slots, amps, label, kind }, 1200);
  const b1 = add(["1"], 15, "Kitchen lights");
  const pair = add(["2", "4"], 30, "Dryer");
  const top = add(["3a"], 15, "Hall");
  const bottom = add(["3b"], 15, "");
  const empty = add(["5"], 0, "", "empty");
  return { ...s, panel, b1, pair, top, bottom, empty };
}

test("spaces and breakers are named in his words", () => {
  const { b1, pair, top, bottom } = house();
  assert.deepEqual(["7", "7a", "7b"].map(spaceName), ["7", "7 top", "7 bottom"]);
  assert.deepEqual([b1, pair, top].map(breakerName), ["1", "2/4", "3 top"]);
  assert.equal(breakerTitle(b1), "Breaker 1 (Kitchen lights)");
  assert.equal(breakerTitle(bottom), "Breaker 3 bottom");
});

test("the two columns follow the panel's numbering", () => {
  assert.deepEqual(columns({ slotCount: 6, numbering: "oddEven" }), [[1, 3, 5], [2, 4, 6]]);
  assert.deepEqual(columns({ slotCount: 6, numbering: "down" }), [[1, 2, 3], [4, 5, 6]]);
  assert.deepEqual(columns({ slotCount: 5, numbering: "down" }), [[1, 2, 3], [4, 5]]);
});

test("the picture: singles, a double across two spaces, a tandem, an empty space, and spaces to add", () => {
  const { p, panel, pair, top, bottom } = house();
  const [left, right] = panelCells(p, panel);
  assert.deepEqual(left.map((c) => c.kind), ["single", "tandem", "empty", "todo", "todo", "todo"]);
  assert.deepEqual(right.map((c) => [c.kind, c.numbers, c.span]), [["double", [2, 4], 2], ["todo", [6], 1], ["todo", [8], 1], ["todo", [10], 1], ["todo", [12], 1]]);
  assert.deepEqual([left[1].top.id, left[1].bottom.id, left[1].span], [top.id, bottom.id, 2]);
  assert.equal(right[0].breaker.id, pair.id);
  // Under the other numbering 2 and 4 are no longer next to each other: the double shows in both, to be fixed.
  m.setNumbering(p, panel.id, "down", 2000);
  assert.deepEqual(panelCells(p, panel)[0].map((c) => c.kind), ["single", "single", "tandem", "single", "empty", "todo"]);
});

test("spaces entered, the next space to enter, and which spaces can pair", () => {
  const { p, panel } = house();
  assert.equal(enteredText(p, panel), "5 of 12 spaces entered");
  assert.deepEqual([nextOpenSpace(p, panel, 0), nextOpenSpace(p, panel, 6), nextOpenSpace(p, panel, 12)], [6, 7, 6]);
  assert.deepEqual(pairChoices(p, panel, 7), [9]);   // 5 is taken
  assert.deepEqual(pairChoices(p, panel, 6), [8]);   // 4 is taken
  assert.deepEqual(pairChoices(p, panel, 12), [10]);
});

test("a breaker is found by its space number or its label", () => {
  const { p, b1, pair, top, bottom } = house();
  const ids = (q) => findBreakers(p, q).map((r) => r.breaker.id);
  assert.deepEqual(ids("2"), [pair.id]);
  assert.deepEqual(ids("3"), [top.id, bottom.id]);
  assert.deepEqual(ids("kitchen"), [b1.id]);
  assert.deepEqual([ids(""), ids("5"), ids("garage")], [[], [], []]); // an empty space is not a breaker
  assert.equal(findBreakers(p, "dryer")[0].panel.name, "Main panel");
});

test("a breaker's summary counts what is on it by kind, and what it reaches through a subpanel", () => {
  const { p, main, kit, panel, b1, pair } = house();
  const place = (type, extra = {}) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, ...extra }, 1300);
  assert.equal(breakerSummary(p, b1.id).text, "");
  for (const d of [place("D"), place("L"), place("X", { customName: "Sump pump" })]) m.setBreaker(p, d.id, b1.id, true, 1400);
  assert.equal(breakerSummary(p, b1.id).text, "3 devices: 1 outlet, 1 light, 1 something else");
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 6 }, 1500);
  m.setFedFrom(p, sub.id, pair.id, 1500);
  const s1 = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20, label: "Garage" }, 1500);
  m.setBreaker(p, place("D").id, s1.id, false, 1600);
  const sum = breakerSummary(p, pair.id);
  assert.deepEqual([sum.text, sum.more, sum.feeds.map((f) => f.name), sum.downstream.length], ["", "and 1 more through Garage subpanel", ["Garage subpanel"], 1]);
  // What can feed a panel: breakers in other panels, but never one the panel itself feeds.
  assert.deepEqual(feedChoices(p, panel.id), []);
  assert.deepEqual(feedChoices(p, sub.id).map((c) => c.text),
    ["1 Kitchen lights 15 A, Main panel", "2/4 Dryer 30 A, Main panel", "3 top Hall 15 A, Main panel", "3 bottom (no label) 15 A, Main panel"]);
  assert.equal(circuitText(p, p.devices.at(-1)), "Breaker 1 (Garage), guess");
});

test("the power-out card: what to check first, the likely breaker and how sure, and what is unknown", () => {
  const { p, main, kit, ext, b1, pair } = house();
  const place = (type) => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1 }, 1300);
  const sw = place("S"), light = place("L"), outlet = place("D"), gfci = place("G"), stray = place("D");
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1400);
  m.setProtection(p, outlet.id, gfci.id, 1400);
  m.setBreaker(p, outlet.id, b1.id, true, 1500);
  m.setBreaker(p, light.id, b1.id, false, 1500);
  let card = powerOutCard(p, { roomId: kit.id });
  assert.equal(card.title, "Kitchen has no power");
  assert.deepEqual(card.check, ["KIT-04 protects 1 device: press Reset.", "KIT-01: is it on?"]);
  assert.deepEqual([card.likely.title, card.likely.sure, card.likely.kindLine, card.likely.subLine], ["Breaker 1 (Kitchen lights), 15 A", "1 tested, 1 guessed", "", ""]);
  assert.deepEqual([card.also, card.unknown, card.none], [[], "2 devices in this room have no breaker recorded.", ""]);
  // A second breaker, a GFCI breaker, and "not working".
  m.update(p, "breakers", b1.id, { kind: "GFCI" }, 1600);
  m.setBreaker(p, stray.id, pair.id, false, 1600);
  m.setNotWorking(p, gfci.id, true, 1600);
  card = powerOutCard(p, { roomId: kit.id });
  assert.equal(card.likely.kindLine, "It is a GFCI breaker: press the Test button on it, then switch it Off and On.");
  assert.deepEqual(card.also.map((a) => a.text), ["Also: Breaker 2/4 (Dryer), 30 A, 1 device"]);
  assert.equal(card.check.at(-1), "KIT-04 is marked Not working.");
  assert.equal(card.unknown, "");
  // Nothing known; one device; a breaker on a subpanel.
  assert.equal(powerOutCard(p, { roomId: ext.id }).none, "No breaker is recorded for this room yet. Try a room next to it, or test your breakers to find out.");
  assert.equal(powerOutCard(p, { deviceId: outlet.id }).title, "KIT-03 has no power");
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 6 }, 1700);
  m.setFedFrom(p, sub.id, pair.id, 1700);
  const s1 = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20 }, 1700);
  m.setBreaker(p, outlet.id, s1.id, true, 1800);
  assert.equal(powerOutCard(p, { deviceId: outlet.id }).likely.subLine,
    "This is on Garage subpanel, which is fed by breaker 2/4 in Main panel. If the whole subpanel is off, check that one first.");
});

test("Where? offers the rooms by floor, the last one asked first, and devices by label when he types", () => {
  const { p, main, kit } = house();
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1300);
  assert.deepEqual(whereChoices(p).map((c) => c.text), ["Exterior, Main", "Kitchen, Main"]);
  assert.deepEqual(whereChoices(p, "", kit.id).map((c) => c.text), ["Kitchen, Main", "Exterior, Main"]);
  const hits = whereChoices(p, "kit");
  assert.deepEqual(hits.map((c) => c.text), ["Kitchen, Main", "KIT-01, Duplex outlet"]);
  assert.deepEqual([!!hits[0].roomId, !!hits[1].deviceId], [true, true]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/panel.test.js`
Expected: FAIL, `Cannot find module ... src/panel.js`.

- [ ] **Step 3: Write `src/panel.js`**

```js
// What the Breakers tab needs to know that is not about the page: how a panel is laid out, what to call things, and
// the words of the "Something has no power" card. A slot is text: "7", or "7a" / "7b" for the halves of a tandem.
import { find, sortedFloors, sortedBreakers, canPair, slotsEntered, devicesOnBreaker, powerOutHelp } from "./model.js";
import { displayName } from "./catalog.js";
import { plural } from "./flow.js";

const num = (slot) => parseInt(slot, 10);

// "7", "7 top", "7 bottom".
export function spaceName(slot) {
  const half = String(slot).slice(-1);
  return half === "a" ? `${num(slot)} top` : half === "b" ? `${num(slot)} bottom` : String(num(slot));
}

// "7", "13/15", "7 top".
export function breakerName(breaker) {
  return breaker.slots.map(spaceName).join("/");
}

// "Breaker 7 (Kitchen)".
export function breakerTitle(breaker) {
  return `Breaker ${breakerName(breaker)}${breaker.label ? ` (${breaker.label})` : ""}`;
}

// The word shown on a breaker for anything special.
export const KIND_WORDS = { standard: "", GFCI: "GFCI", AFCI: "AFCI", dual: "GFCI + AFCI", empty: "" };

// The space numbers down the left side and down the right side.
export function columns(panel) {
  const all = Array.from({ length: panel.slotCount }, (_, i) => i + 1);
  if (panel.numbering === "down") {
    const half = Math.ceil(panel.slotCount / 2);
    return [all.slice(0, half), all.slice(half)];
  }
  return [all.filter((n) => n % 2 === 1), all.filter((n) => n % 2 === 0)];
}

// The picture, as two columns of cells from the top. A cell is one of:
//   { kind: "todo", numbers: [n], span: 1 }                    nothing entered yet
//   { kind: "empty", numbers: [n], breaker, span: 1 }          entered as having no breaker
//   { kind: "single", numbers: [n], breaker, span: 1 }         (also each half of a double that no longer sits together)
//   { kind: "double", numbers: [n, next], breaker, span: 2 }   one tall box across two spaces
//   { kind: "tandem", numbers: [n], top, bottom, span: 2 }     two small breakers; either may be null
export function panelCells(project, panel) {
  const mine = project.breakers.filter((b) => b.panelId === panel.id);
  const at = (n) => mine.filter((b) => b.slots.some((s) => num(s) === n));
  return columns(panel).map((column) => {
    const cells = [];
    for (let i = 0; i < column.length; i++) {
      const n = column[i], next = column[i + 1], here = at(n);
      const double = here.find((b) => b.poles === 2 && b.slots.some((s) => num(s) === next));
      const halves = here.filter((b) => /[ab]$/.test(b.slots[0]));
      if (double) {
        cells.push({ kind: "double", numbers: [n, next], breaker: double, span: 2 });
        i++;
      } else if (halves.length) {
        const half = (letter) => halves.find((b) => b.slots[0].endsWith(letter)) || null;
        cells.push({ kind: "tandem", numbers: [n], top: half("a"), bottom: half("b"), span: 2 });
      } else if (here.length) {
        cells.push({ kind: here[0].kind === "empty" ? "empty" : "single", numbers: [n], breaker: here[0], span: 1 });
      } else {
        cells.push({ kind: "todo", numbers: [n], span: 1 });
      }
    }
    return cells;
  });
}

export function enteredText(project, panel) {
  return `${slotsEntered(project, panel.id)} of ${panel.slotCount} spaces entered`;
}

const openSpaces = (project, panel) => {
  const used = new Set(project.breakers.filter((b) => b.panelId === panel.id).flatMap((b) => b.slots.map(num)));
  return Array.from({ length: panel.slotCount }, (_, i) => i + 1).filter((n) => !used.has(n));
};

// The next space with nothing entered after space `after`, going round to the start; 0 when the panel is full.
export function nextOpenSpace(project, panel, after = 0) {
  const open = openSpaces(project, panel);
  return open.find((n) => n > after) || open[0] || 0;
}

// The spaces that could be the other half of a double breaker in space n: next to it on the same side, and free.
export function pairChoices(project, panel, n) {
  return openSpaces(project, panel).filter((x) => canPair(panel, String(n), String(x)));
}

// "14" means space 14; anything else matches labels. [{ breaker, panel }]
export function findBreakers(project, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hit = /^\d+$/.test(q) ? (b) => b.slots.some((s) => num(s) === Number(q)) : (b) => b.label.toLowerCase().includes(q);
  return project.panels.flatMap((panel) =>
    sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty" && hit(b)).map((breaker) => ({ breaker, panel })));
}

const GROUP_WORDS = { outlet: ["outlet", "outlets"], switch: ["switch", "switches"], light: ["light", "lights"], other: ["other", "other"], custom: ["something else", "something else"] };

// { text, more, feeds, direct, downstream }: "8 devices: 5 outlets, 2 lights, 1 other" ("" with none), and for a
// breaker that feeds a subpanel, "and 14 more through Garage subpanel".
export function breakerSummary(project, breakerId) {
  const { direct, downstream, groups } = devicesOnBreaker(project, breakerId);
  const parts = Object.keys(GROUP_WORDS).filter((g) => groups[g]).map((g) => `${groups[g]} ${GROUP_WORDS[g][groups[g] === 1 ? 0 : 1]}`);
  const feeds = project.panels.filter((panel) => panel.fedFromBreakerId === breakerId);
  return {
    text: direct.length ? `${plural(direct.length, "device")}: ${parts.join(", ")}` : "",
    more: downstream.length ? `and ${downstream.length} more through ${feeds.map((f) => f.name).join(" and ")}` : "",
    feeds, direct, downstream,
  };
}

// The breakers that could feed this panel: those in other panels, leaving out any panel this one feeds.
// [{ breaker, text }], "13/15 Garage 60 A, Main panel".
export function feedChoices(project, panelId) {
  const fedFromThis = (id) => {
    const seen = new Set();
    for (let cur = id; cur && !seen.has(cur);) {
      if (cur === panelId) return true;
      seen.add(cur);
      const feeder = find(project, "breakers", (find(project, "panels", cur) || {}).fedFromBreakerId);
      cur = feeder ? feeder.panelId : "";
    }
    return false;
  };
  return project.panels.filter((panel) => !fedFromThis(panel.id)).flatMap((panel) =>
    sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty")
      .map((breaker) => ({ breaker, text: `${breakerName(breaker)} ${breaker.label || "(no label)"} ${breaker.amps} A, ${panel.name}` })));
}

const KIND_LINES = { GFCI: "a GFCI", AFCI: "an AFCI", dual: "a GFCI and AFCI" };

// The "Something has no power" card for { roomId } or { deviceId }:
// { title, check: [lines], likely: { breakerId, title, sure, kindLine, subLine } | null, also: [{ breakerId, text }], unknown, none }
export function powerOutCard(project, target) {
  const help = powerOutHelp(project, target);
  const room = target.roomId ? find(project, "rooms", target.roomId) : null;
  const device = target.deviceId ? find(project, "devices", target.deviceId) : null;
  const check = [
    ...help.gfcis.map((g) => (g.protects ? `${g.label} protects ${plural(g.protects, "device")}: press Reset.` : `${g.label} is a GFCI outlet: press Reset.`)),
    ...help.switches.map((s) => `${find(project, "devices", s.id).toggles > 1 ? `${s.label} switch ${s.toggle}` : s.label}: is it on?`),
    ...help.notWorking.map((id) => `${find(project, "devices", id).label} is marked Not working.`),
  ];
  const describe = (e) => {
    const b = find(project, "breakers", e.breakerId), panel = b && find(project, "panels", b.panelId);
    const feeder = find(project, "breakers", e.feederId), feederPanel = feeder && find(project, "panels", feeder.panelId);
    return {
      breakerId: e.breakerId, count: e.count,
      title: `${breakerTitle(b)}, ${b.amps} A`,
      sure: [e.tested && `${e.tested} tested`, e.guessed && `${e.guessed} guessed`].filter(Boolean).join(", "),
      kindLine: KIND_LINES[b.kind] ? `It is ${KIND_LINES[b.kind]} breaker: press the Test button on it, then switch it Off and On.` : "",
      subLine: feeder ? `This is on ${panel.name}, which is fed by breaker ${breakerName(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}. If the whole subpanel is off, check that one first.` : "",
    };
  };
  const all = help.breakers.filter((e) => find(project, "breakers", e.breakerId)).map(describe);
  const unknown = help.unknown.length;
  return {
    title: `${room ? room.name : device ? device.label : "It"} has no power`,
    check,
    likely: all[0] || null,
    also: all.slice(1).map((d) => ({ breakerId: d.breakerId, text: `Also: ${d.title}, ${plural(d.count, "device")}` })),
    unknown: all.length && unknown ? `${plural(unknown, "device")} in this room ${unknown === 1 ? "has" : "have"} no breaker recorded.` : "",
    none: all.length ? "" : room
      ? "No breaker is recorded for this room yet. Try a room next to it, or test your breakers to find out."
      : "No breaker is recorded for this device yet. Test your breakers to find out.",
  };
}

// "Where?": rooms lowest floor first then by name, the one he asked about last first; when he types, rooms whose
// name matches and devices whose label matches. [{ roomId | deviceId, text }]
export function whereChoices(project, query = "", lastRoomId = "") {
  const q = query.trim().toLowerCase();
  const rooms = sortedFloors(project).flatMap((floor) =>
    project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ roomId: r.id, text: `${r.name}, ${floor.name}` })))
    .filter((c) => c.text.toLowerCase().includes(q))
    .sort((a, b) => (b.roomId === lastRoomId) - (a.roomId === lastRoomId));
  const devices = q ? project.devices.filter((d) => d.label.toLowerCase().includes(q)).slice(0, 8)
    .map((d) => ({ deviceId: d.id, text: `${d.label}, ${displayName(d)}` })) : [];
  return [...rooms, ...devices];
}
```

- [ ] **Step 4: Use the same breaker name in `src/browse.js`**

Replace:

```js
import { find, sortedFloors, breakerKey, controls, controlledBy, otherSwitches } from "./model.js";
```

with:

```js
import { find, sortedFloors, controls, controlledBy, otherSwitches } from "./model.js";
import { breakerTitle } from "./panel.js";
```

Replace:

```js
  return `Breaker ${breakerKey(b)}${b.label ? ` (${b.label})` : ""}, ${device.tested ? "tested" : "guess"}`;
```

with:

```js
  return `${breakerTitle(b)}, ${device.tested ? "tested" : "guess"}`;
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test`
Expected: PASS, 136 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/panel.js src/browse.js tests/panel.test.js docs/superpowers/plans/2026-10-08-plan-3b-breakers.md
git commit -m "feat: panel layout, breaker names and the power-out card"
```

---

### Task 2: The Breakers tab

**Files:**
- Create: `src/view/panel.js`
- Modify: `styles.css` (append)

- [ ] **Step 1: Write `src/view/panel.js`**

```js
// The Breakers tab: the panels and their breakers. Four screens, kept in state.page: the panel picture (""),
// "breaker", "settings", and "card" (the answer to "Something has no power").
import * as m from "../model.js";
import { displayName } from "../catalog.js";
import { plural } from "../flow.js";
import { listByRoom } from "../browse.js";
import { spaceName, breakerName, breakerTitle, KIND_WORDS, panelCells, enteredText, nextOpenSpace, pairChoices, findBreakers,
  breakerSummary, feedChoices, powerOutCard, whereChoices } from "../panel.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { showOnPlan } from "./browse.js";
import { openMarkerSheet } from "./markersheet.js";

const KINDS = [["standard", "Standard"], ["GFCI", "GFCI (has a Test button)"], ["AFCI", "AFCI"], ["dual", "Both GFCI and AFCI"]];
const NUMBERINGS = [
  ["oddEven", "1 2\n3 4\n5 6", "A: 1 and 2 side by side, then 3 and 4 (most panels)"],
  ["down", "1 4\n2 5\n3 6", "B: 1 to the middle down the left side, the rest down the right"],
];

// What the tab remembers. lastAmps and lastKind start the next breaker entered, so an ordinary one is only a label.
const state = (app) => (app.ui.panel ||= {
  panelId: "", page: "", breakerId: "", card: null, cardMore: false, cardBack: false, highlight: "",
  lastAmps: 15, lastKind: "standard", lastRoomId: "",
});

const show = (app, changes) => {
  Object.assign(state(app), changes);
  app.render();
};

export function panelView(app) {
  const st = state(app), p = app.project;
  const panel = m.find(p, "panels", st.panelId) || p.panels[0] || null;
  st.panelId = panel ? panel.id : "";
  if (!app.mode) {
    const breaker = m.find(p, "breakers", st.breakerId);
    if (st.page === "card" && st.card) return cardPage(app);
    if (st.page === "breaker" && breaker) return breakerPage(app, breaker);
    if (st.page === "settings" && panel) return settingsPage(app, panel);
  }
  return picturePage(app, panel);
}

// Buttons to choose one of a few values, with an optional box for another number. onPick gets the value.
function choiceRow(name, options, current, onPick, withOther = false) {
  let value = current;
  const buttons = h("span", { class: "buttons" });
  const other = withOther && h("input", {
    type: "number", min: 1, inputMode: "numeric", placeholder: "other", "aria-label": `${name}: other`,
    value: options.some(([v]) => v === value) || !value ? "" : value,
    oninput: () => {
      if (!(Number(other.value) > 0)) return;
      value = Number(other.value);
      onPick(value);
      paint();
    },
  });
  const paint = () => buttons.replaceChildren(...options.map(([v, text]) => h("button", {
    type: "button", "aria-pressed": String(value === v),
    onclick: () => {
      value = v;
      if (other) other.value = "";
      onPick(v);
      paint();
    },
  }, text)));
  paint();
  return h("div", { class: "buttons", role: "group", "aria-label": name }, buttons, other);
}

// The two numbering styles, each with a small drawing.
function numberingRow(current, onPick) {
  return h("div", { class: "rows", role: "group", "aria-label": "Numbering" }, NUMBERINGS.map(([value, drawing, text]) =>
    h("button", { type: "button", class: "numbering", "aria-pressed": String(current === value), onclick: () => onPick(value) },
      h("span", { class: "mini" }, drawing), h("span", {}, text))));
}

// ---- the panel picture

function picturePage(app, panel) {
  const st = state(app), p = app.project;
  const results = h("div", { class: "rows" });
  const search = h("input", {
    type: "search", placeholder: "Find a breaker: number or label", "aria-label": "Find a breaker", autocomplete: "off", enterKeyHint: "search",
    oninput: () => results.replaceChildren(...findBreakers(p, search.value).map(({ breaker, panel }) =>
      button(`${breakerTitle(breaker)}, ${breaker.amps} A, ${panel.name}`, () => openBreaker(app, breaker)))),
  });
  return h("section", { class: "page panel-page" },
    // First on the tab: for when he is at the panel with the lights out.
    !app.mode && button("Something has no power", () => whereSheet(app), "main big"),
    st.cardBack && button("Back to the card", () => show(app, { page: "card", cardBack: false, highlight: "" })),
    !panel
      ? [h("p", {}, "No panels yet. Add the one with your main breaker."), button("Add panel", () => addPanelSheet(app), "main")]
      : [
        p.panels.length > 1 && h("div", { class: "pick-row", role: "group", "aria-label": "Panel" }, p.panels.map((x) =>
          h("button", { type: "button", "aria-pressed": String(x.id === panel.id), onclick: () => show(app, { panelId: x.id }) }, x.name))),
        h("div", { class: "panel-head" },
          h("strong", {}, `${panel.name}: ${enteredText(p, panel)}`),
          !app.mode && h("div", { class: "buttons" },
            button("Panel settings", () => show(app, { page: "settings" })),
            button("Add panel", () => addPanelSheet(app)))),
        !app.mode && [search, results],
        pictureEl(app, panel),
      ]);
}

// Two columns of spaces, drawn like the real panel. Nothing here relies on colour: each kind of space says what it is.
function pictureEl(app, panel) {
  const st = state(app), p = app.project, mode = app.mode || {};
  const pairable = mode.pairing ? new Set(pairChoices(p, panel, mode.pairing.n)) : null;
  const facts = (b, extra) => [b.amps ? `${b.amps} A` : "", KIND_WORDS[b.kind], extra].filter(Boolean).join(", ");
  // A breaker: opens its page, or, while a breaker is being picked for a device, is the answer.
  const breakerEl = (b, number, cls, extra) => h("button", {
    type: "button", class: `space ${cls}` + (b.id === st.highlight ? " highlight" : ""), disabled: !!mode.pairing,
    onclick: () => (mode.pickBreaker ? mode.choose(b) : openBreaker(app, b)),
  },
    h("span", { class: "space-no" }, number),
    h("span", { class: "space-label" }, b.label || "(no label)"),
    h("span", { class: "small" }, facts(b, extra)),
    b.id === st.highlight && h("strong", {}, "Check this one"));
  const todoEl = (slot) => {
    const n = parseInt(slot, 10), canPair = pairable && pairable.has(n) && String(n) === slot;
    return h("button", {
      type: "button", class: "space todo", disabled: pairable ? !canPair : !!mode.pickBreaker,
      onclick: () => (canPair ? finishPairing(app, panel, n) : openEntry(app, panel, slot)),
    }, h("span", { class: "space-no" }, spaceName(slot)), h("span", {}, canPair ? "tap to pair" : "tap to add"));
  };
  const cellEl = (cell) => {
    const n = cell.numbers[0];
    if (cell.kind === "todo") return todoEl(String(n));
    if (cell.kind === "tandem") {
      return h("div", { class: "space-pair" },
        cell.top ? breakerEl(cell.top, `${n} top`, "", "") : todoEl(n + "a"),
        cell.bottom ? breakerEl(cell.bottom, `${n} bottom`, "", "") : todoEl(n + "b"));
    }
    if (cell.kind === "empty") {
      return h("button", { type: "button", class: "space empty", disabled: !!app.mode, onclick: () => emptySheet(app, panel, cell.breaker) },
        h("span", { class: "space-no" }, String(n)), h("span", {}, "empty (no breaker)"));
    }
    return cell.kind === "double" ? breakerEl(cell.breaker, cell.numbers.join("/"), "double", "240 V") : breakerEl(cell.breaker, String(n), "", "");
  };
  return h("div", { class: "panel-picture" }, panelCells(p, panel).map((column) => h("div", { class: "panel-col" }, column.map(cellEl))));
}

function openBreaker(app, breaker) {
  show(app, { page: "breaker", breakerId: breaker.id, highlight: "", cardBack: false });
}

// ---- entering and editing a breaker

// The sheet for a space (slot "7", "7a" or "7b"), or for a breaker that exists. The keyboard's key saves and moves
// to the next space not yet entered, so the door can be read top to bottom with the keyboard never closing.
function openEntry(app, panel, slot, existing = null) {
  const st = state(app);
  let amps = existing ? existing.amps : st.lastAmps, kind = existing ? existing.kind : st.lastKind;
  openSheet(existing ? breakerTitle(existing) : `Space ${spaceName(slot)}`, (close) => {
    const label = h("input", { type: "text", value: existing ? existing.label : "", autocomplete: "off", enterKeyHint: existing ? "done" : "next" });
    const fields = () => ({ label: label.value.trim(), amps, kind });
    const remember = () => Object.assign(st, { lastAmps: amps, lastKind: kind });
    const add = (slots, extra = {}) => {
      remember();
      app.commit(`added breaker ${slots.map(spaceName).join("/")}`, (p) => m.addBreaker(p, { panelId: panel.id, slots, ...fields(), ...extra }));
    };
    const nextAfter = () => {
      const next = nextOpenSpace(app.project, panel, parseInt(slot, 10));
      if (next) openEntry(app, panel, String(next));
    };
    const save = (thenNext) => {
      close();
      if (existing) {
        remember();
        app.commit(`changed ${breakerTitle(existing)}`, (p) => m.update(p, "breakers", existing.id, fields()));
      } else {
        add([slot]);
        if (thenNext) nextAfter();
      }
    };
    requestAnimationFrame(() => label.focus());
    return h("form", { onsubmit: (e) => { e.preventDefault(); save(!existing); } },
      h("label", {}, "Label (what is written on the door)", label),
      h("strong", {}, "Amps"),
      choiceRow("Amps", [15, 20, 30, 40, 50].map((a) => [a, String(a)]), amps, (v) => { amps = v; }, true),
      h("strong", {}, "Type of breaker"),
      choiceRow("Type of breaker", KINDS, kind, (v) => { kind = v; }),
      h("div", { class: "buttons" },
        h("button", { type: "submit", class: "main" }, existing ? "Save" : "Save, then next space"),
        !existing && button("Save", () => save(false)),
        button("Cancel", close)),
      // Only a whole space can become a double, a tandem or an empty space.
      !existing && /^\d+$/.test(slot) && h("div", { class: "rows" },
        button("Two spaces together (240 V)", () => { close(); remember(); startPairing(app, panel, Number(slot), fields()); }),
        button("Two small breakers in one space", () => { close(); add([slot + "a"]); openEntry(app, panel, slot + "b"); }),
        button("No breaker here", () => {
          close();
          app.commit(`marked space ${slot} empty`, (p) => m.addBreaker(p, { panelId: panel.id, slots: [slot], amps: 0, kind: "empty" }));
          nextAfter();
        })),
      existing && button("Remove this breaker", () => { close(); removeBreaker(app, existing); }, "plain danger"));
  });
}

// "Tap the other space for this double breaker": only the spaces that can pair stay tappable.
function startPairing(app, panel, n, fields) {
  if (!pairChoices(app.project, panel, n).length) {
    toast(`No free space next to space ${n} for a double breaker.`);
    return;
  }
  app.setMode({
    pairing: { n, fields },
    text: `Tap the other space for this double breaker (the one with space ${n}).`,
    buttons: [{ text: "Cancel", run: () => app.endMode() }],
  });
}

function finishPairing(app, panel, other) {
  const { n, fields } = app.mode.pairing;
  const slots = [n, other].sort((a, b) => a - b).map(String);
  app.endMode();
  app.commit(`added breaker ${slots.join("/")}`, (p) => m.addBreaker(p, { panelId: panel.id, slots, ...fields }));
}

function emptySheet(app, panel, marker) {
  ask(`Space ${breakerName(marker)} is marked empty`, "", [
    {
      text: "Put a breaker here", cls: "main",
      run: () => {
        app.commit(`cleared space ${breakerName(marker)}`, (p) => m.remove(p, "breakers", marker.id));
        openEntry(app, panel, marker.slots[0]);
      },
    },
    { text: "Cancel" },
  ]);
}

function removeBreaker(app, breaker) {
  const lose = m.affected(app.project, "breakers", breaker.id).unassigned || 0;
  ask("Remove this breaker?", `${breakerTitle(breaker)} will be removed.` + (lose ? ` ${plural(lose, "device")} on it will have no breaker recorded.` : ""), [
    { text: "Cancel", cls: "main" },
    {
      text: "Remove it", cls: "plain danger",
      run: () => {
        state(app).page = "";
        app.commit(`removed ${breakerTitle(breaker)}`, (p) => m.remove(p, "breakers", breaker.id));
        toast(`Removed ${breakerTitle(breaker)}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}

// ---- a breaker's page

function breakerPage(app, breaker) {
  const p = app.project, panel = m.find(p, "panels", breaker.panelId), sum = breakerSummary(p, breaker.id);
  // Devices grouped by floor and room, each tagged "guess" where it is one. before() runs first (to close a sheet).
  const groups = (devices, before = () => {}) => listByRoom(p, devices).map((g) => [
    h("h3", {}, `${g.floorName}: ${g.roomName}`),
    h("ul", { class: "rows" }, g.devices.map((d) => h("li", {},
      h("span", {}, `${d.label}, ${displayName(d)}${d.tested ? "" : " (guess)"}`),
      button("Show on plan", () => { before(); showOnPlan(app, d.id); })))),
  ]);
  return h("section", { class: "page" },
    button(`Back to ${panel.name}`, () => show(app, { page: "" })),
    h("h2", {}, breakerTitle(breaker)),
    h("p", {}, [`${breaker.amps} A`, KIND_WORDS[breaker.kind], breaker.poles === 2 && "240 V"].filter(Boolean).join(", ")),
    sum.feeds.map((sub) => h("div", { class: "buttons" }, h("strong", {}, `Feeds ${sub.name}`), button(`Open ${sub.name}`, () => show(app, { panelId: sub.id, page: "" })))),
    // A breaker that feeds a subpanel is not tested itself: its devices belong to the subpanel's breakers.
    sum.text ? h("p", {}, sum.text) : !sum.feeds.length && h("p", {}, "Nothing found on this breaker yet. Test it to find out."),
    groups(sum.direct),
    sum.more && button(sum.more, () => openSheet(`Through ${sum.feeds.map((f) => f.name).join(" and ")}`, (close) => [
      h("div", { class: "scroll" }, groups(sum.downstream, close)),
      button("Done", close, "main"),
    ])),
    button("Edit", () => openEntry(app, panel, breaker.slots[0], breaker)));
}

// ---- adding a panel, and its settings

export function addPanelSheet(app, onAdded = () => {}) {
  let mainAmps = 0, slotCount = 20, numbering = "oddEven";
  openSheet("Add panel", (close) => {
    const name = h("input", { type: "text", value: app.project.panels.length ? "Subpanel" : "Main panel", autocomplete: "off", enterKeyHint: "done" });
    const make = h("input", { type: "text", autocomplete: "off", enterKeyHint: "done" });
    const problem = h("p", { class: "error", role: "alert" });
    const numberingBox = h("div", {});
    const paintNumbering = () => numberingBox.replaceChildren(numberingRow(numbering, (v) => { numbering = v; paintNumbering(); }));
    paintNumbering();
    return h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        if (!name.value.trim()) {
          problem.textContent = "Give the panel a name.";
          return;
        }
        close();
        const panel = app.commit(`added ${name.value.trim()}`, (p) => m.addPanel(p, { name: name.value.trim(), make: make.value.trim(), mainAmps, slotCount, numbering }));
        Object.assign(state(app), { panelId: panel.id, page: "" });
        onAdded(panel);
        app.render();
      },
    },
      h("label", {}, "Name", name),
      h("label", {}, "Make (optional)", make),
      h("strong", {}, "Main breaker size, in amps"),
      choiceRow("Main breaker size", [[100, "100"], [150, "150"], [200, "200"], [0, "Not sure"]], mainAmps, (v) => { mainAmps = v; }, true),
      h("strong", {}, "How many spaces?"),
      choiceRow("How many spaces", [12, 20, 24, 30, 40].map((n) => [n, String(n)]), slotCount, (v) => { slotCount = v; }, true),
      h("p", { class: "small" }, "Not sure? Count the breaker positions down one side and double it. You can change this later."),
      h("strong", {}, "Numbering"),
      numberingBox,
      h("p", { class: "small" }, "Look at the numbers on the breakers or the door. Not sure? Pick A; you can change it."),
      problem,
      h("div", { class: "buttons" }, h("button", { type: "submit", class: "main" }, "Add panel"), button("Cancel", close)));
  });
}

function settingsPage(app, panel) {
  const p = app.project;
  const set = (name, fields) => app.commit(name, (p) => m.update(p, "panels", panel.id, fields));
  const problem = h("p", { class: "error", role: "alert" });
  const make = h("input", { type: "text", value: panel.make, autocomplete: "off", enterKeyHint: "done", onchange: () => set(`changed the make of ${panel.name}`, { make: make.value.trim() }) });
  const amps = h("input", {
    type: "number", min: 0, inputMode: "numeric", value: panel.mainAmps || "",
    onchange: () => set(`changed the main breaker size of ${panel.name}`, { mainAmps: Math.max(0, Number(amps.value) || 0) }),
  });
  const spaces = h("input", {
    type: "number", min: 1, inputMode: "numeric", value: panel.slotCount,
    onchange: () => {
      try {
        app.commit(`changed ${panel.name} to ${spaces.value} spaces`, (p) => m.setSlotCount(p, panel.id, Number(spaces.value)));
      } catch (err) {
        problem.textContent = err.message; // "Space 12 already has a breaker, so the panel cannot have fewer than 12 spaces."
        spaces.value = panel.slotCount;
      }
    },
  });
  const feeder = m.find(p, "breakers", panel.fedFromBreakerId), feederPanel = feeder && m.find(p, "panels", feeder.panelId);
  const choices = feedChoices(p, panel.id), unpaired = m.unpairedBreakers(p, panel.id), marker = m.find(p, "devices", panel.deviceId);
  return h("section", { class: "page" },
    button(`Back to ${panel.name}`, () => show(app, { page: "" })),
    h("label", {}, "Panel name", nameField(panel.name, (name) => set(`renamed ${panel.name}`, { name }))),
    h("label", {}, "Make (optional)", make),
    h("label", {}, "Main breaker size in amps (leave empty if not sure)", amps),
    h("label", {}, "How many spaces?", spaces),
    h("p", { class: "small" }, "Count the breaker positions down one side and double it. It can't go below a space that has a breaker."),
    problem,
    h("strong", {}, "Numbering"),
    numberingRow(panel.numbering, (value) => value !== panel.numbering && app.commit(`changed the numbering of ${panel.name}`, (p) => m.setNumbering(p, panel.id, value))),
    unpaired.length > 0 && [
      h("p", { class: "error" }, `${plural(unpaired.length, "double breaker")} no longer ${unpaired.length === 1 ? "sits" : "sit"} together under this numbering. Check ${unpaired.length === 1 ? "it" : "them"}.`),
      h("ul", { class: "rows" }, unpaired.map((b) => h("li", {}, h("span", {}, breakerTitle(b)), button("Edit", () => openBreaker(app, b))))),
    ],
    // Offered once another panel has breakers: this is what makes a panel a subpanel.
    (choices.length > 0 || feeder) && [
      h("strong", {}, "Which breaker feeds this panel?"),
      h("p", {}, feeder ? `${breakerTitle(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}` : "None: this is a main panel."),
      button("Change", () => feedSheet(app, panel, choices)),
    ],
    marker
      ? button("Show on plan", () => showOnPlan(app, marker.id))
      : h("p", { class: "small" }, "To show where this panel is, place a Breaker panel marker on the Add tab."),
    button("Delete panel", () => deletePanel(app, panel), "plain danger"));
}

function feedSheet(app, panel, choices) {
  const set = (breakerId, name) => () => {
    try {
      app.commit(name, (p) => m.setFedFrom(p, panel.id, breakerId));
    } catch (err) {
      toast(err.message);
    }
  };
  openSheet(`Which breaker feeds ${panel.name}?`, (close) => [
    h("div", { class: "rows scroll" },
      button("None: this is a main panel", () => { close(); set("", `said nothing feeds ${panel.name}`)(); }),
      choices.map((c) => button(c.text, () => { close(); set(c.breaker.id, `said breaker ${breakerName(c.breaker)} feeds ${panel.name}`)(); }))),
    button("Cancel", close),
  ]);
}

function deletePanel(app, panel) {
  const { breakers = 0, unassigned = 0 } = m.affected(app.project, "panels", panel.id);
  const text = [breakers && `Its ${plural(breakers, "breaker")} ${breakers === 1 ? "goes" : "go"} with it.`,
    unassigned && `${plural(unassigned, "device")} will have no breaker recorded.`].filter(Boolean).join(" ");
  ask(`Delete ${panel.name}?`, text, [
    { text: "Cancel", cls: "main" },
    {
      text: `Delete ${panel.name}`, cls: "plain danger",
      run: () => {
        Object.assign(state(app), { page: "", panelId: "" });
        app.commit(`deleted ${panel.name}`, (p) => m.remove(p, "panels", panel.id));
        toast(`Deleted ${panel.name}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}

// ---- "Something has no power"

function whereSheet(app) {
  const st = state(app);
  openSheet("Where is the power out?", (close) => {
    const list = h("div", { class: "rows scroll" });
    const search = h("input", { type: "search", placeholder: "A room, or a label like KIT-03", "aria-label": "Search", autocomplete: "off", oninput: () => fill() });
    const fill = () => {
      const choices = whereChoices(app.project, search.value, st.lastRoomId);
      list.replaceChildren(...(choices.length
        ? choices.map((c) => button(c.text, () => {
          close();
          if (c.roomId) st.lastRoomId = c.roomId;
          show(app, { page: "card", card: c.roomId ? { roomId: c.roomId } : { deviceId: c.deviceId }, cardMore: false });
        }))
        : [h("p", {}, search.value.trim() ? "Nothing matches. Check the spelling." : "No rooms yet. Add them on the Floors tab.")]));
    };
    fill();
    return [search, list, button("Cancel", close)];
  });
}

// One card, most useful first, in large type. No more than three lines in a section until he asks for the rest.
function cardPage(app) {
  const st = state(app), card = powerOutCard(app.project, st.card);
  const onPanel = (breakerId) => button("Show on panel", () => {
    const b = m.find(app.project, "breakers", breakerId);
    show(app, { page: "", panelId: b.panelId, highlight: breakerId, cardBack: true });
  });
  const hidden = st.cardMore ? 0 : Math.max(0, card.check.length - 3);
  return h("section", { class: "page card" },
    button("Back to breakers", () => show(app, { page: "", card: null })),
    h("h2", {}, card.title),
    card.check.length > 0 && [
      h("h3", {}, "Check these first (they can look like a tripped breaker)"),
      h("ul", {}, card.check.slice(0, card.check.length - hidden).map((line) => h("li", {}, line))),
      hidden > 0 && button(`and ${hidden} more`, () => show(app, { cardMore: true })),
    ],
    card.likely && [
      h("h3", {}, `Most likely: ${card.likely.title}`),
      h("p", {}, card.likely.sure),
      onPanel(card.likely.breakerId),
      h("p", { class: "small" }, "A tripped breaker sits between On and Off. Push it fully Off, then On. If it trips again straight away, leave it off and call an electrician."),
      card.likely.kindLine && h("p", {}, card.likely.kindLine),
      card.likely.subLine && h("p", {}, card.likely.subLine),
    ],
    card.also.map((a) => h("div", { class: "buttons" }, h("span", {}, a.text), onPanel(a.breakerId))),
    card.unknown && h("p", {}, card.unknown),
    card.none && [h("p", {}, card.none), button("Try another room", () => whereSheet(app))]);
}

// ---- used from other tabs

// From a marker's sheet: tap the breaker this device is on. A pick made here is always a guess; only a test
// can make it tested.
export function startPickingBreaker(app, deviceId) {
  const d = m.find(app.project, "devices", deviceId), from = app.tab;
  if (!app.project.panels.length) {
    toast("Add your panel on the Breakers tab first.");
    return;
  }
  const back = () => {
    app.endMode();
    app.tab = from;
    app.render();
    openMarkerSheet(app, deviceId);
  };
  state(app).page = "";
  app.tab = "panel";
  app.setMode({
    pickBreaker: deviceId,
    cancel: () => { app.tab = from; },
    choose: (b) => {
      app.commit(`put ${d.label} on ${breakerTitle(b)} as a guess`, (p) => m.setBreaker(p, deviceId, b.id, false));
      back();
    },
    text: `Tap the breaker ${d.label} is on. It is a guess until a test confirms it.`,
    buttons: [
      {
        text: "Not sure",
        run: () => {
          if (d.breakerId) app.commit(`cleared the breaker of ${d.label}`, (p) => m.setBreaker(p, deviceId, "", false));
          back();
        },
      },
      { text: "Cancel", run: back },
    ],
  });
}

// Open the panel picture with one breaker ringed.
export function showOnPanel(app, breakerId) {
  const b = m.find(app.project, "breakers", breakerId);
  if (!b) return;
  Object.assign(state(app), { page: "", panelId: b.panelId, highlight: breakerId, cardBack: false });
  app.go("panel");
}

// A Breaker panel or Subpanel marker was just placed: which panel is it?
export function askWhichPanel(app, deviceId) {
  const link = (panel) => app.commit(`marked where ${panel.name} is`, (p) => m.update(p, "panels", panel.id, { deviceId }));
  openSheet("Which panel is this?", (close) => [
    h("div", { class: "rows" },
      app.project.panels.map((panel) => button(panel.name + (panel.deviceId ? " (already on the plan: this replaces it)" : ""), () => { close(); link(panel); })),
      button("New panel", () => { close(); addPanelSheet(app, link); })),
    button("Decide later", close),
  ]);
}
```

- [ ] **Step 2: Append to `styles.css`**

```css

/* The Breakers tab. A space is at least 44 points tall and never relies on colour to say what it is. */
button.big { min-height: 64px; font-size: 20px; }
.page > button.big { align-self: stretch; }
.panel-head { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 0; background: var(--bg); }
.panel-picture { display: flex; gap: 8px; }
.panel-col { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
button.space { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 56px; padding: 6px 10px; text-align: left; border: 2px solid var(--fg); border-radius: 6px; background: var(--bg); }
button.space.double { min-height: 118px; border-width: 4px; }
button.space.todo { border: 2px dotted var(--line); color: var(--muted); }
button.space.empty { border: 2px dashed var(--fg); }
button.space.highlight { outline: 4px solid var(--danger); outline-offset: 2px; }
button.space:disabled { opacity: 0.4; }
.space-pair { display: flex; flex-direction: column; gap: 2px; }
.space-pair button.space { min-height: 58px; }
.space-no { font-weight: 700; }
.space-label { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
button.numbering { display: flex; align-items: center; gap: 12px; text-align: left; }
.mini { flex: none; padding: 4px 8px; border: 1px solid var(--line); border-radius: 4px; font: 14px/1.2 ui-monospace, Consolas, monospace; white-space: pre; }
.card { font-size: 20px; }
.card h3 { margin: 8px 0 0; font-size: 22px; }
.card ul { margin: 0; padding-left: 24px; }
.page h3 { margin: 8px 0 0; font-size: 18px; }
```

- [ ] **Step 3: Check and commit**

Run: `node --check src/view/panel.js && node --test`
Expected: no output from the check; 136 tests pass.

```bash
git add src/view/panel.js styles.css
git commit -m "feat: the Breakers tab screens"
```

---

### Task 3: Wire it in

**Files:**
- Modify: `src/app.js`, `src/view/markersheet.js`, `src/view/browse.js`, `src/view/place.js`, `src/view/link.js`

- [ ] **Step 1: `src/app.js`**

Replace:

```js
import { linkView } from "./view/link.js";
```

with:

```js
import { linkView } from "./view/link.js";
import { panelView } from "./view/panel.js";
```

Replace:

```js
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["link", "Switches", linkView], ["map", "Map", browseView]];
```

with:

```js
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["link", "Switches", linkView], ["panel", "Breakers", panelView], ["map", "Map", browseView]];
```

Replace:

```js
const AWAKE_TABS = ["add"];
```

with:

```js
const AWAKE_TABS = ["add", "panel"];
```

- [ ] **Step 2: The Breaker row in a marker's sheet (`src/view/markersheet.js`)**

Replace:

```js
import { openPalette } from "./palette.js";
```

with:

```js
import { openPalette } from "./palette.js";
import { circuitText } from "../browse.js";
import { startPickingBreaker } from "./panel.js";
```

Replace:

```js
      row("Room", room ? room.name : "No room", () => { close(); changeRoom(app, id); }),
```

with:

```js
      row("Room", room ? room.name : "No room", () => { close(); changeRoom(app, id); }),
      // Only for things a breaker feeds. A pick made here is a guess.
      typeInfo(d.type).sweep && row("Breaker", circuitText(p, d), () => { close(); startPickingBreaker(app, id); }),
```

- [ ] **Step 3: Show on panel in Map details (`src/view/browse.js`)**

Replace:

```js
import { openMarkerSheet } from "./markersheet.js";
```

with:

```js
import { openMarkerSheet } from "./markersheet.js";
import { showOnPanel } from "./panel.js";
```

Replace:

```js
    line("Breaker", circuitText(p, d)),
```

with:

```js
    line("Breaker", circuitText(p, d), d.breakerId && [" ", button("Show on panel", () => showOnPanel(app, d.breakerId))]),
```

Replace:

```js
function showOnPlan(app, id) {
```

with:

```js
export function showOnPlan(app, id) {
```

- [ ] **Step 4: "Which panel is this?" (`src/view/place.js`)**

Replace:

```js
import { openMarkerSheet } from "./markersheet.js";
```

with:

```js
import { openMarkerSheet } from "./markersheet.js";
import { askWhichPanel } from "./panel.js";
```

Replace:

```js
  }, 2000);
  showAdding(app);
```

with:

```js
  }, 2000);
  showAdding(app);
  if (type === "BP" || type === "SP") askWhichPanel(app, device.id);
```

- [ ] **Step 5: "Next: test your breakers" (`src/view/link.js`)**

Replace:

```js
      progress.todo.length > 0 && button(`Still to do (${progress.todo.length})`, () => todoSheet(app, progress.todo))),
```

with:

```js
      progress.todo.length > 0 && button(`Still to do (${progress.todo.length})`, () => todoSheet(app, progress.todo)),
      progress.todo.length === 0 && !app.mode && button("Next: test your breakers", () => app.go("panel"), "main")),
```

- [ ] **Step 6: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (136 pass), then `node tools/serve.mjs` and http://localhost:8765. Set up a floor with a picture and a traced Kitchen with two outlets, a light and a switch linked to the light. The console must stay free of errors.

1. Tabs read Floors, Add, Switches, Breakers, Map. Breakers shows a large "Something has no power" button and "No panels yet. Add the one with your main breaker."
2. Add panel: Name "Main panel", Make, main size 100 / 150 / 200 / Not sure and an "other" box, spaces 12 / 20 / 24 / 30 / 40 with 20 ticked and an "other" box, Numbering A and B each with a small drawing and A ticked. Pick 12 spaces, Add panel: "Main panel: 0 of 12 spaces entered" and two columns, 1 3 5 7 9 11 and 2 4 6 8 10 12, each "tap to add".
3. Tap space 1: a sheet "Space 1" with Label, Amps (15 ticked), Type of breaker (Standard ticked). Type `Kitchen` and press Enter: space 1 shows "1 / Kitchen / 15 A" and the sheet for space 2 is open. Choose 20 and GFCI, type `Bath`, Save: space 2 shows "20 A, GFCI" and no new sheet opens. Tap space 3: 20 and GFCI are already ticked.
4. In space 3's sheet choose "Two spaces together (240 V)": banner "Tap the other space for this double breaker (the one with space 3)."; only space 5 says "tap to pair" and the rest are disabled. Tap 5: one tall box "3/5" marked 240 V.
5. Space 4, "Two small breakers in one space": "4 top" is saved and the sheet for "4 bottom" opens; save it. The space is drawn as two halves, each with its own label.
6. Space 6, "No breaker here": a dashed box "empty (no breaker)"; the header reads "6 of 12 spaces entered". Tapping it offers "Put a breaker here".
7. The search box: `3` lists Breaker 3/5; `kit` lists Breaker 1 (Kitchen); tapping a result opens that breaker's page.
8. Breaker 1's page: "Breaker 1 (Kitchen)", "15 A", "Nothing found on this breaker yet. Test it to find out.", Edit. Edit changes the label; "Remove this breaker" asks first with Cancel filled.
9. On the Add tab open an outlet's sheet: a Breaker row reads "Not known". Tap it: the Breakers tab shows with the banner "Tap the breaker KIT-01 is on. It is a guess until a test confirms it." and Not sure / Cancel; empty and unentered spaces are disabled. Tap Breaker 1: back on Add with the sheet open and the row reading "Breaker 1 (Kitchen), guess". Do the same for the light.
10. Breaker 1's page now reads "2 devices: 1 outlet, 1 light" with both listed under "<floor>: Kitchen", each "(guess)" with Show on plan, which opens Map with that device ringed.
11. Map details for the outlet read "Breaker: Breaker 1 (Kitchen), guess" with Show on panel, which opens Breakers with breaker 1 outlined and "Check this one".
12. "Something has no power": "Where is the power out?" with a search box and the rooms. Kitchen: a card in large type headed "Kitchen has no power"; "Check these first" lists the switch ("...: is it on?"); "Most likely: Breaker 1 (Kitchen), 15 A", "2 guessed", Show on panel, and the tripped-breaker advice; "1 device in this room has no breaker recorded." Show on panel rings the breaker and offers "Back to the card".
13. Panel settings: name, make, main size, spaces, Numbering. Set spaces to 4: "Space 12 already has a breaker..." style message and the number goes back. Choose numbering B: the picture is redrawn 1-6 down the left and 7-12 down the right, and settings say "1 double breaker no longer sits together under this numbering. Check it." with Edit. Choose A again.
14. Add panel again (name "Garage subpanel", 12 spaces). The panel switch appears. In its settings, "Which breaker feeds this panel?" says None; Change lists the main panel's breakers; pick 3/5. Breaker 3/5's page in the main panel says "Feeds Garage subpanel" with Open Garage subpanel.
15. On Add, place a Breaker panel marker: "Which panel is this?" lists both panels, New panel and Decide later. Pick Main panel; its settings now offer Show on plan.
16. Delete the subpanel from its settings: asks first with Cancel filled; Undo brings it back.
17. Switches tab with every switch set shows "Next: test your breakers", which opens Breakers.
18. Phone width: the two columns stay side by side, labels wrap to two lines then cut off, and every space is at least 44 px tall.

- [ ] **Step 7: Commit**

```bash
git add src/app.js src/view/markersheet.js src/view/browse.js src/view/place.js src/view/link.js
git commit -m "feat: wire the Breakers tab into the app"
```

---

## Done when

- `node --test` passes with 0 failures (136 tests).
- Every browser check in Task 3 passes, with no console errors.
- Three commits on `plan-3b-breakers`, ready to merge.

Then write Plan 3c (the guided breaker test).
