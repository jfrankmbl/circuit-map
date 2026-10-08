// Wording and small decisions that more than one screen needs. No DOM here, so it can be tested.
import { find, affected, sortedFloors } from "./model.js";
import { CODE_PATTERN } from "./ids.js";

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// The four setup steps shown across the top of Floors until all are done.
export function checklist(project) {
  return [
    { text: "Name the house", done: true },
    { text: "Add a floor", done: project.floors.length > 0 },
    { text: "Add a picture of the floor", done: project.floors.some((f) => f.imageId) },
    { text: "Add the rooms", done: project.rooms.length > 0 },
  ];
}

// The tab the app opens on: Floors until some floor has a picture, Map from then on.
export function startTab(project) {
  return project.floors.some((f) => f.imageId) ? "map" : "floors";
}

export function floorSummary(project, floor) {
  const rooms = project.rooms.filter((r) => r.floorId === floor.id).length;
  return `${floor.imageId ? "Has a picture" : "No picture yet"}, ${plural(rooms, "room")}`;
}

export function deleteFloorQuestion(project, floorId) {
  const floor = find(project, "floors", floorId);
  const { rooms = 0, devices = 0, links = 0 } = affected(project, "floors", floorId);
  const question = devices ? `Delete ${floor.name} and its ${plural(devices, "device")}?` : `Delete ${floor.name}?`;
  const parts = [rooms && plural(rooms, "room"), links && plural(links, "link")].filter(Boolean);
  return parts.length ? `${question} It has ${parts.join(" and ")}.` : question;
}

// Which floor to show once this one is deleted: the one below, or the one above if it is the lowest. "" if it is the only one.
export function floorAfterDelete(project, floorId) {
  const list = sortedFloors(project);
  const i = list.findIndex((f) => f.id === floorId);
  const next = list[i - 1] || list[i + 1];
  return next ? next.id : "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayText(time) {
  const d = new Date(time);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function agoText(time, now = Date.now()) {
  const days = Math.round((now - time) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// desc is model.describeProject(project). "Dad's house, 2 floors, 63 devices, last changed 12 Sep 2026, 3 weeks ago."
export function describeFile(desc, now = Date.now()) {
  return `${desc.name}, ${plural(desc.floors, "floor")}, ${plural(desc.devices, "device")}, ` +
    `last changed ${dayText(desc.updated)}, ${agoText(desc.updated, now)}.`;
}

// ---- rooms

export function roomSummary(project, room) {
  const devices = project.devices.filter((d) => d.roomId === room.id).length;
  return plural(devices, "device") + (room.outline.length ? "" : ", no outline");
}

export function deleteRoomQuestion(project, room) {
  const devices = project.devices.filter((d) => d.roomId === room.id).length;
  return devices ? `Delete ${room.name}? It has ${plural(devices, "device")}.` : `Delete ${room.name}?`;
}

// What is wrong with a label code, in words; "" if it can be used. roomId is the room being edited, if any.
export function codeProblem(project, code, roomId = "") {
  if (!CODE_PATTERN.test(code)) return "Use 2 to 4 capital letters or numbers, starting with a letter (like KIT or BR2).";
  const other = project.rooms.find((r) => r.code === code && r.id !== roomId);
  return other ? `${code} is already used by ${other.name}. Pick another.` : "";
}

// After an outline is edited. found is model.outlineMismatches(project, roomId). "" for a group with nothing in it.
export function mismatchText(room, found) {
  const out = found.outside.length, inn = found.inside.length;
  return {
    outside: out ? `${plural(out, "device")} ${out === 1 ? "is" : "are"} now outside ${room.name}.` : "",
    inside: inn ? `${plural(inn, "device")} from ${inn === 1 ? "another room is" : "other rooms are"} now inside it.` : "",
  };
}

// ---- scale and replacing a picture

// moved is what model.refitFloor returns.
export function refitText(moved) {
  return `Moved ${plural(moved.devices, "device")} and ${plural(moved.rooms, "room")} to fit the new picture.`;
}

// Two line-up spots must be at least a twentieth of the picture's width apart, or the fit is too rough to trust.
export function spotsTooClose(a, b, pictureWidth) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) < pictureWidth / 20;
}

// The two number boxes, "feet" and "inches", as inches. 0 when nothing usable was typed.
export function toInches(feet, inches) {
  const total = (Number(feet) || 0) * 12 + (Number(inches) || 0);
  return total > 0 ? total : 0;
}
