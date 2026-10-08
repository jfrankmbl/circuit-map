// What the Add tab needs to know that is not about the page: shapes, lists to choose from, and small tests.
// A "choice" is what he is adding: { type, customName }.
import { typeInfo } from "./catalog.js";
import { recentCustomNames } from "./model.js";

// One-line hints under types he may not know.
export const HINTS = {
  G: "has Test and Reset buttons",
  S3: "one of two switches for the same light",
  DM: "turn knob or slider",
  J: "a cover with nothing on it",
};

// Types that ask "which one?" first. Each entry is [button text, the name the marker gets]; null asks him to type one.
export const PICK_LISTS = {
  R: [["Dryer", "Dryer outlet"], ["Range", "Range outlet"], ["EV charger", "EV charger outlet"], ["Other 240 V", null]],
  HA: [["Water heater", "Water heater"], ["Furnace", "Furnace"], ["Disposal", "Disposal"], ["Dishwasher", "Dishwasher"], ["Other", null]],
};

const CUSTOM_SUGGESTIONS = ["Attic fan", "Sump pump", "Garage door opener", "Well pump", "Heat lamp"];

// Names offered for "Something else": the usual ones, then names he has used in this house, newest first.
export function suggestedNames(project) {
  return [...CUSTOM_SUGGESTIONS, ...recentCustomNames(project).filter((n) => !CUSTOM_SUGGESTIONS.includes(n))];
}

const SHAPES = { outlet: "circle", switch: "square", light: "diamond", other: "triangle", custom: "triangle" };

export function shapeOf(type) {
  return SHAPES[typeInfo(type).group];
}

// The last few different things placed, newest first, for the row above the plan.
export function recentChoices(project, limit = 4) {
  const out = [];
  for (const d of [...project.devices].sort((a, b) => b.created - a.created)) {
    if (out.some((c) => c.type === d.type && c.customName === d.customName)) continue;
    out.push({ type: d.type, customName: d.customName });
    if (out.length === limit) break;
  }
  return out;
}

// A tap is { at (ms), sx, sy (screen pixels) }. A second one within a second and a few pixels of the last is a
// double tap, and must not place a second device.
export function isRepeatTap(last, tap) {
  return !!last && tap.at - last.at < 1000 && Math.hypot(tap.sx - last.sx, tap.sy - last.sy) < 12;
}

// The devices within `reach` picture pixels of (x, y), nearest first.
export function markersNear(devices, x, y, reach) {
  const far = (d) => Math.hypot(d.x - x, d.y - y);
  return devices.filter((d) => far(d) <= reach).sort((a, b) => far(a) - far(b));
}

// The rooms to offer for "Which room?": this floor's, by name, with the last one used first.
export function roomChoices(project, floorId, lastRoomId = "") {
  return project.rooms.filter((r) => r.floorId === floorId)
    .sort((a, b) => (b.id === lastRoomId) - (a.id === lastRoomId) || a.name.localeCompare(b.name));
}
