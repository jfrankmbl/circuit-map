# Circuit Map Plan 3d: Print and Download Spreadsheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a panel he can print a card for the inside of the panel door (or save it as a PDF), with an optional page listing every device on each breaker, and the app remembers when it was printed and says when it has gone stale. From the Map tab he can download the devices or the breakers as a spreadsheet.

**Architecture:** What the printout says is worked out in `src/printing.js` (pure, tested): the card as two columns of cells, the full list, and a *record* of what each breaker's line said when printed. The preview is one more page of the Breakers tab (`view/print.js`); it is the printout itself, drawn on a white "paper" in points and inches, and `@media print` styles hide everything else, so Print is just `window.print()`. The record is kept on the device with `store.setSetting("printed", ...)`, per panel; "3 breakers changed since" is a comparison of the record with what the card would say now, so only changes that show on the card count. The spreadsheets are the CSV text Plan 1 already makes, given a file name and a byte-order mark and handed over by `view/savefile.js` (the Share sheet on a phone, a download elsewhere), which Export will also use in Plan 4.

**Tech Stack:** As before: plain ES modules, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Screens > Panel > Print; Screens > Browse, "Download spreadsheet").

**Conventions for every task**

- Work on the branch `plan-3d-print`.
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://localhost:8765.
- On paper nothing relies on colour or shading: borders and words only, and no type below 10 pt.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Where a step says "Replace A with B", A appears exactly once in the file.

**Decisions made here**

- Print is for the panel being shown (one card per door). A subpanel is printed from its own picture and is headed "Fed from breaker ...".
- The paper is 7.25 in wide, which fits both Letter and A4 with half-inch margins.
- The preview shows the page's width and content, not its full length.
- The Map tab has no menu yet: Download spreadsheet is a button beside Key.

**File map**

| File | Responsibility |
|---|---|
| `src/printing.js` (new) | Pure: rooms on a breaker, the door card, the full list, the print record and "changed since" |
| `src/view/print.js` (new) | The preview page: Short or Full, Print |
| `src/view/savefile.js` (new) | Hand a file over: Share sheet on a phone, download elsewhere |
| `src/csv.js`, `src/file.js` (modify) | `csvFile`: name and byte-order mark; `safeName` shared with Export |
| `src/view/panel.js`, `src/view/browse.js`, `src/app.js`, `styles.css` (modify) | The Print line on a panel, the Download button, `app.printed`, paper and print styles |

---

### Task 1: What the printout says

