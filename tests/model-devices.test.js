import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { sample } from "./helpers.js";

function wired() {
  const s = sample();
  const { p, main, kit } = s;
  const sw = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 10, y: 10 }, 1100);
  const light = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 50, y: 50 }, 1200);
  const outlet = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 90, y: 10 }, 1300);
  const panel = m.addPanel(p, { name: "Main panel", slotCount: 20 }, 1400);
  const b7 = m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 20, label: "Kitchen" }, 1400);
  return { ...s, sw, light, outlet, panel, b7 };
}

test("placeDevice labels in order and takes defaults from the catalog", () => {
  const { sw, light, outlet } = wired();
  assert.deepEqual([sw.label, light.label, outlet.label], ["KIT-01", "KIT-02", "KIT-03"]);
  assert.deepEqual([sw.heightIn, sw.toggles], [48, 1]);
  assert.deepEqual([light.heightIn, light.toggles], [null, 0]);
  assert.deepEqual([outlet.breakerId, outlet.tested, outlet.note, outlet.created], ["", false, "", 1300]);
});

test("placeDevice needs a real room", () => {
  const { p, main } = wired();
  assert.throws(() => m.placeDevice(p, { floorId: main.id, roomId: "", type: "D", x: 0, y: 0 }, 1), /needs a room/);
});

test("a 3-gang plate is one device; cutting its toggles drops links on the removed ones", () => {
  const { p, main, kit, light, outlet } = wired();
  const plate = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 5, y: 5, toggles: 3 }, 1500);
  assert.equal(plate.toggles, 3);
  m.toggleLink(p, { switchId: plate.id, toggle: 3, loadId: light.id }, 1600);
  m.toggleLink(p, { switchId: plate.id, toggle: 1, loadId: outlet.id, loadPart: "top" }, 1600);
  assert.equal(m.linksOnRemovedToggles(p, plate.id, 2), 1);
  m.setToggles(p, plate.id, 2, 1700);
  assert.deepEqual(p.links.map((l) => l.toggle), [1]);
  assert.throws(() => m.setToggles(p, plate.id, 5, 1800), /1 to 4/);
  assert.throws(() => m.setToggles(p, light.id, 2, 1800), /only switches/);
  assert.throws(() => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 1, y: 1, toggles: 0 }, 1900), /1 to 4/);
  const dryer = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "R", x: 2, y: 2, customName: "Dryer outlet" }, 1900);
  assert.deepEqual([dryer.toggles, dryer.customName], [0, "Dryer outlet"]);
});

test("changeType follows the new type's rules", () => {
  const { p, light, outlet, sw, b7 } = wired();
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1500);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "top" }, 1500);
  m.setBreaker(p, outlet.id, b7.id, true, 1600);
  assert.equal(m.linksLostByTypeChange(p, outlet.id, "S").length, 1);
  m.changeType(p, outlet.id, "S", "", 2000);
  assert.deepEqual([outlet.type, outlet.toggles, outlet.heightIn, outlet.breakerId, outlet.tested], ["S", 1, 48, "", false]);
  assert.equal(p.links.length, 1);
  m.update(p, "devices", sw.id, { heightIn: 52 }, 2050);
  m.changeType(p, sw.id, "L", "", 2100);
  assert.deepEqual([sw.toggles, sw.heightIn, p.links.length], [0, 52, 0]);
  assert.equal(m.changeType(p, light.id, "R", "Dryer outlet", 2200).customName, "Dryer outlet");
});

test("setRoom keeps the label unless asked, and stays on the floor", () => {
  const { p, main, sw } = wired();
  const den = m.addRoom(p, { floorId: main.id, name: "Den", code: "DEN" }, 1500);
  m.setRoom(p, sw.id, den.id, false, 2000);
  assert.deepEqual([sw.roomId, sw.label], [den.id, "KIT-01"]);
  m.setRoom(p, sw.id, den.id, true, 2100);
  assert.equal(sw.label, "DEN-01");
  m.setRoom(p, sw.id, den.id, true, 2200);
  assert.equal(sw.label, "DEN-01");
  const up = m.addFloor(p, "Upstairs", 1500);
  const bed = m.addRoom(p, { floorId: up.id, name: "Bed", code: "BED" }, 1500);
  assert.throws(() => m.setRoom(p, sw.id, bed.id, false, 2300), /another floor/);
  m.setRoom(p, sw.id, "", false, 2400);
  assert.equal(sw.roomId, "");
});

