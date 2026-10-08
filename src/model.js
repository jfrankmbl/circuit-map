// The project: one plain object holding everything about one house. All edits go through this module.
import { CODE_PATTERN, nextLabel } from "./ids.js";
import { typeInfo, isSwitch, hasHalves } from "./catalog.js";

export const FORMAT_VERSION = 1;
export const COLLECTIONS = ["floors", "rooms", "devices", "links", "panels", "breakers"];

export function newId() {
  return globalThis.crypto.randomUUID();
}

export function createProject(name, now = Date.now()) {
  return { formatVersion: FORMAT_VERSION, id: newId(), name, updated: now,
    floors: [], rooms: [], devices: [], links: [], panels: [], breakers: [], deleted: [] };
}

export function rename(project, name, now = Date.now()) {
  project.name = name;
  project.updated = now;
}

export function find(project, coll, id) {
  return project[coll].find((r) => r.id === id) || null;
}

export function add(project, coll, fields, now = Date.now()) {
  const rec = { id: newId(), ...fields, updated: now };
  project[coll].push(rec);
  return rec;
}

export function update(project, coll, id, fields, now = Date.now()) {
  const rec = find(project, coll, id);
  if (!rec) throw new Error(`no ${coll} record ${id}`);
  Object.assign(rec, fields, { updated: now });
  return rec;
}

// ---- undo
// The views keep structuredClone(project) snapshots before each change. Restoring one must re-stamp what it brings
// back with `now`, and clear its tombstones, or a later merge would delete the restored records again.
export function restoreSnapshot(project, snap, now = Date.now()) {
  const keep = new Set();
  for (const c of COLLECTIONS) for (const r of snap[c]) keep.add(r.id);
  for (const c of COLLECTIONS) {
    const cur = new Map(project[c].map((r) => [r.id, r]));
    for (const r of project[c]) if (!keep.has(r.id)) project.deleted.push({ id: r.id, at: now });
    project[c] = snap[c].map((r) => {
      const same = cur.get(r.id);
      return same && JSON.stringify(same) === JSON.stringify(r) ? same : { ...structuredClone(r), updated: now };
    });
  }
  project.deleted = project.deleted.filter((t) => !keep.has(t.id));
  project.name = snap.name;
  project.updated = now;
}

// ---- floors

// New floors go last (or first, for a basement). Max + 1, not the count, so a floor added after another was deleted does not
// share an order.
export function addFloor(project, name, now = Date.now(), atBottom = false) {
  const orders = project.floors.map((f) => f.order);
  const order = !orders.length ? 0 : atBottom ? Math.min(...orders) - 1 : Math.max(...orders) + 1;
  return add(project, "floors", { name, order, imageId: "", pxPerIn: 0 }, now);
}

// Floors in display order. Two copies merged can hold equal orders, so ties fall back to id (same on both devices).
export function sortedFloors(project) {
  return [...project.floors].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Move up/down buttons: delta -1 or +1. Renumbers 0..n-1 and stamps only the floors whose order changed.
export function moveFloor(project, floorId, delta, now = Date.now()) {
  const list = sortedFloors(project);
  const i = list.findIndex((f) => f.id === floorId);
  if (i < 0) throw new Error(`no floors record ${floorId}`);
  const j = i + delta;
  if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  list.forEach((f, n) => { if (f.order !== n) update(project, "floors", f.id, { order: n }, now); });
}

export function scaleFromPoints(a, b, inches) {
  const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!px) throw new Error("pick two different points");
  if (!(inches > 0)) throw new Error("enter the distance between the points");
  return px / inches;
}

// ---- rooms

export function addRoom(project, { floorId, name, code }, now = Date.now()) {
  if (!CODE_PATTERN.test(code)) throw new Error("room code must be 2-4 capitals or digits, starting with a letter");
  if (project.rooms.some((r) => r.code === code)) throw new Error(`room code ${code} is already used`);
  return add(project, "rooms", { floorId, code, name, outline: [] }, now);
}

