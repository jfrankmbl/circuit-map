// The words about offline use and versions. No DOM here.

// state: "unsupported" | "pending" | "ready". An unsupported browser says nothing rather than something false.
export function offlineText(state) {
  if (state === "ready") return "Works without a signal";
  if (state === "pending") return "Not saved for offline use yet. Open the app once with a signal.";
  return "";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// released: "2026-10-09" gives "Circuit Map version 12, 9 Oct 2026".
export function versionText(version, released) {
  const [y, mo, d] = released.split("-").map(Number);
  return `Circuit Map version ${version}, ${d} ${MONTHS[mo - 1]} ${y}`;
}

// The new-version banner: a new version waiting, an older one already in control (so not on the very first
// install), and he has not said Later.
export function updateBanner({ waiting = false, controlled = false, later = false } = {}) {
  return waiting && controlled && !later;
}

export const UPDATE_TEXT = "A new version is ready. Close the app and open it again.";
export const UPDATE_HOW = "On iPhone, swipe up from the bottom edge and pause, then swipe Circuit Map up and away.";