test("toggleLink refuses nonsense and keeps whole and halves apart", () => {
  const { p, sw, light, outlet } = wired();
  assert.throws(() => m.toggleLink(p, { switchId: light.id, loadId: outlet.id }, 1), /not a switch/);
  assert.throws(() => m.toggleLink(p, { switchId: sw.id, loadId: sw.id }, 1), /another switch/);
  assert.throws(() => m.toggleLink(p, { switchId: sw.id, toggle: 2, loadId: light.id }, 1), /no switch 2/);
  assert.throws(() => m.toggleLink(p, { switchId: sw.id, loadId: light.id, loadPart: "top" }, 1), /halves/);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "top" }, 2);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "" }, 3);
  assert.deepEqual(p.links.map((l) => l.loadPart), [""]);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "top" }, 4);
  assert.deepEqual(p.links.map((l) => l.loadPart), ["top"]);
});

test("plates to rewrite are tracked until he confirms, and labels can be swapped", () => {
  const { p, main, kit, sw, light, outlet } = wired();
  const den = m.addRoom(p, { floorId: main.id, name: "Den", code: "DEN" }, 1500);
  m.setRoom(p, sw.id, den.id, true, 2000);
  assert.deepEqual([sw.label, sw.plateLabel], ["DEN-01", "KIT-01"]);
  assert.deepEqual(m.platesToRewrite(p).map((d) => d.id), [sw.id]);
  m.confirmPlate(p, sw.id, 2100);
  assert.deepEqual(m.platesToRewrite(p), []);
  m.update(p, "devices", light.id, { label: "KIT-04", plateLabel: "KIT-03" }, 3000); // renumbered; the plate says KIT-03
  m.swapLabels(p, light.id, outlet.id, 3100);                                    // outlet is the other KIT-03
  assert.deepEqual([light.label, light.plateLabel, outlet.label, outlet.plateLabel], ["KIT-03", "", "KIT-04", "KIT-03"]);
});

test("powerOutHelp ranks breakers for a room and lists what to check first", () => {
  const { p, main, kit, sw, light, outlet, b7 } = wired();
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 2000);
  m.setBreaker(p, outlet.id, b7.id, true, 2000);
  m.setBreaker(p, light.id, b7.id, false, 2000);
  const g = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "G", x: 4, y: 4 }, 2100);
  m.setProtection(p, outlet.id, g.id, 2200);
  const stray = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 6, y: 6 }, 2300);
  const r = m.powerOutHelp(p, { roomId: kit.id });
  assert.equal(r.count, 5);
  assert.deepEqual(r.breakers.map((b) => [b.breakerId, b.count, b.tested, b.guessed]), [[b7.id, 2, 1, 1]]);
  assert.deepEqual(r.gfcis.map((x) => [x.id, x.protects]), [[g.id, 1]]);
  assert.deepEqual(r.switches.map((x) => [x.id, x.toggle]), [[sw.id, 1]]);
  assert.deepEqual([...r.unknown].sort(), [g.id, stray.id].sort());
  const one = m.powerOutHelp(p, { deviceId: outlet.id });
  assert.deepEqual([one.count, one.gfcis.length], [1, 1]);
  const sub = m.addPanel(p, { name: "Garage", slotCount: 12 }, 2400);
  m.setFedFrom(p, sub.id, b7.id, 2400);
  const sb = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20 }, 2400);
  m.setBreaker(p, stray.id, sb.id, true, 2500);
  assert.equal(m.powerOutHelp(p, { deviceId: stray.id }).breakers[0].feederId, b7.id);
});