// Rename a room or change its code. Labels are written on cover plates, so the code is locked once the room has devices.
export function editRoom(project, roomId, { name, code }, now = Date.now()) {
  const room = find(project, "rooms", roomId);
  if (!room) throw new Error(`no rooms record ${roomId}`);
  const fields = {};
  if (name !== undefined) fields.name = name;
  if (code !== undefined && code !== room.code) {
    if (project.devices.some((d) => d.roomId === roomId)) {
      throw new Error(`Labels in this room already use ${room.code}, so the code can't change.`);
    }
    if (!CODE_PATTERN.test(code)) throw new Error("room code must be 2-4 capitals or digits, starting with a letter");
    if (project.rooms.some((r) => r.id !== roomId && r.code === code)) throw new Error(`room code ${code} is already used`);
    fields.code = code;
  }
  return update(project, "rooms", roomId, fields, now);
}

export function pointInOutline(outline, x, y) {
  if (outline.length < 3) return false;
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function roomsAt(project, floorId, x, y) {
  return project.rooms.filter((r) => r.floorId === floorId && pointInOutline(r.outline, x, y));
}

const orient = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
const segmentsCross = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;

export function outlineCrossesItself(outline) {
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbouring edges share a corner
      if (segmentsCross(outline[i], outline[(i + 1) % n], outline[j], outline[(j + 1) % n])) return true;
    }
  }
  return false;
}

// Set a room's outline from the corners tapped. Refuses what could not be a room.
export function setOutline(project, roomId, outline, now = Date.now()) {
  if (outline.length < 3) throw new Error("a room needs at least three corners");
  if (outlineCrossesItself(outline)) throw new Error("The lines cross. Undo the last corner or drag a corner.");
  return update(project, "rooms", roomId, { outline }, now);
}

const area = (o) => Math.abs(o.reduce((sum, [x1, y1], i) => { const [x2, y2] = o[(i + 1) % o.length]; return sum + x1 * y2 - x2 * y1; }, 0)) / 2;

function outlineInside(inner, outer) {
  if (!inner.every(([x, y]) => pointInOutline(outer, x, y))) return false;
  for (let i = 0; i < inner.length; i++) {
    for (let j = 0; j < outer.length; j++) {
      if (segmentsCross(inner[i], inner[(i + 1) % inner.length], outer[j], outer[(j + 1) % outer.length])) return false;
    }
  }
  return true;
}

// Which room does a tap belong to? { room, choices }. room is set when it is clear: one outline, or nested
// outlines (a closet inside a bedroom: the inner one). room is null when the tap is outside every outline or
// partly overlaps several; choices lists the outlines hit, for "which room?".
export function roomAt(project, floorId, x, y) {
  const hits = roomsAt(project, floorId, x, y).sort((a, b) => area(a.outline) - area(b.outline));
  if (hits.length === 0) return { room: null, choices: [] };
  const [inner, ...outer] = hits;
  const clear = outer.every((o) => outlineInside(inner.outline, o.outline));
  return { room: clear ? inner : null, choices: hits };
}

// After a room's outline is edited: devices that belong to the room but are now outside it, and devices of other
// rooms (or none) that the outlines now put inside it. Nothing is changed; the view shows the counts and a Review list.
export function outlineMismatches(project, roomId) {
  const room = find(project, "rooms", roomId);
  if (!room) throw new Error(`no rooms record ${roomId}`);
  const out = { outside: [], inside: [] };
  if (room.outline.length < 3) return out;
  for (const d of project.devices) {
    if (d.floorId !== room.floorId) continue;
    if (d.roomId === roomId) {
      if (!pointInOutline(room.outline, d.x, d.y)) out.outside.push(d);
    } else if (roomAt(project, d.floorId, d.x, d.y).room?.id === roomId) {
      out.inside.push(d);
    }
  }
  return out;
}

// ---- devices

