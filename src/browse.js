// Looking things up: search, the list by room, and the words for one device's details. No DOM here.
import { find, sortedFloors, breakerKey, controls, controlledBy, otherSwitches } from "./model.js";
import { displayName, typeInfo } from "./catalog.js";

const byLabel = (a, b) => a.label.localeCompare(b.label, "en", { numeric: true });
const roomName = (project, d) => (find(project, "rooms", d.roomId) || { name: "no room" }).name;
const floorName = (project, d) => (find(project, "floors", d.floorId) || { name: "" }).name;
const HALF = { top: "top half", bottom: "bottom half" };

// Devices matching every word of `query` (in the label, what it is, its room or its note) and, if given, the group.
// The "other" group includes things he named himself.
export function searchDevices(project, query = "", group = "") {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return project.devices.filter((d) => {
    const g = typeInfo(d.type).group;
    if (group && g !== group && !(group === "other" && g === "custom")) return false;
    const text = [d.label, displayName(d), typeInfo(d.type).name, roomName(project, d), d.note].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

// [{ floorId, floorName, roomName, devices }]: floors lowest first, rooms by name, devices with no room last.
export function listByRoom(project, devices) {
  const out = [];
  for (const floor of sortedFloors(project)) {
    const here = devices.filter((d) => d.floorId === floor.id);
    const rooms = project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name));
    for (const room of [...rooms, null]) {
      const list = here.filter((d) => (room ? d.roomId === room.id : !rooms.some((r) => r.id === d.roomId))).sort(byLabel);
      if (list.length) out.push({ floorId: floor.id, floorName: floor.name, roomName: room ? room.name : "No room", devices: list });
    }
  }
  return out;
}

// "Breaker 12 (Kitchen), tested", "Breaker 7 (Kitchen), guess" or "Not known".
export function circuitText(project, device) {
  const b = find(project, "breakers", device.breakerId);
  if (!b) return "Not known";
  return `Breaker ${breakerKey(b)}${b.label ? ` (${b.label})` : ""}, ${device.tested ? "tested" : "guess"}`;
}

// One entry per switch on the plate: { toggle, text, loads: [{ id, label }] }.
// "Switch 1 controls HAL-01. Also switched from HAL-02 (Upstairs hall), switch 1."
export function switchLines(project, device) {
  const lines = [];
  for (let toggle = 1; toggle <= device.toggles; toggle++) {
    const loads = controls(project, device.id, toggle).map((l) => {
      const load = find(project, "devices", l.loadId);
      return load && { id: load.id, label: load.label, text: load.label + (l.loadPart ? ` (${HALF[l.loadPart]})` : "") };
    }).filter(Boolean);
    const seen = new Set();
    const also = otherSwitches(project, device.id, toggle).map((o) => {
      const sw = find(project, "devices", o.switchId), key = o.switchId + "|" + o.toggle;
      if (!sw || seen.has(key)) return "";
      seen.add(key);
      return `${sw.label} (${roomName(project, sw)}), switch ${o.toggle}`;
    }).filter(Boolean);
    const text = loads.length
      ? `Switch ${toggle} controls ${loads.map((l) => l.text).join(", ")}.` + (also.length ? ` Also switched from ${also.join("; ")}.` : "")
      : `Switch ${toggle}: nothing recorded yet.`;
    lines.push({ toggle, text, loads });
  }
  return lines;
}

// What switches a light or outlet: [{ id, label, text }], "KIT-01, switch 1 (Main floor), top half".
export function switchedBy(project, device) {
  return controlledBy(project, device.id).map((l) => {
    const sw = find(project, "devices", l.switchId);
    return sw && { id: sw.id, label: sw.label, text: `${sw.label}, switch ${l.toggle} (${floorName(project, sw)})` + (l.loadPart ? `, ${HALF[l.loadPart]}` : "") };
  }).filter(Boolean).sort((a, b) => byLabel(a, b));
}

// "KIT-06 (plate says KIT-05)" while the plate is out of date.
export function titleText(device) {
  return device.plateLabel ? `${device.label} (plate says ${device.plateLabel})` : device.label;
}

// A row of the "Plates to rewrite" list: what to do first, then which device, then why.
export function plateRow(project, device) {
  return {
    todo: `Write ${device.label} on this plate`,
    what: `${displayName(device)}, ${roomName(project, device)}, ${floorName(project, device)}`,
    why: `It says ${device.plateLabel}.`,
  };
}
