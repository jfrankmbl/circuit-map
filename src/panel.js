// What the Breakers tab needs to know that is not about the page: how a panel is laid out, what to call things, and
// the words of the "Something has no power" card. A slot is text: "7", or "7a" / "7b" for the halves of a tandem.
import { find, sortedFloors, sortedBreakers, canPair, slotsEntered, devicesOnBreaker, powerOutHelp } from "./model.js";
import { displayName } from "./catalog.js";
import { plural } from "./flow.js";

const num = (slot) => parseInt(slot, 10);

// "7", "7 top", "7 bottom".
export function spaceName(slot) {
  const half = String(slot).slice(-1);
  return half === "a" ? `${num(slot)} top` : half === "b" ? `${num(slot)} bottom` : String(num(slot));
}

// "7", "13/15", "7 top".
export function breakerName(breaker) {
  return breaker.slots.map(spaceName).join("/");
}

// "Breaker 7 (Kitchen)".
export function breakerTitle(breaker) {
  return `Breaker ${breakerName(breaker)}${breaker.label ? ` (${breaker.label})` : ""}`;
}

// The word shown on a breaker for anything special.
export const KIND_WORDS = { standard: "", GFCI: "GFCI", AFCI: "AFCI", dual: "GFCI + AFCI", empty: "" };

// The space numbers down the left side and down the right side.
export function columns(panel) {
  const all = Array.from({ length: panel.slotCount }, (_, i) => i + 1);
  if (panel.numbering === "down") {
    const half = Math.ceil(panel.slotCount / 2);
    return [all.slice(0, half), all.slice(half)];
  }
  return [all.filter((n) => n % 2 === 1), all.filter((n) => n % 2 === 0)];
}

// The picture, as two columns of cells from the top. A cell is one of:
//   { kind: "todo", numbers: [n], span: 1 }                    nothing entered yet
//   { kind: "empty", numbers: [n], breaker, span: 1 }          entered as having no breaker
//   { kind: "single", numbers: [n], breaker, span: 1 }         (also each half of a double that no longer sits together)
//   { kind: "double", numbers: [n, next], breaker, span: 2 }   one tall box across two spaces
//   { kind: "tandem", numbers: [n], top, bottom, span: 2 }     two small breakers; either may be null
export function panelCells(project, panel) {
  const mine = project.breakers.filter((b) => b.panelId === panel.id);
  const at = (n) => mine.filter((b) => b.slots.some((s) => num(s) === n));
  return columns(panel).map((column) => {
    const cells = [];
    for (let i = 0; i < column.length; i++) {
      const n = column[i], next = column[i + 1], here = at(n);
      const double = here.find((b) => b.poles === 2 && b.slots.some((s) => num(s) === next));
      const halves = here.filter((b) => /[ab]$/.test(b.slots[0]));
      if (double) {
        cells.push({ kind: "double", numbers: [n, next], breaker: double, span: 2 });
        i++;
      } else if (halves.length) {
        const half = (letter) => halves.find((b) => b.slots[0].endsWith(letter)) || null;
        cells.push({ kind: "tandem", numbers: [n], top: half("a"), bottom: half("b"), span: 2 });
      } else if (here.length) {
        cells.push({ kind: here[0].kind === "empty" ? "empty" : "single", numbers: [n], breaker: here[0], span: 1 });
      } else {
        cells.push({ kind: "todo", numbers: [n], span: 1 });
      }
    }
    return cells;
  });
}

export function enteredText(project, panel) {
  return `${slotsEntered(project, panel.id)} of ${panel.slotCount} spaces entered`;
}

const openSpaces = (project, panel) => {
  const used = new Set(project.breakers.filter((b) => b.panelId === panel.id).flatMap((b) => b.slots.map(num)));
  return Array.from({ length: panel.slotCount }, (_, i) => i + 1).filter((n) => !used.has(n));
};

// The next space with nothing entered after space `after`, going round to the start; 0 when the panel is full.
export function nextOpenSpace(project, panel, after = 0) {
  const open = openSpaces(project, panel);
  return open.find((n) => n > after) || open[0] || 0;
}

// The spaces that could be the other half of a double breaker in space n: next to it on the same side, and free.
export function pairChoices(project, panel, n) {
  return openSpaces(project, panel).filter((x) => canPair(panel, String(n), String(x)));
}

