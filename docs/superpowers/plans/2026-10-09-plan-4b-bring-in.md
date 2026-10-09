# Circuit Map Plan 4b: Bring in a File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** He can bring a `.circuitmap` file into a house that already exists: it says in words what merging would do, merges only after he agrees, offers Undo import and Send it back, refuses to merge a file from a different house, shows the "Moving your project" steps, and accepts a file dropped on the window.

**Architecture:** The merge itself exists (`src/merge.js`, Plan 1). This plan adds the words for it in `src/sending.js` (pure, tested), one new model of "what came in by Import" (`app.cameIn`: so the header chip does not count other people's work as this device's), and three views: `view/bringin.js` (read the file, ask, merge, say it is done), `view/movesheet.js` (the "Move or back up" sheet, now with all three choices, and the steps card) and the first-launch "I already have a project file" screen, which now shows the same steps. `app.bringIn` / `app.undoImport` in `src/app.js` apply and take back a merge.

**Tech Stack:** As before: plain ES modules, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md` (Saving and moving between devices: Import, Moving your project, a different project, The header chip; Merge rules; Errors: unreadable file).

**Plan 4 is split:** 4a Send or back up (done, on branch `plan-4a-send`); 4b Bring in a file (this plan); 4c Plates to rewrite; 4d PDF pictures and the Home Screen card.

**Conventions for every task**

- Work on the branch `plan-4b-bring-in`, made from `plan-4a-send` (4a is not merged yet; this plan builds on it).
- Tests: `node --test`. Try it: `node tools/serve.mjs`, then http://127.0.0.1:8765 (use 127.0.0.1, not localhost, in the browser pane).
- Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Where a step says "Replace A with B", A appears exactly once in the file.

**Decisions made here**

- **What came in is not unsent work.** The chip counts records edited since the last send, except those that arrived in the file unchanged. `app.cameIn` is `{ id: updated }` for those records and deletions; it is kept on the device (`store.setSetting("cameIn", ...)`), emptied when a send finishes or a house is adopted from a file. A record this device relabelled during the merge, or one where this device's copy was newer, is not in it, so it counts and "Send it back" is offered.
- **Undo import puts this device back exactly as it was**, with no new times and no deletions recorded. (The ordinary Undo would record the imported items as deleted, and the next merge would then delete them on the other device.) The ordinary Undo history is emptied by an import, because stepping it back afterwards would do the same harm. Undo import stays in the "Move or back up" sheet for the rest of the session; if he has changed anything since, it asks first.
- **Counts are of everything the merge touches**, links included. A link is named by its two devices ("SW-01 switches KIT-02"), a breaker without a label is "A breaker".
- **"2 relabelled"** opens a plain list ("KIT-05 is now KIT-06") for now. Plan 4c replaces it with the plates-to-rewrite list.
- **A different house** can only be replaced, never merged. Replace has no Undo, as the spec says; "Save a copy of this device first, then replace" is the main button.
- **Nothing new** gives only OK, even when this device has unsent work (the spec's wording).
- The file picker is one hidden `<input id="picker">` in `index.html`, clicked straight from a tap, with no `accept` so iOS does not grey out `.circuitmap` files.

**Left for later plans on purpose:** the plates list and the chip's "2 plates" (4c); PDF pictures, the Home Screen card (4d); "Works without a signal" and the version line (Plan 5).

**File map**

| File | Responsibility |
|---|---|
| `src/merge.js` (modify) | Name links and unlabelled breakers in the lists |
| `src/sending.js` (modify) | `unsent`, `cameInFrom`, `importParts`, `fieldWords`, `changedLine`, `differentHouse`, `MOVING` steps |
| `src/app.js` (modify) | `cameIn`, `importUndo`, `bringIn`, `undoImport`; chip and nudge use `unsent`; drop a file on the window |
| `index.html` (modify) | The hidden file picker |
| `src/view/bringin.js` (new) | Choose a file, read it, ask, merge, done, Undo import, a different house |
| `src/view/movesheet.js` (new) | The "Move or back up" sheet and the "Moving your project" card |
| `src/view/send.js` (modify) | Loses `sendSheet` (moved to `movesheet.js`) |
| `src/view/welcome.js` (modify) | "I already have a project file" shows the steps first |
| `styles.css` (modify) | Numbered lists in sheets and pages |

---

### Task 1: Name links and breakers in the merge lists

**Files:**
- Modify: `src/merge.js`
- Test: `tests/merge.test.js`

- [ ] **Step 1: Write the failing test** (append to `tests/merge.test.js`)

```js
test("a link is named by its two devices in the list of what was deleted", () => {
  const { phone, main, kit, first } = pair();
  const sw = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "S", x: 9, y: 9 }, 1200);
  m.toggleLink(phone, { switchId: sw.id, loadId: first.id }, 1300);
  const mac = structuredClone(phone);
  m.remove(mac, "devices", first.id, 3000);
  const { summary } = merge(phone, mac);
  assert.deepEqual(summary.removedItems.map((r) => r.name).sort(), [first.label, `${sw.label} switches ${first.label}`].sort());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/merge.test.js`
Expected: FAIL, the link's name is its id.

- [ ] **Step 3: Replace the `nameOf` line in `src/merge.js`**

Replace
```js
  const nameOf = (r) => r.label || r.name || r.code || r.id;
