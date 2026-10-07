# Circuit Map: a take-anywhere outlet, switch and breaker mapping app

Date: 2026-10-06. Status: design, awaiting Josh's review.

## Purpose

Let someone who is not Josh (first user: his dad, on a Mac and an iPhone) record the electrical layout of their own
house: load a floor plan per floor, place standard US fixtures on it, record which switch controls what, describe the
breaker panel(s), and find out by testing which breaker feeds each device. Personal record only, not for permits.

It replaces, for other people, three tools that are hard-wired to one house: the marking tool
(`scripts/plan/marker_server.py`), the explorer (`scripts/plan/explorer_template.html`) and the breaker checksheet
(`scripts/plan/make_checksheet_app.py`). Josh's own DXF pipeline is unchanged and stays in this repo.

## Decisions already made

| Question | Decision |
|---|---|
| Floor plan input | A photo or a PDF page per floor, shown as an underlay. No drawing of walls in the app. |
| Where data lives | On the device only. No account, no server, no cloud database. |
| Moving between devices | One project file, exported and imported by hand (AirDrop or iCloud Drive). Import merges. |
| Hosting | A new public GitHub repo served by GitHub Pages. The app holds no house data. |
| Tech | Plain JavaScript ES modules, no build step, SVG for the plan. |

## Where it lives

A new repository, separate from this private one. Working name `circuit-map` (Josh to confirm name and local folder).
Creating the public GitHub repo and turning on Pages needs Josh's go-ahead at that point.

```
index.html
src/
  model.js        project data: create, edit, validate, migrate
  ids.js          room-code device labels (KIT-01), next free number, renumber on collision
  merge.js        combine two copies of a project
  store.js        IndexedDB save/load, image blobs
  file.js         export to / import from the project file
  catalog.js      fixture types, groups, default heights, glyphs
  view/plan.js    pan, zoom, pick, underlay, markers   (from explorer_template.html)
  view/setup.js   floors, underlay, scale, rooms
  view/place.js   palette, tap to place, drag, edit    (palette from marker_page)
  view/link.js    switch toggles to loads
  view/panel.js   panels and breakers, printable directory
  view/test.js    breaker sweep                         (from make_checksheet_app.py)
  view/browse.js  search, filters, device details, list
  csv.js          device list download
sw.js             offline cache
tests/            node --test, pure modules only
vendor/pdf.js     PDF page to image
```

`model`, `ids`, `merge`, `file` and `csv` are pure (no DOM) and unit-tested. Views read and change the project only
through `model.js`.

## Data model

One project per device. All positions are in pixels of that floor's image, so re-setting the scale later never moves
anything. The scale (`pxPerIn`) is optional and only used to show real distances.

```
project   { formatVersion, id, name, updated, floors[], rooms[], devices[], links[], panels[], breakers[], deleted[] }
floor     { id, name, order, imageId, pxPerIn, updated }
room      { id, floorId, code, name, outline[], updated }         code is 2-4 capitals, unique in the project
device    { id, label, roomId, floorId, type, customName, x, y, heightIn, toggles, note,
            breakerId, tested, created, updated }
link      { id, switchId, toggle, loadId, loadPart, updated }     loadPart: "", "top", "bottom"
panel     { id, name, make, mainAmps, slotCount, fedFromBreakerId, deviceId, updated }
breaker   { id, panelId, slots[], poles, amps, kind, label, note, updated }
deleted   { id, at }                                              tombstones, so merges do not resurrect things
```

- `id` is a random unique id and never shown. `label` (`KIT-07`) is what the user sees and writes on things.
- `room.outline` is a list of `[x, y]` corner points traced on the plan. It may be empty (for example an `Exterior` room).
- `toggles` is the number of toggles on a switch plate (1-4). Links name the toggle, so a 3-gang plate is one device.
- `breakerId` empty means unknown. `tested` false means the user typed a guess; true means a sweep set it.
- `breaker.slots` holds slot names as text: `["7"]` single-pole, `["13", "15"]` double-pole. A tandem is two breakers
  in one slot, `["7a"]` and `["7b"]`. `kind` is one of standard, GFCI, AFCI, dual.
- A subpanel is a panel whose `fedFromBreakerId` points at a breaker in another panel.
- Images are stored as blobs keyed by `imageId`, downscaled so the longest side is at most 3000 px.

## Screens

Six tabs. Floor switcher is always visible on any tab that shows the plan.

1. **Setup.** House name. Add, rename, reorder floors. Per floor: load a photo or choose a PDF page, with an optional
   rotate by 90 degrees applied as it loads; optionally set scale by tapping two points and typing the real distance
   (feet and inches). Rooms per floor:
   name and short code, suggested from the name (`Kitchen` gives `KIT`), then trace the room by tapping its corners
   on the plan (tap the first corner again to close). Corners can be dragged afterwards. The outline is drawn as a
   faint tint with the room name in the middle. A room can be left without an outline.
