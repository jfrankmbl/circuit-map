import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "../src/model.js";
import { merge } from "../src/merge.js";
import { sample } from "./helpers.js";

// Two devices start from the same copy, as after an import.
function pair() {
  const { p, main, kit } = sample();
  const first = m.placeDevice(p, { floorId: main.id, roomId: kit.id, type: "D", x: 1, y: 1 }, 1100);
  return { phone: p, mac: structuredClone(p), main, kit, first };
}

test("things added on either side are all kept", () => {
  const { phone, mac, main, kit } = pair();
  const a = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "L", x: 5, y: 5 }, 2000);
  const upstairs = m.addFloor(mac, "Upstairs", 2100);
  const { project, summary } = merge(phone, mac);
  assert.ok(m.find(project, "devices", a.id));
  assert.ok(m.find(project, "floors", upstairs.id));
  assert.deepEqual([summary.added, summary.updated, summary.removed], [1, 0, 0]);
});

test("the newer change to the same record wins whole", () => {
  const { phone, mac, first } = pair();
  m.update(phone, "devices", first.id, { note: "phone note", heightIn: 20 }, 2000);
  m.update(mac, "devices", first.id, { note: "mac note" }, 3000);
  const { project, summary } = merge(phone, mac);
  const d = m.find(project, "devices", first.id);
  assert.deepEqual([d.note, d.heightIn], ["mac note", 12]);
  assert.equal(summary.updated, 1);
  assert.deepEqual(summary.changed.map((c) => [c.coll, c.name, c.fields]), [["devices", first.label, ["heightIn", "note"]]]);
});

test("the same edit made on both devices is not reported as a change", () => {
  const { phone, mac, first } = pair();
  m.update(phone, "devices", first.id, { note: "same" }, 2000);
  m.update(mac, "devices", first.id, { note: "same" }, 3000);
  const { summary } = merge(phone, mac);
  assert.deepEqual([summary.updated, summary.changed], [0, []]);
});

test("the project name follows the newer rename", () => {
  const { phone, mac } = pair();
  m.rename(mac, "Renamed", 5000);
  assert.equal(merge(phone, mac).project.name, "Renamed");
  assert.equal(merge(mac, phone).project.name, "Renamed");
});

test("a deletion is not undone by the other copy", () => {
  const { phone, mac, first } = pair();
  m.remove(mac, "devices", first.id, 2000);
  const { project, summary } = merge(phone, mac);
  assert.equal(m.find(project, "devices", first.id), null);
  assert.equal(summary.removed, 1);
  assert.deepEqual(summary.removedItems, [{ coll: "devices", id: first.id, name: first.label }]);
  assert.deepEqual(project.deleted, [{ id: first.id, at: 2000 }]);
});

test("an edit made after the deletion keeps the record", () => {
  const { phone, mac, first } = pair();
  m.remove(mac, "devices", first.id, 2000);
  m.update(phone, "devices", first.id, { note: "still here" }, 2500);
  assert.equal(m.find(merge(phone, mac).project, "devices", first.id).note, "still here");
});

test("two devices given the same label: the later one is renumbered", () => {
  const { phone, mac, main, kit } = pair();
  const onPhone = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "D", x: 2, y: 2 }, 2000);
  const onMac = m.placeDevice(mac, { floorId: main.id, roomId: kit.id, type: "S", x: 3, y: 3 }, 2500);
  assert.equal(onPhone.label, onMac.label);
  const { project, summary } = merge(phone, mac);
  assert.equal(m.find(project, "devices", onPhone.id).label, "KIT-02");
  assert.equal(m.find(project, "devices", onMac.id).label, "KIT-03");
  assert.deepEqual(summary.renumbered, [{ id: onMac.id, from: "KIT-02", to: "KIT-03", keptId: onPhone.id }]);
  assert.equal(m.find(project, "devices", onMac.id).plateLabel, "KIT-02");
});

