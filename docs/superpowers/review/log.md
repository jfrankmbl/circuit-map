# Circuit Map design review log

## FINAL SUMMARY (after 58 rounds; stopped on a clean A+B pair, rounds 57 and 58)

**What changed in the spec** (docs/superpowers/specs/2026-10-06-circuit-map-app-design.md)
- Structure: five tabs with plain names (Floors, Add, Switches, Breakers, Map); Test is a sub-screen of Breakers. A first-launch flow with two equal buttons (Start a new house / I already have a project file) and a ticking setup checklist.
- Setup: floor adding, reordering and deleting (with Undo and Save a copy first); picture types, rotation, PDF page thumbnails, replace-picture warning; room tracing, editing, deleting, and a review step when outlines change devices.
- Place: palette with recent row, switch-plate counts, 240 V and hard-wired pick lists, Something else, panel markers, room detection, a marker sheet with Move, Move to another floor, GFCI, Not working, height, and consequences asked before they happen.
- Link: progress header, per-toggle linking, Whole/Top/Bottom for outlets, linking across floors, "Switched by" from the load.
- Panel and Test: Add panel with Numbering and "not sure" defaults, a breaker picture like the real panel, entering from the door, doubles, tandems, subpanels; a "Something has no power" card; breaker pages; print card for the panel door; a guided breaker test with GFCI reset, the OFF bar that survives closing the app, per-floor "I've checked this floor", and correction of wrong guesses.
- Using it: a mode banner and an always-present Undo bar, 44 pt targets, 18 px text, 4.5:1 contrast, a one-banner-at-a-time order, Zoom with Rooms button, Screen space and Reduce Motion rules, phone and Mac layouts by window width.
- Saving: Export/Import wording with previews and Undo import, the header chip, backup nudge, Home Screen storage warning, offline and update behaviour, "Labels that changed" and Plates to rewrite, merge rules with tidy-up of dangling links.

**What changed in Plan 1** (docs/superpowers/plans/2026-10-06-plan-1-core.md; 76 tests passed in a scratch run)
- Data model: `plateLabel`, `gfciId`, `notWorking`, `swept`, breaker `kind`, panel `numbering` and `fedFromBreakerId`, switch `toggles`, link `loadPart`.
- New functions: floors (`addFloor`, `sortedFloors`, `moveFloor`, `moveToFloor`), rooms (`outlineCrossesItself`, `setOutline`, `roomAt`, `outlineMismatches`, `editRoom`, `removeRoom`), devices (`placeDevice`, `setToggles`, `changeType`, `setRoom`, `recentCustomNames`), links (`toggleLink` validation, `linksOnRemovedToggles`), panels (`addBreaker` checks, `canPair`, `setSlotCount`, `setNumbering`, `unpairedBreakers`, `setFedFrom`), testing (`markSwept`, `unsweptBreakers`, `sweepList`, `setProtection`, `setNotWorking`, `markNoBreaker`), answers (`powerOutHelp`, `devicesOnBreaker`, `otherSwitches`, `changesSince`, `describeProject`), labels (`fixLabelCollisions`, `platesToRewrite`, `confirmPlate`, `swapLabels`), `restoreSnapshot`, and a `breakersCsv` plus extra device CSV columns. The merge summary reports changed and removed items.

**Open questions for Josh, in priority order** (full text under Questions for Josh below)
1. Q6, Recently deleted screen: recommendation is not in v1.
2. Q1, replacing a floor picture after placing things: recommendation is keep the warning only.
3. Q4, mixed-type switch plates: recommendation is leave for v1.
Also from the spec's own Open items: the repo name and local folder, and the go-ahead to create the public GitHub repo and turn on Pages.

Nothing was committed, no repo was created, no dependencies were added.

## Stories walked
- [x] 1  [x] 2  [x] 3  [x] 4  [x] 5  [x] 6  [x] 7
- [x] 8  [x] 9  [x] 10  [x] 11  [x] 12  [x] 13  [x] 14
- [x] 15  [x] 16  [x] 17  [x] 18  [x] 19  [x] 20  [x] 21

(Story K was walked in round 2K-1. Pass B rounds are the even numbers.)

Pass B done for: first launch, Setup, tab bar, modes/undo (round 2); Setup rooms tracing, Place basics (round 4); room page, outline editor, delete room (round 6); Add tab, palette, banner (round 8); switch count, 240 V pick lists (round 10); Something else naming, palette (round 12); marker sheet and Move mode (round 14); Switches/Link screens (round 16); Breakers/panel screens (round 18); Test screen (round 20); GFCI and Not working additions (round 22); Breaker row and Still assigned step (round 24); Export/Import and the header chip (round 26); Import preview wording (round 28); plates-to-rewrite list (round 30); Power out? card (round 32); breaker page and switch details (round 34); print preview and door card (round 36); first launch and backup nudge (round 38); floors add/delete (round 40); offline and updates (round 42); the whole spec text re-read (round 44); screen space and motion (round 56)

## Questions for Josh
1. Replacing a floor's picture after things are placed. Positions are pixels of the old picture, so a different-sized picture shifts everything. v1 now warns and asks. Recommendation: keep it at the warning; offer "stretch existing items to fit" only if it comes up in real use (needs image width/height stored on the floor).
2. RESOLVED (rounds 2 and 3): tab labels are now plain words (Floors, Add, Switches, Breakers, Map) and there are five tabs.
3. ANSWERED by Josh: yes, five tabs. Test is now opened from a breaker's page in Breakers. Applied to the spec after round 2. Plans 2-4 should treat Test as a sub-screen of Breakers (`view/test.js` stays).
4. Mixed plates. One plate holds one type, so a 3-gang with a dimmer, a 3-way and a plain switch can only be one of them (the others go in the note). 3-way and 4-way are also derivable from the links. Recommendation: leave it for v1; if it bites, replace the single `type` for switches with an optional per-toggle kind list. Low priority.
5. ANSWERED by Josh (round 18): "idk what numbering his uses, or how many it has". Resolved without needing the answer: Add panel has a Numbering choice (A odd/even, B down the sides) with small drawings and a "not sure, pick A, change later" default, and the space count can be changed later (never below a space that has a breaker). See round 18.
6. "Recently deleted" (a trash that keeps deleted floors, rooms and devices for 30 days). Round 39 used Undo, a "Save a copy first" button and a kept floor picture instead. A trash would survive closing the app, which Undo does not. Needs a decision: it is a new screen and keeps deleted records on the device. Recommendation: not in v1; the copy-first button covers the worst case (deleting a whole floor), and the backup nudge exists.

Answered by Josh on 2026-10-08: Q1, his dad may well sketch by hand and replace it with a proper drawing later, so v1 gets a two-spot "Line up the new picture" step (`refitFloor` in the model; spec Screens > Setup). Q4 and Q6: go with the recommendations (not in v1).

---

## Round 1 - Pass A story 1 (Mac, empty app to named house, two floors from a photo and a PDF)
1. Dad opens the site on the Mac. Spec says Browse is the default view, but nothing exists, and nothing says who creates the project or when. He would see an empty map and six tabs.
2. He needs to name the house: Setup has "House name", but he has to find Setup first.
3. Add floors: "Add, rename, reorder floors" with no say on how. Typing names is fine; reorder with no mechanism (dragging is bad one-handed).
4. Choose a photo: file types and phone-camera rotation not stated; HEIC photos from the iPhone may not open in Chrome on the Mac.
5. Choose a PDF: "choose a PDF page" with no way to see which page; a multi-page PDF needs thumbnails.
6. Floor with no picture yet: spec silent on what Place and Browse show.
7. Replace a picture later when things are already placed: positions are pixels of the old picture, spec silent.
8. A phone opened first time while the Mac already has data would create a second project with a different id, and a later import would offer replace/cancel. He needs an import option on the very first screen.
9. Plan check: `addFloor` used `order = floors.length`, which duplicates an order after any floor is deleted. No function exists to reorder floors, nor a stable sort.

Findings
- [fixed in spec] First launch: welcome screen with house name, Start, and "I already have a project file" (adopts, no merge prompt on an empty device); Setup checklist; opens on Setup until a floor has a picture.
- [fixed in spec] Floor add suggestions; Move up / Move down buttons; lowest floor first.
- [fixed in spec] Picture types, camera rotation, PDF page thumbnails, Rotate buttons, "Preparing picture...", empty floor state, replace-picture warning, unreadable picture error.
- [fixed in plan] `addFloor` uses max order + 1; added `sortedFloors` and `moveFloor`, with tests.
- [question] Q1 above.

Spec sections changed: Screens (new First launch paragraph, Setup), Errors and edge cases.
Plan changed: Task 4 (`model.js` floors; two tests added in `tests/model.test.js`; test count in later "Done when" lines is now 47, not 45).

## Round 2 - Pass B screens: first launch, Setup (floors, picture, rooms), tab bar, modes, undo
1. Tab labels: "Setup", "Place", "Link", "Panel", "Browse" mean little to a homeowner. Relabelled on the tab bar as Floors, Add, Switches, Breakers, Test, Map; working names kept in code and plans.
2. Welcome field: "My house" prefilled would need deleting first; now selected so typing replaces it.
3. Room tracing: "tap the first corner again to close" is a tiny, hidden target for one hand. Added a Finish room button (after 3 corners), Undo corner, Cancel, and a banner naming the mode. Empty rooms state worded.
4. Modes were invisible (placing vs moving vs linking vs tracing). Added a mode banner with a big Done on every plan tab; colour never the only signal.
5. Placing a room's outlets: fixture stays selected after each tap, so it is one tap per outlet.
6. Undo was "last action" only and delete was confirm-only. Now a visible multi-step Undo (20 steps, named), delete of a device is undo-toast, rooms/floors/panels/breakers still confirm. Undo restoring old timestamps would be deleted again by merge on the other device, so it re-stamps (see plan).
7. Touch: 44 pt targets, 16 px text (Safari zooms smaller inputs), markers draw small but tap big, ambiguous taps show a pick list.
8. Phone vs Mac layout: bottom tab bar and bottom sheets on phone; top tabs, side panel and keyboard shortcuts on Mac.
9. Dark mode and picture contrast: picture never inverted, markers get light and dark outline; print always black on white.
10. "Export/Import" are jargon: menu items now "Export (send or back up)" and "Import (open a file)".

