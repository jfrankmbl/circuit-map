# A More Modern Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every screen a more modern look (softer colours, rounder shapes, depth, calmer type) by changing `styles.css` only, with no change to how anything behaves.

**Architecture:** The look comes from one stylesheet, so this plan rewrites its tokens (colours, radii, shadows) and then the rules that use them: the shell (header, tabs, bar), controls (buttons, fields), and surfaces (sheets, toast, cards). No kit is added and no JS changes. The existing token names (`--bg`, `--fg`, `--muted`, `--line`, `--panel`, `--accent`, `--accent-fg`, `--danger`) keep their meaning, so nothing that uses them breaks; three new ones are added (`--line-strong`, `--radius`, shadows). The plan SVG colours, the print block and the 44-point touch targets are not touched.

**Tech Stack:** Plain CSS. Checked in the built-in browser pane; `node --test` is run only to show nothing else moved (CSS has no unit tests, so there is no failing-test step).

**Why not a kit yet:** Counting the code showed buttons (`button()` in `src/ui.js`, about 165 uses) and sheets (`openSheet()`, 34 uses) go through single helpers, so Web Awesome can be added later with a few edits in `ui.js`. Most of what looks dated is in this stylesheet, so it comes first and works whichever way that later plan goes.

**Branch:** `plan-ui-look`, created from `plan-4b-bring-in` (not yet merged), so the 4b screens are covered. Plan 4c continues from `plan-4b-bring-in` as before; whichever lands second merges the other in. Merge only when Josh says.

---

## File map

- Modify: `styles.css` (the only file changed)
- Create: `docs/superpowers/review/ui-look.md` (before/after notes from Task 5)

## Ground rules for every task

- Keep text at 16 px or more, touch targets at 44 px or more, and never let colour alone carry a meaning (the tick on pressed buttons, "No power" in words, the dotted and dashed space borders all stay).
- Do not edit the blocks under `/* On the plan. ... */`, `/* Markers. ... */`, `/* Print. ... */` or `@media print`. Their colours are fixed on purpose.
- Contrast: text 4.5:1, borders that identify a control 3:1. Task 5 measures this.

---

### Task 1: Tokens

**Files:**
- Modify: `styles.css:1-11`

- [ ] **Step 1: Branch.** `plan-ui-look` already exists (this plan was committed on it). Confirm with `git branch --show-current`.

- [ ] **Step 2: Replace the token blocks.** Replace lines 1 to 11 of `styles.css` (from `:root {` through the closing brace of the dark-mode media query) with:

```css
:root {
  color-scheme: light dark;
  --bg: #fff; --fg: #14171f; --muted: #596073; --line: #d3d8e2; --line-strong: #858ca0; --panel: #eef0f5;
  --accent: #2f55d4; --accent-fg: #fff; --danger: #b3261e;
  --radius: 12px; --radius-sm: 8px;
  --shadow-1: 0 1px 2px rgba(20, 23, 31, 0.08), 0 1px 3px rgba(20, 23, 31, 0.1);
  --shadow-2: 0 10px 28px rgba(20, 23, 31, 0.2), 0 2px 6px rgba(20, 23, 31, 0.12);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161c; --fg: #eceef3; --muted: #a6adbd; --line: #2e3340; --line-strong: #6f778a; --panel: #20242e;
    --accent: #93aaff; --accent-fg: #10131a; --danger: #f2b8b5;
    --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.5);
    --shadow-2: 0 10px 28px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);
  }
}
```

- [ ] **Step 3: Check the app still loads.** Start the server (or use the one already on 8765), open `http://127.0.0.1:8765` (not `localhost`, see the note in memory), and confirm the screen renders with the new colours and `read_console_messages` (errors only) is empty.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "style: softer colour tokens, a radius and two shadows"
```

---

### Task 2: The shell (header, tabs, bars)

**Files:**
- Modify: `styles.css` (the `#header`, `#tabs`, `#mode-bar` rules near the top, and the `@media (max-width: 699px) { #tabs button ... }` line)

- [ ] **Step 1: Header.** Replace the `#header h1` rule with:

```css
#header h1 { flex: 1; margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

and the `#header` rule with:

```css
#header { order: 1; display: flex; align-items: center; gap: 12px; padding: 8px 16px; padding-top: max(8px, env(safe-area-inset-top)); border-bottom: 1px solid var(--line); background: var(--bg); box-shadow: var(--shadow-1); position: relative; z-index: 2; }
```

- [ ] **Step 2: Tabs.** Replace the two `#tabs button` rules (the plain one and the `[aria-current="page"]` one, just under `#tabs {`) with:

```css
#tabs button { flex: 1; min-height: 56px; border: 0; border-radius: 0; background: none; box-shadow: none; color: var(--muted); font-weight: 500; }
#tabs button[aria-current="page"] { color: var(--fg); font-weight: 700; box-shadow: inset 0 3px 0 var(--accent); }
```

Inside the `@media (min-width: 700px)` block, replace the `#tabs button` and `#tabs button[aria-current="page"]` lines with:

```css
  #tabs button { flex: none; padding: 8px 24px; }
  #tabs button[aria-current="page"] { box-shadow: inset 0 -3px 0 var(--accent); }
```

- [ ] **Step 3: Mode bar.** Replace the `#mode-bar` rule (the first one, `order: 4`) with:

```css
#mode-bar { order: 4; display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-top: 1px solid var(--line); background: var(--panel); }
```

and in the `@media (min-width: 700px)` block leave its `#mode-bar` line as is.

- [ ] **Step 4: Check.** Reload. The header has a soft shadow, the current tab shows a 3 px accent bar, inactive tabs are muted grey and still readable, and the layout does not shift between 375 px and 1000 px wide.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "style: header shadow, quieter tabs, tinted mode bar"
```

---

### Task 3: Controls (buttons and fields)

**Files:**
- Modify: `styles.css` (the `button, input`, `button`, `button.main`, `button.plain`, `input[type=...]`, `label`, `input[type="search"]` rules)

- [ ] **Step 1: Buttons.** Replace the `button { ... }` rule (the one with `min-width: 44px`) and the `button.main` rule with:

```css
button { min-width: 44px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--panel); font-weight: 500; cursor: pointer; transition: background-color 0.12s, box-shadow 0.12s, transform 0.06s; }
button.main { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-weight: 650; box-shadow: var(--shadow-1); }
@media (hover: hover) { button:not(:disabled):hover { background-image: linear-gradient(rgba(127, 127, 127, 0.14), rgba(127, 127, 127, 0.14)); } }
button:not(:disabled):active { transform: translateY(1px); }
@media (prefers-reduced-motion: reduce) { button { transition: none; } button:not(:disabled):active { transform: none; } }
```

(The `button.plain`, `button.danger`, `button.row`, `button:disabled` and `[aria-pressed="true"]` rules that follow stay exactly as they are, including the tick.)

- [ ] **Step 2: Fields.** Replace the `input[type="text"], input[type="number"]` rule and the `input[type="search"]` rule (further down, under "The Map tab") with:

```css
input[type="text"], input[type="number"] { display: block; width: 100%; min-height: 44px; margin-top: 4px; padding: 8px 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--bg); }
input[type="search"] { flex: 1; min-width: 9em; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); background: var(--bg); }
input:focus-visible { border-color: var(--accent); }
```

- [ ] **Step 3: Labels and small text.** Replace `label { display: block; font-weight: 600; }` with:

```css
label { display: block; font-weight: 600; font-size: 16px; }
```

- [ ] **Step 4: Check.** Reload. Buttons have a clear border and rounded corners, the main button is filled with a soft shadow, hovering greys any button slightly (desktop), a pressed toggle still shows its tick, a disabled button is faded, and Tab-key focus shows the 3 px ring on a button and on a field.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "style: rounder buttons and fields, hover and press states"
```

---

### Task 4: Surfaces (sheets, toast, cards, lists)

**Files:**
- Modify: `styles.css` (`dialog.sheet*`, `.toast`, `.checklist`, `.preview`, `.mini`, `.bar`, `.details`, `button.space.todo`, `#top-banner.calm`)

- [ ] **Step 1: Sheets.** Replace the `dialog.sheet { ... }` and `dialog.sheet::backdrop` rules, and the `@media (min-width: 700px) { dialog.sheet ... }` line, with:

```css
dialog.sheet { width: 100%; max-width: 640px; max-height: 90vh; margin: auto auto 0; padding: 20px 16px 16px; border: 0; border-radius: 20px 20px 0 0; background: var(--bg); color: var(--fg); box-shadow: var(--shadow-2); }
dialog.sheet[open] { animation: sheet-in 0.2s ease-out; }
dialog.sheet::backdrop { background: rgba(10, 12, 18, 0.5); backdrop-filter: blur(2px); }
@keyframes sheet-in { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { dialog.sheet[open] { animation: none; } }
@media (min-width: 700px) { dialog.sheet { margin: auto; border-radius: 20px; } }
```

Leave `dialog.sheet > *`, `dialog.sheet > * + *` and `dialog.sheet h2` as they are. Change `dialog.sheet h2 { font-size: 20px; }` to `dialog.sheet h2 { font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }`.