export function placeDevice(project, { floorId, roomId, type, x, y, customName = "", toggles = 1 }, now = Date.now()) {
  const room = find(project, "rooms", roomId);
  if (!room) throw new Error("placeDevice needs a room");
  if (isSwitch(type) && !(Number.isInteger(toggles) && toggles >= 1 && toggles <= 4)) throw new Error("a switch plate has 1 to 4 toggles");
  return add(project, "devices", {
    label: nextLabel(project, room.code), roomId, floorId, type, customName, x, y,
    heightIn: typeInfo(type).heightIn, toggles: isSwitch(type) ? toggles : 0, note: "",
    breakerId: "", tested: false, gfciId: "", notWorking: false, plateLabel: "", created: now,
  }, now);
}

// Say which GFCI outlet a device is behind ("" = none known).
export function setProtection(project, deviceId, gfciId, now = Date.now()) {
  if (!find(project, "devices", deviceId)) throw new Error(`no devices record ${deviceId}`);
  if (gfciId) {
    if (gfciId === deviceId) throw new Error("a device cannot be behind itself");
    const g = find(project, "devices", gfciId);
    if (!g || g.type !== "G") throw new Error("that is not a GFCI outlet");
  }
  return update(project, "devices", deviceId, { gfciId }, now);
}

export function protectedBy(project, gfciId) {
  return project.devices.filter((d) => d.gfciId === gfciId);
}

// After a breaker test: devices already assigned to the breaker that were not marked dead this time. A wrong guess,
// or a circuit that has changed, shows up here. deadIds = the ids marked "no power" in this test; checkedFloorIds =
// the floors he ticked as walked (a device on a floor he did not walk has not been seen, so it is not listed).
export function unconfirmedOnBreaker(project, breakerId, deadIds, checkedFloorIds) {
  const dead = new Set(deadIds), checked = new Set(checkedFloorIds);
  const here = project.devices.filter((d) => d.breakerId === breakerId && !dead.has(d.id) && checked.has(d.floorId));
  return { guessed: here.filter((d) => !d.tested), tested: here.filter((d) => d.tested) };
}

// "What is on breaker 14?": the devices directly on it, those reached through a subpanel it feeds, and a count by group
// (outlet, switch, light, other, custom).
export function devicesOnBreaker(project, breakerId) {
  const direct = project.devices.filter((d) => d.breakerId === breakerId);
  const downstream = [];
  const seen = new Set();
  const walk = (feedId) => {
    for (const panel of project.panels) {
      if (panel.fedFromBreakerId !== feedId || seen.has(panel.id)) continue;
      seen.add(panel.id);
      for (const b of project.breakers.filter((x) => x.panelId === panel.id)) {
        downstream.push(...project.devices.filter((d) => d.breakerId === b.id));
        walk(b.id);
      }
    }
  };
  walk(breakerId);
  const groups = {};
  for (const d of direct) {
    const g = typeInfo(d.type).group;
    groups[g] = (groups[g] || 0) + 1;
  }
  return { direct, downstream, groups };
}

// "Where is the other switch for this light?": the other switches that control what this switch toggle controls.
export function otherSwitches(project, switchId, toggle = 1) {
  const loads = new Set(controls(project, switchId, toggle).map((l) => l.loadId));
  const out = [];
  const seen = new Set();
  for (const l of project.links) {
    if (!loads.has(l.loadId) || (l.switchId === switchId && l.toggle === toggle)) continue;
    const key = l.switchId + "|" + l.toggle + "|" + l.loadId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ switchId: l.switchId, toggle: l.toggle, loadId: l.loadId });
  }
  return out;
}