```
with
```js
  const labelOf = new Map([...local.devices, ...incoming.devices].map((d) => [d.id, d.label]));
  const nameOf = (r) => r.switchId ? `${labelOf.get(r.switchId) || "A switch"} switches ${labelOf.get(r.loadId) || "a device"}`
    : r.label || r.name || r.code || (r.slots ? "A breaker" : r.id);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: all pass (156).

- [ ] **Step 5: Commit**

```bash
git checkout -b plan-4b-bring-in
git add src/merge.js tests/merge.test.js
git commit -m "feat: name links and breakers in what a merge changed"
```

---

### Task 2: The words, and what came in

**Files:**
- Modify: `src/sending.js`
- Test: `tests/sending.test.js`

- [ ] **Step 1: Write the failing tests** (append to `tests/sending.test.js`; extend the existing import lines to the names below)

Replace the line `import { chipText, sendStatus, needsBackup, sizeText } from "../src/sending.js";` with
```js
import { chipText, sendStatus, needsBackup, sizeText, unsent, cameInFrom, importParts, nothingNew, needsCare, fieldWords, changedLine, differentHouse, MOVING } from "../src/sending.js";
import { merge } from "../src/merge.js";
```
then append:
```js
test("what came in from a file is not counted as unsent", () => {
  const { p: phone, main, kit, ext } = sample();
  const mac = structuredClone(phone);
  const theirs = m.placeDevice(mac, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 2000);
  m.remove(mac, "rooms", ext.id, 2100);
  const { project } = merge(phone, mac);
  const cameIn = cameInFrom(project, mac);
  assert.equal(unsent(project, 1500), 2); // the new device and the room's deletion
  assert.equal(unsent(project, 1500, cameIn), 0);
  m.update(project, "devices", theirs.id, { note: "mine" }, 3000); // this device's own edit counts
  assert.equal(unsent(project, 1500, cameIn), 1);
});

test("the import question names only what is not zero", () => {
  const s = { added: 12, updated: 0, removed: 0, renumbered: [] };
  assert.deepEqual(importParts(s).map((p) => p.text), ["12 new"]);
  const t = { added: 12, updated: 3, removed: 2, renumbered: [{}, {}] };
  assert.deepEqual(importParts(t).map((p) => [p.key, p.text]),
    [["added", "12 new"], ["updated", "3 changed"], ["removed", "2 deleted"], ["renumbered", "2 relabelled"]]);
  assert.equal(nothingNew({ added: 0, updated: 0, removed: 0, renumbered: [] }), true);
  assert.equal(nothingNew(s), false);
  assert.deepEqual([needsCare(s), needsCare(t), needsCare({ ...s, renumbered: [{}] })], [false, true, false]);
});

test("changed fields are named in his words", () => {
  assert.deepEqual(fieldWords(["heightIn", "note"]), ["height", "note"]);
  assert.deepEqual(fieldWords(["x", "y", "breakerId", "tested", "toggles", "gfciId", "notWorking"]),
    ["position", "breaker", "test result", "number of switches", "GFCI", "Not working"]);
  assert.equal(changedLine({ name: "KIT-03", fields: ["note", "roomId", "wibble"] }), "KIT-03: note, room, wibble");
});

test("a file from a different house says what each side holds", () => {
  const a = { name: "Dad's house", floors: 2, devices: 63 }, b = { name: "My house", floors: 1, devices: 12 };
  assert.equal(differentHouse(b, a),
    "This file is a different house: Dad's house, 2 floors, 63 devices. This device has My house, 1 floor, 12 devices.");
});

test("the Moving your project steps are there for both directions", () => {
  assert.equal(MOVING.phoneToMac.length, 3);
  assert.equal(MOVING.macToPhone.length, 2);
  assert.match(MOVING.tip, /^Tip: finish on one device/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/sending.test.js`
