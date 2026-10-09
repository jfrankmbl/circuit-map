// Sending the house to another device, or backing it up: what the header chip, its sheet and the backup nudge say.
// "Sent" means this device finished handing over a project file. No DOM here.
import { COLLECTIONS } from "./model.js";
import { plural, dayText, agoText } from "./flow.js";

const DAY = 86400000;

// The chip in the header. On a phone there is only room for the narrow one.
export function chipText(count) {
  return count ? { wide: `${plural(count, "change")} not sent`, narrow: `Send ${count}` } : { wide: "Nothing new to send", narrow: "Send" };
}

// The first line of the "Move or back up" sheet. sentAt is when this device last finished a send, 0 if never.
export function sendStatus(project, sentAt, now = Date.now(), cameIn = {}) {
  const count = unsent(project, sentAt, cameIn);
  if (!count && !sentAt) return "Nothing to send yet.";
  const last = sentAt ? `Last sent ${dayText(sentAt)}, ${agoText(sentAt, now)}.` : "This house has not been sent or backed up from this device yet.";
  return `${count ? `${plural(count, "change")} not sent` : "Nothing new to send"}. ${last}`;
}

// Whether to say "Back up your work" when the app opens: more than 50 changes are waiting, or work has waited more
// than 7 days (since the last send or, with none yet, since the oldest change). laterAt is when he last tapped
// Later, which hides it for a day.
export function needsBackup(project, sentAt, laterAt, now = Date.now(), cameIn = {}) {
  const count = unsent(project, sentAt, cameIn);
  if (!count || now - laterAt < DAY) return false;
  let since = sentAt;
  if (!since) {
    since = now;
    for (const coll of COLLECTIONS) for (const r of project[coll]) since = Math.min(since, r.updated);
    for (const t of project.deleted) since = Math.min(since, t.at);
  }
  return count > 50 || now - since > 7 * DAY;
}

// "3.2 MB" for a file of that many bytes.
export function sizeText(bytes) {
  return bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1e6).toFixed(1)} MB`;
}

// Records and deletions changed on this device since it last finished a send, leaving out those that arrived by Import
// unchanged. cameIn is { id: updated } (or { id: at } for a deletion), see cameInFrom.
export function unsent(project, sentAt, cameIn = {}) {
  let n = 0;
  for (const c of COLLECTIONS) for (const r of project[c]) if (r.updated > sentAt && cameIn[r.id] !== r.updated) n++;
  for (const t of project.deleted) if (t.at > sentAt && cameIn[t.id] !== t.at) n++;
  return n;
}

// After merging incoming into this device: which records and deletions are exactly as the file had them.
export function cameInFrom(merged, incoming) {
  const theirs = new Map();
  for (const c of COLLECTIONS) for (const r of incoming[c]) theirs.set(r.id, r.updated);
  for (const t of incoming.deleted) theirs.set(t.id, t.at);
  const out = {};
  for (const c of COLLECTIONS) for (const r of merged[c]) if (theirs.get(r.id) === r.updated) out[r.id] = r.updated;
  for (const t of merged.deleted) if (theirs.get(t.id) === t.at) out[t.id] = t.at;
  return out;
}

// The parts of "From the file: 12 new, 3 changed, 2 deleted." summary is merge()'s summary. A part with none is left out.
export function importParts(summary) {
  return [["added", summary.added, "new"], ["updated", summary.updated, "changed"], ["removed", summary.removed, "deleted"],
    ["renumbered", summary.renumbered.length, "relabelled"]]
    .filter(([, n]) => n).map(([key, n, word]) => ({ key, text: `${n} ${word}` }));
}

export const nothingNew = (summary) => importParts(summary).length === 0;

// Changing or deleting what is on this device is worth a second look (and a copy first).
export const needsCare = (summary) => summary.updated > 0 || summary.removed > 0;

const FIELD_WORDS = { label: "label", plateLabel: "label", type: "type", customName: "type", name: "name", code: "code", roomId: "room",
  floorId: "floor", x: "position", y: "position", heightIn: "height", note: "note", breakerId: "breaker", tested: "test result",
  toggles: "number of switches", gfciId: "GFCI", notWorking: "Not working", outline: "outline", imageId: "picture" };

// Field names from a record, in his words, each once, in the order they first appear.
export const fieldWords = (fields) => [...new Set(fields.map((f) => FIELD_WORDS[f] || f))];

// "KIT-03: note, height"
export const changedLine = (item) => `${item.name}: ${fieldWords(item.fields).join(", ")}`;

const houseText = (d) => `${d.name}, ${plural(d.floors, "floor")}, ${plural(d.devices, "device")}`;

// local and file are model.describeProject results.
export const differentHouse = (local, file) => `This file is a different house: ${houseText(file)}. This device has ${houseText(local)}.`;

export const MOVING = {
  phoneToMac: ["On the phone choose Export.", "Choose AirDrop and pick the Mac.", "On the Mac, choose Import and pick the file from Downloads."],
  macToPhone: ["On the Mac choose Export, then AirDrop the file to the iPhone and choose Save to Files.", "On the phone choose Import and pick it from Files."],
  tip: "Tip: finish on one device and send the file before working on the other, and labels never clash.",
};