// The "Something has no power" card. target = { roomId } or { deviceId }. Returns what to check first (GFCI outlets,
// switches, devices flagged not working), the breakers that feed it ranked by how many of its devices are on them, and
// the devices with no breaker recorded. feederId is the breaker that feeds the subpanel a breaker sits on ("" if none).
export function powerOutHelp(project, { roomId, deviceId }) {
  const devices = roomId ? project.devices.filter((d) => d.roomId === roomId) : [find(project, "devices", deviceId)].filter(Boolean);
  const ids = new Set(devices.map((d) => d.id));
  const byBreaker = new Map();
  for (const d of devices) {
    if (!d.breakerId) continue;
    const e = byBreaker.get(d.breakerId) || { breakerId: d.breakerId, count: 0, tested: 0, guessed: 0 };
    e.count++;
    if (d.tested) e.tested++;
    else e.guessed++;
    byBreaker.set(d.breakerId, e);
  }
  const breakers = [...byBreaker.values()].map((e) => {
    const b = find(project, "breakers", e.breakerId);
    const panel = b && find(project, "panels", b.panelId);
    return { ...e, feederId: (panel && panel.fedFromBreakerId) || "" };
  }).sort((a, b) => b.count - a.count || b.tested - a.tested);
  const gfciIds = new Set();
  for (const d of devices) {
    if (d.gfciId) gfciIds.add(d.gfciId);
    if (d.type === "G") gfciIds.add(d.id);
  }
  const gfcis = [...gfciIds].map((id) => find(project, "devices", id)).filter(Boolean)
    .map((g) => ({ id: g.id, label: g.label, protects: protectedBy(project, g.id).length }));
  const seen = new Set();
  const switches = [];
  for (const l of project.links) {
    const key = l.switchId + "|" + l.toggle;
    if (!ids.has(l.loadId) || seen.has(key)) continue;
    seen.add(key);
    const sw = find(project, "devices", l.switchId);
    if (sw) switches.push({ id: sw.id, label: sw.label, toggle: l.toggle, controls: l.loadId });
  }
  return {
    count: devices.length, breakers, gfcis, switches,
    notWorking: devices.filter((d) => d.notWorking).map((d) => d.id),
    unknown: devices.filter((d) => !d.breakerId && typeInfo(d.type).sweep && !d.notWorking).map((d) => d.id),
  };
}

// "Doesn't work right now": left out of breaker tests until cleared.
export function setNotWorking(project, deviceId, flag, now = Date.now()) {
  return update(project, "devices", deviceId, { notWorking: !!flag }, now);
}

export function notWorking(project) {
  return project.devices.filter((d) => d.notWorking);
}

// It went dead on a breaker test but is not on that breaker, or any: no breaker, and not working.
export function markNoBreaker(project, deviceId, now = Date.now()) {
  return update(project, "devices", deviceId, { breakerId: "", tested: false, notWorking: true }, now);
}

export function setBreaker(project, deviceId, breakerId, tested, now = Date.now()) {
  if (breakerId && !find(project, "breakers", breakerId)) throw new Error(`no breakers record ${breakerId}`);
  return update(project, "devices", deviceId, { breakerId, tested: !!breakerId && tested }, now);
}

// How many links would be lost by cutting a plate down to `count` toggles (for the "Remove it?" question).
export function linksOnRemovedToggles(project, deviceId, count) {
  return project.links.filter((l) => l.switchId === deviceId && l.toggle > count).length;
}

export function setToggles(project, deviceId, count, now = Date.now()) {
  const d = find(project, "devices", deviceId);
  if (!d) throw new Error(`no devices record ${deviceId}`);
  if (!isSwitch(d.type)) throw new Error("only switches have toggles");
  if (!(Number.isInteger(count) && count >= 1 && count <= 4)) throw new Error("a switch plate has 1 to 4 toggles");
  for (const l of project.links.filter((x) => x.switchId === deviceId && x.toggle > count)) remove(project, "links", l.id, now);
  return update(project, "devices", deviceId, { toggles: count }, now);
}

// Links that would be dropped if this device became `type`: a switch that stops being one loses what it controls,
// a device that becomes a switch can no longer be controlled by one.
export function linksLostByTypeChange(project, deviceId, type) {
  const sw = isSwitch(type);
  return project.links.filter((l) => (l.switchId === deviceId && !sw) || (l.loadId === deviceId && sw));
}

