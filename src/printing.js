// What a printed panel directory says: the card for the inside of the panel door, the full list of devices, and
// whether the card on the door has gone stale. No DOM here.
import { find, sortedBreakers } from "./model.js";
import { displayName } from "./catalog.js";
import { plural, dayText } from "./flow.js";
import { listByRoom } from "./browse.js";
import { breakerName, breakerTitle, KIND_WORDS, panelCells } from "./panel.js";

const feeds = (project, breaker) => project.panels.filter((panel) => panel.fedFromBreakerId === breaker.id).map((panel) => `Feeds ${panel.name}`);

// "Kitchen, Dining, Hall +2 more ?": the rooms with something on this breaker, the room with most first.
// A "?" means something on it has not been confirmed by a test.
export function roomsText(project, breaker) {
  const on = project.devices.filter((d) => d.breakerId === breaker.id);
  const count = new Map();
  for (const d of on) {
    const room = find(project, "rooms", d.roomId);
    if (room) count.set(room.name, (count.get(room.name) || 0) + 1);
  }
  const names = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const rooms = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "");
  return [[...feeds(project, breaker), rooms].filter(Boolean).join(". "), on.some((d) => !d.tested) && "?"].filter(Boolean).join(" ");
}

// "20 A, 240 V, GFCI"
const facts = (b) => [b.amps ? `${b.amps} A` : "", b.poles === 2 && "240 V", KIND_WORDS[b.kind]].filter(Boolean).join(", ");

// The heading every page carries.
function pageHead(project, panel, now) {
  const feeder = find(project, "breakers", panel.fedFromBreakerId), feederPanel = feeder && find(project, "panels", feeder.panelId);
  return {
    house: project.name,
    panel: panel.name,
    fedFrom: feeder ? `Fed from breaker ${breakerName(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}` : "",
    printed: `Printed ${dayText(now)}`,
    legend: "? = not confirmed by testing yet",
  };
}

// The card: { house, panel, fedFrom, printed, legend, wide, columns }. columns is the left and the right side of the
// panel from the top; each cell is { kind, lines: [{ number, label, facts, rooms }] }, where kind is "single",
// "double" (one tall box), "tandem" (two lines), "empty" (entered as having no breaker) or "todo" (nothing entered:
// printed as a ruled line to write on). A panel of more than 30 spaces is wide: it uses the whole page width.
export function doorCard(project, panel, now = Date.now()) {
  const blank = (number, label = "") => ({ number, label, facts: "", rooms: "" });
  const line = (b, number) => ({ number, label: b.label, facts: facts(b), rooms: roomsText(project, b) });
  const cell = (c) => {
    const n = String(c.numbers[0]);
    if (c.kind === "todo") return { kind: "todo", lines: [blank(n)] };
    if (c.kind === "empty") return { kind: "empty", lines: [blank(n, "empty")] };
    if (c.kind === "double") return { kind: "double", lines: [line(c.breaker, c.numbers.join("/"))] };
    if (c.kind === "tandem") {
      return { kind: "tandem", lines: [c.top ? line(c.top, `${n} top`) : blank(`${n} top`), c.bottom ? line(c.bottom, `${n} bottom`) : blank(`${n} bottom`)] };
    }
    return { kind: "single", lines: [line(c.breaker, n)] };
  };
  return { ...pageHead(project, panel, now), wide: panel.slotCount > 30, columns: panelCells(project, panel).map((column) => column.map(cell)) };
}

// The Full page: every breaker with each device on it. [{ title, none, rows: [{ label, type, room, guess }] }]
export function fullList(project, panel) {
  const floors = project.floors.length > 1;
  return sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty").map((b) => {
    const rows = listByRoom(project, project.devices.filter((d) => d.breakerId === b.id)).flatMap((g) => g.devices.map((d) => ({
      label: d.label, type: displayName(d), room: floors ? `${g.roomName}, ${g.floorName}` : g.roomName, guess: d.tested ? "" : "guess",
    })));
    const feeding = feeds(project, b);
    return {
      title: [breakerTitle(b), facts(b)].filter(Boolean).join(", "),
      none: rows.length ? "" : feeding.length ? `${feeding.join(". ")}. Its devices are on that panel's own list.` : "Nothing found on this breaker yet.",
      rows,
    };
  });
}

// What to keep on the device when a card is printed: when, and what each breaker's line said.
export function printRecord(project, panel, now = Date.now()) {
  const lines = {};
  for (const b of sortedBreakers(project, panel.id)) lines[b.id] = [breakerName(b), b.kind, b.label, facts(b), roomsText(project, b)].join("|");
  return { at: now, lines };
}

// { last, changed }: "Last printed 6 Oct 2026" and, if the card would read differently now, "3 breakers changed
// since. Print again?" Both are "" when this panel has not been printed from this device.
export function printedStatus(project, panel, record) {
  if (!record) return { last: "", changed: "" };
  const now = printRecord(project, panel).lines;
  const changed = [...new Set([...Object.keys(now), ...Object.keys(record.lines)])].filter((id) => now[id] !== record.lines[id]).length;
  return { last: `Last printed ${dayText(record.at)}`, changed: changed ? `${plural(changed, "breaker")} changed since. Print again?` : "" };
}
