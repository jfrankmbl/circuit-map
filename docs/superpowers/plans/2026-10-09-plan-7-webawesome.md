# Circuit Map Plan 7: Web Awesome Where It Earns Its Place

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the parts of Web Awesome the app can use offline, and use them for the three Batch C items that plain CSS could not fix: a "More" control that looks tappable (#8), a Breakers header that no longer fills the first phone screen (#1), and one shared notice style (#15).

**Architecture:** `tools/vendor-webawesome.mjs` copies a named list of components, with every file they import and the default theme, from an unpacked `@awesome.me/webawesome` package into `vendor/webawesome/`. `src/wa.js` imports those components (registering `wa-details` and `wa-callout`). `styles.css` maps Web Awesome's `--wa-*` tokens onto the app's own (`--bg`, `--fg`, `--panel`, `--line`, `--accent`, `--radius`) so dark mode, contrast and the look stay as they are. `src/ui.js` gets one `details()` helper. The offline file list picks the new files up through `node tools/stamp.mjs`.

**Tech Stack:** `@awesome.me/webawesome` 3.14.0 (MIT), plain ES modules, no build step.

**Conventions:** Branch `plan-7-webawesome` from `main`. Tests: `node --test`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Merge only when Josh says.

**Decisions made here**

- **Not swapping `button()`, `openSheet()` or the text inputs.** Counting again: 233 `button(` calls and about 40 CSS rules (`button.main`, `button.row`, `#tabs button`, `[aria-pressed]`, the `.space` breakers) are written against native buttons, and the native `<dialog>` already gives focus trapping and Esc. A Web Awesome button would be a restyle of what the stylesheet already does, at the cost of re-doing every one of those rules and the tests of the touch targets. The earlier plan note said to swap them; this plan leaves them out and says why.
- **Only `wa-details` and `wa-callout`**, the two things the app had no good native version of. Together with their imports and the default theme: 47 files, 231 KB.
- **Our tokens win.** Web Awesome's theme is loaded (it is in `@layer wa-theme`), and `styles.css`, which is unlayered, re-points its tokens at ours. Nothing in the theme is allowed to set `color-scheme` or the page colour.
- **Fails soft.** If the components do not load, `<wa-details>` is an unknown element and its content still shows, so the page works without them.
- **#11 (Map toolbar chips and search) is left:** it was fixed in `ed922e1` by CSS, and no component adds to it.
- **Not done here:** Web Awesome buttons, dialog, inputs and tabs (above); the icon library.

## Tasks

1. **Vendor tool** (`tools/vendor-webawesome.mjs`, `vendor/webawesome/`): `node tools/vendor-webawesome.mjs <unpacked package dir>` follows the relative imports of `components/details/details.js` and `components/callout/callout.js` in `dist-cdn`, copies those files and `styles/themes/default.css`, `styles/layers.css` and `styles/color/palettes/default.css` to `vendor/webawesome/` keeping their paths, and writes `vendor/webawesome/README.txt` (version, source, licence MIT). `LICENSE.md` is copied too (the cache list skips LICENSE files).
2. **Load them** (`src/wa.js`, `index.html`, `src/app.js`): `index.html` links `vendor/webawesome/styles/themes/default.css`; `src/wa.js` imports the two component files; `src/app.js` imports `./wa.js` first. `styles.css` gets the token map in a short block after `:root`.
3. **The helper** (`src/ui.js`): `details(summary, opts, ...kids)` returns a `wa-details` with `summary`, `open` from `opts.open`; children as given.
4. **#8 More** (`src/view/markersheet.js`): the `h("details" ...)` with `summary "More"` becomes `details("More", { open: !!opts.more }, ...)`; the same content inside.
5. **#1 Breakers header** (`src/view/panel.js`): the Panel settings and Add panel buttons and the print line move into one closed `details` named "Panel settings and printing", under the panel name line, leaving on the first screen: Something has no power, the pick row, the panel line, the tested count with Test the next one, the search and the picture. Search results and the pairing/pick modes are untouched.
6. **#15 Notice** (`src/view/welcome.js`, `styles.css`): `.home-card` becomes a `wa-callout` (variant brand), the CSS for `.home-card` is removed. Its text and buttons stay.
7. **Stamp, test, notes:** `node tools/stamp.mjs`, `node --test` (the drift test), README gets "Updating Web Awesome" (one line: re-run the vendor tool with the new package). `docs/superpowers/review/ui-issues.md`: move #1, #8, #15 to Fixed.
8. **Browser checks** (pane at 375x812, light and dark, `http://127.0.0.1:8765`):
   - No console errors and no request to any other origin (network list).
   - Marker sheet: More has a marker, opens and closes, a tap on Not working keeps it open (`opts.more`).
   - Breakers: first screen shows a breaker's row without scrolling; the closed control opens and its three buttons work; pairing and picking still disable what they did.
   - Welcome with the Home Screen card: the notice reads the same in both schemes; "Start here anyway" works.
   - Contrast of the summary text and the notice in both schemes is 4.5:1 or better.

## Done when

`node --test` passes, the checks pass, and the commits are on `plan-7-webawesome`.

Then deploy it: `node tools/stamp.mjs --bump`, commit, push `main` (see the README, "Publishing"), and check the update banner on the live address, which is the first real use of it.

## Built

Tasks 1 to 7 on `plan-7-webawesome`; `node --test` 172 pass. Vendored 47 files (231 KB) of 3.14.0; cache list is now 105 files. Checked in the browser pane at 375x812, dark and light: no failed request, no other origin; the Breakers header closed puts the first breaker at 547 px of 812 (609 in light) where it was below the fold; the closed control opens and closes; More opens, and "Not working right now" keeps it open through the re-render; contrast 17.92 (summary text), 3.72 (control border), 15.71 (notice text), 6.23 (notice edge) in light, 15.58 in dark.

**Found while building:** the vendor tool first missed `palettes/base.css` (a second-level CSS import) and the browser 404 showed it; the tool now follows every `@import`. The theme's own `color-scheme` and text colour are overridden in `styles.css`, otherwise it would have forced light.

**Not checked:** the notice in place on an iPhone (it only shows in an iPhone tab, so it was checked by inserting a `wa-callout` into the page, not through the welcome screen); pairing and picking modes on the Breakers tab (the code there is unchanged); the offline cache with these files (needs the live address after the next `--bump`).
