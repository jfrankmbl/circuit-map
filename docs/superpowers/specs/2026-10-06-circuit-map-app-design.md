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
  model.js        project data: create, edit, validate
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
manifest.webmanifest, icons/   name, icon and full-screen display for the Home Screen
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
            breakerId, tested, gfciId, notWorking, plateLabel, created, updated }
link      { id, switchId, toggle, loadId, loadPart, updated }     loadPart: "", "top", "bottom"
panel     { id, name, make, mainAmps, slotCount, numbering, fedFromBreakerId, deviceId, updated }
breaker   { id, panelId, slots[], poles, amps, kind, label, note, swept, updated }
deleted   { id, at }                                              tombstones, so merges do not resurrect things
```

- `id` is a random unique id and never shown. `label` (`KIT-07`) is what the user sees and writes on things.
- `room.outline` is a list of `[x, y]` corner points traced on the plan. It may be empty (for example an `Exterior` room).
- `toggles` is the number of toggles on a switch plate (1-4). Links name the toggle, so a 3-gang plate is one device.
- `gfciId` empty means not known to be behind a GFCI outlet; otherwise the GFCI outlet whose Reset button also controls
  this device. `notWorking` true means it has no power or does not work for a reason other than its breaker; the
  breaker test leaves it out until it is cleared.
- `plateLabel` is empty when the label written on the device's plate matches `label`. When a device is relabelled (by a
  merge or by him) it holds the old label, which is still what the plate says, until he confirms he has rewritten it.
- `breakerId` empty means unknown. `tested` false means the user typed a guess; true means a sweep set it.
- `breaker.slots` holds slot names as text: `["7"]` single-pole, `["13", "15"]` double-pole. A tandem is two breakers
  in one slot, `["7a"]` and `["7b"]`. `kind` is one of standard, GFCI, AFCI, dual, empty (a space with no breaker, so it counts as entered but is never tested).
- `swept` is the time the breaker was last tested with the Test screen, 0 if never.
- A subpanel is a panel whose `fedFromBreakerId` points at a breaker in another panel.
- Images are stored as blobs keyed by `imageId`, downscaled so the longest side is at most 3000 px.

## Screens

Five tabs. On the tab bar they carry plain labels and an icon: Floors (Setup), Add (Place), Switches (Link),
Breakers (Panel and Test), Map (Browse). The names below are the working names used in the code and plans. Words in this document that the screens never show: "fixture" (anything placed on a plan; the screens say "what you are adding" or name the thing), "toggle" (the screens say "switch 2 on the plate"), "sweep" (the screens say "test"). Floor switcher is always visible on any tab that shows the plan, lowest floor first: a row of large buttons up to four floors, and a single "Floor: Main floor" button opening a list beyond that.

**First launch.** With no project on the device the app shows no tabs, only a welcome screen. On an iPhone Safari
tab it begins with the Home Screen card (see Saving and moving between devices). Then two buttons of the same size and
weight: **Start a new house** and **I already have a project file**. They are equal on purpose: after a new phone or a
wipe by Safari the obvious button must not be the one that makes an empty project. Under them, in small type: "Used
this app before? Your house may have been cleared by Safari, or this may be a new phone. Choose I already have a project
file and pick your latest .circuitmap file (look in Files, Downloads or iCloud Drive, or ask your other device to send
it)." On the Mac "or drop the file here" is added.
- **Start a new house** opens a second screen: "What do you call this house?" (a text field showing "My house",
  selected so typing replaces it) and a large Start button. After Start the app opens on Floors with a checklist across
  the top that ticks itself: 1 Name the house, 2 Add a floor, 3 Add a picture of the floor, 4 Add the rooms. Once one
  room exists the checklist shrinks to one line, "Next: add outlets and switches", which jumps to Add. The app opens on
  Map from then on, but stays on Floors until some floor has a picture.
- **I already have a project file** opens the file picker, describes the file ("Dad's house, 2 floors, 63 devices, last
  changed 12 Sep 2026, 3 weeks ago. Use this one?") with Use it and Choose another file, and then adopts it as the
  project. There is nothing on the device to merge with, so it never asks replace or cancel.

1. **Setup.** The Floors tab is a list: house name at the top, then one row per floor showing its name, whether it has
   a picture, and "N rooms". Tapping a floor opens that floor's page with three parts in order: Picture, Scale
   (optional), Rooms. Add, rename, reorder floors. Add floor offers tappable names (Basement, Main floor, Upstairs,
   Attic) as well as typing one; Basement goes first (it is the lowest) and any other new floor goes last; a Reorder button on the list shows Move up / Move down on each row (no dragging) and Done hides them again;
   the lowest floor is listed first. After a floor is added its page opens with "Next: add a picture of the floor" and a Choose a picture button. Per floor: Choose a picture. A photo (JPEG, PNG, or HEIC where the
   browser can read it; the camera's own rotation is honoured) or a PDF. A PDF with more than one page shows the pages
   as small thumbnails to tap. The chosen picture is shown with Rotate left / Rotate right buttons and a Use this
   picture button; "Preparing picture..." shows while it is shrunk and saved. A floor with no picture shows "This floor
   has no picture yet" and a Choose a picture button on every tab that would show its plan. An attic or crawl space often has no plan: under the button it says "No plan of this space? Put its things on the nearest floor, in a room called Attic." Replace picture on a floor
   that already has rooms or devices (a hand sketch replaced by a proper drawing, say) goes on to a line-up step so
   what he has placed follows the plan. "Line up the new picture" shows the old picture with its markers and says
   "Tap a spot you can find on both pictures, like a far corner of the house", then "Now tap a second spot, far from
   the first"; then the new picture, asking for the same two spots in the same order, each numbered 1 and 2 where he
   tapped. Use these spots moves, resizes and turns every outline and marker on that floor to match, and the scale
   with them; the banner then reads "Moved 38 devices and 4 rooms to fit the new picture. Undo", and under it "Anything
   that sits wrong? Tap it and choose Move." (a sketch's proportions are rarely true, so some will). Two spots tapped
   in the same place, or closer than a twentieth of the picture's width, say "Pick two spots further apart." Same
   picture, same size is offered as plain text under the first prompt for a cleaner scan of the same drawing, and
   skips the step. Cancel at any point leaves the old picture and everything on it untouched. The old picture is kept
   until the app is next opened so Undo can bring it back. Optionally set scale by tapping two points and typing
   the real distance in two number boxes labelled "feet" and "inches" (no quote marks to type). Rooms per floor:
   name and short code, suggested from the name (`Kitchen` gives `KIT`). The code box is labelled "Label code (used on
   labels like KIT-01)", turns typed letters into capitals and says in words if a code is taken. Then trace the room by tapping its corners
   on the plan. While tracing, the banner reads "Tracing Kitchen: tap each corner" with Undo corner, Finish room (shown
   once there are three corners; tapping the first corner again also finishes) and Cancel buttons. Corners can be
   dragged afterwards. Pan and zoom stay available while tracing (a touch that moves more than a few
   pixels is a pan, not a corner), so a small closet can be zoomed into first. Finish room refuses an outline whose lines
   cross and says "The lines cross. Undo the last corner or drag a corner." After a room is finished the banner reads
   "Kitchen added. Add another room" with the name field ready for the next one. A closet or alcove inside another
   room is just another room traced over it. A floor with no rooms shows "No rooms yet. Add one, then tap its corners on the plan." The outline is drawn as a
   faint tint with the room name at a point inside the outline (the middle of the bounding box can fall outside an
   L shape). A room can be left without an outline.
   The rooms list shows each room's name, "N devices" and "no outline" where there is none. Tapping a room opens it:
   Name (saved when he leaves the field or taps the keyboard's Done), Label code, Edit outline, Delete room. Edit
   outline shows the banner "Editing the Kitchen outline: drag a corner to move it" with Done and Start over buttons.
   A "+" handle sits on the middle of each line to add a corner there, and tapping a corner selects it and shows a
   Remove corner button (a plain tap never removes anything, since a tap often means a drag was aimed badly). Start
   over clears the outline and goes back to tracing; "Outline cleared. Undo" follows. Changing an outline
   never moves, relabels or reassigns a device. When Done is tapped and some devices no longer match, a notice says
   how many ("3 devices are now outside Kitchen", "2 devices from other rooms are now inside it") with a Review button
   that lists them (label, type, room); tapping one opens its edit sheet, where its room can be changed, and the
   "inside" group also has Move all to Kitchen, which keeps their labels. An empty list says "Nothing to review". Renaming a room changes only the
   name; the label code and every device label stay. The label code can be changed only while the room has no
   devices; after that it is shown as plain text with "Labels in this room already use KIT, so the code can't change." under it
   (not a greyed field that does nothing), since labels are written on cover plates. Delete room says "Delete Kitchen? It has 7 devices." with Keep the devices
   (the main button; they stay on the plan with no room), Cancel, and, set apart from them as a plain text button,
   Delete the devices too. A room with no devices just asks "Delete Kitchen?" with Delete and Cancel. Undo follows
   either way.
2. **Place** (tab label Add). Putting things on the plan and fixing them. Undo: see Using it.
   - **Choosing.** Choose a fixture from the palette, then tap the plan. On the phone the palette is a "What are you
     adding?" button that opens a sheet of large buttons (glyph and name) in the four groups, with Something else always
     at the foot of the sheet (no scrolling to find it), and a row of the last four fixtures used always shown above the
     plan, so switching between outlet and switch is one tap; on the Mac it is the side panel. Buttons for types he may
     not know carry a one-line hint: GFCI outlet "has Test and Reset buttons", 3-way switch "one of two switches for the
     same light", Dimmer "turn knob or slider", Junction box / blank plate "a cover with nothing on it". With nothing
     chosen the banner says "Pick what you are adding below, or tap a marker to change it." The chosen fixture in the
     recent row is outlined and ticked, not only coloured.
   - **Switch plates.** Choosing a switch type adds a row above the plan, "Switches on this plate", that replaces the recent row while a switch type is chosen (so the phone never has two extra rows above the plan), with buttons 1 2 3 4 (each at least 44 points; the last count used is pre-picked; the chosen one filled and ticked). That count
     is set on each switch placed. Switch 1 is the leftmost as you face the plate (the top one on an upright plate). A
     switch marker shows its number of switches inside it ("3"), so a plate's size shows on the plan.
   - **240 V and hard-wired.** Choosing 240 V outlet or Hard-wired appliance opens a short list (Dryer, Range, EV
     charger, Other 240 V; Water heater, Furnace, Disposal, Dishwasher, Other) and the pick becomes the marker's name;
     Other asks for a name. The pick stays chosen, so the banner reads "Adding: Dryer outlet" until Done.
   - **Something else.** Asks "What is it called?" with tappable suggestions (Attic fan, Sump pump, Garage door opener,
     Well pump, Heat lamp) followed by names he has used before in this house, newest first; an empty name is not
     accepted. The name field is already focused when the sheet opens, with suggestions above the keyboard and the
     keyboard's key labelled Done; tapping a suggestion chooses it at once. Autocorrect is off for names. On the Mac the
     name is a field in the side panel. It is always something that uses power: it is listed in breaker tests, can be
     switched from the Switches tab, and is drawn as a triangle.
   - **Panels.** Placing a Breaker panel or Subpanel asks "Which panel is this?" with the panels entered so far, or
     New panel (see Panel).
   - **Placing.** After a tap places a fixture the same fixture stays selected, so a whole room of duplex outlets is one
     tap each; Done (or choosing another fixture) ends it. While placing, a tap always places, even next to an existing
     marker (markers can be tapped again after Done), and a second tap within a second and a few pixels of the last one
     is ignored so a double tap cannot place two. The new marker pulses for two seconds with its label. The label is
     assigned as the next number in the room and shown large in the banner ("Placed KIT-03. Kitchen has 3 devices"), so
     he can write it on the plate. Placing does not open the edit sheet; heights and notes are filled in later. While the Add, Breakers or Test tab is showing, the phone is kept awake (where the browser allows it), so the screen does not lock every half minute during a walk or while he reads the "Something has no power" card in a dark closet.
   - **Which room.** The room is taken from the outline the tap falls in. Where one outline sits wholly inside another
     (a closet drawn inside a bedroom) the inner one wins. A tap outside every outline, or where outlines partly
     overlap, asks which room (a sheet listing this floor's rooms, the last one used first, and New room, which asks for
     a name and label code and adds a room with no outline). The answer is kept for the rest of that placing run: the
     banner reads "Adding: Duplex outlet in Garage" on one line, with the room name itself a button that changes it, and
     the result on a second line; a tap inside a different outline switches the room by itself.
   - **The marker sheet.** With no fixture chosen, tapping a marker opens its sheet over the lower half of the screen,
     so the marker stays visible above it (the Map tab's details view has an Edit button into the same sheet). Top: the
     label large (KIT-03, for writing on the plate) with its type and room. Then rows: Type, Room, Breaker (it shows "Not known", "Breaker 7 (Kitchen), guess" or "Breaker 12 (Kitchen),
     tested"; tapping it opens the panel picture to tap a breaker on, with the panel switch if there is more than one
     panel and Not sure at the top. A pick made here is always a guess, because only the Test screen can make one
     tested), Note, and for switches Switches (1 to 4).
     A "More" row opens the rarer ones: Height (a number in inches with quick buttons 12, 18, 48 and Ceiling);
     "Behind a GFCI outlet" (for outlets and lights: None, then the GFCI outlets, the same room first, so he can say
     which Reset button controls this one); and "Not working right now: On / Off" (the word is shown, not just a
     switch), for a dead bulb, a tripped GFCI or anything else that is off for a reason other than its breaker, so it
     is not mistaken for a dead circuit. Turning it On puts the cursor in Note with the hint "What is wrong? (bulb
     out, tripped GFCI...)". A marker flagged this shows "!" on the plan and the words "Not working" in its details.
     A GFCI outlet's own sheet also shows "Protects 5 devices" with Change, which starts a mode: banner "KIT-04: tap
     each outlet or light that goes dead when this GFCI trips", with a ring and tick on each one tapped and a Done button. Every change saves at
     once; there is no Save button, only Done. Directly under the label sit two buttons, Move and Move to another floor (choose the floor; it opens in
     Moving mode with the banner "Tap where KIT-03 goes on Basement"; the label, links and breaker all stay, and the room
     is taken from the outline tapped, as when placing), since correcting a position is the common job. The sheet
     scrolls and can be pulled up to full height, with the label and Done always in view. Delete sits at the foot, apart
     from them, as plain text, followed by the "Deleted KIT-03. Undo" toast.
   - **Changes made in the sheet.** Changing the room asks "Move KIT-03 to Garage?" with Keep the label KIT-03 and
     Relabel it GAR-04 (write the new one on the plate; it stays under "Plates to rewrite" until he says it is done). Changing the type asks first when links or a breaker would be
     lost ("KIT-03 stops being a switch. Its 2 links will be removed."); a height he edited is kept, and only a height
     still at the old type's default changes to the new type's. Lowering the number of switches on a plate asks first
     if the removed ones control anything ("Switch 3 controls 1 light. Taking it off the plate clears that." with Take
     it off and Keep 3 switches).
   - **Moving.** A marker moves only in Moving mode (the Move button in its sheet), so swiping to pan the plan never
     drags one. The sheet closes and the banner reads "Moving KIT-03. Drag it, or Done."; the marker is drawn above the
     fingertip while dragged. If it ends inside another room's outline, tapping Done offers to relabel it ("Now in
     Garage. Keep the label KIT-03, or relabel it GAR-04"), keeping the old label unless he says yes.
3. **Link** (tab label Switches). Recording what each switch controls.
   - **Start.** The header reads "12 of 15 switches set" (every switch on every plate counts) and has a "Still to do
     (3)" button listing the switches that control nothing so far; tapping one starts linking it. When all are set the
     header says "All 15 switches set" with a "Next: test your breakers" button that opens Breakers. With no switches
     placed the tab says "No switches placed yet. Add them on the Add tab."
   - **Pick a switch.** Tap a switch on the plan. On a plate with several, a sheet lists 1, 2, 3 with what each controls
     now ("Switch 2: nothing recorded yet") and he taps one. The banner then names it (see Using it).
   - **Pick what it controls.** Tap each light or outlet it controls; tap again to unlink. Tapping another switch
     changes which one is picked. Only the breaker panel, subpanel and meter are dimmed with a dashed outline, and
     tapping them says "That can't be switched." Each linked load shows a ring and a tick and a thin line from the
     switch. Tapping the banner opens "What it controls", a list of its loads (label, type, floor) each with a Remove
     button, which is also how to unlink something on another floor without leaving the screen. The floor switcher still works while linking and the picked switch stays
     picked, so a hallway light on two 3-way switches on different floors is two passes: pick the downstairs switch and
     tap the light, then pick the upstairs switch, change floor and tap the same light. Loads on other floors are
     listed in the banner ("Also controls HAL-02 (Main)").
   - **Outlets in halves.** Duplex, GFCI and Exterior outlets open a sheet Whole / Top / Bottom when tapped (Whole first and largest, since
     it is the usual answer), each with a tick when linked; tapping a ticked one unlinks it. Whole replaces Top and Bottom from the same switch, and the other
     way round. Other loads link in one tap.
   - **From the load.** With no switch picked, tapping a light or outlet shows "Switched by" with its switches (label and
     floor) and Add a switch, after which he taps that switch on any floor; a listed switch can be removed.
   - Many-to-many, so 3-ways and 4-ways are just several switches on one load.
4. **Panel** (tab label Breakers). Describing the panels and their breakers.
   - **Start.** With no panels: "No panels yet. Add the one with your main breaker." Add panel asks Name ("Main
     panel"), Make (optional), Main size (100, 150, 200 or other amps; "Not sure" is allowed) and "How many spaces?" with 12, 20, 24, 30,
     40 or other. Under it: "Not sure? Count the breaker positions down one side and double it. You can change this
     later." The panel's page has Add more spaces, and the count can never go below a space that has a breaker.
     Then Numbering, with two small drawings: A "1 and 2 side by side, then 3 and 4" (odd numbers on the left, even on
     the right; most panels) and B "1 to the middle down the left side, the rest down the right". "Look at the numbers
     on the breakers or the door. Not sure? Pick A; you can change it." Changing it later redraws the picture. If a double breaker would no longer sit side by side, the panel says "2 double breakers no longer sit together under this numbering. Check them." with the list and an Edit button on each. A subpanel also has "Which breaker feeds this panel?", a list of
     breakers in other panels ("13/15 Garage 60 A"), offered once another panel has breakers. A panel cannot be fed
     from itself or from something it feeds.
   - **Power out?** The first thing on the Breakers tab is a large button, "Something has no power", for when he is at
     the panel with the lights out. It asks "Where?": a search box, then the room he asked about last, then the rooms
     by floor, or one device (search by label, or tap it on the plan). The answer is one card in text at least 20 px,
     most useful first, with no more than three lines in a section ("and 2 more" opens the rest):
     "Check these first (they can look like a tripped breaker)": a GFCI outlet that covers it ("KIT-04 protects 5
     outlets here: press Reset"), any switch that controls it ("KIT-01 switch 1: is it on?"), anything flagged Not
     working. Then "Most likely: Breaker 7 (Kitchen), 20 A", with how sure ("6 tested, 2 guessed") and Show on panel,
     which opens the panel picture with that breaker ringed and marked "Check this one". Under it, in small type: "A
     tripped breaker sits between On and Off. Push it fully Off, then On. If it trips again straight away, leave it
     off and call an electrician." If that breaker is a GFCI, AFCI or both type, a line says "It is a GFCI breaker: press the Test button on it, then switch it Off and On." Other breakers that feed some of it follow ("Also: Breaker 9, 1 device"). If the
     breaker is on a subpanel it adds "This is on the Garage subpanel, fed by breaker 13/15 in Main panel. If the
     whole subpanel is off, check that one first." Devices with no breaker recorded are counted ("3 devices in this
     room have no breaker recorded") with a Test breakers button. If nothing in the room has a breaker, the card says
     "No breaker is recorded for this room yet. Try a room next to it, or test your breakers to find out." with
     buttons for both.
   - **The panel picture.** The panel is drawn like the real one: two columns of spaces numbered as the Numbering choice says
     (A: 1, 3, 5 down the left and 2, 4, 6 down the right; B: 1 to the middle down the left, the rest down the right). Each space is at least 44 points tall and shows its number, its label (two
     lines, then cut off; the full text is on its page), its amps, and a word for anything special ("GFCI", "AFCI").
     A double breaker is one tall box across its two spaces; a tandem space is drawn twice as tall so each half is still
     44 points. A space not yet entered says "tap to add"; one entered as empty says "empty (no breaker)" in a dashed
     box, so the two are never confused and neither relies on colour. With more than one panel, a switch across the top
     (Main panel | Garage subpanel) chooses which is drawn. The header reads "17 of 20 spaces entered" and stays in view
     while the picture scrolls.
   - **Entering a breaker.** Tap a space. A sheet asks Label (already focused: type what is written on the door), Amps
     (15, 20, 30, 40, 50, other, where other opens a number pad) and Type of breaker (Standard, GFCI "has a Test
     button", AFCI, Both GFCI and AFCI). Amps and type start as the ones used last, so an ordinary breaker is only a
     label. The keyboard's key reads "Next space": it saves and moves to the next space not yet entered, so the door can
     be entered top to bottom with the keyboard never closing. "Two spaces together (240 V)" starts a mode, banner "Tap
     the other space for this double breaker", with only the spaces that can pair left tappable; "Two small breakers in
     one space" makes a tandem, shown as "7 top" and "7 bottom"; "No breaker here" marks a space empty.
   - **Where it is.** Placing a Breaker panel or Subpanel marker on a plan asks "Which panel is this?" (a list, or New
     panel). The panel's page then has Show on plan.
   - **A breaker's page.** Tapping a breaker opens its page: label, amps, a one-line summary ("8 devices: 5 outlets, 2 lights, 1 other" ("other" covers alarms, fans and appliances; "something else" counts what he named himself)), the devices found on it grouped by floor and room (each tagged "guess" where it is a
     guess, each with Show on plan), Edit, and a large Test this breaker button. If the breaker feeds a subpanel the
     summary adds "and 14 more through the Garage subpanel", which opens that list. With no devices found yet it says
     "Nothing found on this breaker yet. Test it to find out." Empty spaces have no page. A search box above the panel picture finds a breaker by space number or label ("14" means space 14, "kitchen" matches labels); the result is a row that opens its page, so an answer to "what is on breaker 14?" is two taps.
   - **Print.** "Print or save as PDF" on a panel's page opens a preview exactly as it will print (always black on white
     whatever the device's dark mode, one page per panel; on the phone it fits the screen and can be pinched), with a
     Short | Full switch and a Print button that opens the system print dialog (on iPhone that includes AirPrint and
     Save to Files as a PDF). Short is the card for the inside of the panel door, about 5 inches wide so it can be cut
     out (a panel of more than 30 spaces uses the full page width so the type stays readable; print type is never below
     10 pt): the panel drawn as two columns like the real one, each space with its number, its door label, its amps and
     up to three rooms that are on it ("Kitchen, Dining, Hall +2 more ?"). A "?" means not confirmed by testing yet.
     A double breaker is one tall box marked 240 V and a tandem space has two halves, all by borders, never shading or
     colour, so it reads on any printer. A space not entered yet is an empty ruled line to write on by hand; a space
     entered as empty says "empty". Full adds a page listing every device on each breaker (label, type, room, "guess"
     where it is one). A subpanel prints on its own page headed "Fed from breaker 13/15 in Main panel". Every page
     carries the house name, the panel name, the date printed and a legend for "?". The panel's page shows "Last
     printed 6 Oct 2026" (kept on the device) and, if breakers have changed since, "3 breakers changed since. Print
     again?".
5. **Test** (not a tab; opens from a breaker's page in Breakers, with a Back to breakers button). Finding out what a
   breaker feeds, by switching it off and seeing what has no power.
   - **Top.** The breaker is named ("Breaker 7, Kitchen, 20 A") with "Breakers tested: 5 of 18" and "41 of 63 devices
     have a breaker". The phone is kept awake.
   - **Steps.** Three steps with large tick boxes, then the list: 1 Turn every light switch on (a switched light looks
     dead even when its breaker is on). 2 Press Reset on every GFCI outlet (a tripped one would be mistaken for a dead
     circuit; it cannot be reset once the breaker is off). 3 Switch breaker 7 off, with the line "Keep it short if a
     freezer or fridge is on this breaker." Steps 1 and 2 show how many devices the app knows of ("4 recorded"); with
     none it says "None recorded" and counts as done. Ticking step 3 shrinks the steps to a bar, "Breaker 7 is OFF" with
     a large "I've switched it back on" button, which is step 4 and lives in that bar on every screen of the app until
     it is tapped. The bar survives closing the app (kept on the device, not in the project file), and if he opens
     the app with it showing, it asks "Is breaker 7 back on?" with Yes, it's back on and No, not yet.
   - **What to mark.** A List | Plan switch. List: every outlet, light and hard-wired load grouped by floor, then room,
     with rooms that already have devices on this breaker first, then by name, and devices with no room last. Plan: the
     current floor with only those devices drawn. Tapping a device marks it "No power" (a cross and the words, not just
     a colour) and tapping again unmarks it. Each room has "Whole room has no power" for the common case, which marks every
     device in it and then shows "Marked 7 devices. Undo". The list is the default and the last choice is remembered.
     Marking sets the device's breaker as tested. Marking a GFCI outlet offers "Also mark the 5 outlets it protects?" with Yes as the main
     button and No beside it. Devices flagged Not working are left out of the list and shown in a collapsed "Not working
     (2)" group at the end ("Fix them or find out why; they cannot be tested until then."), each row with a "Working
     now" button that clears the flag. If a device he marks was already found on another breaker by an earlier test, the app says "KIT-09 was
     dead when breaker 3 was off too. Move it to breaker 5?" with Move it as the main button, Keep it on breaker 3
     beside it, and, set apart as plain text, "It has no power for another reason". The last is the answer for an outlet
     that goes dead whatever breaker is off (a tripped GFCI, a loose wire, a switch that is off): it clears the
     breaker and flags the device Not working.
   - **Finishing.** After "I've switched it back on", the screen says "3 devices found on breaker 7: KIT-01, KIT-02, KIT-05" and, for any that were moved from a guess, "KIT-02 was your guess of breaker 5", records the breaker
     as tested (even if it found nothing), and offers "Next untested breaker (6 left)" and Back to breakers. A breaker counts as untested again when a device with no breaker (a finished basement, say) has been added since it was tested; the header then says "Breakers to test: 18. New devices added."
   - **Still assigned here.** Each floor has an "I've checked this floor" tick at its heading (in the list, and above
     the plan for the floor shown); only ticked floors count, since a device on a floor he has not walked has not
     been seen. Before Done is final, devices on ticked floors that are assigned to this breaker but were not marked
     No power are listed: "KIT-05 and KIT-07 were put on breaker 12 but still had power." In two groups, "Guess" and
     "Found by an earlier test", each with Take them all off this breaker, and each row with Take it off (the main
     button) and Keep it. "Keep all" at the foot skips the step. This is how a wrong guess, or a circuit that has
     since been changed, is corrected. A device that was only guessed on another breaker simply moves when he marks
     it, without a question.
   - **A breaker that feeds a subpanel.** Its page says "Feeds Garage subpanel" and, in place of Test this breaker,
     shows "Test the subpanel's own breakers", which opens that panel. Switching it off would put out everything
     on the subpanel, so its devices belong to the subpanel's breakers.
6. **Browse** (tab label Map). The default view: pan, zoom, search by label, room, type or note; filter by group; tap a device for
   its circuit ("Breaker 12 (Kitchen), tested", "Breaker 7 (Kitchen), guess" or "Not known"; Show on panel opens the panel picture at that breaker), height, note, what it controls and what switches it (a switch plate is shown one switch at a time: "Switch 1 controls HAL-01. Also switched from HAL-02 (Upstairs hall), switch 1", each with Show on plan), with links that jump between floors. List view
   grouped by room. A Key in this tab's menu shows every marker shape and mark with its meaning in words. Download spreadsheet (Devices or Breakers, as CSV) lives in this menu; the download adds a byte-order mark so Excel shows accents correctly, and on iPhone it opens the Share sheet like Export; Export and Import are in the header sheet on every tab (see Saving and moving between devices).

## Using it: modes, undo, size, layout

- **The current mode is always written in a banner on the plan** (just above the tab bar on the phone, where the thumb
  is; at the top of the plan on the Mac), in words, with a big Done button (Finish room while tracing): "Adding: Duplex
  outlet. Tap the plan.", "Moving KIT-03. Drag it, or Done.", "Switch 2 on KIT-01: tap each light or outlet it controls.",
  "Tracing Kitchen: tap each corner." With no mode the banner is empty. Colour and shape are never the only signal:
  tested, guessed, dead and unknown each also show a word or symbol.
- **Undo** is a button, always visible, on every editing tab (on the phone in a bar just above the tab bar that is always there, holding Undo alone when no mode is on and Undo beside Done when one is; on the Mac in the header), and steps back through the last 20 changes
  of the session, each named on the button ("Undo: placed KIT-03"). A deleted device is undone, not confirmed:
  "Deleted KIT-03. Undo" appears for a few seconds. Deleting a room, floor, panel or breaker still asks first (see
  Errors and Setup). Undo restores records with a new time, so a merge on the other device cannot delete them again.
- **Touch size.** Every button and field is at least 44 by 44 points with a gap between neighbours; body text is 18 px and nothing is below 16 px (smaller text in a field makes Safari zoom the page). A marker is drawn small but taps with a 44 point
  reach. If a tap reaches more than one marker, a short list of them (label and type) pops up to choose from, rather
  than guessing. Markers have a light and a dark outline so they show on any picture, light or dark. While a marker or
  room corner is dragged on the phone it is drawn above the fingertip so it can be seen.
- **Screen space.** The plan always gets at least half the screen height. On a small iPhone the rows above the plan
  (floor buttons, recent fixtures or switch count) and the bars below it (mode banner, Undo, tab bar) share the rest: the
  recent row hides while a sheet or the keyboard is open, and a banner is at most two lines. Held sideways the tab bar
  becomes a narrow column at the left edge so the plan keeps its height.
- **Motion.** The pulse on a new marker and any other animation are replaced by a steady ring (for the same two
  seconds) when the device's Reduce Motion setting is on. Markers and buttons carry their label as text for VoiceOver.
- **Zoom** has + and - buttons, a Fit button and a Rooms button in a corner of the plan (Rooms lists this floor's rooms by name; tapping one zooms the plan to that room, so he can get to the room he is standing in with one thumb), as well as pinch or trackpad, because pinching
  is hard one-handed. A double tap never zooms (it could place two markers).
- **Phone:** tab bar at the bottom within thumb reach; the plan fills the screen; editing opens in a sheet from the
  bottom, not a new page. **Mac:** tabs across the top, the plan on the left and the palette or device details in a
  side panel; Esc ends a mode, Delete removes the selected device (with Undo), Cmd-Z undoes. The mouse wheel or a
  trackpad pinch zooms and dragging empty plan pans; hovering over a marker shows its label, type and room. The layout
  follows the width of the window, not the kind of device: a Mac window narrower than about 700 px uses the phone
  layout, so a half-screen Safari still works.
- **Empty and loading states say what to do.** Map with nothing placed: "Nothing placed yet. Add outlets, switches and
  lights on the Add tab." with a button. A search that finds nothing: "Nothing matches "garage". Check the spelling or
  clear the search." The breaker Test list with no outlets or lights: "No outlets or lights placed yet. Add them on
  the Add tab first." Opening the app shows the plan at once; a picture that is slow to load shows "Loading
  picture..." on that floor, never a blank screen.
- **One banner at the top at a time.** Banners that can appear at the top are shown in this order and only the first
  one that applies is shown: the breaker-is-OFF bar (safety, never hidden), "Changes are not being saved" (storage full or blocked), "Plates to rewrite", the backup nudge, the
  new-version notice. The mode banner at the bottom is separate. A hidden one appears when the one above it is done.
- **Nothing is deleted by swiping a row or by one tap.** Every Delete lives inside a page or sheet, set apart from the
  main button, in plain text, and the Undo that follows names what was deleted.
- **Jumps leave a way back.** Any jump (Show on plan, a link in a list, Show on panel) that changes floor or screen puts
  a Back button, with a word ("Back to Main floor"), in the banner area until he taps it or does something else.
- **Contrast.** Text, marker outlines and symbols meet a 4.5 to 1 contrast ratio in both light and dark mode.
- **Dark mode** follows the device. The floor picture is shown as it is and is never inverted. Printed output is
  always black on white.

## Fixture catalog

| Group | Types |
|---|---|
| Outlets | duplex, GFCI, 240 V (dryer, range, EV, other), floor, exterior weatherproof |
| Switches | single, 3-way, 4-way, dimmer, fan control |
| Lights | ceiling, recessed, sconce, ceiling fan, under-cabinet, flood |
| Other | smoke / CO alarm, exhaust fan, thermostat, doorbell transformer, junction box or blank plate, hard-wired appliance (water heater, furnace, disposal, dishwasher, other), panel, subpanel, meter |
| Something else | a name he types (attic fan, sump pump, ...) |

Default heights: outlets 12 in, switches 48 in, ceiling items left blank (ceiling), all editable. Marker shapes and
colours follow the explorer: circle outlets, square switches, diamond lights, triangle other.

## Saving and moving between devices

- Every change saves to IndexedDB at once. The app asks the browser for persistent storage. On iPhone, Safari may
  clear data for sites left unused for weeks, and an app added to the Home Screen has its own separate storage that
  starts empty. So the app should be added to the Home Screen before anything is entered: in an iPhone Safari tab the
  welcome screen opens with a card, "Add this to your Home Screen first. Tap Share, then Add to Home Screen, then
  open Circuit Map from your Home Screen.", with "Start here anyway" under it. If a Safari tab already holds a
  project, the one-time note says "If you add this to your Home Screen, the new app starts empty. First tap Send or
  back up. Then open the Home Screen app and choose I already have a project file."
- **Export** writes one file, `<house name> <date time>.circuitmap`, JSON with images embedded (a few megabytes for a
  house with several floors; the screen says "Preparing file..." while it is made). On iPhone it opens the Share sheet
  (AirDrop to the Mac, or Save to Files / iCloud Drive); the file is handed over as plain JSON so the Share sheet
  accepts it, and if sharing is refused the file is downloaded instead. On the Mac it downloads, and the app then
  says "Saved to your Downloads folder as <file name>. To put it on your iPhone: right-click the file, Share, AirDrop."
- **Import** shows "Reading file..." and then what merging would do, in words, leaving out any count that is
  zero: "From the file: 12 new. Bring them in?" in the ordinary case, or "From the file: 12 new, 3 changed, 2 deleted.
  Bring them in?" Tapping "3 changed" lists the items and what differs ("KIT-03: note, height"; fields are named
  in his words: label, type, name, room, position, height, note, breaker, test result, number of switches, GFCI, Not
  working); tapping "2 deleted" lists them by label. Only when something is changed or deleted does the sheet add "If
  the same item was changed on both devices, the newer change is kept. Your other work on this device stays." and a
  second button, Save a copy of this device first (it opens the Export, then returns to this question). Bring them in
  is the main button, with Cancel beside it; nothing changes until he taps Bring them in. Then it merges the file into the project and says "Done. This device now has everything from both.",
  with Undo import for the rest of the session. If this device had changes not yet sent, it adds "The other device
  does not have this device's work yet. Send this project back to it?" with Send it back (Export) and Not now; this is
  the second half of every exchange, so without it one device is always behind. If there is nothing to do it says
  "Nothing new: this device already has everything in the file." and offers no button but OK. A
  "relabelled" count opens the list (see Merge rules). The file picker shows every file (it does not filter by the
  `.circuitmap` ending, because iOS greys out files it does not recognise); anything that is not a project file is
  refused with the plain message in Errors. On the Mac a file can also be dragged onto the app window.
- **Moving your project** is a help card in the header sheet with both directions in numbered steps. Phone to Mac: 1 On
  the phone choose Export. 2 Choose AirDrop and pick the Mac. 3 On the Mac, choose Import and pick the file from
  Downloads. Mac to phone: 1 On the Mac choose Export, then AirDrop the file to the iPhone and choose Save to Files.
  2 On the phone choose Import and pick it from Files. The first-launch screen's "I already have a project file" shows
  the same steps for a device that has nothing yet. Under the steps: "Tip: finish on one device and send the file before working on the other, and labels never clash."
- If the file is for a different project (for example the phone was started with Start instead of from the Mac's
  file), Import never merges. It says "This file is a different house: Dad's house, 2 floors, 63 devices. This device has My house, 1 floor, 12 devices." with Save a copy of this device first, then replace (the main button),
  Replace without saving, and Cancel.
- **The header chip.** Every tab has a chip in its header: "12 changes not sent" (or "Nothing new to send"). On the phone, to leave room for the floor buttons, the chip is the word Send with the number beside it ("Send 12"); the full words are in its sheet. It
  counts records edited or deleted since this device last finished an Export (it does not count what came in by
  Import) and opens the "Move or back up" sheet, so sending the project is one tap from wherever he is. The sheet has
  Send or back up (Export), Bring in a file (Import), and Moving your project (the steps). The chip resets when the
  Share sheet reports the share finished, or when the Mac download starts, not when the sheet is merely opened. The
  time of the last Export is kept on the device, not in the project file.
- **A nudge to back up.** If more than 7 days have passed, or more than 50 changes have not been sent, a banner on
  opening says "Back up your work: send a copy to your Mac, or save it to iCloud Drive." with Send or back up and Later, a banner that sits at the top of the screen (not a pop-up that blocks it); Later hides it for a day. A copy that never leaves the phone does not protect against a lost or wiped phone.
- **Offline.** The service worker saves every file the app needs (pages, scripts, the PDF reader, the icon and
  manifest) the first time it loads with a signal, and after that the app makes no network request at all: no fonts, no
  analytics, nothing. When saving has finished a toast says "Ready to use without a signal." once, and the header
  sheet shows "Works without a signal"; until then the sheet says "Not saved for offline use yet. Open the app once
  with a signal." Opened with no signal, the app looks and works the same as with one, with no error and no spinner
  waiting on the network. A web manifest (name, a 180 px icon, full-screen display) makes the Home Screen app open
  without Safari's bars.
- **Updates.** When a new version is available the app fetches it in the background and uses it the next time it is
  closed and reopened; it never reloads while he is working. A banner says "A new version is ready. Close the app and open it again." with Later, and under it in small type how:
  "On iPhone, swipe up from the bottom edge and pause, then swipe Circuit Map up and away." The header sheet shows the
  version ("Circuit Map version 12, 6 Oct 2026") so he can read it out when asking for help. A project file from a newer version is handled under Errors.

### Merge rules

For each record, matched by `id`:

1. Present on one side only: keep it, unless its id is in the other side's `deleted` with a later time than the
   record's `updated`.
2. Present on both: the copy with the later `updated` wins whole (no field-by-field mixing).
3. `deleted` lists are unioned.
4. After merging, if two devices share a `label`, the one created later gets the next free number in its room, keeps
   the old label in `plateLabel`, and is reported in the summary together with the device that kept the number.
5. Leftovers are tidied: links to a missing device are dropped; a missing breaker, or a missing GFCI outlet, is cleared from the devices that pointed at it;
   rooms and devices on a missing floor and breakers in a missing panel are dropped; a device whose room is missing
   is kept with no room; duplicate links are collapsed.

Merging is symmetric: importing A into B and B into A gives the same project.

### Labels that changed

A label may already be written on a cover plate, so a changed label is never a quiet detail.

- The import summary's "2 relabelled" opens the list below.
- **Plates to rewrite.** Until he confirms, the Map tab shows a bar "2 plates to rewrite" with a Remind me later
  button (hides it until the app is next opened), and the header chip reads "12 not sent, 2 plates" when both apply.
  The header sheet has the same list, or "No plates to rewrite".
- **A row** starts with what to do: "Write KIT-06 on this plate", then the device and where ("Duplex outlet, Kitchen,
  Main floor") and the reason in small type ("It says KIT-05, and another outlet in the Kitchen already uses
  KIT-05"). Buttons: Show on plan (it changes floor if it must, and the other device with the same label is shown
  too), "I've rewritten it" (clears the note), and Swap labels with the line under it "This one keeps KIT-05; the
  other outlet becomes KIT-06", for when the other plate is the easier one to rewrite. At the foot, "I've rewritten
  all 4" asks "Mark all 4 as done?" first.
- **On the plan** a device whose plate is out of date wears a small pencil mark next to its label (the Key explains
  it); its details say "KIT-06 (plate says KIT-05)".
- The same list is used when he relabels a device himself (Place, marker sheet).

## Carried over from the existing tools

- Pan / zoom / pick and constant-size markers from `explorer_template.html`.
- Palette layout and default heights from `marker_page/index.html`.
- Sweep screen and wording from `make_checksheet_app.py`.

Fixed on the way: user-typed text is escaped everywhere (the explorer did not escape names and rooms); room order
comes from the data, so no room can be silently dropped (the checksheet filtered on a hard-coded list).

## Not in version 1

Drawing walls, wall snapping, distance-from-corner entry, DXF import or export, a scaled printable plan
sheet, conduit runs, several houses on one device, live sync, accounts.

Decided with Josh on 2026-10-08: no "Recently deleted" screen (Undo, Save a copy first and the backup nudge cover
it); one type per switch plate (a mixed plate's other switches go in the note); and, when a floor's picture is
replaced, a two-spot line-up for the whole floor rather than a room-by-room fit.

## Errors and edge cases

- Unreadable or wrong-format file on import: plain message, nothing changed.
- A picture the browser cannot open (for example HEIC in some browsers): "This picture can't be opened here. Open it
  in Preview, choose File > Export, pick JPEG, and try again." Nothing is changed on the floor.
- Newer `formatVersion` than the app knows: refuse, and say "This file was made by a newer version of Circuit Map. Close the app completely, open it again, and try the file once more." (an app opened from the Home Screen only updates when it is closed and reopened).
- A floor with no room outlines still works: every placement asks for the room.
- Storage full or blocked (private browsing): banner saying changes are not being saved, Export still works.
- Deleting a panel or breaker that is in use asks first and says what will be affected. Deleting a room asks as
  described under Setup and keeps its devices unless he chooses otherwise. Deleting a floor (the button, "Delete floor", is at the foot of that floor's page, set apart as plain text)
  says "Delete Basement and its 38 devices? It has 4 rooms and 12 links." with Cancel as the main button, Save a copy
  first beside it, and Delete Basement set apart; then "Deleted Basement. Undo" stays on screen until he does
  something else (or 30 seconds), not a few seconds. The floor's picture is
  kept until the app is next opened, so Undo can bring the whole floor back; after that only a saved copy can. The plan
  then shows the floor below the deleted one (or above, if it was the lowest). With no floors left the Floors tab says
  "No floors yet. Add one."

## Testing

- `node --test` for `model` (including point-in-outline room lookup), `ids`, `merge` (including the symmetric property and tombstones), `file` round-trip with images, and `csv`. A format migration step is added when a version 2 exists; version 1 has nothing to migrate.
- UI checked in the browser at laptop and phone widths, light and dark.
- By Josh or his dad on real hardware: Home Screen install, offline use, Share-sheet export, AirDrop both ways,
  import from iCloud Drive.

## Open items for Josh

1. Repo name (`circuit-map`?) and the local folder to create it in.
2. Go-ahead to create the public GitHub repo and enable Pages, when we reach that step.
