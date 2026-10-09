# Circuit Map on the computer: a desktop workspace with a drawn floor plan

Date: 2026-10-09. Status: design, awaiting Josh's review. It replaces the screens of
`2026-10-06-circuit-map-app-design.md`; that document's data model, catalog and wording rules still hold except where
this one says otherwise.

## Why

The phone version works but is not pleasant: the screen is too small for a floor plan, edits take too many steps
(sheets, modes, tabs) and it looks plain. Version 1 becomes a computer-only app with a finished look and direct
manipulation, and gains a floor plan he can draw. A phone companion is a possible version 2, so the file format stays
ready for it.

## Decisions made with Josh (2026-10-09)

| Question | Decision |
|---|---|
| Devices | Computer only (his dad's Mac; also Windows). No phone layout. |
| Walk-around jobs | On paper: the app prints sheets, he marks them up, then types the results in at the desk. |
| Delivery | The same GitHub Pages address. No container, no packaged app. |
| Tech | React, Vite and TypeScript for the views; the tested logic modules carry over unchanged. |
| Layout | Steps across the top in job order; the plan fills the window; a side panel only when needed. |
| Floor plan | A picture, a drawing, or a drawing traced over a picture. |
| Drawing precision | Sketch with snapping: 15 degree angle steps, corners, wall lines, grid. Lengths can be typed, never required. |
| Rooms | Click inside enclosed walls and name it. Hand tracing stays for picture-only floors and open areas. |
| Doors, windows, openings | Standard symbols on a wall; drag along, resize, flip a door's swing. |
| Dropped from the screens | Two-device merge, the offline service worker, the live breaker-test walk. |
| Version 2 | May add working steps on a phone. Records keep ids, changed-times and deletion markers so merging still works. |

## Layout

One window, three areas.

- **Top bar.** House name (click to rename); the five steps as a row, each ticked when it has something in it:
  **Floor plan, Devices, Switches, Breakers, Print**; then Search, Undo, Redo and a File menu (Save file, Open file,
  Key, About with the version). Any step can be opened at any time; the order is a guide, not a lock.
- **Plan.** Fills everything under the bar. Floating on it: the floor chooser (bottom left), zoom out / percent / zoom
  in / Fit (bottom right), and one hint line (top centre) that says what a click will do now, for example "Adding
  duplex outlets: click the plan. Esc to stop." With nothing armed the hint is hidden.
- **Tool rail.** A thin column of icon buttons at the left edge of the plan, different for each step. Each has a
  tooltip with its name and shortcut key. The first tool is always Select.
- **Side panel.** On the right, about 320 px. It shows the details of what is selected and is closed when nothing is.
  The Breakers step is the exception: the breaker panel picture stays there, since that job is matching it to the plan.

A window narrower than 1000 px shows "Circuit Map needs a wider window" over a dimmed app; there is no phone layout.

### Working on the plan (every step)

- Wheel or trackpad pinch zooms about the pointer; dragging empty plan, or holding Space and dragging, pans.
- Click selects; Shift-click adds to the selection; dragging from empty plan with Select draws a box selection.
- Dragging a selected thing moves it. A drag shorter than 4 px is a click.
- Delete or Backspace removes the selection. Esc disarms the tool, then clears the selection.
- Ctrl/Cmd-Z undoes, Ctrl/Cmd-Shift-Z redoes; the Undo button's tooltip names the change ("Undo: placed KIT-03").
- Right-click opens a short menu for the thing under the pointer (Edit, Duplicate, Move to another floor, Delete).
- Hovering shows a tooltip: label, type, room.
- Every edit saves at once. There is no Save button for the project; Save file is for a copy.
- Deletion is undone, not confirmed. Deleting a floor, a panel or a room with devices still asks first, as in the
  first design.
- Colour and shape are never the only signal; contrast 4.5 to 1; light and dark follow the computer; the picture is
  never inverted.

## The steps

### 1. Floor plan

Tools: Select, Wall, Door, Window, Opening, Name a room, Trace a room, Set scale.

The side panel with nothing selected shows the floors: add (Basement, Main floor, Upstairs, Attic or a typed name),
rename, reorder by dragging, delete; and for the floor shown, its picture (Choose a picture, Replace, Rotate, a Show
picture switch and a Fade slider) and its scale.

- **Start of a floor.** A new floor asks one question: "Start from a picture or a blank page?" Either can be added
  later. A blank page has a known scale from the start (see Data), so lengths show at once.
- **Picture.** A photo or a PDF page, as today (page thumbnails for a PDF, rotation, downscaled to 3000 px). Replacing
  a picture on a floor that has content keeps the two-spot line-up step from the first design.
- **Wall.** Click a start, click each next corner; the wall chain ends on double-click, Enter, Esc, or a click on the
  chain's first corner. While drawing, the next point snaps, in this order of strength: an existing corner; a point on
  an existing wall; a direction that is a multiple of 15 degrees from horizontal, or from the previous wall; the grid.
  Thin guide lines show which snap is in force. Holding Alt turns snapping off. The length is shown beside the wall
  being drawn when the floor has a scale; typing a number (feet, or feet and inches as `12 6`) and Enter sets it.
- **Editing walls.** Dragging a corner moves every wall end that meets there, with the same snapping. Dragging a wall
  moves it and stretches its neighbours. Selecting a wall shows its length in the side panel as an editable field (with
  a scale) and a Delete button. A wall ending on the middle of another wall makes a T; nothing has to be split by hand.
- **Door, Window, Opening.** With the tool armed, a preview follows the pointer along the nearest wall; a click
  places it. It can then be dragged along its wall and resized by either end; it cannot leave its wall or overlap
  another. A door is drawn as a gap with a leaf and a swing arc; clicking a selected door's arc cycles its four swings
  (hinge at either end, opening to either side). A window is a double line in the wall. An opening is a plain gap.
  The side panel shows width (presets 30, 32, 36 in for a door; 24, 36, 48, 60, 72 in for a window; any number) when
  the floor has a scale, otherwise only the drag handles.
- **Name a room.** Click inside a space closed by walls; a name field opens at that spot with the label code
  suggested beside it (`Kitchen` gives `KIT`). Doors, windows and openings count as closed wall for this purpose. The
  room's outline is taken from the walls and follows them when they move. If the click is not inside a closed space the
  hint says "The walls don't close here. Finish the walls, or use Trace a room."
- **Trace a room.** The first design's tracing (click each corner, finish on the first corner or Enter), with corners
  snapping to wall corners. For picture-only floors and for parts of an open space (a kitchen and dining area with no
  wall between).
- **A room that comes apart.** If walls are moved or deleted so a named room is no longer closed, the room keeps its
  last outline, its name on the plan gains a warning mark, and the side panel lists it under "Rooms to check" with
  "Kitchen's walls no longer close." Closing the walls again clears it.
- **Rooms list.** Under the floors in the side panel: each room's name, code, "N devices". Selecting a room allows
  rename, a code change while it has no devices, and delete (Keep the devices / Delete the devices too, as before).
- **Set scale.** Click two points and type the real distance. Only needed for a picture-only or traced floor.

### 2. Devices

Tools: Select, then one button per group (Outlets, Switches, Lights, Other) that opens a flyout of that group's types
with their hints, and Something else. The last four types used sit under them on the rail. Keys 1 to 4 arm the last
four.

- An armed type places on every click until Esc; the hint names it and the room under the pointer. The new marker's
  label is shown beside it and in the hint ("Placed KIT-03").
- The room comes from the outline clicked in. Outside every outline, a small menu at the pointer asks which room (with
  No room and New room); the answer holds for the rest of that run.
- Switch types show "Switches on this plate: 1 2 3 4" in the hint line. 240 V, hard-wired and Something else ask for
  the name in a small popover at the first click, then keep it.
- Placing a Breaker panel or Subpanel asks which panel in the same popover.
- **Side panel, one device selected:** label (large), Type, Room, Breaker (a dropdown of breakers by panel, "Not
  known" first; a pick here is a guess), Number of switches, Height, Behind a GFCI outlet, Not working, Note, Delete.
  All fields are visible; there is no More. Changing room, type or switch count asks the same questions as the first
  design when a label, links or a breaker would be affected.
- **Several selected:** the count, and Room, Breaker, Height and Delete applied to all.
- Search in the top bar finds devices by label, room, type or note in any step and jumps to the one picked.

### 3. Switches

Tools: Select only. The side panel lists every switch (one row per switch on a plate) by floor and room with what it
controls, and "12 of 15 switches set" at the top with a Still to do filter.

- Click a switch on the plan or in the list (a plate with several shows 1 2 3 4 at the pointer to choose from). Then
  each click on a light or outlet links it, and a click on a linked one unlinks it. Linked loads show a ring, a tick
  and a line from the switch.
- A duplex, GFCI or exterior outlet asks Whole / Top / Bottom at the pointer.
- The floor chooser works while a switch is picked, so a light on two floors' switches is two passes.
- Selecting a load with no switch picked shows "Switched by" in the side panel with Add a switch and Remove.

### 4. Breakers

The side panel is wider here (about 420 px) and always open: a panel chooser when there is more than one, "17 of 20
spaces entered, 5 of 18 tested", a search box, the panel picture, and under it the selected breaker.

- **Describing a panel.** Add panel (name, make, main size, spaces, numbering A or B, fed-from for a subpanel) is a
  form in the side panel, reached from a menu beside the panel chooser, with Panel settings and Delete panel.
- **Entering breakers.** Click a space and type its label in place; Tab or Enter moves to the next space not yet
  entered. Amps and type are small dropdowns on the row and start as the last used. The row's menu has Two spaces
  together (240 V), Two small breakers in one space, No breaker here.
- **Linked both ways.** Selecting a breaker rings its devices on the plan (all floors; the floor chooser shows a count
  per floor) and lists them under the picture. Selecting a device on the plan highlights its breaker.
- **Entering test results.** With a breaker selected, the button "Enter what lost power" arms the plan: the hint
  reads "Breaker 7: click everything that lost power. 2 so far. Done", and each click on a device marks it No power (a
  cross and the words) or unmarks it. A box selection marks a group. A room's name on the plan can be clicked to mark
  the whole room. Marking sets the device's breaker as tested. The questions from the first design are kept, as small
  dialogs: a GFCI outlet offers its protected devices; a device already found on another breaker asks Move it / Keep
  it / It has no power for another reason. Done records the breaker as tested and lists devices that were assigned to
  it but not marked, with Take it off / Keep it.
- **Something has no power.** A button above the panel picture; it asks for a room or device and shows the same
  answer card as the first design, in the side panel.
- A breaker that feeds a subpanel offers "Open the subpanel" in place of entering results.

### 5. Print

The side panel lists the sheets; the plan area shows the selected sheet exactly as it prints (black on white), with a
Print button that opens the system dialog.

- **Floor sheet**, one per floor: the plan (drawing, picture or both) with every marker and label, room names and a
  key. For walking the house and for the file.
- **Breaker check sheet:** one block per breaker (number, label, amps) with a tick box beside every device, grouped by
  floor and room, and blank lines for things found that are not on the plan. Steps printed at the top: turn every
  switch on, reset every GFCI, switch one breaker off, tick what is dead, switch it back on. Devices flagged Not
  working are listed apart.
- **Panel door card:** Short and Full, as in the first design.
- **Spreadsheet:** Devices or Breakers as CSV.

## Start and files

- **First visit.** A welcome page: **Start a new house** (asks the name, then opens Floor plan with the picture or
  blank page question) and **Open a project file** (also by dropping a file on the window). A third button, "Try the
  example house", loads a small built-in project so the app can be shown without entering anything.
- **Save file** downloads `<house name> <date time>.circuitmap`. **Open file** describes the file ("Dad's house, 2
  floors, 63 devices, last changed 12 Sep 2026") and replaces the project on this computer, offering Save a copy of
  this one first when there is one. It never merges.
- **Backup nudge.** After 7 days or 50 changes without a Save file, a line under the top bar says "Save a copy of
  your work" with Save file and Later.
- Storage full or blocked shows "Changes are not being saved" under the top bar; Save file still works.
- The project lives in the browser's IndexedDB as today, and the app asks for persistent storage.

## Data

Format version 2. Everything in version 1 stays, including `updated` on every record and the `deleted` list, though no
screen merges. A version 1 file or stored project opens and is upgraded in place.

```
project   adds  walls[], openings[]
floor     adds  drawn (true when it began as a blank page), showPicture, pictureFade
wall      { id, floorId, a: [x, y], b: [x, y], updated }
opening   { id, wallId, kind, at, width, hinge, side, updated }
room      adds  inside: [x, y] or null
```

- **Units.** As before, positions are in the floor's own units and `pxPerIn` gives the scale. For a floor with a
  picture the unit is a pixel of the picture. A blank-page floor has no picture and starts with `pxPerIn` 2 (one unit
  is half an inch), so it has a scale from the first wall. The grid is 6 in when there is a scale, otherwise 20 units.
- **Walls** are centre lines. Two wall ends at the same point are one corner; snapping makes them exactly equal.
  Thickness is drawing only (4.5 in at scale, a fixed stroke without one) and is not stored.
- **Openings.** `kind` is door, window or opening. `at` is the centre's position along the wall from `a` to `b`, 0 to
  1; `width` is in floor units; `hinge` is `a` or `b` and `side` is 1 or -1 (doors only). Deleting a wall deletes its
  openings.
- **Rooms.** `inside` is the point clicked for a room named from walls; null for a traced room. `outline` is still
  stored for every room and is what every other module reads, so finding a device's room is unchanged. When a floor's
  walls change, each room on it with an `inside` point has its outline worked out again.
- `plateLabel`, the merge rules and `merge.js` stay as they are, unused by any screen, for version 2.
- Kept on the computer and not in the file: the last Save file time, the last step and floor shown, the last types
  used.

## Code

```
index.html              Vite entry
src/core/               the logic modules, moved here unchanged: model, ids, merge, catalog, panel, testing, linking,
                        placing, outline, browse, printing, flow, history, csv, file, viewport, store (IndexedDB)
src/core/geometry/      new and pure: snap.js, walls.js, rooms.js, openings.js
src/core/migrate.js     version 1 to 2
src/state/              one Zustand store: project, step, floor, tool, selection, undo
src/ui/shell/           top bar, steps, side panel frame, hint line, welcome
src/ui/plan/            the SVG plan: viewport, picture, walls, openings, rooms, markers, selection, guides
src/ui/steps/           floorplan/, devices/, switches/, breakers/, print/  (each: its tools and its side panel)
tests/                  node --test, the core only
```

- **Boundaries.** `src/core` has no React and no DOM except `store.js`. Views change the project only through
  `model.js` (which gains wall, opening and room-inside functions), by way of store actions that also push undo.
  `src/ui/plan` draws and reports pointer events in floor units; each step decides what a click means.
- **`geometry/snap.js`:** given a pointer position, the previous corner and the floor's walls, returns the snapped
  point and which rule applied.
- **`geometry/walls.js`:** corners, walls meeting at a point, splitting at T joins and crossings into a plane graph,
  moving a corner or a wall.
- **`geometry/rooms.js`:** the smallest closed face of that graph containing a point, as an outline; null when there
  is none.
- **`geometry/openings.js`:** nearest wall to a point, clamping an opening to its wall and away from its neighbours,
  the four door swings.
- **Libraries:** React, Mantine (components, menus, notifications, dark mode), Zustand, pdf.js (already used). Icons
  from Tabler. Nothing is loaded from another origin at run time.
- **Removed at the switch-over:** `src/view/`, `src/app.js`, `src/ui.js`, `src/wa.js`, `src/homescreen.js`,
  `src/offline.js`, `src/sending.js`, `src/version.js`, `sw.js`, `manifest.webmanifest`, `styles.css`,
  `vendor/webawesome/`, `tools/stamp.mjs`, `tools/vendor-webawesome.mjs`, `tools/serve.mjs`, and their tests. A
  service worker already installed in his browser is unregistered by the new app on first load.
- **Build and deploy.** `npm.cmd run dev` for local work, `npm.cmd run build` to `dist/`. A GitHub Action builds on a
  push to `main` and publishes `dist/` to Pages; the Pages source changes from "branch" to "GitHub Actions" (Josh's
  go-ahead needed at that point). The version shown in About is the build date and short commit.

## Build order

Each plan is its own branch off `desktop` and merges back to `desktop` on Josh's say-so. `main`, and so the live
address, stays on the phone version until plan 6.

1. **Shell.** Vite, React, TypeScript, Mantine, the store, `src/core` moved with its tests passing, top bar and steps,
   the plan with pan and zoom, welcome, Floor plan step with floors, picture, scale and traced rooms.
2. **Devices.** Tools, placing, selection, the side panel, search.
3. **Switches.**
4. **Breakers.** Panels, entering breakers, linked highlighting, entering test results, Something has no power.
5. **Print and files.** The four sheets, Save file, Open file, backup nudge, example house.
6. **Switch over.** Remove the old app, add the Action, merge `desktop` to `main`, deploy, check the live address.
7. **Drawing walls.** Format version 2 and migration, `snap.js`, `walls.js`, the Wall tool, corner and wall editing,
   blank-page floors, picture show and fade.
8. **Openings and rooms from walls.** `openings.js`, `rooms.js`, Door, Window, Opening, Name a room, Rooms to check.

## Testing

- `node --test`: the existing core tests unchanged, plus `migrate` (a version 1 project round-trips), `snap` (each
  rule and their order), `walls` (T joins, crossings, moving a shared corner), `rooms` (a box, an L, a room inside a
  room, an unclosed space, a point outside), `openings` (clamping, overlap, swings).
- Each plan is checked in the browser pane at 1280 and 1920 wide, light and dark, with no console errors and no
  request to another origin.
- By Josh on Windows and his dad on the Mac: opening a version 1 file, printing each sheet, Save file and Open file.

## Not in this version

A phone layout or phone steps, merging two copies, offline use, measured drawing (wall thickness, dimension lines,
constraints), door and window types, stairs and furniture, a scaled printable plan, DXF, several houses, accounts,
live sync.