// "14" means space 14; anything else matches labels. [{ breaker, panel }]
export function findBreakers(project, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hit = /^\d+$/.test(q) ? (b) => b.slots.some((s) => num(s) === Number(q)) : (b) => b.label.toLowerCase().includes(q);
  return project.panels.flatMap((panel) =>
    sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty" && hit(b)).map((breaker) => ({ breaker, panel })));
}

const GROUP_WORDS = { outlet: ["outlet", "outlets"], switch: ["switch", "switches"], light: ["light", "lights"], other: ["other", "other"], custom: ["something else", "something else"] };

// { text, more, feeds, direct, downstream }: "8 devices: 5 outlets, 2 lights, 1 other" ("" with none), and for a
// breaker that feeds a subpanel, "and 14 more through Garage subpanel".
export function breakerSummary(project, breakerId) {
  const { direct, downstream, groups } = devicesOnBreaker(project, breakerId);
  const parts = Object.keys(GROUP_WORDS).filter((g) => groups[g]).map((g) => `${groups[g]} ${GROUP_WORDS[g][groups[g] === 1 ? 0 : 1]}`);
  const feeds = project.panels.filter((panel) => panel.fedFromBreakerId === breakerId);
  return {
    text: direct.length ? `${plural(direct.length, "device")}: ${parts.join(", ")}` : "",
    more: downstream.length ? `and ${downstream.length} more through ${feeds.map((f) => f.name).join(" and ")}` : "",
    feeds, direct, downstream,
  };
}

// The breakers that could feed this panel: those in other panels, leaving out any panel this one feeds.
// [{ breaker, text }], "13/15 Garage 60 A, Main panel".
export function feedChoices(project, panelId) {
  const fedFromThis = (id) => {
    const seen = new Set();
    for (let cur = id; cur && !seen.has(cur);) {
      if (cur === panelId) return true;
      seen.add(cur);
      const feeder = find(project, "breakers", (find(project, "panels", cur) || {}).fedFromBreakerId);
      cur = feeder ? feeder.panelId : "";
    }
    return false;
  };
  return project.panels.filter((panel) => !fedFromThis(panel.id)).flatMap((panel) =>
    sortedBreakers(project, panel.id).filter((b) => b.kind !== "empty")
      .map((breaker) => ({ breaker, text: `${breakerName(breaker)} ${breaker.label || "(no label)"} ${breaker.amps} A, ${panel.name}` })));
}

const KIND_LINES = { GFCI: "a GFCI", AFCI: "an AFCI", dual: "a GFCI and AFCI" };

// The "Something has no power" card for { roomId } or { deviceId }:
// { title, check: [lines], likely: { breakerId, title, sure, kindLine, subLine } | null, also: [{ breakerId, text }], unknown, none }
export function powerOutCard(project, target) {
  const help = powerOutHelp(project, target);
  const room = target.roomId ? find(project, "rooms", target.roomId) : null;
  const device = target.deviceId ? find(project, "devices", target.deviceId) : null;
  const check = [
    ...help.gfcis.map((g) => (g.protects ? `${g.label} protects ${plural(g.protects, "device")}: press Reset.` : `${g.label} is a GFCI outlet: press Reset.`)),
    ...help.switches.map((s) => `${find(project, "devices", s.id).toggles > 1 ? `${s.label} switch ${s.toggle}` : s.label}: is it on?`),
    ...help.notWorking.map((id) => `${find(project, "devices", id).label} is marked Not working.`),
  ];
  const describe = (e) => {
    const b = find(project, "breakers", e.breakerId), panel = b && find(project, "panels", b.panelId);
    const feeder = find(project, "breakers", e.feederId), feederPanel = feeder && find(project, "panels", feeder.panelId);
    return {
      breakerId: e.breakerId, count: e.count,
      title: `${breakerTitle(b)}, ${b.amps} A`,
      sure: [e.tested && `${e.tested} tested`, e.guessed && `${e.guessed} guessed`].filter(Boolean).join(", "),
      kindLine: KIND_LINES[b.kind] ? `It is ${KIND_LINES[b.kind]} breaker: press the Test button on it, then switch it Off and On.` : "",
      subLine: feeder ? `This is on ${panel.name}, which is fed by breaker ${breakerName(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}. If the whole subpanel is off, check that one first.` : "",
    };
  };
  const all = help.breakers.filter((e) => find(project, "breakers", e.breakerId)).map(describe);
  const unknown = help.unknown.length;
  return {
    title: `${room ? room.name : device ? device.label : "It"} has no power`,
    check,
    likely: all[0] || null,
    also: all.slice(1).map((d) => ({ breakerId: d.breakerId, text: `Also: ${d.title}, ${plural(d.count, "device")}` })),
    unknown: all.length && unknown ? `${plural(unknown, "device")} in this room ${unknown === 1 ? "has" : "have"} no breaker recorded.` : "",
    none: all.length ? "" : room
      ? "No breaker is recorded for this room yet. Try a room next to it, or test your breakers to find out."
      : "No breaker is recorded for this device yet. Test your breakers to find out.",
  };
}

// "Where?": rooms lowest floor first then by name, the one he asked about last first; when he types, rooms whose
// name matches and devices whose label matches. [{ roomId | deviceId, text }]
export function whereChoices(project, query = "", lastRoomId = "") {
  const q = query.trim().toLowerCase();
  const rooms = sortedFloors(project).flatMap((floor) =>
    project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ roomId: r.id, text: `${r.name}, ${floor.name}` })))
    .filter((c) => c.text.toLowerCase().includes(q))
    .sort((a, b) => (b.roomId === lastRoomId) - (a.roomId === lastRoomId));
  const devices = q ? project.devices.filter((d) => d.label.toLowerCase().includes(q)).slice(0, 8)
    .map((d) => ({ deviceId: d.id, text: `${d.label}, ${displayName(d)}` })) : [];
  return [...rooms, ...devices];
}