Findings
- [fixed in spec] items 1-10 above (new "Using it: modes, undo, size, layout" section; Screens intro, Setup, Place, Browse).
- [fixed in plan] `restoreSnapshot(project, snap, now)` in model.js with a test (11 model tests, 48 total).
- [question] Q2/Q3 (five tabs).

Spec sections changed: Screens (intro, Setup, Place, Browse), new "Using it", unchanged elsewhere.

## After round 2 - Josh answered Q3
- [fixed in spec] Five tabs (Floors, Add, Switches, Breakers, Map). Test is a sub-screen opened by "Test this breaker" on a breaker's page, with Back to breakers. Panel section now describes the breaker page.

## Round 3 - Pass A story 2 (Mac or phone, Floors tab: trace and name rooms; L-shaped room; closet inside a room)
1. Floors tab, pick floor, Add room, type "Kitchen": code KIT suggested. If he types a lowercase or taken code, the model throws a developer message; spec said nothing about the field.
2. Taps corners on the picture. A drag to pan would also be read as a corner; zoom while tracing unstated.
3. He taps corners in a crossing order (a bow-tie) and finishes. Nothing in spec or model rejected it, and point-in-outline would then give wrong rooms.
4. L-shaped room: six corners; fine for room lookup. But the name label "in the middle" can land outside an L.
5. Closet inside bedroom: both outlines contain every tap inside the closet, so the spec's rule ("where outlines overlap asks which room") would ask on every closet placement. Plan `roomsAt` had no notion of nesting.
6. After finishing a room he is left on an unspecified screen; no "add the next room" cue.
7. A tiny closet on the phone is hard to trace at default zoom.

Findings
- [fixed in spec] Code field auto-capitalises, explains taken codes; pan vs corner; zoom while tracing; crossing outline refused with plain message; "Kitchen added. Add another room"; label placed inside the outline; nested rooms: innermost wins, partial overlap still asks.
- [fixed in plan] `outlineCrossesItself`, `setOutline` (min 3 corners, no crossing), `roomAt` (innermost wins, else choices) with 2 tests (13 model tests, 50 total).

Spec sections changed: Screens > Setup, Place.

## Round 4 - Pass B screens: Floors (floor page, rooms, tracing), Add basics
1. Floors tab was one long paragraph: no list, no per-floor page, no sense of progress. Now: list rows (name, picture yes/no, "N rooms"); floor page with Picture, Scale, Rooms.
2. "Short code" means nothing to him. Relabelled "Label code (used on labels like KIT-01)".
3. Scale entry "feet and inches" would invite typing quote marks. Two number boxes, feet and inches.
4. Mode banner and its Done/Finish button at the top of a tall phone is out of thumb reach: banner now sits above the tab bar on the phone, top on the Mac. Tracing ends with "Finish room", other modes "Done".
5. A finger hides the spot being placed or the corner being dragged: marker drawn above the fingertip while dragging.
6. One-handed pinch is hard and double-tap zoom would place two markers: + / - / Fit buttons added, double tap never zooms.

Findings
- [fixed in spec] items 1-6 (Screens > Setup, Using it).
- [fixed in plan] none needed.
- [question] none new.

Spec sections changed: Screens > Setup, Using it.

## Round 5 - Pass A story 3 (Mac, Floors tab: fix a badly drawn room; rename a room that has fixtures)
1. Floors tab, floor, Rooms list, taps Kitchen. Spec had no room page and only "corners can be dragged". He cannot add a missed corner, remove a wrong one, or start over.
2. He fixes the outline. Fixtures already placed keep their x/y and roomId, so some now sit outside the outline, others now inside it. Spec silent; he would not know.
3. He renames Kitchen to Dining. Labels are KIT-07 and written on cover plates, so labels and code must not change. Spec silent; plan `update` would have let a view change the code and silently break the "labels are permanent" rule.
4. He gives up on a bad outline and deletes the room to redraw it. Plan `remove(rooms)` cascaded to every fixture in it, losing his work, with only a confirm. (Merge rule already allows devices with no room.)
5. Plan check: my round-3 and round-2 tests placed in Task 4's test file call `placeDevice`/`remove`, which only exist after Task 5. Moved to the Task 5 test file.

Findings
- [fixed in spec] Room page (Name, Label code, Edit outline, Delete room); edit-outline banner (move, add, remove corner, Start over); mismatch notice with Review; rename keeps code and labels; code locked once devices exist, with wording; delete room offers Keep the devices / Delete the devices too / Cancel (Setup, Errors, Using it).
- [fixed in plan] `editRoom` (code lock, pattern, unique), `outlineMismatches`, `removeRoom` (keeps devices by default); `remove(rooms)` no longer cascades to devices (floor deletes still do); restoreSnapshot test moved to Task 5; test counts now 12 in Task 4 and 53 overall.
- [question] none new.

Spec sections changed: Screens > Setup, Using it, Errors and edge cases.

## Round 6 - Pass B screens: room page, edit outline, mismatch notice, delete room
1. "Tap a corner to remove it" collides with dragging a corner: a slightly off drag removes a corner. Now: tap selects and shows Remove corner; "+" handles on lines add corners.
2. Delete room had three equal buttons; the destructive one must not sit beside the safe one. Keep the devices is the main button, Delete the devices too is a separate plain text button; no-device rooms get a simple Delete/Cancel; Undo follows.
3. Mismatch notice said "outlets" though the devices can be anything: now "devices". Added a Move all to Kitchen for the inside group (keeps labels) so the common fix is one tap, plus an empty state.
4. Greyed code field with no explanation looks broken (and low contrast in dark mode): plain text with the reason under it.
5. Name field save moment unstated: saves when he leaves the field or taps keyboard Done.
6. Rooms list now shows "N devices" and "no outline" as words; Start over is undoable with a toast.

Findings
- [fixed in spec] items 1-6 (Screens > Setup).
- [fixed in plan] none needed (Move all is a loop of existing `update`s in the view).
- [question] none new.

Spec sections changed: Screens > Setup.

## Round 7 - Pass A story 4 (iPhone, Add tab: walk one room and place every outlet, switch and light)
1. Opens on Map, taps Add, picks the floor, zooms to the room. Palette on a phone: spec only said "palette"; 25 types does not fit beside the plan and banner.
2. Picks Duplex outlet, banner says Placing, taps the first outlet. Where does the label show? He needs KIT-01 to write on the plate. Spec: assigned, not shown.
3. Taps outlets one after another: each placement stays in the same fixture (round 2 fix). But a tap near an existing marker: place or select? And a double tap places two.
4. Switches to a switch, then back to outlets repeatedly: needs a fast switch between fixtures.
5. Room has no outline (or he is outside every outline, or no rooms exist): spec asked "which room" on every tap, so ten taps, ten questions; with no rooms at all, the list is empty and he is stuck.
6. Phone auto-locks every 30 s mid-walk; he re-unlocks and has to find his place.
7. How does he know the room is done? No count anywhere.
8. Plan check: `placeDevice` needs a room (matches the new New room step); `addRoom` and `suggestCode` already support creating a room with no outline.

Findings
- [fixed in spec] Phone palette sheet plus recent-four row; label and room device count shown after each tap; placing taps always place, near-duplicate tap ignored; room question remembered for the run, Change room button, New room option; wake lock on Add and Test; no edit sheet while placing.
- [fixed in plan] none needed.
- [question] none new.

Spec sections changed: Screens > Place.

## Round 8 - Pass B screens: Add tab (palette, mode banner, placement feedback)
1. "Choose fixture" and "fixture" are trade words; relabelled "What are you adding?", banner now "Adding: ..." to match the tab name.
2. Type names he may not know (GFCI, 3-way, dimmer, junction box): one-line plain hints on their palette buttons. Plan catalog name "240 V receptacle" changed to "240 V outlet".
3. Add tab with nothing chosen had no cue: banner now says what to do.
4. Phone bottom banner was overloaded (mode, result, Change room, Done, Undo). Now two lines (mode with the room name as the change-room button, then the result); Undo moves into the bottom bar beside Done on the phone since a header Undo is out of thumb reach.
5. No confirmation that a tap landed: new marker pulses with its label; label visibility rule on the Map (when zoomed in enough, always on tap).
6. Checked and left alone: palette glyph plus word (colour not sole signal), 44 pt targets, one-line recent row fits 375 pt.

Findings
- [fixed in spec] items 1-5 (Place, Using it).
- [fixed in plan] catalog name for type R.
- [question] none new.

Spec sections changed: Screens > Place, Using it.

## Round 9 - Pass A story 5 (iPhone, Add tab: 3-gang plate, half-switched outlet, 240 V dryer receptacle)
1. 3-gang plate: he picks Switch and places it. Toggles default to 1 and the spec only says the count can be edited later on the marker, so he must place, Done, tap the marker, find the count. Also nothing says which toggle is number 1 on a plate, which he needs at the Switches tab.
2. Reducing a plate from 3 to 2 would leave links to toggle 3 dangling (plan `update` allowed it).
3. Half-switched outlet: place a Duplex outlet; "top/bottom" belongs to linking (story 8). Nothing to do at placement, fine. But at the breaker test a switched light or outlet half looks dead when its switch is off, giving a wrong answer.
4. 240 V dryer receptacle: catalog lists dryer/range/EV/other but no screen offers them. Plan has one type R; `placeDevice` already takes `customName`, so the pick can fill the name.
5. Hard-wired appliance had the same gap (water heater, furnace...).
6. Plan check: `placeDevice` could not set a toggle count, and nothing enforced 1-4.

Findings
- [fixed in spec] switch-count buttons in the Add banner; toggle 1 is leftmost/top; 240 V and Hard-wired pick lists fill the marker name; confirm before cutting toggles that have links; Test starts with "turn every light switch on".
- [fixed in plan] `placeDevice` takes `toggles` (1-4 checked); `setToggles` and `linksOnRemovedToggles`; one test (model-devices; 54 total).
- [question] Q4 below.

Spec sections changed: Screens > Place, Test.