test("devicesOnBreaker reaches through a subpanel, and otherSwitches finds the partner switch", () => {
  const { p, main, kit, sw, light, outlet, b7 } = wired();
  m.setBreaker(p, outlet.id, b7.id, true, 2000);
  const sub = m.addPanel(p, { name: "Garage", slotCount: 12 }, 2100);
  m.setFedFrom(p, sub.id, b7.id, 2100);
  const sb = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20 }, 2100);
  const far = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "L", x: 8, y: 8 }, 2200);
  m.setBreaker(p, far.id, sb.id, false, 2200);
  const r = m.devicesOnBreaker(p, b7.id);
  assert.deepEqual([r.direct.map((d) => d.id), r.downstream.map((d) => d.id), r.groups], [[outlet.id], [far.id], { outlet: 1 }]);
  const sw2 = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S3", x: 9, y: 9 }, 2300);
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 2400);
  m.toggleLink(p, { switchId: sw2.id, loadId: light.id }, 2400);
  assert.deepEqual(m.otherSwitches(p, sw.id, 1), [{ switchId: sw2.id, toggle: 1, loadId: light.id }]);
  assert.deepEqual(m.otherSwitches(p, outlet.id, 1), []);
});

test("moveToFloor keeps label, links and breaker, and checks the room is on the new floor", () => {
  const { p, main, sw, light, b7 } = wired();
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1500);
  m.setBreaker(p, light.id, b7.id, true, 1500);
  const up = m.addFloor(p, "Upstairs", 1600);
  const bed = m.addRoom(p, { floorId: up.id, name: "Bed", code: "BED" }, 1600);
  m.moveToFloor(p, light.id, up.id, 5, 6, bed.id, 2000);
  assert.deepEqual([light.floorId, light.x, light.y, light.roomId, light.label, light.breakerId], [up.id, 5, 6, bed.id, "KIT-02", b7.id]);
  assert.equal(p.links.length, 1);
  assert.throws(() => m.moveToFloor(p, light.id, main.id, 1, 1, bed.id, 2100), /another floor/);
});

test("recentCustomNames lists things typed for Something else, newest first", () => {
  const { p, main, kit } = wired();
  const add = (customName, created, type = "X") => m.placeDevice(p, { floorId: main.id, roomId: kit.id, type, x: 1, y: 1, customName }, created);
  add("Sump pump", 2000); add("Attic fan", 3000); add("Sump pump", 4000); add("Dryer outlet", 5000, "R");
  assert.deepEqual(m.recentCustomNames(p), ["Sump pump", "Attic fan"]);
  assert.equal(add("Heat lamp", 6000).type, "X");
});

test("toggleLink adds, then removes, and the lookups follow", () => {
  const { p, sw, light, outlet } = wired();
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1500);
  m.toggleLink(p, { switchId: sw.id, loadId: outlet.id, loadPart: "top" }, 1500);
  assert.deepEqual(m.controls(p, sw.id, 1).map((l) => l.loadId), [light.id, outlet.id]);
  assert.deepEqual(m.controlledBy(p, outlet.id).map((l) => [l.switchId, l.loadPart]), [[sw.id, "top"]]);
  assert.equal(m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1600), null);
  assert.deepEqual(m.controls(p, sw.id, 1).map((l) => l.loadId), [outlet.id]);
});

test("unlinkedToggles lists switch toggles that control nothing yet", () => {
  const { p, sw, light } = wired();
  m.update(p, "devices", sw.id, { toggles: 2 }, 1500);
  m.toggleLink(p, { switchId: sw.id, toggle: 2, loadId: light.id }, 1500);
  assert.deepEqual(m.unlinkedToggles(p), [{ deviceId: sw.id, toggle: 1 }]);
});

test("setBreaker records the breaker and whether it was tested", () => {
  const { p, outlet, b7 } = wired();
  m.setBreaker(p, outlet.id, b7.id, true, 1700);
  assert.deepEqual([outlet.breakerId, outlet.tested, outlet.updated], [b7.id, true, 1700]);
});

test("breaker slots: keys, clashes and order", () => {
  const { p, panel, b7 } = wired();
  assert.equal(b7.poles, 1);
  const pair = m.addBreaker(p, { panelId: panel.id, slots: ["13", "15"], amps: 30 }, 1);
  assert.equal(pair.poles, 2);
  assert.equal(m.breakerKey(pair), "13/15");
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["7"], amps: 15 }, 1), /slot 7 is already used/);
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["7a"], amps: 15 }, 1), /already used/);
  m.addBreaker(p, { panelId: panel.id, slots: ["9a"], amps: 15 }, 1);
  m.addBreaker(p, { panelId: panel.id, slots: ["9b"], amps: 15 }, 1);
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["9"], amps: 15 }, 1), /already used/);
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["x"], amps: 15 }, 1), /bad slot/);
  assert.deepEqual(m.sortedBreakers(p, panel.id).map(m.breakerKey), ["7", "9a", "9b", "13/15"]);
});