2. **Place.** Choose a fixture from the palette and tap the plan. The room is taken from the outline the tap falls
   in; a tap outside every outline (or where outlines overlap) asks which room, defaulting to the last one used.
   Label is assigned as the next number in that room. Moving a device into another room's outline offers to
   relabel it, and keeps the old label unless he says yes. Tap a marker to edit type, height, note, toggle count, or delete. Drag to move. Undo for the
   last action.
3. **Link.** Tap a switch (pick a toggle if it has several), then tap each load it controls; tap again to unlink.
   Outlets offer whole / top / bottom. Many-to-many, so 3-ways and 4-ways are just several switches on one load.
   Switch toggles with no links are listed as "not yet known".
4. **Panel.** Add panels. Per panel: name, make, main size, slot count. Add breakers by slot with amps, poles, kind
   and the handwritten label. Print view lays out a panel directory with the devices found on each breaker.
5. **Test.** Pick a panel and breaker. The screen says: flip it off, reset any GFCI, tap everything that is dead,
   flip it back on. Lists every outlet, light and hard-wired load, grouped by floor then room, rooms that already
   have devices on this breaker first. Tapping sets `breakerId` and `tested`. Progress shows tested / total.
   A device already tested on another breaker shows that breaker and asks before moving it.
6. **Browse.** The default view: pan, zoom, search by label, room, type or note; filter by group; tap a device for
   its circuit, height, note, what it controls and what switches it, with links that jump between floors. List view
   grouped by room. CSV download and Export / Import live in this tab's menu.

## Fixture catalog

| Group | Types |
|---|---|
| Outlets | duplex, GFCI, 240 V (dryer, range, EV, other), floor, exterior weatherproof |
| Switches | single, 3-way, 4-way, dimmer, fan control |
| Lights | ceiling, recessed, sconce, ceiling fan, under-cabinet, flood |
| Other | smoke / CO alarm, exhaust fan, thermostat, doorbell transformer, junction box or blank plate, hard-wired appliance (water heater, furnace, disposal, dishwasher, other), panel, subpanel, meter |
| Custom | free-text name |

Default heights: outlets 12 in, switches 48 in, ceiling items left blank (ceiling), all editable. Marker shapes and
colours follow the explorer: circle outlets, square switches, diamond lights, triangle other.

## Saving and moving between devices

- Every change saves to IndexedDB at once. The app asks the browser for persistent storage and, on iPhone, shows a
  one-time note to add it to the Home Screen, since Safari can clear data for sites left unused for weeks.
- **Export** writes one file, `<house name> <date time>.circuitmap`, JSON with images embedded. On iPhone it opens
  the Share sheet (AirDrop to the Mac, or Save to Files / iCloud Drive). On the Mac it downloads.
- **Import** reads a file and merges it into the project on the device, then shows a summary: added, updated,
  removed, renumbered.
- If the file is for a different project id, Import offers replace or cancel, never merge.
- A small "changes since last export" marker reminds him to export after a working session.
- The service worker caches the app so it runs with no signal.

### Merge rules

For each record, matched by `id`:

1. Present on one side only: keep it, unless its id is in the other side's `deleted` with a later time than the
   record's `updated`.
2. Present on both: the copy with the later `updated` wins whole (no field-by-field mixing).
3. `deleted` lists are unioned.
4. After merging, if two devices share a `label`, the one created later gets the next free number in its room and is
   reported in the summary.
5. Leftovers are tidied: links to a missing device are dropped; a missing breaker is cleared from its devices;
   rooms and devices on a missing floor and breakers in a missing panel are dropped; a device whose room is missing
   is kept with no room; duplicate links are collapsed.

Merging is symmetric: importing A into B and B into A gives the same project.

## Carried over from the existing tools

- Pan / zoom / pick and constant-size markers from `explorer_template.html`.
- Palette layout and default heights from `marker_page/index.html`.
- Sweep screen and wording from `make_checksheet_app.py`.

Fixed on the way: user-typed text is escaped everywhere (the explorer did not escape names and rooms); room order
comes from the data, so no room can be silently dropped (the checksheet filtered on a hard-coded list).

## Not in version 1

Drawing walls, wall snapping, distance-from-corner entry, DXF import or export, a scaled printable plan
sheet, conduit runs, several houses on one device, live sync, accounts.

## Errors and edge cases

- Unreadable or wrong-format file on import: plain message, nothing changed.
- Newer `formatVersion` than the app knows: refuse and say to reload the app for an update.
- A floor with no room outlines still works: every placement asks for the room.
- Storage full or blocked (private browsing): banner saying changes are not being saved, Export still works.
- Deleting a room, floor, panel or breaker that is in use asks first and says what will be affected.

## Testing

- `node --test` for `model` (including point-in-outline room lookup), `ids`, `merge` (including the symmetric property and tombstones), `file` round-trip with
  images, `csv`, and format migration.
- UI checked in the browser at laptop and phone widths, light and dark.
- By Josh or his dad on real hardware: Home Screen install, offline use, Share-sheet export, AirDrop both ways,
  import from iCloud Drive.

## Open items for Josh

1. Repo name (`circuit-map`?) and the local folder to create it in.
2. Go-ahead to create the public GitHub repo and enable Pages, when we reach that step.