## Round 10 - Pass B screens: Add banner with switch count, 240 V / hard-wired pick lists, Link wording
1. The switch-count buttons would have gone into an already full banner: now a separate row above it; 44 pt each; selected shown by fill plus tick, not colour alone.
2. "Toggle" is a builder word and showed up in the Link banner, the Link section and the marker edit sheet. Replaced with "switch 2 on KIT-01" / "number of switches" in everything he reads (the data model keeps `toggles`).
3. "Switch 3 controls 1 light. Remove it?" is ambiguous (remove what?). Now says what happens, with buttons "Take it off" and "Keep 3 switches".
4. A plate's size was invisible on the plan: the marker shows its switch count.
5. 240 V and hard-wired pick stays selected, banner names it, so repeated placements do not re-ask.
6. Same selected-state rule (outline and tick, not colour) for the recent row.

Findings
- [fixed in spec] items 1-6 (Place, Link, Using it wording).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Place, Link, Using it.

## Round 11 - Pass A story 6 (iPhone, Add tab: attic fan and sump pump, which are not in the palette)
1. Opens "What are you adding?". The spec's catalog has a Custom group, but the plan's catalog had no such group; type X was an "Other" button in the Other group, named "Other". He would see two things called Other and no way to name one.
2. What happens when he picks it is unwritten: no name prompt, no suggestions; typing "Sump pump" every time for each of two or three placements is tedious on a phone.
3. What a custom item can do is unwritten: is it in the breaker test, can a switch control it, what marker? A sump pump is on a circuit like anything else; it must be in the test list.
4. Empty name would show as a blank row.
5. Plan check: `placeDevice` already takes `customName`; `displayName` shows it; sweep is true for X, so the test lists it. Missing: the palette group and a source for "names used before".

Findings
- [fixed in spec] Catalog row renamed "Something else"; prompt "What is it called?" with suggestions and his own earlier names; empty name refused; behaves as a power-using load (breaker test, switchable, triangle).
- [fixed in plan] `GROUPS` gets "Something else"; type X renamed and moved into it; `recentCustomNames` with a test (55 total).
- [question] none new.

Spec sections changed: Fixture catalog, Screens > Place.

## Round 12 - Pass B screens: palette sheet, Something else naming, marker shapes
1. With 25 types in four groups, Something else would be at the end of a long scroll. It is now pinned at the foot of the sheet.
2. The name prompt on a phone: keyboard covers half the screen. Field focused on open, suggestions directly above the keyboard, keyboard key labelled Done, tapping a suggestion chooses it in one step; autocorrect off so "sump" is not rewritten. Mac: a field in the side panel, no sheet.
3. Nothing explained marker shapes and marks (circle, square, diamond, triangle; tested, guessed, dead) after the palette is closed. Added a Key in the Map menu in words.
4. Checked and fine: "Something else" and "What is it called?" read plainly; suggestions are 44 pt chips; the recent row shows names, not only glyphs.

Findings
- [fixed in spec] items 1-3 (Place, Browse).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Place, Browse.

## Round 13 - Pass A story 7 (iPhone, Add and Map tabs: wrong spot, wrong type, wrong room)
1. Wrong spot just placed: Undo. Wrong spot found later: "Drag to move" with no mode, so a swipe to pan the plan can drag a marker by accident. Spec had a "Moving" banner but no way to enter it.
2. Wrong type: spec lists "edit type", but the plan's `update` would change `type` alone and leave a 3-gang's toggles, a stale height (48 in on an outlet that became a light), links on a switch that is now a light, and a breaker on a thing that cannot have one.
3. Wrong room: the sheet had no Room row at all (only moving across an outline offered relabel). Plan had no way to change a device's room except raw `update`, no floor check, no relabel.
4. The Map tab said "tap a device for its details" but could not edit; the edit sheet was described only for Add.
5. Wrong floor (placed while viewing the basement): no move-to-floor; he would delete and re-place, which costs a label. Judged acceptable, not added.

Findings
- [fixed in spec] Sheet contents (type, room, height, note, switches, Move, Delete) from Add or from Map's Edit; Move mode only; room change asks keep/relabel with the new label shown; type change asks before losing links or breaker, keeps an edited height.
- [fixed in plan] `changeType`, `linksLostByTypeChange`, `setRoom` with two tests (57 total).
- [question] none new.

Spec sections changed: Screens > Place.

## Round 14 - Pass B screens: marker sheet, Move mode (and the Place section as a whole)
1. The Place section had grown into one 40-line paragraph with rules in no order (the room rule sat between the switch-count row and the move rule). Hard for Josh to review and for Plans 2-4 to build from. Rewritten as titled bullets (Choosing, Switch plates, 240 V and hard-wired, Something else, Placing, Which room, The marker sheet, Changes made in the sheet, Moving) with every earlier rule kept.
2. The sheet itself had no layout. Now: opens over the lower half so the marker stays visible; label shown large for writing on plates; rows Type, Room, Height, Note, Switches; saves at once, Done not Save; Move as button, Delete apart as plain text plus Undo toast.
3. Height: typing inches on a phone for every device is slow and blank means ceiling: numeric field plus quick buttons 12, 18, 48, Ceiling.
4. Move mode: the cross-room relabel question would pop up mid-drag. Now asked when he taps Done, worded with the new label.
5. Checked and fine: Move and Delete are different buttons and Delete is set apart; sheet rows are 44 pt.

Findings
- [fixed in spec] items 1-4 (Place restructured; no rule dropped).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Place.

## Round 15 - Pass A story 8 (iPhone, Switches tab: what each switch controls; hallway light on two 3-way switches on different floors)
1. Opens Switches. Spec: "Tap a switch, then tap each load". Where does the list "not yet known" live and how does he know how far along he is? Unwritten.
2. Taps a 3-gang plate: "pick a toggle" with no screen described, and "toggle" is not his word.
3. Hallway light, two floors: downstairs switch to the light is easy. The upstairs switch is on another floor. Spec silent on whether the floor switcher works while linking. Without it he cannot link across floors at all.
4. Half-switched outlet: "Outlets offer whole / top / bottom" and "tap again to unlink" collide for an outlet already linked as Top: which link does the second tap remove? Plan allowed Whole and Top from the same switch together, and allowed Top on a ceiling light.
5. Nothing says how he sees what is already linked (no wall drawing, so no wires): needs ring, tick, line.
6. He may think from the light ("what switches this?"), not the switch. Spec offered only switch-first.
7. In dense areas he could tap another switch as a "load". Plan `toggleLink` accepted a switch as a load, a non-switch as the switch, and toggle numbers the plate does not have.
8. Plan model check: link {switchId, toggle, loadId, loadPart} holds two switches on one light and links across floors; no change needed there. Needed: validation and halves rules.

Findings
- [fixed in spec] Link section rewritten as bullets: header count and "Not yet known" list; plate sheet; dimmed non-loads; ring, tick and line on linked loads; floor switcher works while linking, with the cross-floor 3-way walkthrough; Whole/Top/Bottom sheet with ticks and the replace rule; "Switched by" from the load.
- [fixed in plan] `hasHalves` in catalog; `toggleLink` refuses a non-switch as switch, a switch as load, a toggle the plate lacks, halves on non-outlets, and makes Whole and halves replace each other; two tests (59 total).
- [question] none new.

Spec sections changed: Screens > Link.

## Round 16 - Pass B screens: Switches (Link) tab
1. "Not yet known" is a status word, not an action; the button opens a to-do list. Relabelled "Still to do (3)". Count rule stated (every switch on every plate), and an all-done state with a "Next: test your breakers" button, which was the missing what-next cue.
2. Dimming other switches would make him think the app froze when he taps one to change the pick. Switches stay tappable (tapping another switch changes the picked one); only panel, subpanel and meter are dimmed, with a spoken reason when tapped.
3. Unlinking something on another floor needed a floor change. Banner tap opens "What it controls", a list with Remove buttons (also a non-spatial way to review, helpful on the Mac).
4. Outlet halves sheet is an extra tap for the usual case: Whole is the first, largest button.
5. Checked and fine: ring plus tick plus line (not colour alone), 44 pt rows, Undo steps named by the general rule.

Findings
- [fixed in spec] items 1-4 (Link).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Link.

## Round 17 - Pass A story 9 (Breakers tab, standing at the panel or at the Mac: 20 spaces, two double-pole breakers, one tandem, a garage subpanel)
1. Opens Breakers: spec said "Add panels" with no empty state; "slot count" is not a word on the panel door; "main size" unlabelled.
2. Enters breakers "by slot". No picture of the panel, so no way to see which spaces are done, and no idea how a double-pole pair is chosen (two slots one above the other).
3. Tandem: stored as "7a"/"7b", but what does he tap? Unwritten. Shown to him as "7a"? He would not know a is the top.
4. Spaces with nothing in them: no way to say "empty", so he can never reach "all done" and unknown looks the same as empty.
5. Typing a label, amps and kind for 20 breakers: no fast path down the door label.
6. Garage subpanel: data model has fedFromBreakerId but no screen mentions it. Nothing stops a panel being fed from itself.
7. Linking a panel record to its marker on the plan (plan field deviceId): unwritten.
8. Plan check: `addBreaker` accepted slot 99 on a 20-space panel, slot 0, and any kind text; no count of entered spaces; no feed-chain check.

Findings
- [fixed in spec] Panel section rewritten as bullets: empty state; Add panel wording (spaces, main size, make); subpanel "Fed from"; panel drawn as two columns with entered count; entering sheet with label first, amps chips, kind with plain hints, two spaces together, tandem shown "7 top/7 bottom", "No breaker here", Save and next space; placing a panel marker asks "Which panel is this?"; kind gains "empty" in the data model text.
- [fixed in plan] `BREAKER_KINDS`; `addBreaker` checks the panel, the kind and the slot against the panel size; `slotsEntered`; `setFedFrom` with a loop check; one test (60 total).
- [question] Q5 (numbering style).

Spec sections changed: Data model (kind), Screens > Place (Panels), Panel.

