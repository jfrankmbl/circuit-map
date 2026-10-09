# UI review issues (plan-ui-look)

Found while walking screens. Log here, do not fix during a review round; they are fixed in a batch afterwards, and each is marked whether it needs a change to a building plan (4d and later).

Format: `- [ ] #N screen: what is wrong. Seen: how to reproduce. Plan impact: none | plan name`

## Open

- [ ] #1 Breakers tab: the header block (Something has no power, panel line, Panel settings, Add panel, tested count, Test the next one, Print) fills the first phone screen before any breaker shows. Plan impact: Web Awesome plan.
- [ ] #8 Marker sheet: "More" is a bare bold word with no chevron, border or fill, so it does not look tappable. Seen: Map, List, tap a row, Edit. Plan impact: Web Awesome look plan (a details component would give it a marker).

## Fixed

- #14 PDF page choice is a grid with "Page N of M" and larger thumbnails. (plan-4d-pdf-home, 5258f53)
- #15 Home Screen card styled as a notice. (plan-4d-pdf-home, 5258f53)
- #16 Home Screen note has "Send or back up now". (plan-4d-pdf-home, 5258f53)
- #17 plan-4d-pdf-home rebased onto plan-ui-look. (plan-4d-pdf-home, 5258f53)
- #2 Switches tab lists the seeded `S` switch; it was the seed, not a bug. (ed922e1)
- #3 zoom controls in one row at the top of the plan. (ed922e1)
- #4 details card capped at 40% under the list, buttons first. (ed922e1)
- #5 details card overlays the foot of the plan; the screen no longer scrolls. (ed922e1)
- #6 `--line-strong` light #7d849a holds 3.27:1 on panel. (ed922e1)
- #7 sheet bottom padding adds the safe-area inset. (ed922e1)
- #9 sheets focus themselves, no ring after a tap. (ed922e1)
- #10 toast at the top, 8 s. (ed922e1)
- #11 search on its own row, scrollbars hidden. (ed922e1)
- #12 Undo bar hidden on the print page, "Read it larger" at full size. (ed922e1)
- #13 kept at 12 px, exception noted in the spec. (ed922e1)
- Add tab, floor without a picture: content sat off the left edge (d4bc775).
- Test steps with nothing to do were 2.8:1 contrast (d4bc775).
