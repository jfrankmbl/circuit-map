# Circuit Map Plan 5: Offline Use and Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After one visit with a signal the app opens and works with none: a service worker saves every file, the header sheet says "Works without a signal", a new version is fetched in the background and offered as a banner (never applied while he is working), and the header sheet shows the version ("Circuit Map version 12, 9 Oct 2026").

**Architecture:** A plain `sw.js` at the root (cache-first, one cache per version, no network request for anything in the list). The version lives in one file, `src/version.js` (`VERSION`, `RELEASED`), and the file list and version in `sw.js` are written by `tools/stamp.mjs`; a test fails when either has drifted, so a new file cannot be forgotten. `src/offline.js` is the pure part: what the sheet says and which banner applies (tested). `src/view/offline.js` registers the worker and reports to the app. Nothing here touches project data.

**Tech Stack:** As before: plain ES modules, `node --test`, no dependencies, no build step.

**Spec:** Offline; Updates; One banner at the top at a time (order: OFF bar, not saving, plates, backup nudge, new version); Where it lives (`sw.js`).

**Conventions:** Work on branch `plan-5-offline` from `main`. Tests: `node --test`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The dev server (`tools/serve.mjs`) sends `no-store` and runs on localhost: the worker is only registered off localhost, or with `?sw=1` for the checks below, so everyday work is not served from a cache.

**Decisions made here**

- **Cache-first, whole-app.** The install step adds every file in `FILES` (index, styles, manifest, icon, every `src/**/*.js`, `vendor/pdf.js/*`) to the cache `circuit-map-v<VERSION>`. A fetch is answered from that cache; a miss is not fetched from the network (the app makes no other request), it just fails as it would offline.
- **No `skipWaiting`, no `clients.claim`.** A new worker installs, then waits; it takes over when every window of the app is closed. That is the "never reloads while he is working" rule without any code of ours to guard it.
- **Old caches** are deleted when the new worker activates.
- **"Ready" means the cache holds the current version's files,** found with `caches.has("circuit-map-v" + VERSION)` after `navigator.serviceWorker.ready`, not "a controller exists" (the first visit has no controller until the next load).
- **The first-time toast** "Ready to use without a signal." shows once per device (setting `offlineToast`), the first time the app finds the cache complete.
- **The update banner** is the last in the top banner order. It shows when a worker is waiting and a worker was already in control (so it is not shown on the very first install). Later hides it until the app is next opened (`app.updateLater`, not saved). Under it, in small type: "On iPhone, swipe up from the bottom edge and pause, then swipe Circuit Map up and away."
- **Version text** is `Circuit Map version 12, 9 Oct 2026`; `VERSION` starts at 1 and `stamp` is run once for each change that is shipped. The date is `RELEASED` (an ISO date written by `stamp`, formatted in `offline.js`).
- **Not done here:** the Web Awesome library is vendored in its own plan; adding it only means running `node tools/stamp.mjs` so its files join the list.

## Tasks

1. **Version and file list** (`src/version.js`, `tools/stamp.mjs`, `sw.js`, `tests/sw.test.js`): `stamp` lists the files that must be cached (everything tracked under `src/`, `vendor/`, `icons/`, plus `index.html`, `styles.css`, `manifest.webmanifest`), sorts them, and rewrites the `FILES` array and `VERSION` in `sw.js` and `RELEASED` in `src/version.js`. Test: `sw.js` `FILES` equals the files on disk, and its `VERSION` equals `src/version.js` `VERSION`.
2. **The worker** (`sw.js`): install (`caches.open` then `addAll`), activate (delete other `circuit-map-v*` caches), fetch (`caches.match`, same-origin GET only). Test with a fake `caches` and `self` that install fills the cache, activate removes an older one, and fetch answers from the cache.
3. **What the sheet and banner say** (`src/offline.js`, `tests/offline.test.js`, pure): `offlineText(state)` returns "Works without a signal" for `ready`, "Not saved for offline use yet. Open the app once with a signal." for `pending`, and "" for `unsupported` (a browser with no service worker says nothing rather than something false); `versionText(version, released)` returns "Circuit Map version 12, 9 Oct 2026"; `updateBanner(state)` is `true` only for `waiting` with a controller and not `later`.
4. **Register and report** (`src/view/offline.js`, `src/app.js`): register `sw.js` unless the host is localhost and there is no `?sw=1`; set `app.offline` (`"unsupported" | "pending" | "ready"`) and `app.updateWaiting`; show the one-time toast; re-render on change. Registration errors are swallowed and leave `pending`.
5. **Header sheet** (`src/view/movesheet.js`): under the send status, a small line with `offlineText` and one with `versionText`.
6. **Update banner** (`src/app.js` `render`): last in the top banner chain, calm style, with "A new version is ready. Close the app and open it again.", Later, and the small how-to line.
7. **README and spec touch-up:** README gets "Publishing" (run `node tools/stamp.mjs`, commit, push; GitHub Pages serves the repo root). The spec's `sw.js` line stays.
8. **Browser checks** (pane at 375x812, dark and light; start the server and open `http://localhost:8765/?sw=1`):
   - First load: Application state shows the worker installed and the cache `circuit-map-v1` holds every file in `FILES`; the toast shows once; the sheet says "Works without a signal" and the version line.
   - Stop the dev server, reload: the app opens with the same house, no error, no spinner. Restart the server.
   - Change `VERSION` to 2 with `stamp`, reload: the banner appears only after the new worker has installed; the page did not reload; Later hides it; closing every tab and reopening runs version 2 and removes the v1 cache.
   - No console errors; `node --test` passes.
   - Cannot be checked here, say so in the log: the Home Screen app's own cache, and the swipe-away steps on a real iPhone.

## Done when

`node --test` passes (including the drift test), the checks pass, and the commits are on `plan-5-offline`.

Then the Web Awesome look plan (see `2026-10-09-plan-ui-look.md` and `docs/superpowers/review/ui-issues.md`, Batch C), or deployment to GitHub Pages if Josh asks for it first.
