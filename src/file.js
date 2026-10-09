// The project file that moves between devices: JSON text holding the project and its plan images.
import { FORMAT_VERSION, COLLECTIONS } from "./model.js";

export const EXTENSION = ".circuitmap";

const pad = (n) => String(n).padStart(2, "0");

// The house name with the characters a file name cannot have taken out.
export function safeName(project) {
  return project.name.replace(/[\\/:*?"<>|]/g, "").trim() || "House";
}

// "2026-10-06"
export function dayStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fileName(project, date = new Date()) {
  return `${safeName(project)} ${dayStamp(date)} ${pad(date.getHours())}${pad(date.getMinutes())}${EXTENSION}`;
}

export function serialize(project, images = {}) {
  return JSON.stringify({ app: "circuit-map", project, images });
}

function importError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Returns { project, images } or throws an Error whose .code is "unreadable", "format" or "newer"
// and whose .message can be shown to the user as is.
export function parse(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw importError("unreadable", "This file could not be read.");
  }
  const project = data && data.app === "circuit-map" ? data.project : null;
  if (!project || typeof project.id !== "string") throw importError("format", "This is not a Circuit Map project file.");
  if (project.formatVersion > FORMAT_VERSION) {
    throw importError("newer", "This file was made by a newer version of Circuit Map. Close the app completely, open it again, and try the file once more.");
  }
  for (const coll of [...COLLECTIONS, "deleted"]) {
    if (!Array.isArray(project[coll])) throw importError("format", "This is not a Circuit Map project file.");
  }
  return { project, images: data.images && typeof data.images === "object" ? data.images : {} };
}