Expected: FAIL, the new names are not exported.

- [ ] **Step 3: Add to `src/sending.js`**

Replace the import line `import { COLLECTIONS, changesSince } from "./model.js";` with
```js
import { COLLECTIONS } from "./model.js";
```
Replace the `changesSince(project, sentAt)` call in `sendStatus` and in `needsBackup` (two places) with `unsent(project, sentAt, cameIn)`, and add the parameter: `sendStatus(project, sentAt, now = Date.now(), cameIn = {})` and `needsBackup(project, sentAt, laterAt, now = Date.now(), cameIn = {})`. Then append:

```js
// Records and deletions changed on this device since it last finished a send, leaving out those that arrived by Import
// unchanged. cameIn is { id: updated } (or { id: at } for a deletion), see cameInFrom.
export function unsent(project, sentAt, cameIn = {}) {
  let n = 0;
  for (const c of COLLECTIONS) for (const r of project[c]) if (r.updated > sentAt && cameIn[r.id] !== r.updated) n++;
  for (const t of project.deleted) if (t.at > sentAt && cameIn[t.id] !== t.at) n++;
  return n;
}

// After merging incoming into this device: which records and deletions are exactly as the file had them.
export function cameInFrom(merged, incoming) {
  const theirs = new Map();
  for (const c of COLLECTIONS) for (const r of incoming[c]) theirs.set(r.id, r.updated);
  for (const t of incoming.deleted) theirs.set(t.id, t.at);
  const out = {};
  for (const c of COLLECTIONS) for (const r of merged[c]) if (theirs.get(r.id) === r.updated) out[r.id] = r.updated;
  for (const t of merged.deleted) if (theirs.get(t.id) === t.at) out[t.id] = t.at;
  return out;
}

// The parts of "From the file: 12 new, 3 changed, 2 deleted." summary is merge()'s summary. A part with none is left out.
export function importParts(summary) {
  return [["added", summary.added, "new"], ["updated", summary.updated, "changed"], ["removed", summary.removed, "deleted"],
    ["renumbered", summary.renumbered.length, "relabelled"]]
    .filter(([, n]) => n).map(([key, n, word]) => ({ key, text: `${n} ${word}` }));
}

export const nothingNew = (summary) => importParts(summary).length === 0;

// Changing or deleting what is on this device is worth a second look (and a copy first).
export const needsCare = (summary) => summary.updated > 0 || summary.removed > 0;

const FIELD_WORDS = { label: "label", plateLabel: "label", type: "type", customName: "type", name: "name", code: "code", roomId: "room",
  floorId: "floor", x: "position", y: "position", heightIn: "height", note: "note", breakerId: "breaker", tested: "test result",
  toggles: "number of switches", gfciId: "GFCI", notWorking: "Not working", outline: "outline", imageId: "picture" };

// Field names from a record, in his words, each once, in the order they first appear.
export const fieldWords = (fields) => [...new Set(fields.map((f) => FIELD_WORDS[f] || f))];

// "KIT-03: note, height"
export const changedLine = (item) => `${item.name}: ${fieldWords(item.fields).join(", ")}`;

const houseText = (d) => `${d.name}, ${plural(d.floors, "floor")}, ${plural(d.devices, "device")}`;

// local and file are model.describeProject results.
export const differentHouse = (local, file) => `This file is a different house: ${houseText(file)}. This device has ${houseText(local)}.`;

export const MOVING = {
  phoneToMac: ["On the phone choose Export.", "Choose AirDrop and pick the Mac.", "On the Mac, choose Import and pick the file from Downloads."],
  macToPhone: ["On the Mac choose Export, then AirDrop the file to the iPhone and choose Save to Files.", "On the phone choose Import and pick it from Files."],
  tip: "Tip: finish on one device and send the file before working on the other, and labels never clash.",
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test`
Expected: all pass. The existing `sendStatus` and `needsBackup` tests still pass (their new parameter defaults).

