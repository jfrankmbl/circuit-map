// The rules of a breaker test. A test in progress is a session: a plain object kept on this device (not in the
// project file), so the "breaker is OFF" bar and what he has marked survive closing the app.
import { find, setBreaker, unsweptBreakers, unconfirmedOnBreaker, protectedBy } from "./model.js";
import { typeInfo, isSwitch } from "./catalog.js";
import { plural } from "./flow.js";
import { breakerName } from "./panel.js";

// dead: { deviceId: { breakerId, tested } } is what each marked device said before, so a mark can be taken back.
// floors: the floors he ticked as walked. kept: devices he chose to leave on this breaker in the last step.
export function newSession(breakerId) {
  return { breakerId, off: false, steps: [false, false], view: "list", dead: {}, floors: [], kept: [], review: false, done: false, summary: null };
}

export function joinLabels(labels) {
  return labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// Things that go dead when a breaker is off, and are not already known to be dead for another reason.
const testable = (d) => typeInfo(d.type).sweep && !d.notWorking;

// Breakers that get tested: not an empty space, and not one that feeds a subpanel (its devices belong to the
// subpanel's own breakers).
const tested = (project) => project.breakers.filter((b) => b.kind !== "empty" && !project.panels.some((p) => p.fedFromBreakerId === b.id));
const toTest = (project) => {
  const ids = new Set(tested(project).map((b) => b.id));
  return unsweptBreakers(project).filter((b) => ids.has(b.id));
};

// "Breakers tested: 5 of 18", or, when devices added since make tested breakers count again,
// "Breakers to test: 18. New devices added."
export function progressText(project) {
  const all = tested(project), left = toTest(project);
  return left.some((b) => b.swept) ? `Breakers to test: ${left.length}. New devices added.` : `Breakers tested: ${all.length - left.length} of ${all.length}`;
}

export function testHeader(project, breaker) {
  const devices = project.devices.filter((d) => typeInfo(d.type).sweep);
  return {
    title: [`Breaker ${breakerName(breaker)}`, breaker.label, `${breaker.amps} A`].filter(Boolean).join(", "),
    breakers: progressText(project),
    devices: `${devices.filter((d) => d.breakerId).length} of ${devices.length} devices have a breaker`,
  };
}

// The next breaker to test, in panel then space order; null when none is left.
export function nextToTest(project, afterId = "") {
  return toTest(project).find((b) => b.id !== afterId) || null;
}

// For steps 1 and 2: how many switches and GFCI outlets the app knows of.
export function stepCounts(project) {
  const count = (keep) => project.devices.filter(keep).length;
  const text = (n) => (n ? `${n} recorded` : "None recorded");
  const switches = count((d) => isSwitch(d.type)), gfcis = count((d) => d.type === "G");
  return { switches, gfcis, switchText: text(switches), gfciText: text(gfcis) };
}

// Is there anything to mark at all?
export function canTest(project) {
  return project.devices.some(testable);
}

// An earlier test found this device on another breaker. (A device only guessed onto another breaker simply moves.)
export function hasConflict(project, device, session) {
  return device.tested && device.breakerId !== session.breakerId && !!find(project, "breakers", device.breakerId);
}

export function conflictText(project, device, session) {
  const other = find(project, "breakers", device.breakerId), now = find(project, "breakers", session.breakerId);
  return `${device.label} was dead when breaker ${breakerName(other)} was off too. Move it to breaker ${breakerName(now)}?`;
}

// "No power": the device is on this breaker, found by a test.
export function markDead(project, session, deviceId, now = Date.now()) {
  const d = find(project, "devices", deviceId);
  if (!d || session.dead[deviceId]) return;
  session.dead[deviceId] = { breakerId: d.breakerId, tested: d.tested };
  setBreaker(project, deviceId, session.breakerId, true, now);
}

// Tapped again: it goes back to what it said before (or to nothing, if that breaker has gone).
export function unmark(project, session, deviceId, now = Date.now()) {
  const before = session.dead[deviceId];
  if (!before) return;
  delete session.dead[deviceId];
  const back = find(project, "breakers", before.breakerId) ? before : { breakerId: "", tested: false };
  setBreaker(project, deviceId, back.breakerId, back.tested, now);
}

// Drop marks the project no longer agrees with (Undo took them back, or the device was deleted).
export function reconcile(project, session) {
  for (const id of Object.keys(session.dead)) {
    const d = find(project, "devices", id);
    if (!d || d.breakerId !== session.breakerId || !d.tested) delete session.dead[id];
  }
}

const canMark = (project, session) => (d) => !session.dead[d.id] && testable(d) && !hasConflict(project, d, session);

// "Also mark the 5 outlets it protects?": the ids that would be marked.
export function alsoProtected(project, session, gfci) {
  return protectedBy(project, gfci.id).filter(canMark(project, session)).map((d) => d.id);
}

// "Whole room has no power": the ids that would be marked. group is one entry of model.sweepList.
export function roomToMark(project, session, group) {
  return group.devices.filter(canMark(project, session)).map((d) => d.id);
}

// After the breaker is back on: devices on the floors he walked that are on this breaker but were not marked.
// { guessed, tested, text }: "KIT-05 and KIT-07 were put on breaker 12 but still had power."
export function stillAssigned(project, session) {
  const found = unconfirmedOnBreaker(project, session.breakerId, Object.keys(session.dead), session.floors);
  const keep = (d) => testable(d) && !session.kept.includes(d.id);
  const guessed = found.guessed.filter(keep), tested = found.tested.filter(keep), all = [...guessed, ...tested];
  const breaker = find(project, "breakers", session.breakerId);
  return {
    guessed, tested,
    text: all.length ? `${joinLabels(all.map((d) => d.label))} ${all.length === 1 ? "was" : "were"} put on breaker ${breakerName(breaker)} but still had power.` : "",
  };
}

// { found, guesses, left }: what the finished test says.
export function finishSummary(project, session) {
  const breaker = find(project, "breakers", session.breakerId);
  const devices = Object.keys(session.dead).map((id) => find(project, "devices", id)).filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
  const guesses = devices.map((d) => {
    const before = session.dead[d.id], was = find(project, "breakers", before.breakerId);
    return was && !before.tested && was.id !== breaker.id ? `${d.label} was your guess of breaker ${breakerName(was)}` : "";
  }).filter(Boolean);
  return {
    found: devices.length
      ? `${plural(devices.length, "device")} found on breaker ${breakerName(breaker)}: ${devices.map((d) => d.label).join(", ")}`
      : `Nothing was found on breaker ${breakerName(breaker)}.`,
    guesses,
    left: toTest(project).filter((b) => b.id !== breaker.id).length,
  };
}