// Change what a device is. Keeps a height he edited, drops links that no longer make sense, and clears a breaker
// the new type cannot have. customName is replaced (pass "" for none).
export function changeType(project, deviceId, type, customName = "", now = Date.now()) {
  const d = find(project, "devices", deviceId);
  if (!d) throw new Error(`no devices record ${deviceId}`);
  const was = typeInfo(d.type), next = typeInfo(type);
  const fields = { type, customName, toggles: isSwitch(type) ? Math.max(1, d.toggles) : 0 };
  if (d.heightIn === was.heightIn) fields.heightIn = next.heightIn;
  if (!next.sweep) Object.assign(fields, { breakerId: "", tested: false });
  for (const l of linksLostByTypeChange(project, deviceId, type)) remove(project, "links", l.id, now);
  if (d.type === "G" && type !== "G") for (const x of protectedBy(project, deviceId)) update(project, "devices", x.id, { gfciId: "" }, now);
  return update(project, "devices", deviceId, fields, now);
}

// Put a device in another room on the same floor ("" = no room). relabel gives it the next number in that room.
export function setRoom(project, deviceId, roomId, relabel = false, now = Date.now()) {
  const d = find(project, "devices", deviceId);
  if (!d) throw new Error(`no devices record ${deviceId}`);
  const fields = { roomId };
  if (roomId) {
    const room = find(project, "rooms", roomId);
    if (!room) throw new Error(`no rooms record ${roomId}`);
    if (room.floorId !== d.floorId) throw new Error("that room is on another floor");
    if (relabel && !d.label.startsWith(room.code + "-")) {
      fields.label = nextLabel(project, room.code);
      fields.plateLabel = d.plateLabel || d.label;
    }
  }
  return update(project, "devices", deviceId, fields, now);
}

// ---- plates: a label may already be written on the cover plate

// Devices whose plate still shows an old label.
export function platesToRewrite(project) {
  return project.devices.filter((d) => d.plateLabel);
}

// He has rewritten the plate.
export function confirmPlate(project, deviceId, now = Date.now()) {
  return update(project, "devices", deviceId, { plateLabel: "" }, now);
}

// Two devices trade labels (for when the other plate is easier to rewrite). A device whose plate already shows its
// new label needs no rewriting.
export function swapLabels(project, aId, bId, now = Date.now()) {
  const a = find(project, "devices", aId), b = find(project, "devices", bId);
  if (!a || !b) throw new Error("no such device");
  const onA = a.plateLabel || a.label, onB = b.plateLabel || b.label;
  const labelA = b.label, labelB = a.label;
  update(project, "devices", aId, { label: labelA, plateLabel: onA === labelA ? "" : onA }, now);
  update(project, "devices", bId, { label: labelB, plateLabel: onB === labelB ? "" : onB }, now);
}

// Put a device on another floor, at a spot he tapped there. Label, links and breaker stay. roomId must be on that floor.
export function moveToFloor(project, deviceId, floorId, x, y, roomId = "", now = Date.now()) {
  if (!find(project, "devices", deviceId)) throw new Error(`no devices record ${deviceId}`);
  if (!find(project, "floors", floorId)) throw new Error(`no floors record ${floorId}`);
  if (roomId) {
    const room = find(project, "rooms", roomId);
    if (!room || room.floorId !== floorId) throw new Error("that room is on another floor");
  }
  return update(project, "devices", deviceId, { floorId, x, y, roomId }, now);
}

// Names typed for "Something else", newest first, no repeats: offered as one-tap choices next time.
export function recentCustomNames(project, limit = 8) {
  const names = [];
  for (const d of [...project.devices].sort((a, b) => b.created - a.created)) {
    if (d.type === "X" && d.customName && !names.includes(d.customName)) names.push(d.customName);
  }
  return names.slice(0, limit);
}

// ---- links: which switch toggle controls which load