**Files:**
- Create: `src/printing.js`
- Test: `tests/printing.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { roomsText, doorCard, fullList, printRecord, printedStatus } from "../src/printing.js";
import { sample } from "./helpers.js";

const DAY = new Date(2026, 9, 6, 12).getTime(); // noon on 6 Oct 2026, whatever the time zone

// A 12-space panel: breaker 1 (two kitchen outlets tested, a hall light guessed), a double on 2/4 (a flood light),
// a tandem in 3 with only its top entered, space 5 empty, a GFCI breaker in 6.
function house() {
  const s = sample();
  const { p, main, kit, ext } = s;
  const hall = m.addRoom(p, { floorId: main.id, name: "Hall", code: "HAL" }, 1000);
  const place = (roomId, type) => m.placeDevice(p, { floorId: main.id, roomId, type, x: 1, y: 1 }, 1100);
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 12 }, 1200);
  const add = (slots, amps, label, kind) => m.addBreaker(p, { panelId: panel.id, slots, amps, label, kind }, 1200);
  const b1 = add(["1"], 15, "Kitchen"), pair = add(["2", "4"], 30, "Dryer"), top = add(["3a"], 15, "Hall");
  const empty = add(["5"], 0, "", "empty"), gfi = add(["6"], 20, "Counter", "GFCI");
  const a = place(kit.id, "D"), b = place(kit.id, "D"), light = place(hall.id, "L"), flood = place(ext.id, "FL");
  m.setBreaker(p, a.id, b1.id, true, 1300);
  m.setBreaker(p, b.id, b1.id, true, 1300);
  m.setBreaker(p, light.id, b1.id, false, 1300);
  m.setBreaker(p, flood.id, pair.id, true, 1300);
  return { ...s, hall, place, panel, b1, pair, top, empty, gfi, a, b, light, flood };
}

const blank = (number) => ({ number, label: "", facts: "", rooms: "" });

test("the rooms on a breaker: most devices first, three at most, and ? when any is a guess", () => {
  const { p, main, place, b1, pair, top } = house();
  assert.deepEqual([roomsText(p, b1), roomsText(p, pair), roomsText(p, top)], ["Kitchen, Hall ?", "Exterior", ""]);
  for (const [name, code] of [["Office", "OFF"], ["Bath", "BTH"], ["Den", "DEN"]]) {
    const room = m.addRoom(p, { floorId: main.id, name, code }, 1400);
    m.setBreaker(p, place(room.id, "D").id, b1.id, true, 1400);
  }
  assert.equal(roomsText(p, b1), "Kitchen, Bath, Den +2 more ?");
  // A device whose room has been deleted is still a guess to flag.
  const closet = m.addRoom(p, { floorId: main.id, name: "Closet", code: "CLO" }, 1500);
  m.setBreaker(p, place(closet.id, "D").id, top.id, false, 1500);
  m.removeRoom(p, closet.id, {}, 1500);
  assert.equal(roomsText(p, top), "?");
});

test("the door card is the panel in two columns, with a heading", () => {
  const { p, panel } = house();
  const card = doorCard(p, panel, DAY);
  assert.deepEqual([card.house, card.panel, card.fedFrom, card.printed, card.legend, card.wide],
    ["Dad's house", "Main panel", "", "Printed 6 Oct 2026", "? = not confirmed by testing yet", false]);
  const [left, right] = card.columns;
  assert.deepEqual(left, [
    { kind: "single", lines: [{ number: "1", label: "Kitchen", facts: "15 A", rooms: "Kitchen, Hall ?" }] },
    { kind: "tandem", lines: [{ number: "3 top", label: "Hall", facts: "15 A", rooms: "" }, blank("3 bottom")] },
    { kind: "empty", lines: [{ ...blank("5"), label: "empty" }] },
    { kind: "todo", lines: [blank("7")] },
    { kind: "todo", lines: [blank("9")] },
    { kind: "todo", lines: [blank("11")] },
  ]);
  assert.deepEqual(right.slice(0, 2), [
    { kind: "double", lines: [{ number: "2/4", label: "Dryer", facts: "30 A, 240 V", rooms: "Exterior" }] },
    { kind: "single", lines: [{ number: "6", label: "Counter", facts: "20 A, GFCI", rooms: "" }] },
  ]);
  assert.deepEqual(right.slice(2).map((c) => c.lines[0].number), ["8", "10", "12"]);
});

test("a subpanel says what feeds it, and a panel of more than 30 spaces uses the whole page", () => {
  const { p, pair } = house();
  const sub = m.addPanel(p, { name: "Garage subpanel", slotCount: 40 }, 1400);
  m.setFedFrom(p, sub.id, pair.id, 1400);
  const card = doorCard(p, sub, DAY);
  assert.deepEqual([card.fedFrom, card.wide], ["Fed from breaker 2/4 in Main panel", true]);
  assert.equal(roomsText(p, pair), "Feeds Garage subpanel. Exterior");
});

test("the full list has every device on each breaker, and says which are guesses", () => {
  const { p, panel, pair, flood } = house();
  assert.deepEqual(fullList(p, panel), [
    { title: "Breaker 1 (Kitchen), 15 A", none: "", rows: [
      { label: "HAL-01", type: "Ceiling light", room: "Hall", guess: "guess" },
      { label: "KIT-01", type: "Duplex outlet", room: "Kitchen", guess: "" },
      { label: "KIT-02", type: "Duplex outlet", room: "Kitchen", guess: "" },
    ] },
    { title: "Breaker 2/4 (Dryer), 30 A, 240 V", none: "", rows: [{ label: "EXT-01", type: "Flood light", room: "Exterior", guess: "" }] },
    { title: "Breaker 3 top (Hall), 15 A", none: "Nothing found on this breaker yet.", rows: [] },
    { title: "Breaker 6 (Counter), 20 A, GFCI", none: "Nothing found on this breaker yet.", rows: [] },
  ]);
  // With more than one floor a room is given with its floor. A breaker that feeds a subpanel says so.
  m.addFloor(p, "Upstairs", 1400);
  m.setBreaker(p, flood.id, "", false, 1400);
  m.setFedFrom(p, m.addPanel(p, { name: "Garage subpanel" }, 1400).id, pair.id, 1400);
  const list = fullList(p, panel);
  assert.equal(list[0].rows[0].room, "Hall, Main");
  assert.equal(list[1].none, "Feeds Garage subpanel. Its devices are on that panel's own list.");
});

test("last printed, and how many breakers have changed on the card since", () => {
  const { p, panel, b1, gfi, a, light } = house();
  assert.deepEqual(printedStatus(p, panel, undefined), { last: "", changed: "" });
  const record = printRecord(p, panel, DAY);
  assert.deepEqual(printedStatus(p, panel, record), { last: "Last printed 6 Oct 2026", changed: "" });
  // A change that does not show on the card does not count.
  m.update(p, "devices", a.id, { note: "loose" }, 2000);
  assert.equal(printedStatus(p, panel, record).changed, "");
  m.setBreaker(p, light.id, b1.id, true, 2000); // the "?" goes from breaker 1
  assert.equal(printedStatus(p, panel, record).changed, "1 breaker changed since. Print again?");
  m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 15, label: "Bath" }, 2100);
  m.remove(p, "breakers", gfi.id, 2200);
  assert.equal(printedStatus(p, panel, record).changed, "3 breakers changed since. Print again?");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/printing.test.js`
