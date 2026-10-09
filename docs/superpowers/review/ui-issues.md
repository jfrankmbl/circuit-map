# UI review issues (plan-ui-look)

Found while walking screens. Log here, do not fix during a review round; they are fixed in a batch afterwards, and each is marked whether it needs a change to a building plan (4d and later).

Format: `- [ ] #N screen: what is wrong. Seen: how to reproduce. Plan impact: none | plan name`

## Open

- [ ] #1 Breakers tab: the header block (Something has no power, panel line, Panel settings, Add panel, tested count, Test the next one, Print) fills the first phone screen before any breaker shows. Plan impact: Web Awesome plan.
- [ ] #8 Marker sheet: "More" is a bare bold word with no chevron, border or fill, so it does not look tappable. Seen: Map, List, tap a row, Edit. Plan impact: Web Awesome look plan (a details component would give it a marker).
- [ ] #14 PDF page choice (`src/view/pdfpage.js`): thumbnails sit in two fixed 126 px columns against the left edge, leaving the right third of the sheet empty (3 pages: a lone thumbnail on row two); the thumbnails are too small to tell floor plans apart and carry only "Page N"; a long PDF scrolls in a 50vh box inside the sheet. Seen: floor with no picture, choose a PDF with 3-4 pages, 375x812. Plan impact: Plan 4d (pdfpage.js and its `.pages` CSS).
- [ ] #15 Home Screen card (`src/view/welcome.js`, iPhone tab): `.card` only sets font-size, so the card is plain 20 px text with no panel or border, larger than the 18 px intro and not set apart as a notice; "Start here anyway" is inset 16 px from the text edge; the two equal main buttons below still outweigh it. Seen: iPhone Safari tab with no project (or the user agent set to iPhone), 375x812. Plan impact: Plan 4d (the card), with a style from the Web Awesome look plan.
- [ ] #16 Home Screen note (`src/app.js`): it says "First tap Send or back up" but offers only OK, with no button that opens the send sheet. Seen: iPhone Safari tab with a house. Plan impact: Plan 4d.
- [ ] #17 Merging plan-4d-pdf-home onto plan-ui-look conflicts in styles.css (`#top-banner.calm button` border: `--line-strong` here, `--line` there). plan-4d-pdf-home is based on main and lacks the look commits, so it needs a rebase on plan-ui-look. Seen: `git merge plan-4d-pdf-home` on plan-ui-look. Plan impact: Plan 4d (rebase, keep the `--line-strong` rule and add the `.pages` rules).

## Fixed

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
