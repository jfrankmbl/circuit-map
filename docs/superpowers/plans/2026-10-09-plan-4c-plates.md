# Circuit Map Plan 4c: Plates to Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A relabelled device's old label is still on its cover plate, so the app keeps asking until he says it is rewritten: a bar at the top of the Map tab, the same list in the "Move or back up" sheet, a Swap labels choice when another device already uses the old label, and the chip reading "12 not sent, 2 plates".

**Architecture:** Much of this already exists from Plan 2d (`m.platesToRewrite`, `confirmPlate`, `swapLabels`, the pencil mark, "(plate says KIT-05)", the Key entry, a bar and list on the Map tab). This plan fills the gaps from the spec: the row's reason and Swap labels (`plateRow` in `src/browse.js`, pure, tested), one shared list in `src/view/plates.js` used by the Map bar and the header sheet, the bar moved into the single top banner (after "not saving", before the backup nudge), and the chip's second figure (`chipText` in `src/sending.js`).

**Spec:** Labels that changed; Using it: One banner at the top at a time; The header chip.

**Conventions:** Work on branch `plan-4c-plates`. Tests: `node --test`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Decisions made here**

- The bar is a top banner shown on the Map tab only (the spec says "the Map tab shows a bar"). Remind me later hides it until the app is next opened (`app.platesLater`, not saved).
- The chip shows the plates figure only when changes are also unsent ("12 not sent, 2 plates"; on a phone "Send 12 ✎2"); with nothing unsent it is unchanged.
- Show on plan for a row with a second device rings and labels both (`also` on the Map's state).
- In the import question "2 relabelled" still opens a plain list ("KIT-05 is now KIT-06"): the real plates only exist after Bring them in, and then the bar and list take over.

## Tasks

1. **Row text and Swap** (`src/browse.js`, `tests/browse.test.js`): `plateRow` adds, when another device's label is this plate's old label, `otherId`, a longer `why` ("It says KIT-05, and another duplex outlet in the Kitchen already uses KIT-05.") and `swap` ("This one keeps KIT-05; the other duplex outlet becomes KIT-06").
2. **Chip** (`src/sending.js`, `tests/sending.test.js`): `chipText(count, plates = 0)`.
3. **Shared list** (new `src/view/plates.js`; `src/view/browse.js`, `src/view/movesheet.js`, `src/view/markers.js`): `platesContent`, `platesSheet`; Swap labels button and the line under it; Show on plan rings both; "No plates to rewrite" in the header sheet.
4. **Top banner** (`src/app.js`, `src/view/browse.js`): the bar moves into `#top-banner`.
5. **Browser checks**: relabel a device so a plate is out of date (`m.setRoom(p, id, otherRoom, true)`), see the bar on Map only, the chip, the list in both places, Swap, "I've rewritten all", Remind me later, no console errors.

## Done when

`node --test` passes, the checks pass, and the commits are on `plan-4c-plates`.

Then write Plan 4d (PDF pictures and the Home Screen card).
