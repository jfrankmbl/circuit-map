// The device list as CSV text, for a spreadsheet or a printout.
import { displayName } from "./catalog.js";
import { find, breakerKey, sortedBreakers } from "./model.js";

function cell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop a spreadsheet treating typed text as a formula
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function devicesCsv(project) {
  const label = (id) => (find(project, "devices", id) || { label: "" }).label;
  const rows = [["label", "floor", "room", "type", "height_in", "panel", "breaker", "breaker_label", "amps", "tested",
    "controls", "switched_by", "behind_gfci", "not_working", "note"]];
  const devices = [...project.devices].sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  for (const d of devices) {
    const floor = find(project, "floors", d.floorId);
    const room = find(project, "rooms", d.roomId);
    const breaker = find(project, "breakers", d.breakerId);
    const panel = breaker && find(project, "panels", breaker.panelId);
    rows.push([
      d.label, floor ? floor.name : "", room ? room.name : "", displayName(d), d.heightIn,
      panel ? panel.name : "", breaker ? breakerKey(breaker) : "", breaker ? breaker.label : "", breaker ? breaker.amps : "",
      breaker ? (d.tested ? "yes" : "guess") : "",
      project.links.filter((l) => l.switchId === d.id).map((l) => label(l.loadId) + (l.loadPart ? " " + l.loadPart : "")).join(" "),
      project.links.filter((l) => l.loadId === d.id).map((l) => label(l.switchId)).join(" "),
      label(d.gfciId), d.notWorking ? "yes" : "", d.note,
    ]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// One row per breaker: size, label, how many devices are on it and how sure we are, and what feeds a subpanel.
export function breakersCsv(project) {
  const rows = [["panel", "spaces", "amps", "type", "label", "devices_on_it", "tested", "guessed", "fed_from"]];
  for (const panel of project.panels) {
    const feeder = find(project, "breakers", panel.fedFromBreakerId);
    const feederPanel = feeder && find(project, "panels", feeder.panelId);
    const fedFrom = feeder ? `${feederPanel ? feederPanel.name : ""} ${breakerKey(feeder)}`.trim() : "";
    for (const b of sortedBreakers(project, panel.id)) {
      const on = project.devices.filter((d) => d.breakerId === b.id);
      const tested = on.filter((d) => d.tested).length;
      rows.push([panel.name, breakerKey(b), b.amps, b.kind, b.label, on.length, tested, on.length - tested, fedFrom]);
    }
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