- [ ] **Step 2: Toast.** Replace the `.toast` rule with:

```css
.toast { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 16px; min-height: 60px; border-radius: 14px; background: var(--fg); color: var(--bg); box-shadow: var(--shadow-2); pointer-events: auto; }
```

- [ ] **Step 3: Cards and bars.** Make these replacements:

```css
.checklist { margin: 0; padding: 12px 12px 12px 40px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
.preview { display: block; max-width: 100%; max-height: 45vh; margin: 0 auto; border: 1px solid var(--line); border-radius: var(--radius-sm); }
.mini { flex: none; padding: 4px 8px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); font: 14px/1.2 ui-monospace, Consolas, monospace; white-space: pre; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
```

- [ ] **Step 4: Borders that carry meaning stay strong.** In `button.space.todo` change `border: 2px dotted var(--line);` to `border: 2px dotted var(--line-strong);`. In `#top-banner.calm button` change `border-color: var(--line);` to `border-color: var(--line-strong);`. Also in the `button.space` rule change `border-radius: 6px` to `border-radius: var(--radius-sm)`.

- [ ] **Step 5: Check.** Open a sheet (the Add tab's type picker works): it slides up with a soft shadow and blurred backdrop; on a 1000 px window it is a centred rounded box; a question sheet (e.g. delete a floor) looks the same. Trigger a toast (place a device) and confirm the shadow and Undo button. Open the Breakers tab: spaces still show solid, double, dotted (to do) and dashed (empty) borders.

- [ ] **Step 6: Commit**

```bash
git add styles.css
git commit -m "style: sheets, toast and cards with depth"
```

---

### Task 5: Check in the browser and write it up

**Files:**
- Create: `docs/superpowers/review/ui-look.md`

- [ ] **Step 1: Run the tests.**

Run: `node --test`
Expected: 0 failures (161 tests, the same as Plan 4b; no JS changed).

- [ ] **Step 2: Walk every screen** at `http://127.0.0.1:8765`, in four settings: phone (`resize_window` preset `mobile`) and desktop, each in light and dark (`colorScheme`). Screens: first-launch, Plan (with a floor and rooms), Add, Map (with a device selected and its details open), Switches, Breakers (a panel with at least one empty, one to-do and one double space), Test, Print preview, and one sheet and one toast. Take a screenshot of each in light phone and dark desktop. For each, confirm nothing overflows sideways, no text is cut off, and nothing looks unstyled.

- [ ] **Step 3: Measure contrast.** In `javascript_tool`, run this in both colour schemes and confirm every ratio printed is at least 4.5 for text and 3 for the border rows:

```js
const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)).toFixed(2); };
const root = getComputedStyle(document.documentElement);
const v = (n) => { const d = document.createElement("i"); d.style.color = root.getPropertyValue(n); document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
({
  "text on page": ratio(v("--fg"), v("--bg")),
  "muted on page": ratio(v("--muted"), v("--bg")),
  "muted on panel": ratio(v("--muted"), v("--panel")),
  "main button text": ratio(v("--accent-fg"), v("--accent")),
  "danger on page": ratio(v("--danger"), v("--bg")),
  "field border (3)": ratio(v("--line-strong"), v("--bg")),
  "accent bar on page (3)": ratio(v("--accent"), v("--bg")),
});
```

If a ratio fails, adjust that one token in Task 1's block, reload, and re-run.

- [ ] **Step 4: Print is unchanged.** On the Print screen compare `getComputedStyle(document.querySelector(".paper")).backgroundColor` and `.color` in dark mode: still white and black.

- [ ] **Step 5: Console.** `read_console_messages` with errors only: none.

- [ ] **Step 6: Write the notes.** Create `docs/superpowers/review/ui-look.md` with: the contrast numbers from Step 3, any screen that still looks dated (candidates for the Web Awesome plan, such as the Breakers panel and the type picker), and anything that surprised you.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/review/ui-look.md
git commit -m "docs: notes on the new look"
```

If any check fails, fix it in `styles.css` and commit the fix with its own message.

---

## Done when

- `node --test` passes with 0 failures (161 tests).
- Every screen reads correctly in phone and desktop, light and dark, with the contrast numbers from Task 5 at or above target and no console errors.
- Five commits on `plan-ui-look` (tokens, shell, controls, surfaces, notes), ready to merge.

Then write the Web Awesome plan (vendor the library into the repo for offline use, then swap `button()` and `openSheet()` in `src/ui.js` and the 22 text inputs, using `docs/superpowers/review/ui-look.md` to pick the screens still worth changing). Plan 4c (Plates to rewrite) is still next on the feature line.