export function toggleLink(project, { switchId, toggle = 1, loadId, loadPart = "" }, now = Date.now()) {
  const sw = find(project, "devices", switchId), load = find(project, "devices", loadId);
  if (!sw || !isSwitch(sw.type)) throw new Error("that is not a switch");
  if (!(Number.isInteger(toggle) && toggle >= 1 && toggle <= sw.toggles)) throw new Error(`that plate has no switch ${toggle}`);
  if (!load || isSwitch(load.type)) throw new Error("a switch cannot be controlled by another switch");
  if (loadPart && !hasHalves(load.type)) throw new Error("only a duplex, GFCI or exterior outlet can be switched by halves");
  const hit = project.links.find((l) =>
    l.switchId === switchId && l.toggle === toggle && l.loadId === loadId && l.loadPart === loadPart);
  if (hit) {
    remove(project, "links", hit.id, now);
    return null;
  }
  // Whole and halves from the same switch replace each other.
  for (const l of project.links.filter((x) => x.switchId === switchId && x.toggle === toggle && x.loadId === loadId &&
      (loadPart === "" ? x.loadPart !== "" : x.loadPart === ""))) remove(project, "links", l.id, now);
  return add(project, "links", { switchId, toggle, loadId, loadPart }, now);
}

export function controls(project, switchId, toggle) {
  return project.links.filter((l) => l.switchId === switchId && l.toggle === toggle);
}

export function controlledBy(project, loadId) {
  return project.links.filter((l) => l.loadId === loadId);
}

export function unlinkedToggles(project) {
  const out = [];
  for (const d of project.devices) {
    for (let toggle = 1; toggle <= d.toggles; toggle++) {
      if (!controls(project, d.id, toggle).length) out.push({ deviceId: d.id, toggle });
    }
  }
  return out;
}

// ---- panels and breakers. A slot is text: "7", or "7a" / "7b" for the halves of a tandem.

// numbering: "oddEven" = 1 and 2 side by side, odd numbers down the left (most panels);
// "down" = 1 to the middle down the left side, the rest down the right.
export const NUMBERINGS = ["oddEven", "down"];

export function addPanel(project, { name, make = "", mainAmps = 0, slotCount = 20, numbering = "oddEven" }, now = Date.now()) {
  if (!NUMBERINGS.includes(numbering)) throw new Error(`bad panel numbering "${numbering}"`);
  return add(project, "panels", { name, make, mainAmps, slotCount, numbering, fedFromBreakerId: "", deviceId: "" }, now);
}

// Can two spaces be the two halves of one double breaker? Same side, next to each other.
export function canPair(panel, a, b) {
  const x = parseInt(a, 10), y = parseInt(b, 10);
  if (x === y) return false;
  if (panel.numbering === "down") {
    const half = Math.ceil(panel.slotCount / 2);
    return Math.abs(x - y) === 1 && (x <= half) === (y <= half);
  }
  return Math.abs(x - y) === 2;
}

// Change the numbering style. Double breakers that no longer sit side by side are listed by unpairedBreakers.
export function setNumbering(project, panelId, numbering, now = Date.now()) {
  if (!NUMBERINGS.includes(numbering)) throw new Error(`bad panel numbering "${numbering}"`);
  return update(project, "panels", panelId, { numbering }, now);
}

export function unpairedBreakers(project, panelId) {
  const panel = find(project, "panels", panelId);
  return project.breakers.filter((b) => b.panelId === panelId && b.poles === 2 && !canPair(panel, b.slots[0], b.slots[1]));
}

// Change how many spaces a panel has. It cannot shrink past a space that has a breaker.
export function setSlotCount(project, panelId, count, now = Date.now()) {
  if (!find(project, "panels", panelId)) throw new Error(`no panels record ${panelId}`);
  if (!(Number.isInteger(count) && count >= 1)) throw new Error("a panel needs at least one space");
  for (const b of project.breakers) {
    if (b.panelId !== panelId) continue;
    for (const s of b.slots) {
      if (parseInt(s, 10) > count) throw new Error(`Space ${parseInt(s, 10)} already has a breaker, so the panel cannot have fewer than ${parseInt(s, 10)} spaces.`);
    }
  }
  return update(project, "panels", panelId, { slotCount: count }, now);
}

function slotParts(slot) {
  const m = /^(\d+)([ab]?)$/.exec(slot);
  if (!m) throw new Error(`bad slot "${slot}"`);
  return [Number(m[1]), m[2]];
}