test("restoreSnapshot brings a deleted device back and removes an added one, for merges too", () => {
  const { p, main, kit } = sample();
  const d = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  const before = structuredClone(p);
  m.remove(p, "devices", d.id, 2000);
  m.restoreSnapshot(p, before, 3000);
  assert.deepEqual([m.find(p, "devices", d.id).updated, p.deleted], [3000, []]);
  const snap2 = structuredClone(p);
  const e = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "S", x: 2, y: 2 }, 3500);
  m.restoreSnapshot(p, snap2, 4000);
  assert.deepEqual([m.find(p, "devices", e.id), p.deleted], [null, [{ id: e.id, at: 4000 }]]);
});

test("editRoom renames freely but locks the code once the room has devices", () => {
  const { p, kit, ext, light } = wired();
  assert.equal(m.editRoom(p, kit.id, { name: "Dining", code: "KIT" }, 2000).name, "Dining");
  assert.throws(() => m.editRoom(p, kit.id, { code: "DIN" }, 2001), /already use KIT/);
  assert.equal(light.label, "KIT-02");
  assert.equal(m.editRoom(p, ext.id, { code: "OUT" }, 2002).code, "OUT");
  assert.throws(() => m.editRoom(p, ext.id, { code: "KIT" }, 2003), /already used/);
  assert.throws(() => m.editRoom(p, ext.id, { code: "o" }, 2003), /room code/);
});

test("outlineMismatches lists devices an edited outline leaves out or takes in", () => {
  const { p, main, kit, ext, sw, outlet } = wired();
  const stray = m.placeDevice(p, { floorId: main.id, roomId: ext.id, type: "D", x: 20, y: 20 }, 1500);
  assert.deepEqual(m.outlineMismatches(p, kit.id).outside, []);
  assert.deepEqual(m.outlineMismatches(p, kit.id).inside.map((d) => d.id), [stray.id]);
  m.setOutline(p, kit.id, [[0, 0], [60, 0], [60, 100], [0, 100]], 2000);
  assert.deepEqual(m.outlineMismatches(p, kit.id).outside.map((d) => d.id), [outlet.id]);
  assert.equal(sw.roomId, kit.id);
});

test("removeRoom keeps its devices (no room) unless told to delete them", () => {
  const { p, kit, sw, light } = wired();
  m.removeRoom(p, kit.id, {}, 3000);
  assert.equal(m.find(p, "rooms", kit.id), null);
  assert.deepEqual([sw.roomId, sw.label, sw.updated], ["", "KIT-01", 3000]);
  const b = wired();
  m.removeRoom(b.p, b.kit.id, { deleteDevices: true }, 3000);
  assert.deepEqual(b.p.devices, []);
});

test("breakers: kind, panel size, entered count and the feed chain are checked", () => {
  const { p, panel, b7 } = wired();
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["21"], amps: 15 }, 1), /past the end/);
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["0"], amps: 15 }, 1), /past the end/);
  assert.throws(() => m.addBreaker(p, { panelId: panel.id, slots: ["3"], amps: 15, kind: "weird" }, 1), /bad breaker kind/);
  m.addBreaker(p, { panelId: panel.id, slots: ["3"], amps: 0, kind: "empty" }, 1);
  assert.equal(m.slotsEntered(p, panel.id), 2);
  m.addBreaker(p, { panelId: panel.id, slots: ["9a"], amps: 15 }, 1);
  m.addBreaker(p, { panelId: panel.id, slots: ["9b"], amps: 15 }, 1);
  assert.equal(m.slotsEntered(p, panel.id), 3);
  const sub = m.addPanel(p, { name: "Garage sub", slotCount: 12 }, 2);
  m.setFedFrom(p, sub.id, b7.id, 3);
  assert.equal(sub.fedFromBreakerId, b7.id);
  const sb = m.addBreaker(p, { panelId: sub.id, slots: ["1"], amps: 20 }, 4);
  assert.throws(() => m.setFedFrom(p, panel.id, sb.id, 5), /fed from itself/);
  assert.throws(() => m.setFedFrom(p, panel.id, b7.id, 5), /fed from itself/);
  m.setFedFrom(p, sub.id, "", 6);
  assert.equal(sub.fedFromBreakerId, "");
});