test("a link to a device deleted elsewhere is dropped", () => {
  const { phone, mac, main, kit, first } = pair();
  const sw = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "S", x: 2, y: 2 }, 2000);
  m.toggleLink(phone, { switchId: sw.id, loadId: first.id }, 2000);
  m.remove(mac, "devices", first.id, 3000);
  const { project } = merge(phone, mac);
  assert.equal(m.find(project, "devices", first.id), null);
  assert.ok(m.find(project, "devices", sw.id));
  assert.deepEqual(project.links, []);
});

test("a device added to a room deleted elsewhere is kept, with no room", () => {
  const { phone, main } = pair();
  const den = m.addRoom(phone, { floorId: main.id, name: "Den", code: "DEN" }, 1200);
  const mac = structuredClone(phone);
  m.remove(mac, "rooms", den.id, 2000);
  const lamp = m.placeDevice(phone, { floorId: main.id, roomId: den.id, type: "L", x: 9, y: 9 }, 2500);
  const { project } = merge(phone, mac);
  assert.equal(m.find(project, "rooms", den.id), null);
  assert.deepEqual([m.find(project, "devices", lamp.id).roomId, m.find(project, "devices", lamp.id).label], ["", "DEN-01"]);
});

test("a breaker deleted elsewhere is cleared from devices that point at it", () => {
  const { phone, first } = pair();
  const panel = m.addPanel(phone, { name: "Main" }, 1200);
  const b = m.addBreaker(phone, { panelId: panel.id, slots: ["1"], amps: 15 }, 1200);
  const mac = structuredClone(phone);
  m.setBreaker(phone, first.id, b.id, true, 3000);
  m.remove(mac, "breakers", b.id, 2000);
  const d = m.find(merge(phone, mac).project, "devices", first.id);
  assert.deepEqual([d.breakerId, d.tested], ["", false]);
});

test("a device behind a GFCI deleted elsewhere is cleared of it", () => {
  const { phone, main, kit, first } = pair();
  const g = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "G", x: 5, y: 5 }, 1500);
  const mac = structuredClone(phone);
  m.setProtection(phone, first.id, g.id, 3000);
  m.remove(mac, "devices", g.id, 2000);
  assert.equal(m.find(merge(phone, mac).project, "devices", first.id).gfciId, "");
});

test("the same link made on both devices collapses to one", () => {
  const { phone, mac, main, kit, first } = pair();
  const sw = m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "S", x: 2, y: 2 }, 1500);
  const mac2 = merge(mac, phone).project;
  m.toggleLink(phone, { switchId: sw.id, loadId: first.id }, 2000);
  m.toggleLink(mac2, { switchId: sw.id, loadId: first.id }, 2100);
  assert.equal(merge(phone, mac2).project.links.length, 1);
});

test("merging is symmetric and does not change its inputs", () => {
  const { phone, mac, main, kit, first } = pair();
  m.placeDevice(phone, { floorId: main.id, roomId: kit.id, type: "D", x: 2, y: 2 }, 2000);
  m.placeDevice(mac, { floorId: main.id, roomId: kit.id, type: "S", x: 3, y: 3 }, 2500);
  m.update(phone, "devices", first.id, { note: "a" }, 2600);
  m.update(mac, "devices", first.id, { note: "b" }, 2600); // same instant: a tie
  m.addFloor(mac, "Basement", 2700);
  const before = [structuredClone(phone), structuredClone(mac)];
  const ab = merge(phone, mac).project, ba = merge(mac, phone).project;
  assert.deepEqual(ab, ba);
  assert.deepEqual([phone, mac], before);
  assert.deepEqual(merge(ab, mac).project, ab); // merging again changes nothing
});

test("a file from a different house is refused", () => {
  const { phone } = pair();
  const other = m.createProject("Other", 1);
  assert.throws(() => merge(phone, other), (e) => e.code === "different-project");
});
