// Undo for one session: the project as it was before each of the last 20 changes, each with a name for the button.
import { restoreSnapshot } from "./model.js";

export function createHistory(limit = 20) {
  return { limit, steps: [] };
}

// Call before a change. name finishes "Undo: ...", for example "placed KIT-03".
export function remember(history, name, project) {
  history.steps.push({ name, snap: structuredClone(project) });
  if (history.steps.length > history.limit) history.steps.shift();
}

// The change that was about to be made failed, so there is nothing to undo.
export function forget(history) {
  history.steps.pop();
}

export function undoLabel(history) {
  const last = history.steps.at(-1);
  return last ? "Undo: " + last.name : "";
}

// Put the project back as it was before the newest change. Returns that change's name, or null with nothing to undo.
export function undo(history, project, now = Date.now()) {
  const step = history.steps.pop();
  if (!step) return null;
  restoreSnapshot(project, step.snap, now);
  return step.name;
}