export function slotsClash(a, b) {
  const [n1, h1] = slotParts(a), [n2, h2] = slotParts(b);
  return n1 === n2 && (h1 === "" || h2 === "" || h1 === h2);
}

export const BREAKER_KINDS = ["standard", "GFCI", "AFCI", "dual", "empty"];

export function addBreaker(project, { panelId, slots, amps, kind = "standard", label = "", note = "" }, now = Date.now()) {
  const panel = find(project, "panels", panelId);
  if (!panel) throw new Error(`no panels record ${panelId}`);
  if (!BREAKER_KINDS.includes(kind)) throw new Error(`bad breaker kind "${kind}"`);
  for (const slot of slots) {
    const [n] = slotParts(slot);
    if (n < 1 || n > panel.slotCount) throw new Error(`slot ${slot} is past the end of this panel (${panel.slotCount} spaces)`);
    for (const b of project.breakers) {
      if (b.panelId === panelId && b.slots.some((s) => slotsClash(s, slot))) throw new Error(`slot ${slot} is already used`);
    }
  }
  return add(project, "breakers", { panelId, slots, poles: slots.length, amps, kind, label, note, swept: 0 }, now);
}

export function breakerKey(breaker) {
  return breaker.slots.join("/");
}

export function sortedBreakers(project, panelId) {
  return project.breakers.filter((b) => b.panelId === panelId)
    .sort((a, b) => parseInt(a.slots[0], 10) - parseInt(b.slots[0], 10) || a.slots[0].localeCompare(b.slots[0]));
}

// ---- the breaker test

// The test screen was finished for this breaker (even if nothing was found on it).
export function markSwept(project, breakerId, now = Date.now()) {
  return update(project, "breakers", breakerId, { swept: now }, now);
}

// Breakers still to test, in panel then slot order. A space entered as empty never needs testing. A tested breaker counts
// again if a device with no breaker was added after it was tested (a floor finished later may be on it).
export function unsweptBreakers(project) {
  const loose = project.devices.filter((d) => !d.breakerId && !d.notWorking && typeInfo(d.type).sweep);
  const newest = loose.reduce((t, d) => Math.max(t, d.created), 0);
  return project.panels.flatMap((panel) =>
    sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty" && (!b.swept || newest > b.swept)));
}

// What the test screen lists: per floor, rooms (devices that go dead when a breaker is off). Rooms with a device already on
// this breaker come first, then by name, and devices with no room last.
export function sweepList(project, breakerId) {
  const out = [];
  for (const floor of sortedFloors(project)) {
    const byRoom = new Map();
    for (const d of project.devices) {
      if (d.floorId !== floor.id || !typeInfo(d.type).sweep || d.notWorking) continue;
      if (!byRoom.has(d.roomId)) byRoom.set(d.roomId, []);
      byRoom.get(d.roomId).push(d);
    }
    const groups = [...byRoom].map(([roomId, devices]) => ({
      floorId: floor.id, roomId, roomName: roomId ? (find(project, "rooms", roomId) || { name: "No room" }).name : "No room",
      onThisBreaker: devices.some((d) => d.breakerId === breakerId),
      devices: devices.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true })),
    }));
    groups.sort((a, b) => (a.roomId === "") - (b.roomId === "") || b.onThisBreaker - a.onThisBreaker || a.roomName.localeCompare(b.roomName));
    out.push(...groups);
  }
  return out;
}

// How many of the panel's spaces have something entered (a breaker, or "empty"). A tandem fills one space.
export function slotsEntered(project, panelId) {
  const used = new Set();
  for (const b of project.breakers) if (b.panelId === panelId) for (const s of b.slots) used.add(parseInt(s, 10));
  return used.size;
}

