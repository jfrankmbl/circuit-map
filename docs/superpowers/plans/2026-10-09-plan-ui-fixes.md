# UI Review Fixes: Continuation Plan

Source: `docs/superpowers/review/ui-issues.md` (17 issues, rounds 59 and 60). Nothing here changes behaviour except #10, #12 and #16. Merge only when Josh says.

## Order of work

1. **Batch A, on `plan-ui-look`** (CSS and small view edits). Do first; 4d needs it.
2. **Batch B, on `plan-4d-pdf-home`**: rebase onto `plan-ui-look` (issue 17), then fix 14, 15, 16.
3. **Batch C**: not built now. The inputs to the later Web Awesome look plan (1, 6, 8, 11 and the card style from 15).

Each batch: fix, `node --test` passes, check each issue in the browser pane at 375x812 in dark and light, move the issue to Fixed in `ui-issues.md` with the commit, one commit per issue group.

## Batch A: `plan-ui-look`

| Issues | Fix |
| --- | --- |
| 2 | Reopen the Switches tab with a seeded `S` switch; if it lists it, close; otherwise it is a real bug, fix it with a test. |
| 3 | Zoom controls: one row, equal 44 px buttons, never under the Undo bar. |
| 4, 5 | Map tab with a device selected: the plan keeps at least half the height (Screen space rule); the details card scrolls inside a capped height or collapses to a compact bar; the list keeps room for several rows. Floor chips and filters do not scroll away. |
| 6 | Make `--line-strong` hold 3:1 on `--panel` in light mode; re-measure on both `--bg` and `--panel`; update the table in `ui-look.md`. |
| 7 | `dialog.sheet` bottom padding `calc(16px + env(safe-area-inset-bottom))`. |
| 9 | Use `:focus-visible` so a tap does not show a ring; do not focus the type list's scroll box. |
| 10 | Toast with Undo must not cover the details card buttons: shorter time (about 8 s) and sits above the card, or drop it where the Undo bar already offers the same action. |
| 11 | Search box wide enough for its placeholder (own row); toolbar rows wrap or hide scrollbars so Key and Download are reachable. |
| 12 | Print preview: hide the Undo bar while it is open; leave the 10 pt rule alone; make the sheet zoomable or open full width. |
| 13 | Decide: keep 12 px toggle badges on the plan, and record the exception in the spec's text-size rule. |

## Batch B: `plan-4d-pdf-home`

1. `git rebase plan-ui-look`. Conflict in `styles.css` (`#top-banner.calm button`): keep `--line-strong`, keep the `.pages` rules.
2. 14: PDF page choice: a responsive grid (2 columns that fill the width, 3 on wide), larger thumbnails, "Page N of M", scroll the grid not a 50vh box inside the sheet.
3. 15: Home Screen card styled as a notice (panel, border, 18 px text matching the intro), "Start here anyway" aligned with the text, and the two main buttons no longer outweigh it.
4. 16: Home Screen note gets a "Send or back up now" button that opens the send sheet next to OK.
5. Plan 4d has no plan file yet: write `docs/superpowers/plans/2026-10-09-plan-4d-pdf-home.md` from the commit `aa9b777`, run its browser checks, and end it with the line "Then write Plan 5".

## Batch C: inputs for the Web Awesome look plan

- 1: Breakers header block (collapse into a menu or one summary row).
- 6: tokens that hold 3:1 on `--panel`.
- 8: "More" in the marker sheet as a real details control.
- 11: the Map toolbar chips and search.
- 15: a shared card/notice style.
Add these to that plan's goals when it is written.

## Next session prompts

Batch A:
> On branch `plan-ui-look` in C:\Users\Josh\Documents\circuit-map, do Batch A of docs/superpowers/plans/2026-10-09-plan-ui-fixes.md. Read ui-issues.md for the details. Verify each in the browser pane at 375x812, dark and light. Commit per group, move fixed issues to Fixed. Do not merge.

Batch B (after A):
> On branch `plan-4d-pdf-home`, do Batch B of docs/superpowers/plans/2026-10-09-plan-ui-fixes.md.
