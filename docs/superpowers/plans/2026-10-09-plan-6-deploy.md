# Circuit Map Plan 6: Deploy to GitHub Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app is live at `https://jfrankmbl.github.io/circuit-map/`, with no street address anywhere in the published files or history, and the service worker is checked on that real HTTPS origin.

**Architecture:** No code change. A public repo `jfrankmbl/circuit-map`, GitHub Pages serving the `main` branch root. Every path in the app is relative (`index.html`, `manifest.webmanifest` `start_url "./"`, `register("sw.js")`), so the `/circuit-map/` sub-path needs nothing.

**Tech Stack:** `git`, `gh`, Node 22 for `tools/stamp.mjs`.

**Decisions made here**

- **Public repo.** Free Pages needs it; the app holds no house data (spec, Hosting).
- **Address scrubbed before the first push.** One line of the design spec names the street. Nothing has been pushed, so local history is rewritten (all refs) so no commit contains it. A bundle of the old history is kept outside the repo until the push is checked.
- **Commit identity** is already the GitHub noreply address (76 of 76 commits).
- **Version:** stays 1 for the first publish (no cache exists anywhere yet).

## Tasks

1. **Back up and scrub.**
   - `git bundle create <scratchpad>/circuit-map-before-scrub.bundle --all`
   - Reword the spec line: "hard-wired to one house" in place of the street address.
   - `git filter-branch -f --tree-filter "sed -i 's/<street address>/one house/' docs/superpowers/specs/2026-10-06-circuit-map-app-design.md" -- --all` (the real address goes in place of the placeholder when run).
   - Check: `git grep -n <street number> $(git rev-list --all)` prints nothing; `node --test` still 172 pass; `rm -rf .git/refs/original && git reflog expire --expire=now --all && git gc --prune=now`.
2. **Create and push.** `gh repo create jfrankmbl/circuit-map --public --source . --remote origin --push` (pushes `main` only; the merged plan branches stay local).
3. **Turn on Pages.** `gh api -X POST repos/jfrankmbl/circuit-map/pages -f "source[branch]=main" -f "source[path]=/"`, then wait for `gh api repos/jfrankmbl/circuit-map/pages/builds/latest` to report `built`.
4. **Serve check.** `curl -sI` for `index.html`, `sw.js`, `manifest.webmanifest`, `icons/icon-180.png`, `vendor/pdf.js/pdf.worker.min.mjs`: all 200, and the `.mjs` and `.js` files are `text/javascript`.
5. **Branch `plan-6-deploy`**: add `.obsidian/` to `.gitignore`; README gets the live address; this plan's "Built" note. Commit, push the branch (not merged).
6. **Browser checks** (built-in browser pane at 375x812, address `https://jfrankmbl.github.io/circuit-map/`):
   - The app loads with no console errors; the sheet says "Works without a signal" after the first load and the version line reads "Circuit Map version 1, 9 Oct 2026".
   - Application state: the worker is registered with scope `/circuit-map/`; cache `circuit-map-v1` holds every file in `FILES`.
   - Reload with the network off (pane offline emulation, or `caches.match` from the console): the app opens.
   - Cannot be checked here, say so: install to the iPhone Home Screen, and the update banner on a second published version.

## Done when

The live address opens the working app, the scrub check prints nothing, `node --test` passes, and the branch is pushed.

Then the Web Awesome look plan (`2026-10-09-plan-ui-look.md`, `docs/superpowers/review/ui-issues.md` Batch C).

## Built

Live at https://jfrankmbl.github.io/circuit-map/ (repo `jfrankmbl/circuit-map`, public, Pages on `main`). The street address was scrubbed from all 76 commits before the first push. Serve check: every file 200, `.mjs` and `.js` as JavaScript. In the browser pane at 375x812: worker active with scope `/circuit-map/`, cache `circuit-map-v1` holds all 57 listed files, a controller after reload, no console errors. Not checked: the iPhone Home Screen install, and the update banner (needs a second published version).