test("panel numbering decides which spaces pair; spaces can grow but not shrink past a breaker", () => {
  const { p, panel } = wired();
  assert.equal(m.canPair(panel, "13", "15"), true);
  assert.equal(m.canPair(panel, "13", "14"), false);
  assert.equal(m.canPair(panel, "13", "17"), false);
  const down = m.addPanel(p, { name: "Old", slotCount: 20, numbering: "down" }, 1);
  assert.deepEqual([m.canPair(down, "3", "4"), m.canPair(down, "10", "11"), m.canPair(down, "11", "12"), m.canPair(down, "3", "5")], [true, false, true, false]);
  assert.throws(() => m.addPanel(p, { name: "x", numbering: "spiral" }, 1), /numbering/);
  assert.throws(() => m.setSlotCount(p, panel.id, 6, 2), /already has a breaker/);
  m.setSlotCount(p, panel.id, 30, 2);
  assert.equal(panel.slotCount, 30);
});

test("a GFCI outlet protects others; deleting or changing it clears that", () => {
  const { p, main, kit, outlet, light } = wired();
  const g = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "G", x: 4, y: 4 }, 1500);
  m.setProtection(p, outlet.id, g.id, 2000);
  assert.deepEqual(m.protectedBy(p, g.id).map((d) => d.id), [outlet.id]);
  assert.throws(() => m.setProtection(p, outlet.id, light.id, 2001), /not a GFCI/);
  assert.throws(() => m.setProtection(p, g.id, g.id, 2001), /behind itself/);
  m.changeType(p, g.id, "D", "", 2100);
  assert.equal(outlet.gfciId, "");
  m.changeType(p, g.id, "G", "", 2200);
  m.setProtection(p, outlet.id, g.id, 2300);
  m.remove(p, "devices", g.id, 2400);
  assert.equal(outlet.gfciId, "");
});

test("devices that are not working are left out of the breaker test until cleared", () => {
  const { p, light, outlet, b7 } = wired();
  m.setBreaker(p, outlet.id, b7.id, true, 1600);
  m.setNotWorking(p, outlet.id, true, 2000);
  const listed = () => m.sweepList(p, b7.id).flatMap((g) => g.devices.map((d) => d.id));
  assert.deepEqual(listed(), [light.id]);
  assert.deepEqual(m.notWorking(p).map((d) => d.id), [outlet.id]);
  m.markNoBreaker(p, outlet.id, 3000);
  assert.deepEqual([outlet.breakerId, outlet.tested, outlet.notWorking], ["", false, true]);
  m.setNotWorking(p, outlet.id, false, 4000);
  assert.deepEqual(listed(), [light.id, outlet.id]);
});

test("unconfirmedOnBreaker lists what is assigned to a breaker but still had power", () => {
  const { p, main, light, outlet, b7 } = wired();
  m.setBreaker(p, outlet.id, b7.id, true, 1600);
  m.setBreaker(p, light.id, b7.id, false, 1600);
  const ids = (list) => list.map((d) => d.id);
  let r = m.unconfirmedOnBreaker(p, b7.id, [outlet.id], [main.id]);
  assert.deepEqual([ids(r.guessed), ids(r.tested)], [[light.id], []]);
  r = m.unconfirmedOnBreaker(p, b7.id, [], [main.id]);
  assert.deepEqual([ids(r.guessed), ids(r.tested)], [[light.id], [outlet.id]]);
  r = m.unconfirmedOnBreaker(p, b7.id, [], []);
  assert.deepEqual([ids(r.guessed), ids(r.tested)], [[], []]);
  assert.throws(() => m.setBreaker(p, light.id, "nope", true, 1700), /no breakers record/);
});

test("changesSince counts edits and deletions after a time", () => {
  const { p, light, outlet } = wired();
  assert.equal(m.changesSince(p, 1e9), 0);
  const before = m.changesSince(p, 1300);
  m.update(p, "devices", light.id, { note: "x" }, 5000);
  m.remove(p, "devices", outlet.id, 6000);
  assert.equal(m.changesSince(p, 4000), 2);
  assert.ok(m.changesSince(p, 1300) > before);
  assert.deepEqual(m.describeProject(p), { name: "Dad's house", floors: 1, devices: 2, updated: 6000 });
});

