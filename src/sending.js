// Sending the house to another device, or backing it up: what the header chip, its sheet and the backup nudge say.
// "Sent" means this device finished handing over a project file. No DOM here.
import { COLLECTIONS, changesSince } from "./model.js";
import { plural, dayText, agoText } from "./flow.js";

const DAY = 86400000;

// The chip in the header. On a phone there is only room for the narrow one.
export function chipText(count) {
  return count ? { wide: `${plural(count, "change")} not sent`, narrow: `Send ${count}` } : { wide: "Nothing new to send", narrow: "Send" };
}

// The first line of the "Move or back up" sheet. sentAt is when this device last finished a send, 0 if never.
export function sendStatus(project, sentAt, now = Date.now()) {
  const count = changesSince(project, sentAt);
  if (!count && !sentAt) return "Nothing to send yet.";
  const last = sentAt ? `Last sent ${dayText(sentAt)}, ${agoText(sentAt, now)}.` : "This house has not been sent or backed up from this device yet.";
  return `${count ? `${plural(count, "change")} not sent` : "Nothing new to send"}. ${last}`;
}

// Whether to say "Back up your work" when the app opens: more than 50 changes are waiting, or work has waited more
// than 7 days (since the last send or, with none yet, since the oldest change). laterAt is when he last tapped
// Later, which hides it for a day.
export function needsBackup(project, sentAt, laterAt, now = Date.now()) {
  const count = changesSince(project, sentAt);
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