## Round 18 - Pass B screens: panel picture, breaker entry sheet, breaker page
1. Tandem halves would be drawn half-height, under the 44 pt target. Tandem spaces are drawn twice as tall; double breakers one tall box. Rows at least 44 pt, text 16 px.
2. "Not yet entered" and "empty" must look different and not by colour: "tap to add" versus "empty (no breaker)" in a dashed box. GFCI and AFCI shown by word.
3. Entering 20 breakers: with the keyboard open the amps and type buttons and the Save button are covered. Fix: amps and type default to the last used, the keyboard key reads "Next space" (saves and advances), so a normal breaker is one field.
4. Double-breaker pairing is a mode: banner "Tap the other space for this double breaker", only pairable spaces tappable.
5. "Fed from" and "Kind" are builder words: "Which breaker feeds this panel?" and "Type of breaker". Long door labels: two lines then cut off, full text on the breaker's page.
6. Several panels: a switch across the top (Main panel | Garage subpanel), same idea as the floor switcher. Header "17 of 20 spaces entered" stays visible while scrolling.
7. A breaker with nothing found on it: a what-next sentence, not a blank list.

Findings
- [fixed in spec] items 1-7 (Panel).
- [fixed in plan] none.
- [question] none new. Q5 closed by round 18b (below).

Spec sections changed: Screens > Panel.

## Round 18b - Josh said he does not know his dad's panel numbering or space count
- The honest design answer is that the app must not depend on knowing either up front.
- [fixed in spec] Panel record gets `numbering`. Add panel: "Not sure? Count the breaker positions down one side and double it. You can change this later", Add more spaces on the panel page (never below a space with a breaker), and a Numbering choice with two small drawings (A "1 and 2 side by side, then 3 and 4"; B "1 to the middle down the left, the rest down the right"), default A, "Not sure? Pick A; you can change it." Changing it only redraws the picture, because slots are stored as text.
- [fixed in plan] `addPanel` takes `numbering` (checked), `canPair(panel, a, b)` for the double-breaker pairing mode, `setSlotCount` (cannot shrink past a breaker); one test (61 total).
- Suggestion, not needed: when dad is at the panel, a photo of the door will settle both questions in ten seconds.

## Round 19 - Pass A story 10 (iPhone, Breakers then Test: alone, switch a breaker off, walk every floor, mark what is dead, switch it back on, next breaker)
1. Breakers, panel picture, tap breaker 7, big Test this breaker. Test screen was one sentence. Order given: "turn every light switch on, flip the breaker off, reset any GFCI". Resetting a GFCI after the breaker is off is impossible (no power), and a tripped GFCI left unreset would make its downstream outlets look dead. Reset belongs before the breaker goes off.
2. He is alone, so the breaker stays off for as long as he walks. Nothing reminds him to switch it back on; leaving the app mid-test leaves the house with a dead circuit (a freezer, perhaps).
3. A long list of every device is slow to scan. Walking floor by floor he wants the plan, and rooms where everything is dead need one tap, not twelve.
4. "Progress shows tested / total" counted devices, not breakers. After breaker 7 finds nothing (a spare, or a circuit that feeds nothing recorded), the app had no way to know breaker 7 was done, so "next untested breaker" was impossible. Plan breaker had no `swept`.
5. Dead is shown how? Tap sets breakerId; no word or mark.
6. A breaker that feeds a subpanel (the garage): flipping it kills everything there, and marking devices dead would assign them to the feed breaker, not to the subpanel breaker they are really on.
7. Plan check: no function gave the test list order ("rooms that already have devices on this breaker first") or the list of breakers left to test.

Findings
- [fixed in spec] Test section rewritten as bullets: header counts (breakers tested, devices on a breaker); five tick-box steps with GFCI reset before switching off, why shown; OFF banner until step 5 and a "back on?" question on return; List | Plan; "No power" cross and words; "All dead in this room"; Done summary, tested even if nothing found, "Next untested breaker"; subpanel feed breaker redirects to the subpanel's breakers. Data model: breaker `swept`.
- [fixed in plan] `swept` on breakers; `markSwept`; `unsweptBreakers`; `sweepList` with the room order rule; two tests (63 total).
- [question] none new. Still to cover in story 12: devices assigned to this breaker (a guess, or an earlier test) that are not marked dead this time.

Spec sections changed: Data model (breaker, swept), Screens > Test.

## Round 20 - Pass B screens: Test (breaker sweep)
1. Five tick-box steps plus a long list do not fit one phone screen. Now three steps; ticking the third shrinks them to a bar "Breaker 7 is OFF" whose big "I've switched it back on" button is the fourth step. The bar is the safety net: it shows on every screen and survives closing the app.
2. Steps that cannot apply (no GFCI outlets recorded) would be a dead end: "None recorded", counts as done. Counts shown ("4 recorded").
3. "Is breaker 7 back on?" needed its answers: Yes, it's back on / No, not yet.
4. "All dead in this room" is builder wording and one tap marks many: renamed "Whole room has no power", with "Marked 7 devices. Undo". List is the default and the choice is remembered.
5. A line "Keep it short if a freezer or fridge is on this breaker" at step 3.
6. "On a breaker: 41 of 63" reworded "41 of 63 devices have a breaker".

Findings
- [fixed in spec] items 1-6 (Test). The OFF-bar state is view state on the device, not in the project file.
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Test.

## Round 21 - Pass A story 11 (iPhone, Test: a GFCI that trips downstream outlets; a light dead for no clear reason; an outlet dead on every breaker)
1. GFCI downstream: the app had no way to say which outlets sit behind a GFCI. During a breaker test the GFCI and its outlets all go dead; he would have to find and tap each. And later (story 16) "power is out in a room" should say "try the GFCI Reset first". Nothing recorded it.
2. A light dead because of a bulb: it is dead under every breaker test, so he would tap it as "no power" on the first breaker he tests and the app would pin it to that wrong breaker. Nothing separates "off for another reason" from "on this breaker".
3. An outlet dead on every breaker (tripped GFCI, loose wire, a switch that is off): on the second test he taps it again; the spec's "already tested on another breaker, asks before moving it" gave only Move or not, with no honest third answer.
4. Plan check: devices carried no GFCI link or working flag; removing or retyping a GFCI would have left dangling references; the merge tidy-up did not know about them.

Findings
- [fixed in spec] Data model: device `gfciId` and `notWorking`. Marker sheet: "Behind a GFCI outlet" and "Doesn't work right now". Test: marking a GFCI offers "Also mark the N outlets it protects?"; not-working devices are left out, shown in a collapsed "Not working (N)" group; conflict question has Move it / Keep it on breaker 3 / "It has no power for another reason" (clears the breaker, flags Not working).
- [fixed in plan] `gfciId` and `notWorking` on devices; `setProtection`, `protectedBy`, `setNotWorking`, `notWorking`, `markNoBreaker`; `sweepList` skips not-working devices; `remove`, `changeType` and merge tidy-up clear dangling GFCI references; three tests (66 total).
- [question] none new. For story 16 (power out in a room): suggest the GFCI Reset first, using `gfciId`, and mention Not working devices.

Spec sections changed: Data model (device), Screens > Place (marker sheet), Test.

## Round 22 - Pass B screens: marker sheet with the GFCI and Not working rows, Test conflict questions
1. The marker sheet had grown to Type, Room, Height, Note, GFCI, Not working, Switches, Move, Delete in a half-height sheet. Common rows stay (Type, Room, Note, Switches); Height, GFCI and Not working move under a "More" row.
2. Not working as a bare toggle gives no reason and carries no words: shown "On / Off", and turning it On moves the cursor to Note with a hint, so the reason is captured.
3. Naming the downstream outlets from each outlet's sheet is slow. The GFCI's own sheet has "Protects 5 devices - Change", a mode like linking (banner, ring and tick on each, Done), and he knows which outlets die when a GFCI trips better than he knows anything else about it.
4. Not working group rows had no way back: "Working now" button on each row.
5. Conflict question: said "was found on breaker 3"; clearer "was dead when breaker 3 was off too", with Move it as the main button, Keep it beside, and the third answer set apart as plain text.
6. "Also mark the 5 outlets it protects?": Yes is the main button.

Findings
- [fixed in spec] items 1-6 (marker sheet, Test).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Place (marker sheet), Test.

## Round 23 - Pass A story 12 (iPhone, Test: last week he guessed a breaker for an outlet; today's test says otherwise)
1. Where did last week's guess come from? The data model has "tested false = a typed guess", but the marker sheet had no Breaker row, so no screen let him type one. He could not have made the guess the story starts from.
2. Today he tests the real breaker and the outlet goes dead. He taps it. It moves from the guess to this breaker. The earlier rule only handled "already tested on another breaker" and the wording of my last conflict question could be read to include guesses. A guess must be replaced without a fuss, but he should be told.
3. The reverse: a device guessed on breaker 12 stays powered when 12 is off. Nothing flags it; the wrong guess stays forever and the printed directory would be wrong. The same for a device "found" by an old test on a circuit that has since been changed.
4. In Browse, "its circuit" gave no way to tell a guess from a tested result. Colour is not enough; words needed.
5. Plan check: `setBreaker` accepted a breaker id that does not exist; nothing computed "assigned here but still had power".

Findings
- [fixed in spec] Marker sheet "Breaker" row (Not known / Guess / Tested; a pick there is always a guess); conflict question only for devices found by an earlier test; "Still assigned here" step with Take it off / Keep; Done summary names devices moved from a guess; Browse shows "Breaker 12, tested" or "Breaker 7, guess".
- [fixed in plan] `setBreaker` checks the breaker exists; `unconfirmedOnBreaker`; one test (67 total).
- [question] none new. Story 18 (printed directory) should mark guesses.

Spec sections changed: Screens > Place (marker sheet), Test, Browse.

## Round 24 - Pass B screens: marker sheet Breaker row, "Still assigned here" step
1. The breaker picker would list up to 40 breakers across panels as plain rows. The panel picture already exists: it is the picker, with the panel switch and Not sure at the top.
2. "Guess: 7 Kitchen" read like a time or a score. Wording made one format everywhere: "Breaker 7 (Kitchen), guess" / "Breaker 12 (Kitchen), tested" / "Not known".
3. "Still assigned here" would treat a device on a floor he never walked as "still had power". He now ticks "I've checked this floor" per floor, and only ticked floors count. Plan: `unconfirmedOnBreaker` takes the checked floors.
4. The step must not be a trap at the end of a tiring walk: Keep all at the foot skips it, each group has Take them all off, each row Take it off (main) and Keep it. Words "Guess" / "Found by an earlier test" on every row.