test("sweepList puts rooms with devices on this breaker first, rooms without a room last", () => {
  const { p, main, ext, outlet, b7 } = wired();
  const flood = m.placeDevice(p, { floorId: main.id, roomId: ext.id, type: "FL", x: 3, y: 3 }, 1500);
  m.setBreaker(p, outlet.id, b7.id, true, 1600);
  const names = () => m.sweepList(p, b7.id).map((g) => g.roomName);
  assert.deepEqual(names(), ["Kitchen", "Exterior"]);
  assert.deepEqual(m.sweepList(p, b7.id)[0].devices.map((d) => d.label), ["KIT-02", "KIT-03"]);
  m.setRoom(p, flood.id, "", false, 1700);
  assert.deepEqual(names(), ["Kitchen", "No room"]);
});

test("markSwept records a finished breaker test, and unsweptBreakers skips it and empty spaces", () => {
  const { p, main, kit, panel, b7 } = wired();
  const b9 = m.addBreaker(p, { panelId: panel.id, slots: ["9"], amps: 15 }, 1);
  m.addBreaker(p, { panelId: panel.id, slots: ["11"], amps: 0, kind: "empty" }, 1);
  assert.deepEqual(m.unsweptBreakers(p).map((b) => b.id), [b7.id, b9.id]);
  m.markSwept(p, b7.id, 5000);
  assert.equal(b7.swept, 5000);
  assert.deepEqual(m.unsweptBreakers(p).map((b) => b.id), [b9.id]);
  m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 9, y: 9 }, 6000);
  assert.deepEqual(m.unsweptBreakers(p).map((b) => b.id), [b7.id, b9.id]);
});

test("changing the numbering lists double breakers that no longer sit together", () => {
  const { p, panel } = wired();
  const pair = m.addBreaker(p, { panelId: panel.id, slots: ["13", "15"], amps: 30 }, 1);
  assert.deepEqual(m.unpairedBreakers(p, panel.id), []);
  m.setNumbering(p, panel.id, "down", 2);
  assert.deepEqual(m.unpairedBreakers(p, panel.id).map((b) => b.id), [pair.id]);
  assert.throws(() => m.setNumbering(p, panel.id, "spiral", 3), /numbering/);
});

test("removing a device removes its links and leaves tombstones", () => {
  const { p, sw, light } = wired();
  const link = m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1500);
  assert.deepEqual(m.affected(p, "devices", light.id), { links: 1 });
  m.remove(p, "devices", light.id, 1800);
  assert.equal(m.find(p, "devices", light.id), null);
  assert.deepEqual(p.links, []);
  assert.deepEqual(p.deleted, [{ id: light.id, at: 1800 }, { id: link.id, at: 1800 }]);
});

test("removing a floor takes its rooms, devices and links", () => {
  const { p, main, sw, light } = wired();
  m.toggleLink(p, { switchId: sw.id, loadId: light.id }, 1500);
  assert.deepEqual(m.affected(p, "floors", main.id), { rooms: 2, devices: 3, links: 1 });
  m.remove(p, "floors", main.id, 1800);
  assert.deepEqual([p.floors, p.rooms, p.devices, p.links], [[], [], [], []]);
  assert.equal(p.deleted.length, 7);
});

test("removing a panel removes its breakers and unassigns their devices", () => {
  const { p, panel, b7, outlet } = wired();
  m.setBreaker(p, outlet.id, b7.id, true, 1700);
  const sub = m.addPanel(p, { name: "Garage sub" }, 1700);
  m.update(p, "panels", sub.id, { fedFromBreakerId: b7.id }, 1700);
  assert.deepEqual(m.affected(p, "panels", panel.id), { breakers: 1, unassigned: 1 });
  m.remove(p, "panels", panel.id, 1900);
  assert.deepEqual(p.breakers, []);
  assert.deepEqual([outlet.breakerId, outlet.tested, outlet.updated], ["", false, 1900]);
  assert.deepEqual([sub.fedFromBreakerId, sub.updated], ["", 1900]);
});