Expected: FAIL, `Cannot find module ... src/printing.js`.

- [ ] **Step 3: Write `src/printing.js`**

```js
// What a printed panel directory says: the card for the inside of the panel door, the full list of devices, and
// whether the card on the door has gone stale. No DOM here.
import { find, sortedBreakers } from "./model.js";
import { displayName } from "./catalog.js";
import { plural, dayText } from "./flow.js";
import { listByRoom } from "./browse.js";
import { breakerName, breakerTitle, KIND_WORDS, panelCells } from "./panel.js";

const feeds = (project, breaker) => project.panels.filter((panel) => panel.fedFromBreakerId === breaker.id).map((panel) => `Feeds ${panel.name}`);

// "Kitchen, Dining, Hall +2 more ?": the rooms with something on this breaker, the room with most first.
// A "?" means something on it has not been confirmed by a test.
export function roomsText(project, breaker) {
  const on = project.devices.filter((d) => d.breakerId === breaker.id);
  const count = new Map();
  for (const d of on) {
    const room = find(project, "rooms", d.roomId);
    if (room) count.set(room.name, (count.get(room.name) || 0) + 1);
  }
  const names = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const rooms = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "");
  return [[...feeds(project, breaker), rooms].filter(Boolean).join(". "), on.some((d) => !d.tested) && "?"].filter(Boolean).join(" ");
}

// "20 A, 240 V, GFCI"
const facts = (b) => [b.amps ? `${b.amps} A` : "", b.poles === 2 && "240 V", KIND_WORDS[b.kind]].filter(Boolean).join(", ");

// The heading every page carries.
function pageHead(project, panel, now) {
  const feeder = find(project, "breakers", panel.fedFromBreakerId), feederPanel = feeder && find(project, "panels", feeder.panelId);
  return {
    house: project.name,
    panel: panel.name,
    fedFrom: feeder ? `Fed from breaker ${breakerName(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}` : "",
    printed: `Printed ${dayText(now)}`,
    legend: "? = not confirmed by testing yet",
  };
}

// The card: { house, panel, fedFrom, printed, legend, wide, columns }. columns is the left and the right side of the
// panel from the top; each cell is { kind, lines: [{ number, label, facts, rooms }] }, where kind is "single",
// "double" (one tall box), "tandem" (two lines), "empty" (entered as having no breaker) or "todo" (nothing entered:
// printed as a ruled line to write on). A panel of more than 30 spaces is wide: it uses the whole page width.
export function doorCard(project, panel, now = Date.now()) {
  const blank = (number, label = "") => ({ number, label, facts: "", rooms: "" });
  const line = (b, number) => ({ number, label: b.label, facts: facts(b), rooms: roomsText(project, b) });
  const cell = (c) => {
    const n = String(c.numbers[0]);
    if (c.kind === "todo") return { kind: "todo", lines: [blank(n)] };
    if (c.kind === "empty") return { kind: "empty", lines: [blank(n, "empty")] };
    if (c.kind === "double") return { kind: "double", lines: [line(c.breaker, c.numbers.join("/"))] };
    if (c.kind === "tandem") {
      return { kind: "tandem", lines: [c.top ? line(c.top, `${n} top`) : blank(`${n} top`), c.bottom ? line(c.bottom, `${n} bottom`) : blank(`${n} bottom`)] };
    }
    return { kind: "single", lines: [line(c.breaker, n)] };
  };
  return { ...pageHead(project, panel, now), wide: panel.slotCount > 30, columns: panelCells(project, panel).map((column) => column.map(cell)) };
}

// The Full page: every breaker with each device on it. [{ title, none, rows: [{ label, type, room, guess }] }]
export function fullList(project, panel) {
  const floors = project.floors.length > 1;
  return sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty").map((b) => {
    const rows = listByRoom(project, project.devices.filter((d) => d.breakerId === b.id)).flatMap((g) => g.devices.map((d) => ({
      label: d.label, type: displayName(d), room: floors ? `${g.roomName}, ${g.floorName}` : g.roomName, guess: d.tested ? "" : "guess",
    })));
    const feeding = feeds(project, b);
    return {
      title: [breakerTitle(b), facts(b)].filter(Boolean).join(", "),
      none: rows.length ? "" : feeding.length ? `${feeding.join(". ")}. Its devices are on that panel's own list.` : "Nothing found on this breaker yet.",
      rows,
    };
  });
}