Findings
- [fixed in spec] items 1-4 (marker sheet, Test).
- [fixed in plan] `unconfirmedOnBreaker(project, breakerId, deadIds, checkedFloorIds)`, test updated (still 67 total).
- [question] none new.

Spec sections changed: Screens > Place (marker sheet), Test.

## Round 25 - Pass A story 13 (iPhone to Mac: finish a session on the phone, get it onto the Mac, add notes there)
1. Phone: Map, menu, "Export (send or back up)": Share sheet, AirDrop to the Mac. Plan idea: `navigator.share` with a custom file type is refused on iOS; spec said nothing about a fallback or the MIME type.
2. Mac: the file arrives in Downloads. Spec: "On the Mac it downloads." He is not told where it went or what to do next (it cannot be opened by double-click, since a web app has no file association).
3. Mac: Import. The iPhone and Mac file pickers: a picker that filters on `.circuitmap` greys out the file on iOS, which does not know the type. Dragging the file onto the window is the natural Mac move and was unwritten.
4. He imports and sees "added, updated, removed, renumbered": jargon, and no wording for "nothing new".
5. The big trap: the phone was started with Start instead of from the Mac's file, so the two devices hold different projects. The spec said Import then offers replace or cancel, with no word on what would be lost.
6. "Changes since last export" marker: no definition (since when? stored where? does an import count?).
7. No written steps anywhere for the two-device dance, which is the app's biggest hurdle for a non-technical user.
8. Plan check: nothing could compute "changes since" or describe a project for the different-project question.

Findings
- [fixed in spec] Saving section: export file handed over as JSON with download fallback, "Preparing file...", Mac "Saved to Downloads" message with AirDrop how-to; import summary in words with a "nothing new" case; picker not filtered; drag onto window; "Moving your project" help card with both directions; different-project question names both projects and offers "Save a copy first, then replace"; change marker defined.
- [fixed in plan] `changesSince`, `describeProject`, one test (68 total).
- [question] none new. Story 14 will check what happens if both devices changed since the last exchange.

Spec sections changed: Saving and moving between devices.

## Round 26 - Pass B screens: Export / Import, the moving-your-project help, the change marker
1. Export and Import lived in the Map tab's menu. The most important cross-device action was two taps away on one tab. There are five tabs and no room for another, so the marker became a chip in every tab's header ("12 changes not sent") that opens a "Move or back up" sheet with Send or back up (Export), Bring in a file (Import) and Moving your project.
2. Import applied the merge and then reported, which a cautious user will not trust, particularly when the file deletes things. Now it shows "From the file: 12 new, 3 changed, 2 deleted, 0 relabelled. Bring them in?" first, nothing changes until Bring them in, then "Done" with Undo import (the undo snapshot already exists in the plan).
3. When does the chip reset? Defined: when the Share sheet reports done or the Mac download starts, not when the sheet is merely opened or cancelled.
4. The "nothing to do" case gets a single OK button.
5. Wording: Send or back up / Bring in a file lead; Export / Import stay in brackets so the words match what he may hear elsewhere.

Findings
- [fixed in spec] items 1-5 (Saving and moving between devices, Browse).
- [fixed in plan] none (the preview uses `merge`, which is pure; Undo import uses `restoreSnapshot`).
- [question] none new.

Spec sections changed: Saving and moving between devices, Screens > Browse.

## Round 27 - Pass A story 14 (Mac to phone: he forgot to export from the Mac, and has since added more on the phone)
1. Mac: Send or back up, AirDrop to the phone, Save to Files. Phone: header chip already says "9 changes not sent" (his phone work). He taps Bring in a file.
2. The preview says "3 changed". Changed how? On both devices he may have edited the same device's note; the newer one silently wins whole, and the older version is gone. The count was all he saw.
3. The preview gave no reassurance that his phone work survives, and no way to keep a copy of the phone's old state before the merge.
4. After "Done" the phone has everything from both, but the Mac still lacks the phone's new work. Nothing told him a second send is needed; the two devices would be out of step indefinitely.
5. Plan check: `merge` counted "updated" whenever the record text differed, including when only `updated` differed (the same edit made on both devices) and had no list of what changed or what was deleted.
6. Accepted, not changed: "newer wins" compares the two devices' clocks, so a clock that is a few minutes out can pick the wrong winner for edits made close together. Days apart (the real case) is safe.

Findings
- [fixed in spec] Import preview lists changed items with the fields that differ and deleted items by label; a one-line rule for clashes; "Save a copy of this device first"; after Done, "Send this project back to it?" when this device had unsent changes.
- [fixed in plan] `merge` summary gains `changed` (coll, id, name, differing fields) and `removedItems`; "updated" no longer counts records that differ only in their time; two assertions and one new test (69 total).
- [question] none new.

Spec sections changed: Saving and moving between devices (Import).

