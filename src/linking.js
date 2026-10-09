// What the Switches tab needs to know that is not about the page: how far he has got, what can be switched, and
// the words for a switch and for what it controls. A "toggle" here is one switch on a plate, numbered from 1.
import { find, controls, controlledBy, unlinkedToggles } from "./model.js";
import { displayName, isSwitch } from "./catalog.js";

const HALF = { top: "top half", bottom: "bottom half" };
const nameOf = (project, coll, id, fallback) => (find(project, coll, id) || { name: fallback }).name;
const half = (link) => (link.loadPart ? `, ${HALF[link.loadPart]}` : "");

// Anything that uses power can be switched; a switch, a panel or the meter cannot.
export function canBeSwitched(type) {
  return !isSwitch(type) && !["BP", "SP", "MN"].includes(type);
}

// "Switch 2 on KIT-01", or just "KIT-01" for a plate with one switch.
export function switchName(device, toggle) {
  return device.toggles > 1 ? `Switch ${toggle} on ${device.label}` : device.label;
}

// { total, set, todo }: every switch on every plate, how many control something, and the rest as rows to tap.
export function switchProgress(project) {
  const total = project.devices.reduce((n, d) => n + d.toggles, 0);
  const todo = unlinkedToggles(project).map(({ deviceId, toggle }) => {
    const d = find(project, "devices", deviceId);
    return { deviceId, toggle, text: `${switchName(d, toggle)}, ${nameOf(project, "rooms", d.roomId, "no room")}, ${nameOf(project, "floors", d.floorId, "")}` };
  });
  return { total, set: total - todo.length, todo };
}

export function progressText({ total, set }) {
  if (!total) return "";
  if (set === total) return total === 1 ? "The switch is set" : `All ${total} switches set`;
  return `${set} of ${total} ${total === 1 ? "switch" : "switches"} set`;
}

// The banner while linking. floorId is the floor showing; what the switch controls on other floors is listed,
// because those markers cannot be seen.
export function linkBanner(project, device, toggle, floorId) {
  const elsewhere = controls(project, device.id, toggle).map((l) => find(project, "devices", l.loadId))
    .filter((d) => d && d.floorId !== floorId);
  const also = elsewhere.length ? ` Also controls ${elsewhere.map((d) => `${d.label} (${nameOf(project, "floors", d.floorId, "")})`).join(", ")}.` : "";
  return `${switchName(device, toggle)}: tap each light or outlet it controls.${also}`;
}

// "What it controls": [{ link, text }], "KIT-03, Ceiling light, Main floor".
export function controlRows(project, switchId, toggle) {
  return controls(project, switchId, toggle).map((link) => {
    const d = find(project, "devices", link.loadId);
    return d && { link, text: `${d.label}, ${displayName(d)}, ${nameOf(project, "floors", d.floorId, "")}${half(link)}` };
  }).filter(Boolean);
}

// "Switched by": [{ link, text }], "Switch 1 on KIT-01, Main floor".
export function switchedRows(project, loadId) {
  return controlledBy(project, loadId).map((link) => {
    const sw = find(project, "devices", link.switchId);
    return sw && { link, text: `${switchName(sw, link.toggle)}, ${nameOf(project, "floors", sw.floorId, "")}${half(link)}` };
  }).filter(Boolean);
}

// Which parts of an outlet this switch controls now, for the ticks on Whole / Top / Bottom.
export function halfState(project, switchId, toggle, loadId) {
  const parts = controls(project, switchId, toggle).filter((l) => l.loadId === loadId).map((l) => l.loadPart);
  return { whole: parts.includes(""), top: parts.includes("top"), bottom: parts.includes("bottom") };
}