- [ ] **Step 5: Commit**

```bash
git add src/sending.js tests/sending.test.js
git commit -m "feat: the words for bringing in a file, and what counts as unsent after it"
```

---

### Task 3: Apply and undo a merge in the app

**Files:**
- Modify: `src/app.js`, `index.html`

There are no node tests for the shell; Task 6 checks it in the browser.

- [ ] **Step 1: Add the picker to `index.html`**

Replace `<div id="toast" role="status"></div>` with
```html
<div id="toast" role="status"></div>
<input id="picker" type="file" hidden>
```

- [ ] **Step 2: `src/app.js` state and actions**

Replace `import { chipText, needsBackup } from "./sending.js";` with
```js
import { chipText, needsBackup, unsent } from "./sending.js";
```
Replace `import { sendSheet, exportSheet } from "./view/send.js";` with
```js
import { exportSheet } from "./view/send.js";
import { sendSheet } from "./view/movesheet.js";
import { importFile } from "./view/bringin.js";
```

In `adopt`, replace
```js
      sentAt: images ? Date.now() : 0, nudge: false });
    app.store.setSetting("sent", app.sentAt).catch(() => {});
```
with
```js
      sentAt: images ? Date.now() : 0, nudge: false, cameIn: {}, importUndo: null });
    app.store.setSetting("sent", app.sentAt).catch(() => {});
    app.store.setSetting("cameIn", {}).catch(() => {});
```

Replace
```js
  markSent(at) {
    app.sentAt = at;
    app.nudge = false;
    app.store.setSetting("sent", at).catch(() => {});
    render();
  },
```
with
```js
  // { id: updated }: records and deletions that arrived by Import exactly as they are, which are not this device's work
  // to send (see sending.js unsent). Emptied by a send.
  cameIn: {},
  // Set by bringIn, for Undo import: { project, history, cameIn, after } as they were before it, and the project as it
  // was just after. Lasts for the session.
  importUndo: null,

  markSent(at) {
    app.sentAt = at;
    app.cameIn = {};
    app.nudge = false;
    app.store.setSetting("sent", at).catch(() => {});
    app.store.setSetting("cameIn", {}).catch(() => {});
    render();
  },

  // Take in a merged project (from merge.js) and the pictures that came with the file ({ imageId: data URL }). The
  // ordinary Undo history is emptied: stepping back through it afterwards would record the imported things as deleted.
  async bringIn(merged, images, cameIn) {
    if (app.mode) app.cancelMode();
    const before = { project: structuredClone(app.project), history: app.history, cameIn: app.cameIn };
    for (const floor of merged.floors) {
      const url = images[floor.imageId];
      if (url && !(await app.store.getImage(floor.imageId))) await app.store.putImage(floor.imageId, await (await fetch(url)).blob());
    }
    Object.assign(app.project, merged);
    Object.assign(app, { history: createHistory(), ui: {}, cameIn: { ...app.cameIn, ...cameIn } });
    app.importUndo = { ...before, after: JSON.stringify(app.project) };
    if (app.test && !m.find(app.project, "breakers", app.test.breakerId)) app.test = null;
    app.store.setSetting("cameIn", app.cameIn).catch(() => {});
    app.saveTest();
    app.save();
    render();
  },

  // Put this device back exactly as it was before the last bringIn. Nothing is recorded as deleted.
  undoImport() {
    const { project, history, cameIn } = app.importUndo;
    if (app.mode) app.cancelMode();
    Object.assign(app.project, project);
    Object.assign(app, { history, cameIn, ui: {}, importUndo: null });
    app.store.setSetting("cameIn", cameIn).catch(() => {});
    app.save();
    render();
  },
```