## Round 28 - Pass B screens: Import preview, clash wording, errors
1. The preview was built for the worst case (changed, deleted, warnings, three buttons) and would look heavy for the usual one: only new things. Zero counts are now left out, so the ordinary question is "From the file: 12 new. Bring them in?" and the extra line and button appear only when something is changed or deleted.
2. The changed list showed field names from the code (heightIn, breakerId, gfciId). Named in his words: label, type, name, room, position, height, note, breaker, test result, number of switches, GFCI, Not working.
3. "Save a copy first" must lead back to the question, not leave him in the Share sheet: it opens Export, then returns to the preview.
4. "Different project" is not how he thinks of it: "different house" (also matches the plan's own error text).
5. The newer-version message told him to "reload", which on a Home Screen app does not update it: now "Close the app completely, open it again, and try the file once more." Plan message changed to match.
6. Reading and applying states named ("Reading file...").

Findings
- [fixed in spec] items 1-6 (Saving and moving between devices, Errors).
- [fixed in plan] `file.js` newer-version message (test checks only the code).
- [question] none new.

Spec sections changed: Saving and moving between devices, Errors and edge cases.

## Round 29 - Pass A story 15 (either device: the import says two fixtures were renumbered, and he already wrote the old number on the cover plate)
1. Both devices placed an outlet in the Kitchen between exchanges, both got KIT-05, and he wrote KIT-05 on both plates. Merge rule 4 renumbers the later-created one to KIT-06 and reports it. The report was a count, and "later created" is not the plate he can most easily redo.
2. He needs to know which device it is and where. The summary entry had an id and two labels only: no room, type, floor, and no way to show it on the plan.
3. The plate now disagrees with the app, forever, unless he remembers. Nothing recorded that this plate still says KIT-05. Same problem with the "Relabel it GAR-04" question in the marker sheet.
4. If the plate that must change is the hard one (behind a ladder), he cannot choose. A swap is the natural fix.
5. A stale copy of the renumbered device would, on a later merge, tie on `updated` with the renumbered one and could bring back the clash.
6. Prevention is cheaper than cure: the help card says to finish on one device and send before working on the other.

Findings
- [fixed in spec] Data model `plateLabel`; merge rule 4 keeps the old label and names the keeper; a "Labels that changed" section (relabelled list with where and why, "Plates to rewrite" bar with Show on plan / "I've rewritten it" / Swap, "(plate says KIT-05)" on the plan and details, same list for his own relabels); the moving-your-project tip.
- [fixed in plan] `plateLabel` on devices; `fixLabelCollisions` returns `keptId`, sets `plateLabel` and bumps `updated` past the keeper's (so a stale copy cannot win later); `setRoom` relabel records the plate; `platesToRewrite`, `confirmPlate`, `swapLabels`; tests updated and one added (70 total).
- [question] none new.

Spec sections changed: Data model (device), Merge rules, new "Labels that changed", Screens > Place (relabel), help card.

## Round 30 - Pass B screens: Plates to rewrite bar and list, relabelled rows
1. The bar was only on Map and in the header sheet; he works on the Add tab when he is at the plate. The header chip now carries it too ("12 not sent, 2 plates").
2. The row text "Now KIT-06. The plate says KIT-05, which is also another outlet." put the action last and was unclear. Now the action first ("Write KIT-06 on this plate"), then what and where, then the reason in small type.
3. "Swap" alone is meaningless: "Swap labels" with a sentence under it saying who keeps what.
4. A long "(plate says KIT-05)" beside every marker would crowd a dense plan. A pencil mark on the plan; the words live in the details. (The "!" is already used for Not working.)
5. Four rows to confirm one at a time is tedious: "I've rewritten all 4", with a confirmation.
6. A bar that never goes away is nagging: Remind me later hides it until the app is next opened. When there are none, the sheet says so.
7. Show on plan changes floor if it must and shows both devices with the clashing label.

Findings
- [fixed in spec] items 1-7 (Labels that changed).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Labels that changed.

## Round 31 - Pass A story 16 (iPhone, at the panel, months later: the lights are out in one room; which breaker?)
1. Opens the app on Map. To answer "which breaker feeds the Kitchen?" the spec offered: search for a device, tap it, read "its circuit", repeat for the next device. There is no room-level answer and no view that says "most likely".
2. At the panel he wants the panel picture with the right breaker marked. Device details showed the breaker as text and did not open the picture.
3. Cheapest causes were not surfaced: a tripped GFCI (the Reset button, from story 11's data), a switch that is off, a bulb flagged Not working. The app knew all three.
4. A breaker on a subpanel: if the whole garage is dead, the thing to check is the main-panel breaker that feeds it, not the garage breaker. The data had the feed; no screen used it.
5. Confidence: a breaker found by testing deserves more trust than a guess; he is never told which he is looking at.
6. Devices with no breaker recorded in that room: silently ignored.
7. Plan check: no function answered "which breakers feed this room, ranked".

Findings
- [fixed in spec] A "Something has no power" button at the top of Breakers, asking Where? (room or device) and answering in one card: check-first items (GFCI, switches, Not working), then "Most likely: Breaker 7 (Kitchen), 20 A" with how sure, Show on panel (ring and "Check this one"), other breakers, the feeding breaker for subpanels, and devices with no breaker with a Test breakers button. Device details get Show on panel.
- [fixed in plan] `powerOutHelp(project, {roomId | deviceId})` returning counts, ranked breakers with tested/guessed and feederId, GFCIs, switches, Not working, unknown; one test (71 total).
- [question] none new.

Spec sections changed: Screens > Panel (Power out?), Browse.

## Round 32 - Pass B screens: "Something has no power" button and card
1. The "Where?" step is one more tap in a hurry, in the dark. The room asked about last comes first, with a search box on top.
2. The card could run to several screens (GFCIs, switches, Not working, breakers, subpanel, unknowns). At most three lines per section with "and 2 more"; text at least 20 px since he reads it at arm's length in a dark closet.
3. How sure: "6 of 8 devices with a breaker were found by testing, 2 guessed" is too long to read at a glance: "6 tested, 2 guessed".
4. At the breaker itself he needs the one fact most people forget: a tripped breaker sits between On and Off and must be pushed fully Off first. Added in small type, with "If it trips again straight away, leave it off and call an electrician."
5. Nothing recorded for the room: the card said nothing. Now it says so and offers "a room next to it" or testing.
6. Checked and fine: the card changes no data, so no Undo; Show on panel reuses the picture with the ring and the words "Check this one" (not colour alone).

Findings
- [fixed in spec] items 1-5 (Panel > Power out?).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Panel.

## Round 33 - Pass A story 17 (an electrician asks "what is on breaker 14?" and "where is the other switch for this light?")
1. "Breaker 14": Breakers tab, panel picture, tap space 14, breaker page. That worked, but the page had no summary, so he reads 12 rows to answer "how many outlets?". And a space number is not how people say it: "the kitchen breaker". The Breakers tab had no search.
2. A breaker feeding the garage subpanel: "what is on 13/15?" should include everything behind it. The page listed only devices set directly on that breaker.
3. Guessed devices looked like tested ones on the list: an electrician relying on it needs the word "guess".
4. "Where is the other switch for this light?": tap the light on Map, "what switches it" with links that jump. That worked for the light. From a switch ("which is the other one for this?") he would have to go to the light first.
5. Plan check: no function gave the devices on a breaker including subpanel ones, or the other switches for a toggle.

Findings
- [fixed in spec] Breaker page: one-line summary, grouped list with "guess" tags and Show on plan, "and 14 more through the Garage subpanel"; search box on Breakers by number or label; switch details gain "Also switched from".
- [fixed in plan] `devicesOnBreaker` (direct, downstream, group counts) and `otherSwitches`; one test (72 total).
- [question] none new. The electrician may also want the whole directory on paper: story 18.

Spec sections changed: Screens > Panel, Browse.

## Round 34 - Pass B screens: breaker page, breaker search, switch details
1. The summary "5 outlets, 2 lights, 1 hard-wired" claimed a group the catalog does not have ("other" holds alarms, fans, appliances, thermostats). Wording now "1 other", with "something else" for what he named himself.
2. The breaker search was vaguely placed and "14" could mean amps or a space. Above the panel picture; "14" means space 14, words match labels; results are rows that open the page.
3. A plate of three switches would put three "controls / also switched from" blocks in one wall of text: shown one switch at a time, each with its own partner line.
4. Show on plan jumps floors; he is then on another floor with no cue how to get back to where he was. Every jump leaves a "Back to Main floor" style button.
5. Checked and fine: Test this breaker is the main button on the page, Edit secondary, Delete only in the Edit sheet with its confirmation.

Findings
- [fixed in spec] items 1-4 (Panel, Browse, Using it).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Panel, Browse; Using it.

## Round 35 - Pass A story 18 (Mac or iPhone: print a panel directory for the inside of the door; get a spreadsheet of everything)
1. Print: "The Print view lays out a panel directory with the devices found on each breaker." Layout unspecified. Listing every device per breaker would run to pages and not fit a card on the door; a door card has a number, a label and short text.
2. Unwritten: page size and what he sees before printing; how it prints from an iPhone (it has no print button of its own); whether it is black on white (it is, from Using it); empty or not-yet-entered spaces; double and tandem; subpanel; date; guesses.
3. Taped inside a door for years, a card must say which parts are guesses ("?") and when it was printed.
4. Spreadsheet: only a device CSV existed. The device rows carried the breaker's space numbers but not its label ("Kitchen"), nor GFCI or Not working. There was no breaker-level sheet ("what is on each breaker, how many, how sure").
5. Excel shows accented characters wrongly in a CSV without a byte-order mark; iPhone download needs the Share sheet like Export.
6. Plan check: `devicesCsv` lacked breaker label, behind GFCI and Not working columns; no breakers CSV.

Findings
- [fixed in spec] Print: preview identical to the printout, Short | Full, system print dialog (AirPrint, PDF), a door-card layout about 5 in wide with rooms per breaker and "?" for guesses, tandem and double handling, empty and not-yet-entered spaces, subpanel page headed "Fed from...", header with date and legend; Full page lists every device. Menu: Download spreadsheet (Devices or Breakers) with a byte-order mark and the Share sheet on iPhone.
- [fixed in plan] `devicesCsv` gains breaker_label, behind_gfci, not_working; new `breakersCsv`; csv tests updated and one added (73 total).
- [question] none new.

Spec sections changed: Screens > Panel (Print), Browse.

## Round 36 - Pass B screens: print preview, the door card, spreadsheet download
1. A 40-space panel squeezed into a 5 inch card would print at an unreadable size: minimum 10 pt, and a panel over 30 spaces uses the full page width.
2. "Kitchen, Dining, Hall, Den, Study ?" would overflow a card cell: three rooms then "+2 more".
3. "?" meant "only guessed", but a breaker with some tested and some guessed devices is neither. Defined as "not confirmed by testing yet", with a legend.
4. Home printers are often black and white: double breakers and tandems by borders and words (240 V), never shading or colour.
5. The preview is always light even in dark mode, and fits the phone screen with pinch to zoom; the button is "Print or save as PDF" because that is what a non-technical person looks for on an iPhone.
6. A card taped inside a door goes stale: the panel page says when it was last printed and how many breakers have changed since.

Findings
- [fixed in spec] items 1-6 (Panel > Print).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Panel (Print).

## Round 37 - Pass A story 19 (new phone, or Safari wiped the site data: get everything back)
1. He opens the app and sees the welcome screen as if new. Nothing explains why, or what to do. The obvious button is Start, which would make a second, empty project.
2. The only recovery is a .circuitmap file. The spec never told him where to look, and the import described a file by nothing, so he cannot tell a file from last week from one from last year.
3. The big trap: on iPhone an app added to the Home Screen has separate storage from the Safari tab. The spec's own one-time note, "add it to the Home Screen", would make a Safari-started project vanish into an empty copy.
4. There is no protection beforehand. The header chip counts changes but nothing ever asks him to send a copy somewhere safe. A lost or wiped phone loses everything not exported.
5. Plan check: `describeProject` gave no date.

Findings
- [fixed in spec] First-launch: Safari-tab card "Add this to your Home Screen first" with Start here anyway; the Home Screen note rewritten to say export first; after-wipe text under "I already have a project file"; the file is described, with "last changed" and how long ago, before it is adopted; a backup nudge after 7 days or 50 unsent changes.
- [fixed in plan] `lastChanged`; `describeProject` carries `updated`; test updated (73 total).
- [question] none new.

Spec sections changed: First launch, Saving and moving between devices.

## Round 38 - Pass B screens: first launch (welcome), Home Screen card, backup nudge
1. The welcome paragraph put a name field, a large Start, and a small link for "I already have a project file" on one screen. After a wipe the large button is the wrong one. Now two equal buttons, **Start a new house** and **I already have a project file**; the name field moves to a second screen after Start. On the Mac the file can be dropped on the window.
2. The tab and the checklist words were builder words from earlier rounds (Place, Browse): the checklist now ends "Next: add outlets and switches" (opens Add), and the app opens on Map.
3. The Safari Home Screen card sits above the two buttons so it is read first, and has "Start here anyway" so it cannot trap a user who already has the app installed.
4. The backup nudge: a banner at the top, not a pop-up; Later hides it for a day, so it cannot nag within a session or block a breaker walk.
5. Checked and fine: the "Used this app before?" sentence is shown to everyone but is small; the file description step guards against importing the wrong file.

Findings
- [fixed in spec] items 1-4 (First launch, backup nudge).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > First launch; Saving and moving between devices.

## Round 39 - Pass A story 20 (Floors tab: finish the basement later; delete a floor or a room by mistake)
1. Add floor, tap Basement: it is added last, so he must Move up twice to put it at the bottom. A basement is always the lowest floor.
2. He draws rooms, places devices, tests: the breakers are all marked tested, so "Next untested breaker" says nothing is left, but the new basement devices have no breaker yet. The Test screen could not tell him to test again.
3. Delete a floor by mistake: Errors said "asks first and says what will be affected", Undo for the last 20 steps. But Undo disappears when the app is closed, the floor's picture (a blob) would be gone, and the deletion would travel to the other device on the next merge. No "Save a copy first".
4. After deleting the floor he was viewing, which floor does he see? No rule. With no floors left? No text.
5. Plan check: `addFloor` had no way to put a floor at the bottom; `unsweptBreakers` did not notice new unassigned devices.

Findings
- [fixed in spec] Basement goes first; floor delete says what will go ("4 rooms, 38 devices and 12 links") with Save a copy first / Delete / Cancel, keeps the picture until the app is next opened so Undo works, shows the floor below next, "No floors yet. Add one." when none; Test: a breaker counts as untested again when a device with no breaker was added after it was tested.
- [fixed in plan] `addFloor(..., atBottom)`; `unsweptBreakers` considers later unassigned devices; tests (74 total).
- [question] Q6 (a "Recently deleted" screen).

Spec sections changed: Screens > Setup, Test, Errors and edge cases.

## Round 40 - Pass B screens: Floors list, add floor, delete floor
1. The delete-floor dialog listed Delete beside Cancel with equal weight, and a floor is the biggest thing he can delete. Cancel is now the main button, Save a copy first beside it, and "Delete Basement" is set apart; the button is on the floor's own page, not in the list.
2. The Undo toast would last only a few seconds, short for a floor: it stays until he does something else or 30 seconds.
3. Two arrow buttons on every row of the floor list: four touch targets per row for something done once. A Reorder button reveals them; Done hides them.
4. After Add floor the next step was not shown: the new floor's page opens with "Next: add a picture of the floor".
5. The floor switcher on a phone: a row of large buttons for up to four floors, a single "Floor: Main floor" menu beyond that (attic, main, basement, garage, guest...).
6. A rule for the whole app: nothing is deleted by a swipe or a single tap; every Delete is inside a page or sheet, set apart, with a named Undo.

Findings
- [fixed in spec] items 1-6 (Setup, Errors, Using it, Screens intro).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Setup, Errors and edge cases, Using it.

## Round 41 - Pass A story 21 (iPhone, in the basement with no signal, app opened from the Home Screen)
1. Opens from the Home Screen icon: works only if the service worker finished saving everything while he had a signal. The spec said "caches the app" with no list. The PDF reader and its worker, the icon, the manifest could all be missed, giving a half-working app (floors load, PDF import fails).
2. Nothing tells him whether this copy is safe offline. If he installed it moments before going downstairs, saving may not have finished.
3. The Home Screen needs a manifest and an icon: not in the spec's file list at all. Without a manifest it opens in a Safari tab with bars (and, on iPhone, with separate storage: round 37's trap in another form).
4. The app must make no network requests after loading: a font or a script from a CDN would hang in the basement.
5. Updates: a new version could replace the running one mid-session. No rule.
6. Plan check: Plan 1 is pure data, nothing to change. Plan 4 gets the manifest, icons and update banner in its row.

Findings
- [fixed in spec] Offline section (everything saved on first load, no network use afterwards, a "Ready to use without a signal" toast and "Works without a signal" in the header sheet, a message before saving finishes, same look with no signal); Updates section (background fetch, applied on next reopen, banner with Later); manifest and icons in the file list.
- [fixed in plan] none in Plan 1; Plan 4's roadmap row now names the manifest, icons and update banner.
- [question] none new.

All 21 stories have now been walked once (rounds 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41). The stop rule needs one further A+B pair with no new findings, so the loop continues with a re-walk of the most-edited stories.

Spec sections changed: Files, Saving and moving between devices.

## Round 42 - Pass B screens: offline readiness, update notice, the stack of banners
1. By now four things can sit at the top of the screen: the breaker-is-OFF bar, "Plates to rewrite", the backup nudge and the new-version notice, plus the mode banner below. Together they could fill a phone. Rule: one at a time, in a fixed order, the safety one first and never hidden.
2. "Close the app and open it again" is not obvious on an iPhone. Added how, in small type: swipe up from the bottom edge and pause, then swipe the app away.
3. Josh may have to help over the phone: the header sheet shows the version and date so dad can read it out.
4. Checked and fine: the offline toast is once only; "Works without a signal" lives in the header sheet with Export and Import (one place to look); no spinner waits on the network.

Findings
- [fixed in spec] items 1-3 (Using it, Updates).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Using it, Saving and moving between devices (Updates).

## Round 43 - Pass A confirmation re-walk of stories 4, 10 and 13 against the full current spec
1. Story 4 (iPhone, Add tab, one room): re-read Place from the top. Palette sheet, recent row, switch count row, room question, placing, label in the banner, undo, wake lock: all consistent with each other. One gap: he is standing in a particular room, and the plan fills the screen at whatever zoom; getting to that room is pinch, pan and pan again, one-handed. [finding]
2. Story 10 (iPhone, Breakers to Test): panel picture, breaker page, three steps, OFF bar, List | Plan, No power marks, Whole room, GFCI offer, conflict question, "I've checked this floor", Still assigned, summary, Next untested breaker: consistent. No wording left over from earlier rounds (five steps, "All dead").
3. Story 13 (phone to Mac): header chip, sheet, Export, AirDrop, Mac download message, Import preview, Bring them in, Done, "Send it back": consistent.

Findings
- [fixed in spec] A Rooms button next to Fit and zoom lists the floor's rooms and zooms the plan to the one tapped (Using it).
- [fixed in plan] none.
- [question] none new.

Because round 43 produced a finding, the stop rule's clean A+B pair restarts: rounds 44 (B) and 45 (A) and 46 (B) follow.

Spec sections changed: Using it.

## Round 44 - Pass B: the second half of the spec re-read end to end (Using it, catalog, Saving, Merge, Labels that changed, Errors, Testing)
1. The "Tip: finish on one device..." sentence appeared twice (in the help card and in Labels that changed). Kept the help card's.
2. The file list and Testing section promised "format migration", which nothing in the plan provides and version 1 does not need. Spec now says a migration step is added when a version 2 exists.
3. Text size: "at least 16 px" is the Safari zoom minimum, but body text for an older reader should be larger. Body 18 px, nothing below 16.
4. No statement on contrast. Added a 4.5 to 1 rule for text, outlines and symbols in light and dark.
5. Merge rule 5 listed what is tidied but not the GFCI link the plan already clears; added.
6. Checked and consistent: tab names throughout, Delete rules, banner order, Home Screen/offline/updates, Undo wording.

Findings
- [fixed in spec] items 1-5.
- [fixed in plan] none.
- [question] none new.

A finding was made, so the clean pair has not been reached: round 45 (Pass A) and round 46 (Pass B) must find nothing.

Spec sections changed: Using it, Merge rules, Labels that changed, Testing, file list.

## Round 45 - Pass A confirmation re-walk of stories 1, 8, 16 and 19 against the full current spec
1. Story 1 (Mac): welcome, two buttons, house name, Floors checklist, Add floor chips, picture (HEIC, PDF thumbnails, Rotate), rooms. No gap found.
2. Story 8 (phone, Switches): start header, plate sheet, linking, floor switcher during linking, halves sheet, From the load. No gap found.
3. Story 16 (phone, at the panel): "Something has no power" card is the answer, but the phone sleeps after about 30 seconds while he reads it standing in a dark closet; the wake lock was only on Add and Test. [finding]
4. Story 19 (new phone / wipe): welcome with two equal buttons, "Used this app before?", the file described with its date. No gap found.

Findings
- [fixed in spec] The phone is also kept awake on the Breakers tab (Place > Placing).
- [fixed in plan] none.
- [question] none new.

Because round 45 produced a finding, the clean pair restarts again: rounds 46 (Pass B) and 47 (Pass A) must find nothing.

Spec sections changed: Screens > Place (Placing).

## Round 46 - Pass B: phone screen budget, the stack of bars above and below the plan
1. On an iPhone the plan competes with: header, the floor buttons, the recent-fixtures row, the switch-count row, the mode banner with Undo and Done, and the tab bar. Counting heights leaves about 380 points for the plan. The switch-count row now replaces the recent row while a switch type is chosen.
2. The header chip's words ("12 changes not sent") would crowd the floor buttons on a phone: it is "Send 12" on the phone, full words in its sheet and on the Mac.
3. Undo lives in the banner bar, but with no mode the banner is empty: the bar is always there, holding Undo alone, or Undo beside Done.

Findings
- [fixed in spec] items 1-3 (Place > Switch plates, header chip, Undo).
- [fixed in plan] none.
- [question] none new.

The clean pair has still not been reached (round 46 found layout details). Round 47 (Pass A) and round 48 (Pass B) follow.

Spec sections changed: Screens > Place, Saving and moving between devices, Using it.

## Round 47 - Pass A confirmation re-walk of stories 6, 12, 14 and 17
1. Story 6 (phone): attic fan and sump pump work through Something else. But an attic fan lives in the attic, and an attic or crawl space often has no floor plan to photograph; the spec requires a picture before anything can be placed. He would be stuck. [finding] Fixed with a line under the no-picture state: put its things on the nearest floor in a room called Attic.
2. Story 12 (guess then test): Breaker row in the sheet, Test marks, "KIT-02 was your guess of breaker 5", Still assigned here. Consistent.
3. Story 14 (Mac to phone with unsent phone work): preview, Save a copy first, Bring them in, Send it back. Consistent.
4. Story 17 (electrician): breaker page summary, search, "and 14 more through the Garage subpanel", Also switched from. Consistent.

Findings
- [fixed in spec] item 1 (Setup).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Setup.

## Round 48 - Pass B: empty and loading states across every tab, and the banner order
1. Map with no devices, a search with no results, and the Test list with no outlets or lights had no wording: a blank plan or an empty list. Added one bullet of empty and loading states, including "Loading picture..." for a slow floor image.
2. The "storage full or blocked" banner (Errors) was missing from the banner order. It is a data-loss warning, so second, after the breaker-is-OFF bar.
3. Checked and fine: Floors, Switches, Breakers empty states already had wording; "Nothing to review", "No plates to rewrite", "No floors yet" exist.

Findings
- [fixed in spec] items 1-2 (Using it).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Using it.

## Round 49 - Pass A re-walk of odd corners in stories 2, 5, 9 and 11
1. Story 2: same room name on two floors, taken codes, a closet in a room, 20 rooms: all covered.
2. Story 5: lowering the number of switches asks; raising does not need to. Covered.
3. Story 9: he enters 13/15 as a double breaker under numbering A (odd left), later finds his panel is B (down the sides) and switches the Numbering choice. 13 and 15 are no longer next to each other, but the picture would draw one tall box over two distant spaces and nothing would say so. [finding]
4. Story 11 / 16: the "Something has no power" card covers GFCI outlets, but a GFCI or AFCI breaker in the panel can itself be the thing that tripped. The card said only "push it fully Off, then On". [finding]
5. Story 9 other corners (40 spaces, tandem next to a double breaker, a main breaker size): covered.

Findings
- [fixed in spec] Numbering change lists double breakers that no longer sit together with Edit on each; the Power out card adds a line for GFCI, AFCI and dual breakers.
- [fixed in plan] `setNumbering`, `unpairedBreakers`, one test (75 total).
- [question] none new.

Spec sections changed: Screens > Panel.

## Round 50 - Pass B: terminology audit of the whole spec (grep for builder words)
1. Searched the spec for toggle, sweep, fixture, Browse, Setup, Place, Link, Kind. Every quoted label, prompt and banner already uses the plain words (Floors, Add, Switches, Breakers, Map; "What are you adding?"; "switch 2 on KIT-01"; "Test"). The prose still says fixture, toggle and sweep, as does the code.
2. To stop a reader (Josh, or Plans 2-4) taking those prose words for screen text, the Screens intro now lists the three words that the screens never show and what they say instead.

Findings
- [fixed in spec] item 2 (Screens intro). No wording problems in any quoted screen text.
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens (intro).

## Round 51 - Pass A re-walk of stories 3, 7, 15 and 20
1. Story 3 (room fixes and rename): room page, outline editor, mismatch notice, code lock, delete. Consistent.
2. Story 7 (wrong spot, type, room): Move mode, Type with consequences, Room with relabel. But the third mistake, a device placed on the wrong floor, was judged acceptable in round 13 (delete and place again). It is not: floors have separate pictures, and he can easily tap a plan while the other floor is showing. Deleting and re-placing loses the label already written on the plate (a different number is given unless it was the highest) and the links and breaker. [finding]
3. Story 15 (relabelled plates): consistent with the Labels that changed section.
4. Story 20 (floors): consistent.

Findings
- [fixed in spec] "Move to another floor" beside Move in the marker sheet.
- [fixed in plan] `moveToFloor` with a test (76 total).
- [question] none new.

Spec sections changed: Screens > Place (marker sheet).

## Round 52 - Pass B: the marker sheet after all the rows added in rounds 13-51
1. The sheet now holds a label, Type, Room, Breaker, Note, Switches, More, Move, Move to another floor and Delete. Over the lower half of a phone that is more than fits; Move and Delete, "at the bottom", would be below the fold, while correcting a position is the most common job.
2. Fix: Move and Move to another floor directly under the label; Delete at the foot, apart; the sheet scrolls and can be pulled to full height with the label and Done pinned.

Findings
- [fixed in spec] items 1-2 (Place > The marker sheet).
- [fixed in plan] none.
- [question] none new.

Spec sections changed: Screens > Place (marker sheet).

## Round 53 - Pass A confirmation re-walk of stories 1, 4 and 10 against the full current spec
1. Story 1 (Mac): welcome (two equal buttons), name screen, Floors checklist, Add floor (Basement first), picture (HEIC message, PDF thumbnails, Rotate), rooms, "Next: add outlets and switches". No gap.
2. Story 4 (phone, Add): What are you adding?, recent row, switch count row replacing it, Rooms zoom button, placing with the label in the bar, undo bar, wake lock, marker sheet with Move first. No gap.
3. Story 10 (phone, Test): Power out? not involved; breaker page, three steps, OFF bar, List | Plan, No power, Whole room, GFCI offer, conflicts, floor ticks, Still assigned, finishing summary, Next untested breaker. No gap.

Findings: none. The plan holds what these stories need (checked `placeDevice`, `setRoom`, `moveToFloor`, `sweepList`, `markSwept`, `unconfirmedOnBreaker`).

Round 54 (Pass B) must also find nothing for the stop rule.

## Round 54 - Pass B: the Mac layout and mouse/keyboard use
1. Mouse use had one line (Esc, Delete, Cmd-Z). Added: wheel and pinch zoom, drag to pan, hover shows a marker's label, type and room (a mouse has no tap-to-reveal and hover is free).
2. A Mac Safari window half the screen wide would get the wide layout and a cramped side panel. Layout follows window width: under about 700 px it is the phone layout.
3. Delete key removes a device at once while the rest of the spec says deletes are set apart: devices are the one case undone, not confirmed, so the line now says "(with Undo)".

Findings
- [fixed in spec] items 1-3 (Using it > Phone / Mac).
- [fixed in plan] none.
- [question] none new.

All three are small polish items; nothing structural has been found since round 52.

## Round 55 - Pass A confirmation re-walk of stories 9, 11 and 19 against the full current spec
1. Story 9 (at the panel, phone or Mac): No panels yet, Add panel (name, make, main size, spaces, numbering with "not sure" defaults), the panel picture, entering a breaker with Next space, double and tandem modes, "No breaker here", subpanel Fed from, "Which panel is this?" for a panel marker. No gap. The plan holds it (`addPanel`, `addBreaker`, `canPair`, `setSlotCount`, `setFedFrom`, `unpairedBreakers`).
2. Story 11 (GFCI, dead light, outlet dead on every breaker): Behind a GFCI outlet, Protects N devices, Whole room has no power, Also mark the N outlets it protects, Not working with a note, the conflict question's third answer. No gap.
3. Story 19 (new phone or wiped data): Home Screen card, two equal buttons, file description with its date, backup nudge. No gap.

Findings: none. The plan needed nothing for these stories.

Round 56 (Pass B) must also find nothing for the stop rule.

## Round 56 - Pass B: print, dark mode, wording, and the phone screen as a whole
1. Print and dark mode: black on white always, borders not shading, 10 pt minimum, "?" legend. Wording: checked every quoted string against the tab names. No gap.
2. Phone screen as a whole: by now the phone can stack floor buttons plus chip, a recent-fixtures or switch-count row, the plan, a two-line mode banner, the Undo bar and the tab bar. On a small iPhone, and especially held sideways, that could leave a postage-stamp plan. Nothing set a minimum. [finding]
3. Animation (the new-marker pulse) with no Reduce Motion fallback, and nothing said about VoiceOver names for markers. [finding]

Findings
- [fixed in spec] Screen space: plan keeps at least half the height; recent row hides with a sheet or keyboard; banner at most two lines; landscape tab bar moves to a left column.
- [fixed in spec] Motion: Reduce Motion gives a steady ring; markers and buttons have text labels for VoiceOver.
- [fixed in plan] none (no data change).
- [question] none new.

Spec sections changed: Using it.

Findings were made, so the clean pair is not yet reached. Round 57 (Pass A) re-walks stories 4, 10 and 21 on a small iPhone; round 58 (Pass B) must follow.

## Round 57 - Pass A re-walk of stories 4, 10 and 21 on a small iPhone, with the round 56 Screen space rule
1. Story 4 (placing a room): top rows are floor buttons plus Send chip and the recent row; bottom is a two-line banner ("Adding: Duplex outlet in Garage" over "Placed KIT-03. Kitchen has 3 devices"), the Undo bar and the tab bar. The plan keeps half the height; the recent row hides when the sheet or keyboard opens. Held sideways the tab bar moves to the left. Consistent.
2. Story 10 (testing a breaker): the Test screen is a list, not a plan, so the half-height rule does not apply; the "Breaker 7 is OFF" bar sits above it and the steps shrink to that bar. List mode scrolls; the plan mode keeps its height. Consistent.
3. Story 21 (basement, no signal): opened from the Home Screen, everything cached, no spinner, no error. Consistent.

Findings: none. The plan needed nothing.

Round 58 (Pass B) must also find nothing for the stop rule.

## Round 58 - Pass B: Add, Test and offline screens on a small iPhone, light and dark, with the Screen space and Motion rules
1. Add tab: banner wording, recent row, 44 pt buttons, hints for unfamiliar types, steady ring under Reduce Motion. No gap.
2. Test screen: OFF bar is first in the banner order and never hidden; steps, List | Plan, "No power" with words, Still assigned step. No gap.
3. Offline and updates: toast once, header sheet state, no network after first load, how to close the app. No gap.
4. Contrast, dark mode, print: stated and consistent.

Findings: none. Rounds 57 and 58 are a clean A+B pair and all 21 stories are walked, so the loop stops.

## Round 59 - Pass B on plan-ui-look: Floors, Add (no picture), Switches, Breakers, Test steps, phone width, dark
Seeded one house (1 floor, 1 room, 2 outlets, 1 panel, 1 breaker) and walked the screens `ui-look.md` listed as not yet seen.
1. First launch, name screen, Setup, Add floor sheet, Floors list: consistent with the new look. No gap.
2. Add tab with a floor that has no picture: the message and "Choose a picture" were shrink-wrapped and centred (`.page` has `margin: 0 auto` inside the flex-column `.plan-screen`), so they sat about 60 px in from the floor chip. Fixed: `.plan-screen > .page { width: 100%; box-sizing: border-box; }`; now left at 16 px like every other screen.
3. Test steps: a step with nothing to do is a disabled button, so `button:disabled { opacity: .5 }` took its words to about 2.8:1. Fixed with colour instead of opacity (`button.step:disabled`); now 6.9:1.
4. Breakers tab: the header block still fills the first screen (already listed as a candidate for the Web Awesome plan). Switches empty state: fine.

Not yet walked: the Map tab with a picture, Print preview, toast, type picker, light mode. Round 60 should take those.

## Round 60 - Pass B on plan-ui-look: Map with a picture, Print, toast, type picker, marker and send sheets, plates, PDF page choice, Home Screen card and note; phone width, dark and light
Seeded a house (1 floor with a drawn picture, 3 rooms with outlines, 2 switches, outlets, a GFCI, a light, 1 panel, 2 breakers, 2 links, 2 plates to rewrite) with `openStore().saveProject()`. Switch type ids are S, S3, S4, DM, FC. plan-ui-look does not hold `pdfpage.js` or `homescreen.js` (they are on plan-4d-pdf-home), so those two were walked in a throwaway worktree with plan-4d merged onto plan-ui-look (the merge conflicted in styles.css, issue 17; resolved there by keeping both sides, worktree removed, no branch touched). The iPhone user agent was faked in that copy only. Checked contrast, 44 px targets, 16 px text and the console in each screen; no console errors.
1. Map tab, plan and list, dark and light: issues 3, 4, 5, 11, 13; light borders issue 6.
2. Marker sheet and type picker: issues 7, 8, 9.
3. Send sheet and plates-to-rewrite list: issues 7, 9. No contrast, size or text failures.
4. Toast: issue 10. Contrast and size fine.
5. Print preview, Short and Full: issue 12. 10 pt print text is as specified.
6. PDF page choice: issues 7, 14. A 4-page PDF returned the chosen page at 2318x3000.
7. Home Screen card and note: issues 7, 15, 16.
Not walked: the Switches tab again (issue 2), the password and unreadable-PDF error messages, a real iPhone for safe areas.