// Say which breaker feeds a subpanel ("" = none). A panel cannot be fed from itself or from something it feeds.
export function setFedFrom(project, panelId, breakerId, now = Date.now()) {
  if (!find(project, "panels", panelId)) throw new Error(`no panels record ${panelId}`);
  if (breakerId) {
    const b = find(project, "breakers", breakerId);
    if (!b) throw new Error(`no breakers record ${breakerId}`);
    const seen = new Set();
    for (let cur = b.panelId; cur && !seen.has(cur); ) {
      if (cur === panelId) throw new Error("a panel cannot be fed from itself");
      seen.add(cur);
      const feeder = find(project, "breakers", (find(project, "panels", cur) || {}).fedFromBreakerId);
      cur = feeder ? feeder.panelId : "";
    }
  }
  return update(project, "panels", panelId, { fedFromBreakerId: breakerId }, now);
}

// How many records were edited, added or deleted after `since` (the time this device last finished an Export).
export function changesSince(project, since) {
  let n = 0;
  for (const c of COLLECTIONS) for (const r of project[c]) if (r.updated > since) n++;
  for (const t of project.deleted) if (t.at > since) n++;
  return n;
}

// The time of the newest change anywhere in the project.
export function lastChanged(project) {
  let t = project.updated;
  for (const c of COLLECTIONS) for (const r of project[c]) t = Math.max(t, r.updated);
  for (const d of project.deleted) t = Math.max(t, d.at);
  return t;
}

// For "Use this one?" and the "this file is a different house" question.
export function describeProject(project) {
  return { name: project.name, floors: project.floors.length, devices: project.devices.length, updated: lastChanged(project) };
}

// ---- delete. Deleting something deletes what cannot exist without it, and leaves a tombstone for each
// so a later merge does not bring them back.

const CHILDREN = {
  floors: (p, id) => [...p.rooms.filter((r) => r.floorId === id).map((r) => ["rooms", r.id]),
    ...p.devices.filter((d) => d.floorId === id).map((d) => ["devices", d.id])],
  rooms: () => [], // devices stay (with no room) unless removeRoom is told to delete them
  devices: (p, id) => p.links.filter((l) => l.switchId === id || l.loadId === id).map((l) => ["links", l.id]),
  panels: (p, id) => p.breakers.filter((b) => b.panelId === id).map((b) => ["breakers", b.id]),
  breakers: () => [],
  links: () => [],
};

function cascade(project, coll, id, out = []) {
  if (out.some(([c, i]) => c === coll && i === id)) return out;
  out.push([coll, id]);
  for (const [c, i] of CHILDREN[coll](project, id)) cascade(project, c, i, out);
  return out;
}

// What else goes if this is deleted: counts per collection, plus `unassigned` = devices that lose their breaker.
export function affected(project, coll, id) {
  const list = cascade(project, coll, id);
  const counts = {};
  for (const [c] of list.slice(1)) counts[c] = (counts[c] || 0) + 1;
  const ids = new Set(list.map(([, i]) => i));
  const unassigned = project.devices.filter((d) => ids.has(d.breakerId)).length;
  if (unassigned) counts.unassigned = unassigned;
  return counts;
}

export function remove(project, coll, id, now = Date.now()) {
  const ids = new Set(cascade(project, coll, id).map(([, i]) => i));
  for (const c of COLLECTIONS) project[c] = project[c].filter((r) => !ids.has(r.id));
  for (const i of ids) project.deleted.push({ id: i, at: now });
  for (const d of project.devices) {
    if (ids.has(d.breakerId)) Object.assign(d, { breakerId: "", tested: false, updated: now });
    if (ids.has(d.gfciId)) Object.assign(d, { gfciId: "", updated: now });
  }
  for (const p of project.panels) {
    if (ids.has(p.fedFromBreakerId)) Object.assign(p, { fedFromBreakerId: "", updated: now });
    if (ids.has(p.deviceId)) Object.assign(p, { deviceId: "", updated: now });
  }
}

// Delete a room. Its devices stay on the plan with no room (label unchanged) unless deleteDevices is true.
export function removeRoom(project, roomId, { deleteDevices = false } = {}, now = Date.now()) {
  for (const d of project.devices.filter((x) => x.roomId === roomId)) {
    if (deleteDevices) remove(project, "devices", d.id, now);
    else update(project, "devices", d.id, { roomId: "" }, now);
  }
  remove(project, "rooms", roomId, now);
}
