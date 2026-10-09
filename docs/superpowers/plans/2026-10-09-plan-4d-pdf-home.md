# Circuit Map Plan 4d: PDF Pictures and the Home Screen Card

**Goal:** A PDF can be a floor's picture (pages shown as thumbnails to tap), and the app tells an iPhone Safari tab to be added to the Home Screen before anything is entered, with a manifest and icon so the Home Screen app opens full screen.

**What was built (branch `plan-4d-pdf-home`)**

- `vendor/pdf.js/`: pdfjs-dist 4.10.38 (Apache-2.0), downloaded from the npm registry with the checksum checked (see its README.txt). Loaded only when a PDF is chosen.
- `src/picture.js` `pdfScale` (tested); `src/view/pdfpage.js` `pickPdfPage` reads the file, shows "Which page is the floor?" with thumbnails when there are several, and returns the page as a 3000 px image that goes into the usual "Use this picture?" step (`setup.js`). A locked or unreadable PDF gives a plain message.
- `src/homescreen.js` `inIphoneTab` (tested): the welcome screen shows the Home Screen card with "Start here anyway"; a Safari tab that already holds a house gets the one-time note (kept per device as setting `homeNote`).
- `manifest.webmanifest`, `icons/icon-180.png` (drawn by `tools/make-icon.mjs`), and the head links in `index.html`.

**Left for Plan 5:** the service worker (offline), "Works without a signal", the version line.

**Checks done:** a 3-page PDF shows three thumbnails and page 2 comes back as a 2318 x 3000 image; the card shows with an iPhone user agent and Start here anyway hides it; manifest and icon are served; no console errors. Not checked on a real iPhone: Add to Home Screen itself and the one-time note.

**After the UI review (issues 14 to 17)**

- Rebased onto `plan-ui-look`; the one conflict was `#top-banner.calm button` in `styles.css` (kept `--line-strong`, kept the `.pages` rules).
- 14: the page choice is a grid that fills the width (two columns on a phone), thumbnails drawn at 320 px, "Page N of M", and the sheet scrolls instead of a box inside it.
- 15: the Home Screen card is a notice (`.home-card`: panel, border, accent edge, 18 px text); "Start here anyway" lines up with the text.
- 16: the one-time Home Screen note offers "Send or back up now", which opens the send sheet, next to OK.

Checked at 375x812, dark: a 4-page PDF in the page choice, the card with an iPhone user agent. The note's new button was read in code only. `node --test` 165 pass.

Then write Plan 5.