In `render`, replace `const chip = chipText(m.changesSince(p, app.sentAt));` with
```js
  const chip = chipText(unsent(p, app.sentAt, app.cameIn));
```

Before the `document.addEventListener("keydown", ...)` block add:
```js
// A file dropped on the window is brought in. (With no house yet the first-launch screen takes it.)
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file && app.project && !document.querySelector("dialog[open]")) importFile(app, file);
});
```

In `boot`, replace
```js
    app.sentAt = await app.store.getSetting("sent", 0);
    app.nudge = needsBackup(app.project, app.sentAt, await app.store.getSetting("later", 0));
```
with
```js
    app.sentAt = await app.store.getSetting("sent", 0);
    app.cameIn = await app.store.getSetting("cameIn", {});
    app.nudge = needsBackup(app.project, app.sentAt, await app.store.getSetting("later", 0), Date.now(), app.cameIn);
```

(Other uses of `sendSheet` stay: the chip's click handler.) Do not commit yet: the two imported modules arrive in Tasks 4 and 5, so commit once Task 5 is in.

---

### Task 4: Bring in a file

**Files:**
- Create: `src/view/bringin.js`

- [ ] **Step 1: Write `src/view/bringin.js`**

```js
// Bring in a file: read it, say in words what merging would do, merge only when he agrees, then say it is done.
import * as m from "../model.js";
import { parse } from "../file.js";
import { merge } from "../merge.js";
import { importParts, nothingNew, needsCare, changedLine, cameInFrom, differentHouse, unsent } from "../sending.js";
import { h, button, openSheet, ask, toast } from "../ui.js";
import { exportSheet } from "./send.js";

const TITLE = "Bring in a file";

// Open the file picker. Called straight from a tap, because a phone only allows that. The picker shows every file.
export function chooseFile(app) {
  const picker = document.getElementById("picker");
  picker.value = "";
  picker.onchange = () => picker.files[0] && importFile(app, picker.files[0]);
  picker.click();
}

export async function importFile(app, file) {
  const status = h("p", { role: "status" }, "Reading file...");
  const close = openSheet(TITLE, (close) => [status, button("Cancel", close)]);
  let incoming;
  try {
    incoming = parse(await file.text());
  } catch (err) {
    close();
    ask("This file can't be used", err.code ? err.message : "This file could not be read.", [{ text: "OK", cls: "main" }]);
    return;
  }
  if (!status.isConnected) return; // he cancelled while it was being read
  close();
  if (incoming.project.id !== app.project.id) return askDifferentHouse(app, incoming);
  askBringIn(app, incoming, merge(app.project, incoming.project));
}

function askDifferentHouse(app, { project, images }) {
  const replace = () => app.adopt(project, images);
  ask(TITLE, differentHouse(m.describeProject(app.project), m.describeProject(project)), [
    { text: "Save a copy of this device first, then replace", cls: "main", run: () => exportSheet(app, replace) },
    { text: "Replace without saving", cls: "plain danger", run: replace },
    { text: "Cancel" },
  ]);
}

// "From the file: 12 new, 3 changed, 2 deleted. Bring them in?" Nothing changes until he taps Bring them in.
function askBringIn(app, incoming, result) {
  const { project, summary } = result;
  if (nothingNew(summary)) {
    ask(TITLE, "Nothing new: this device already has everything in the file.", [{ text: "OK", cls: "main" }]);
    return;
  }
  const lists = {
    updated: summary.changed.map(changedLine),
    removed: summary.removedItems.map((r) => r.name),
    renumbered: summary.renumbered.map((c) => `${c.from} is now ${c.to}`),
  };
  openSheet(TITLE, (close) => {
    const open = h("div");
    let shown = "";
    const show = (key) => {
      shown = shown === key ? "" : key;
      open.replaceChildren(...(shown ? [h("ul", {}, lists[shown].map((t) => h("li", {}, t)))] : []));
    };
    const parts = importParts(summary).map((part, i) => [i ? ", " : "",
      lists[part.key] ? button(part.text, () => show(part.key), "plain") : part.text]);
    return [
      h("p", {}, "From the file: ", parts, ". Bring them in?"),
      open,
      needsCare(summary) && h("p", { class: "small" },
        "If the same item was changed on both devices, the newer change is kept. Your other work on this device stays."),
      h("div", { class: "buttons" },
        button("Bring them in", async () => {
          close();
          await app.bringIn(project, incoming.images, cameInFrom(project, incoming.project));
          done(app);
        }, "main"),
        button("Cancel", close),
        needsCare(summary) && button("Save a copy of this device first", () => {
          close();
          exportSheet(app, () => askBringIn(app, incoming, result)); // the question comes back once the copy is saved
        })),
    ];
  });
}

// "Done." and, when this device has work the other one has not seen, the offer to send it back: the second half of
// every exchange, without which one device is always behind.
function done(app) {
  const back = unsent(app.project, app.sentAt, app.cameIn) > 0;
  openSheet(TITLE, (close) => [
    h("p", {}, "Done. This device now has everything from both."),
    back && h("p", {}, "The other device does not have this device's work yet. Send this project back to it?"),
    h("div", { class: "buttons" },
      ...(back
        ? [button("Send it back", () => { close(); exportSheet(app); }, "main"), button("Not now", close)]
        : [button("OK", close, "main")]),
      button("Undo import", () => { close(); undoImport(app); })),
  ]);
}

// Available from the "Move or back up" sheet for the rest of the session. If he has changed anything since, he is asked.
export function undoImport(app) {
  const back = () => {
    app.undoImport();
    toast("Import undone.");
  };
  if (JSON.stringify(app.project) === app.importUndo.after) return back();
  ask("Undo import", "You have made changes since bringing in the file. Undo import will take those away too.", [
    { text: "Cancel", cls: "main" },
    { text: "Undo import anyway", cls: "plain danger", run: back },
  ]);
}
```

(Do not commit yet; Task 5 completes the imports.)

---

### Task 5: The "Move or back up" sheet and the steps card

**Files:**
- Create: `src/view/movesheet.js`
- Modify: `src/view/send.js`, `styles.css`

- [ ] **Step 1: Write `src/view/movesheet.js`**

```js
// "Move or back up": what the chip in the header opens. Send, bring in a file, and the steps for moving a project.
import { sendStatus, MOVING } from "../sending.js";
import { h, button, openSheet } from "../ui.js";
import { exportSheet } from "./send.js";
import { chooseFile, undoImport } from "./bringin.js";

// Both directions in numbered steps. Also shown on the first-launch screen.
export function movingCard() {
  const steps = (list) => h("ol", {}, list.map((s) => h("li", {}, s)));
  return h("div", { class: "steps" },
    h("h3", {}, "Phone to Mac"), steps(MOVING.phoneToMac),
    h("h3", {}, "Mac to phone"), steps(MOVING.macToPhone),
    h("p", { class: "small" }, MOVING.tip));
}

export function sendSheet(app) {
  openSheet("Move or back up", (close) => [
    h("p", {}, sendStatus(app.project, app.sentAt, Date.now(), app.cameIn)),
    h("p", { class: "small" }, "Send a copy to your Mac, or save it to iCloud Drive. A copy that never leaves this device does not protect against a lost or wiped phone."),
    h("div", { class: "buttons" },
      button("Send or back up", () => { close(); exportSheet(app); }, "main"),
      // The picker is opened here, in the tap itself; the sheet closing first does not stop it.
      button("Bring in a file", () => { close(); chooseFile(app); }),
      button("Moving your project", () => {
        close();
        openSheet("Moving your project", (shut) => [movingCard(), button("Close", shut, "main")]);
      }),
      app.importUndo && button("Undo import", () => { close(); undoImport(app); }),
      button("Close", close)),
  ]);
}
```

- [ ] **Step 2: Remove `sendSheet` from `src/view/send.js`**

Delete the whole `sendSheet` function and the comment line `// "Move or back up": what the chip in the header opens.` above it. Replace
```js
import { sendStatus, sizeText } from "../sending.js";
```
with
```js
import { sizeText } from "../sending.js";
```
Replace the file's first comment `// Send or back up: the whole house, pictures included, as one project file. Also the sheet behind the header chip.` with `// Send or back up: the whole house, pictures included, as one project file.`

- [ ] **Step 3: Styles** — in `styles.css` replace
```css
dialog.sheet ul { margin: 0; padding-left: 24px; }
```
with
```css
dialog.sheet ul, dialog.sheet ol, .steps ol { margin: 0; padding-left: 24px; }
.steps h3 { margin: 12px 0 4px; font-size: 18px; }
```

- [ ] **Step 4: Run the tests and load the app**

Run: `node --test`
Expected: all pass. Then start the server, open http://127.0.0.1:8765, confirm the page loads and the console has no errors (a missing export would show here).

- [ ] **Step 5: Commit** (Tasks 3, 4 and 5 together; they only work together)

```bash
git add index.html src/app.js src/view/bringin.js src/view/movesheet.js src/view/send.js styles.css
git commit -m "feat: bring in a file: say what merging would do, merge, undo import, send it back"
```

---

### Task 6: "I already have a project file" shows the steps

**Files:**
- Modify: `src/view/welcome.js`

- [ ] **Step 1: Replace the picker on the first screen**

In `welcomeView`, replace
```js
  if (app.ui.offered) return offerScreen(app);
  const picker = h("input", { type: "file", hidden: true, onchange: () => picker.files[0] && readFile(app, picker.files[0]) });
  const el = h("section", { class: "page" },
```
with
```js
  if (app.ui.offered) return offerScreen(app);
  if (app.ui.finding) return findScreen(app);
  const el = h("section", { class: "page" },
```
Replace
```js
      button("I already have a project file", () => picker.click(), "main")),
    picker,
    app.ui.fileError && h("p", { class: "error", role: "alert" }, app.ui.fileError),
```
with
```js
      button("I already have a project file", () => {
        app.ui.finding = true;
        app.render();
      }, "main")),
```
Replace
```js
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) readFile(app, e.dataTransfer.files[0]);
  });
  return el;
}
```
with
```js
  return dropTarget(app, el);
}

// A file dropped on the screen is read as if it had been chosen.
function dropTarget(app, el) {
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) readFile(app, e.dataTransfer.files[0]);
  });
  return el;
}

// The same steps as in the header sheet, for a device that has nothing yet.
function findScreen(app) {
  const picker = h("input", { type: "file", hidden: true, onchange: () => picker.files[0] && readFile(app, picker.files[0]) });
  return dropTarget(app, h("section", { class: "page" },
    h("h1", {}, "Bring in your project file"),
    movingCard(),
    h("div", { class: "buttons" },
      button("Choose the file", () => picker.click(), "main"),
      button("Back", () => {
        app.ui.finding = false;
        app.ui.fileError = "";
        app.render();
      })),
    picker,
    app.ui.fileError && h("p", { class: "error", role: "alert" }, app.ui.fileError)));
}
```
Add the import after the `ui.js` import line:
```js
import { movingCard } from "./movesheet.js";
```

- [ ] **Step 2: Run the tests**

Run: `node --test`
Expected: all pass (156 + 5 new = 161; the count in Done-when below is checked against the real run).

- [ ] **Step 3: Commit**

```bash
git add src/view/welcome.js
git commit -m "feat: show the steps for moving a project before choosing the file"
```

---

### Task 7: Check it in the browser

**Files:** none changed unless a check fails.

Start the server (`node tools/serve.mjs`) and open http://127.0.0.1:8765 in the browser pane. Start a new house "Test house", add a floor "Main", a room "Kitchen" (code KIT), and place two outlets with the Add tab. Make a second copy of the project to play the "other device", from the page's console:

```js
const { app } = await import("/src/app.js");
const m = await import("/src/model.js");
const { serialize } = await import("/src/file.js");
window.other = structuredClone(app.project);                       // the other device starts from this copy
const f = m.sortedFloors(other)[0], room = other.rooms[0];
m.placeDevice(other, { floorId: f.id, roomId: room.id, type: "L", x: 20, y: 20 }, Date.now() + 1000);   // one new
m.update(other, "devices", other.devices[0].id, { note: "from the other device", heightIn: 20 }, Date.now() + 2000); // one changed
m.remove(other, "devices", other.devices[1].id, Date.now() + 3000);                                      // one deleted
window.fileFor = (p) => new File([serialize(p, {})], "other.circuitmap");
```

- [ ] **Step 1: The question.** In the console: `(await import("/src/view/bringin.js")).importFile(app, fileFor(other))`. The sheet shows "Reading file..." and then "From the file: 1 new, 1 changed, 1 deleted. Bring them in?" Tapping "1 changed" lists "KIT-01: height, note" (the device's real label); tapping "1 deleted" lists the other device's label; tapping it again hides the list. The small "If the same item was changed on both devices..." line and three buttons are there (Bring them in, Cancel, Save a copy of this device first). Cancel changes nothing: the chip number is the same.
- [ ] **Step 2: Save a copy first.** Tap "Save a copy of this device first": the Send or back up sheet opens; after the download starts the question comes back with the same wording.
- [ ] **Step 3: Bring them in.** Tap Bring them in. The sheet says "Done. This device now has everything from both." The Map tab shows the new light and no longer the deleted outlet; the changed outlet's note reads "from the other device". The chip does not count the three imported changes. Because this device had no unsent work of its own, the offer to send it back is absent and the only buttons are OK and Undo import.
- [ ] **Step 4: Send it back appears when it should.** Place one more outlet (chip says 1 change not sent). Import the same file again: "Nothing new: this device already has everything in the file." with only OK. Then make a newer file: `m.update(other, "devices", other.devices[0].id, { note: "again" }, Date.now() + 5000)` and import it; after Bring them in, the Done sheet adds "The other device does not have this device's work yet. Send this project back to it?" with Send it back (opens the Send sheet) and Not now.
- [ ] **Step 5: Undo import.** In the chip's sheet there is an Undo import button. With no change since, tapping it brings back the earlier note and the earlier chip count and says "Import undone."; after a change since the import, it first asks and offers Undo import anyway. After the undo, import the file again: the same question comes back (nothing was recorded as deleted).
- [ ] **Step 6: A different house.** `const other2 = (await import("/src/model.js")).createProject("Dad's house")` (add a floor to it) then import `fileFor(other2)`: "This file is a different house: Dad's house, 1 floor, 0 devices. This device has Test house, 1 floor, N devices." with the three buttons. Cancel changes nothing. (Do not try Replace on the house you want to keep; to see it work, use "Replace without saving" on a throwaway house.)
- [ ] **Step 7: A bad file.** `importFile(app, new File(["hello"], "x.circuitmap"))` shows "This file could not be read." with OK; `new File(["{}"], "x")` shows "This is not a Circuit Map project file."; nothing changes.
- [ ] **Step 8: Chip menu and steps.** Tapping the chip shows Send or back up, Bring in a file, Moving your project, (Undo import when there is one) and Close. Moving your project shows both numbered lists and the tip. Bring in a file opens the file picker (the browser's native dialog; close it with Esc).
- [ ] **Step 9: Drop a file.** Dispatch a drop on the window:
```js
const dt = new DataTransfer(); dt.items.add(fileFor(other));
document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
```
The same question sheet opens. With a sheet already open the drop is ignored.
- [ ] **Step 10: First-launch screen.** Clear this site's data (`indexedDB.deleteDatabase("circuit-map")` then reload). Tap "I already have a project file": the steps screen appears with Choose the file and Back; Back returns to the two buttons. Dropping `fileFor(other)` on this screen (dispatch on the `section`) shows the "Use this one?" offer as before.
- [ ] **Step 11: Console.** `read_console_messages` with errors only: none. Reload the app after Step 3 without undoing: the chip's count is the same as before the reload (`cameIn` was kept).

If any check fails, fix it, add a test where the fault is in `src/sending.js` or `src/merge.js`, and commit the fix with its own message.

---

## Done when

- `node --test` passes with 0 failures (161 tests).
- The browser checks in Task 7 pass, with no console errors.
- Four commits on `plan-4b-bring-in` (merge names, words, bring in a file, first-launch steps), on top of `plan-4a-send`, ready to merge.

Then write Plan 4c (Plates to rewrite: the "N plates to rewrite" bar on the Map tab with Remind me later, the list with Show on plan, "I've rewritten it" and Swap labels, "I've rewritten all N" with its confirmation, the pencil mark on the plan, "KIT-06 (plate says KIT-05)" in the details, the chip's "12 not sent, 2 plates", and "2 relabelled" in the import question opening that list).
