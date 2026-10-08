// The project: one plain object holding everything about one house. All edits go through this module.
import { CODE_PATTERN } from "./ids.js";

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