// What to keep on the device when a card is printed: when, and what each breaker's line said.
export function printRecord(project, panel, now = Date.now()) {
  const lines = {};
  for (const b of sortedBreakers(project, panel.id)) lines[b.id] = [breakerName(b), b.kind, b.label, facts(b), roomsText(project, b)].join("|");
  return { at: now, lines };
}

// { last, changed }: "Last printed 6 Oct 2026" and, if the card would read differently now, "3 breakers changed
// since. Print again?" Both are "" when this panel has not been printed from this device.
export function printedStatus(project, panel, record) {
  if (!record) return { last: "", changed: "" };
  const now = printRecord(project, panel).lines;
  const changed = [...new Set([...Object.keys(now), ...Object.keys(record.lines)])].filter((id) => now[id] !== record.lines[id]).length;
  return { last: `Last printed ${dayText(record.at)}`, changed: changed ? `${plural(changed, "breaker")} changed since. Print again?` : "" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/printing.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/printing.js tests/printing.test.js docs/superpowers/plans/2026-10-08-plan-3d-print.md
git commit -m "feat: what a printed panel directory says"
```

---

### Task 2: The print preview

**Files:**
- Create: `src/view/print.js`
- Modify: `src/view/panel.js`, `src/app.js`, `styles.css`

- [ ] **Step 1: Write `src/view/print.js`**

```js
// "Print or save as PDF": one page of the Breakers tab. What is on the screen is the printout: the print styles
// hide everything but the paper. It is always black on white, whatever the device's dark mode.
import { h, button } from "../ui.js";
import { doorCard, fullList, printRecord } from "../printing.js";
import { state, show } from "./panel.js";

const PAPER = 744; // CSS pixels: 7.25 in of page with a quarter inch of white each side

// On a phone the paper is shrunk to the width of the screen (pinch to read it). It is never enlarged.
function fit() {
  for (const paper of document.querySelectorAll(".paper")) paper.style.zoom = Math.min(1, paper.parentElement.clientWidth / PAPER);
}
let listening = false; // for a window that changes size; set up when the page is first drawn

export function printPage(app, panel) {
  const st = state(app), p = app.project, card = doorCard(p, panel);
  const pick = (full, text) => h("button", { type: "button", "aria-pressed": String(st.printFull === full), onclick: () => show(app, { printFull: full }) }, text);
  // Every page carries the house, the panel, the date and what "?" means.
  const head = () => h("div", { class: "paper-head" },
    h("strong", {}, `${card.house}: ${card.panel}`),
    card.fedFrom && h("span", {}, card.fedFrom),
    h("span", {}, card.printed),
    h("span", {}, card.legend));
  // A line with nothing entered is ruled, to write on by hand.
  const lineEl = (line) => h("div", { class: "door-line" + (line.label || line.facts ? "" : " write") },
    h("strong", { class: "door-no" }, line.number),
    h("span", { class: "door-text" },
      h("span", { class: "door-label" }, line.label),
      line.facts && h("span", { class: "door-facts" }, line.facts),
      line.rooms && h("span", { class: "door-rooms" }, line.rooms)));
  const cardEl = () => h("div", { class: "door-card" + (card.wide ? " wide" : "") },
    head(),
    h("div", { class: "door-cols" }, card.columns.map((column) =>
      h("div", { class: "door-col" }, column.map((cell) => h("div", { class: `door-cell ${cell.kind}` }, cell.lines.map(lineEl)))))));
  // A table, so its heading is repeated at the top of every printed page.
  const listEl = () => h("table", { class: "full-list" },
    h("thead", {},
      h("tr", {}, h("th", { colspan: 4 }, head())),
      h("tr", {}, ["Label", "What it is", "Room", ""].map((text) => h("th", {}, text)))),
    h("tbody", {}, fullList(p, panel).map((b) => [
      h("tr", { class: "full-breaker" }, h("th", { colspan: 4 }, b.title)),
      b.rows.length
        ? b.rows.map((row) => h("tr", {}, [row.label, row.type, row.room, row.guess].map((text) => h("td", {}, text))))
        : h("tr", {}, h("td", { colspan: 4 }, b.none)),
    ])));
  const print = () => {
    // Remembered on this device, so the panel can say when the card on the door has gone stale.
    app.printed[panel.id] = printRecord(p, panel);
    app.store.setSetting("printed", app.printed).catch(() => {});
    window.print();
  };
  if (!listening) window.addEventListener("resize", fit);
  listening = true;
  queueMicrotask(fit); // once the page is on the screen
  return h("section", { class: "print-page" },
    h("div", { class: "page no-print" },
      button(`Back to ${panel.name}`, () => show(app, { page: "" })),
      h("h2", {}, `Print ${panel.name}`),
      h("div", { class: "buttons", role: "group", "aria-label": "How much to print" }, pick(false, "Short"), pick(true, "Full")),
      h("p", { class: "small" }, st.printFull
        ? "The card, then a list of every device on each breaker."
        : "A card for the inside of the panel door. Cut along the outer line."),
      button("Print", print, "main big"),
      h("p", { class: "small" }, "To save a PDF instead, choose Save as PDF in the print window (on iPhone: Save to Files).")),
    h("div", { class: "paper-fit" }, h("div", { class: "paper" },
      h("section", { class: "sheet-page" }, cardEl()),
      st.printFull && h("section", { class: "sheet-page" }, listEl()))));
}
```

- [ ] **Step 2: Open it from a panel (`src/view/panel.js`)**

Replace:

```js
import { testPage, startTest } from "./test.js";
```

with:

```js
import { testPage, startTest } from "./test.js";
import { printedStatus } from "../printing.js";
import { printPage } from "./print.js";
```

Replace:

```js
  lastAmps: 15, lastKind: "standard", lastRoomId: "",
```

with:

```js
  lastAmps: 15, lastKind: "standard", lastRoomId: "", printFull: false,
```

Replace:

```js
    if (st.page === "settings" && panel) return settingsPage(app, panel);
```

with:

```js
    if (st.page === "settings" && panel) return settingsPage(app, panel);
    if (st.page === "print" && panel) return printPage(app, panel);
```

Replace:

```js
        !app.mode && testLine(app),
```

with:

```js
        !app.mode && testLine(app),
        !app.mode && printLine(app, panel),
```

Append to the end of the file:

```js

// "Print or save as PDF", with when this panel's card was last printed and whether it has gone stale since.
function printLine(app, panel) {
  const status = printedStatus(app.project, panel, app.printed[panel.id]);
  return h("div", { class: "buttons print-line" },
    button("Print or save as PDF", () => show(app, { page: "print" })),
    status.last && h("span", {}, status.last),
    status.changed && h("strong", {}, status.changed));
}
```

- [ ] **Step 3: Keep the print records in the shell (`src/app.js`)**

Replace:

```js
  // The breaker test in progress (see testing.js), or null. Kept on this device, not in the project file, so the
```

with:

```js
  // { panelId: { at, lines } }: what each panel's door card said when it was last printed from this device (see
  // printing.js). Not in the project file.
  printed: {},

  // The breaker test in progress (see testing.js), or null. Kept on this device, not in the project file, so the
```

Replace:

```js
  app.project = await app.store.loadProject();
```

with:

```js
  app.printed = await app.store.getSetting("printed", {});
  app.project = await app.store.loadProject();
```

- [ ] **Step 4: Append to `styles.css`**

```css

/* Print. The paper on the screen is the printout: black on white whatever the theme, borders and words instead of
   shading or colour, sizes in points and inches, and no type below 10 pt. */
.print-line { align-items: center; }
.paper-fit { margin: 0 16px 16px; }
.paper { box-sizing: content-box; width: 7.25in; margin: 0 auto; padding: 0.25in; color-scheme: light; background: #fff; color: #000; font: 10pt/1.25 system-ui, -apple-system, "Segoe UI", sans-serif; }
.sheet-page + .sheet-page { margin-top: 0.25in; padding-top: 0.25in; border-top: 1px dashed #000; }
.paper-head { display: flex; flex-wrap: wrap; gap: 2pt 12pt; margin-bottom: 6pt; font-weight: 400; text-align: left; }
.paper-head strong { flex: 1 1 100%; font-size: 13pt; }
.door-card { width: 5in; padding: 0.1in; border: 1px solid #000; }
.door-card.wide { width: 100%; }
.door-cols { display: flex; gap: 6pt; }
.door-col { flex: 1; display: flex; flex-direction: column; gap: 2pt; min-width: 0; }
.door-cell { border: 1px solid #000; }
.door-cell.double { border-width: 2.5pt; }
.door-cell.empty { border-style: dashed; }
.door-line { display: flex; gap: 4pt; min-height: 27pt; padding: 1pt 4pt; } /* 40 spaces fit one page */
.door-cell.double .door-line { min-height: 56pt; }
.door-line + .door-line { border-top: 1px solid #000; }
.door-no { flex: none; min-width: 1.6em; font-size: 11pt; white-space: nowrap; }
.door-text { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 0 6pt; min-width: 0; overflow-wrap: anywhere; }
.door-label { flex: 1; font-weight: 600; }
.door-facts { flex: none; }
.door-rooms { flex: 1 1 100%; }
.door-line.write .door-text { margin-bottom: 5pt; border-bottom: 1px solid #000; }
.full-list { width: 100%; border-collapse: collapse; text-align: left; }
.full-list th, .full-list td { padding: 2pt 8pt 2pt 0; vertical-align: top; }
.full-list .full-breaker th { padding-top: 8pt; border-bottom: 1px solid #000; font-size: 11pt; }
.full-list tr { break-inside: avoid; }
@page { margin: 0.5in; }
@media print {
  :root { color-scheme: light; --bg: #fff; --fg: #000; }
  html, body { height: auto; }
  body { display: block; }
  #header, #top-banner, #tabs, #mode-bar, #toast, .no-print { display: none !important; }
  #screen { overflow: visible; }
  .paper-fit { margin: 0; }
  .paper { margin: 0; padding: 0; zoom: 1 !important; }
  .sheet-page + .sheet-page { margin: 0; padding: 0; border: 0; break-before: page; }
}
```

- [ ] **Step 5: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (150 pass), then `node tools/serve.mjs` and http://localhost:8765. Use a house with a 12-space panel holding: breaker 1 "Kitchen" with two tested devices and one guessed in another room, a double on 2/4, a tandem in 3 with only the top entered, space 5 marked empty, the rest not entered. The console must stay free of errors.

1. Breakers shows "Print or save as PDF" under the progress line, with no "Last printed" yet.
2. Print or save as PDF: "Print Main panel", Short ticked, a white page (white in dark mode too) holding a bordered card about two thirds of the page wide, headed "<house>: Main panel", "Printed <today>", "? = not confirmed by testing yet".
3. The card has two columns. Breaker 1 reads "1 Kitchen 15 A" with its rooms and a "?" under it; 2/4 is one tall box with a thick border and "240 V"; space 3 is two halves, "3 top" filled and "3 bottom" a ruled line; space 5 is dashed and says "empty"; unentered spaces are a number and a ruled line.
4. Full: a second page follows a dashed rule, with the same heading, then each breaker as a heading with its devices as rows (label, what it is, room, "guess"), or "Nothing found on this breaker yet."
5. At phone width the whole paper fits the screen width, with no sideways scrolling.
6. Print opens the system print dialog showing only the paper: no tabs, no buttons, the card at its real size, and in Full the list starting on a second page.
7. Back to Main panel: "Last printed <today>" beside the button. Change breaker 1's label: "1 breaker changed since. Print again?" appears. Print again: it goes.
8. Make a subpanel fed from 2/4 and open its preview: the heading adds "Fed from breaker 2/4 in Main panel".
9. A 40-space panel's card is the full width of the page.

- [ ] **Step 6: Commit**

```bash
git add src/view/print.js src/view/panel.js src/app.js styles.css
git commit -m "feat: print a panel's door card and device list"
```

---

### Task 3: Download spreadsheet

**Files:**
- Create: `src/view/savefile.js`
- Modify: `src/file.js`, `src/csv.js`, `src/view/browse.js`
- Test: `tests/csv.test.js`

- [ ] **Step 1: Write the failing test (append to `tests/csv.test.js`)**

Replace:

```js
import { devicesCsv, breakersCsv } from "../src/csv.js";
```

with:

```js
import { devicesCsv, breakersCsv, csvFile } from "../src/csv.js";
```

Append to the end of the file:

```js

test("the file to download is named for the house and the day, and starts with a byte-order mark", () => {
  const { p } = sample();
  const day = new Date(2026, 9, 6, 14, 5);
  const devices = csvFile(p, "devices", day), breakers = csvFile(p, "breakers", day);
  assert.equal(devices.name, "Dad's house devices 2026-10-06.csv");
  assert.ok(devices.text.startsWith("\uFEFFlabel,floor,"));
  assert.equal(breakers.name, "Dad's house breakers 2026-10-06.csv");
  assert.ok(breakers.text.startsWith("\uFEFFpanel,spaces,"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/csv.test.js`
Expected: FAIL, `The requested module '../src/csv.js' does not provide an export named 'csvFile'`.

- [ ] **Step 3: Share the safe file name (`src/file.js`)**

Replace:

```js
export function fileName(project, date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}${p(date.getMinutes())}`;
  const safe = project.name.replace(/[\\/:*?"<>|]/g, "").trim() || "House";
  return `${safe} ${stamp}${EXTENSION}`;
}
```

with:

```js
const pad = (n) => String(n).padStart(2, "0");

// The house name with the characters a file name cannot have taken out.
export function safeName(project) {
  return project.name.replace(/[\\/:*?"<>|]/g, "").trim() || "House";
}

// "2026-10-06"
export function dayStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fileName(project, date = new Date()) {
  return `${safeName(project)} ${dayStamp(date)} ${pad(date.getHours())}${pad(date.getMinutes())}${EXTENSION}`;
}
```

- [ ] **Step 4: Add `csvFile` (`src/csv.js`)**

Replace:

```js
import { find, breakerKey, sortedBreakers } from "./model.js";
```

with:

```js
import { find, breakerKey, sortedBreakers } from "./model.js";
import { safeName, dayStamp } from "./file.js";
```

Append to the end of the file:

```js

// The spreadsheet to download: which is "devices" or "breakers". { name, text }. The text starts with a byte-order
// mark so Excel shows accents correctly.
export function csvFile(project, which, date = new Date()) {
  return {
    name: `${safeName(project)} ${which} ${dayStamp(date)}.csv`,
    text: "\uFEFF" + (which === "breakers" ? breakersCsv(project) : devicesCsv(project)),
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test`
Expected: PASS, 151 tests (the file-name test in `tests/file.test.js` still passes).

- [ ] **Step 6: Write `src/view/savefile.js`**

```js
// Hand a file to him: the Share sheet on a phone (Save to Files, AirDrop, Mail), a download on a computer.
import { h, toast } from "../ui.js";

export async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // he closed the Share sheet
    }
  }
  const url = URL.createObjectURL(file);
  h("a", { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast(`Saved to your Downloads folder as ${name}.`);
}
```

- [ ] **Step 7: Add the button to the Map tab (`src/view/browse.js`)**

Replace:

```js
import { showOnPanel } from "./panel.js";
```

with:

```js
import { showOnPanel } from "./panel.js";
import { csvFile } from "../csv.js";
import { saveFile } from "./savefile.js";
```

Replace:

```js
      button("Key", keySheet)),
```

with:

```js
      button("Key", keySheet),
      button("Download spreadsheet", () => spreadsheetSheet(app))),
```

Append to the end of the file:

```js

// Everything as a spreadsheet: one row for each device, or one for each breaker.
function spreadsheetSheet(app) {
  const p = app.project, breakers = p.breakers.filter((b) => b.kind !== "empty").length;
  const get = (which) => {
    const file = csvFile(p, which);
    saveFile(file.name, file.text, "text/csv");
  };
  openSheet("Download spreadsheet", (close) => [
    h("p", { class: "small" }, "A file that opens in Excel or Numbers."),
    h("div", { class: "rows" },
      button(`Devices (${p.devices.length}): every outlet, switch and light, with its breaker`, () => { close(); get("devices"); }),
      button(`Breakers (${breakers}): what is on each one, and how sure`, () => { close(); get("breakers"); })),
    button("Cancel", close),
  ]);
}
```

- [ ] **Step 8: Check it in a browser**

Run: `for f in src/*.js src/view/*.js; do node --check "$f"; done; node --test` (151 pass), then http://localhost:8765 with the house from Task 2.

1. Map shows "Download spreadsheet" beside Key. It opens a sheet with "Devices (N): ..." and "Breakers (N): ...", and Cancel.
2. Devices: on a computer a file "<house> devices <date>.csv" lands in Downloads and a message says so. Opened in Excel or Numbers it has a heading row and one row per device, and a name with an accent (rename a room "Café") reads correctly.
3. Breakers: "<house> breakers <date>.csv", one row per breaker with devices_on_it, tested and guessed.
4. On an iPhone the Share sheet opens instead (by Josh, on the phone).

- [ ] **Step 9: Commit**

```bash
git add src/view/savefile.js src/file.js src/csv.js src/view/browse.js tests/csv.test.js
git commit -m "feat: download the devices or breakers as a spreadsheet"
```

---

## Done when

- `node --test` passes with 0 failures (151 tests).
- The browser checks in Tasks 2 and 3 pass, with no console errors.
- Three commits on `plan-3d-print`, ready to merge.

Then write Plan 4 (Export and Import with merge, PDF pictures, "Save a copy first", the Home Screen card, the header chip, Swap labels in the plates list).
