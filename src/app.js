// The shell: opens the store, loads the project, draws the tabs, the banner and the Undo button, and gives each view
// the `app` object. A view is a function (app) => element, called again after every change.
import * as m from "./model.js";
import { openStore, memoryStore } from "./store.js";
import { createHistory, remember, forget, undo, undoLabel } from "./history.js";
import { startTab, plural } from "./flow.js";
import { h, button, toast, clearToast } from "./ui.js";
import { createPlan } from "./view/plan.js";
import { welcomeView } from "./view/welcome.js";
import { setupView } from "./view/setup.js";
import { placeView } from "./view/place.js";
import { linkView } from "./view/link.js";
import { panelView } from "./view/panel.js";
import { breakerName } from "./panel.js";
import { backOn, askBackOn } from "./view/test.js";
import { browseView, deleteSelected } from "./view/browse.js";
import { chipText, needsBackup, unsent } from "./sending.js";
import { exportSheet } from "./view/send.js";
import { sendSheet } from "./view/movesheet.js";
import { platesSheet } from "./view/plates.js";
import { importFile } from "./view/bringin.js";

// [id, the word on the tab bar, view]. Tabs appear here as they are built.
const TABS = [["floors", "Floors", setupView], ["add", "Add", placeView], ["link", "Switches", linkView], ["panel", "Breakers", panelView], ["map", "Map", browseView]];

// On these tabs the phone is kept awake where the browser allows it, so the screen does not lock during a walk.
const AWAKE_TABS = ["add", "panel"];

const $ = (id) => document.getElementById(id);

export const app = {
  store: null,
  project: null,      // null until a house is started or a file adopted
  tab: "",
  floorId: "",        // the floor being shown; see floor()
  notSaved: false,    // true when the device refuses to store the project
  history: createHistory(),
  plan: createPlan(), // one plan for every tab, so zoom and position survive a redraw
  shownImage: "",     // the imageId the plan is showing
  ui: {},             // what views remember between redraws (the open page, reorder mode ...)

  // What he is in the middle of doing on the plan, or null. { text, buttons: [{ text, run, cls }], cancel, floorId, ... }
  // text and buttons fill the banner; cancel() is what Esc, Undo and changing tab do. A mode may add its own fields.
  mode: null,

  // Make a change. fn(project) edits through model.js; name finishes "Undo: ...". Saves and redraws.
  commit(name, fn) {
    remember(app.history, name, app.project);
    let result;
    try {
      result = fn(app.project);
    } catch (err) {
      forget(app.history);
      throw err;
    }
    clearToast();
    app.save();
    render();
    return result;
  },

  save() {
    app.store.saveProject(app.project).catch(() => {
      if (app.notSaved) return;
      app.notSaved = true;
      render();
    });
  },

  undo() {
    if (app.mode) app.cancelMode();
    const name = undo(app.history, app.project);
    if (!name) return;
    app.save();
    render();
    toast("Undone: " + name);
  },

  go(tab) {
    if (app.mode) app.cancelMode();
    app.tab = tab;
    render();
  },

  // Start a mode, or change what the current one says. The mode sets plan.onTap and plan.handles itself.
  setMode(mode) {
    app.mode = mode;
    render();
  },

  // Finish the mode: the banner empties and the plan stops listening.
  endMode() {
    if (!app.mode) return;
    app.mode = null;
    app.plan.onTap = null;
    app.plan.handles = null;
    app.plan.layers.overlay.replaceChildren();
    render();
  },

  cancelMode() {
    if (app.mode && app.mode.cancel) app.mode.cancel();
    app.endMode();
  },

  // The floor being shown. Falls back to the lowest floor; null when the house has none.
  floor() {
    return m.find(app.project, "floors", app.floorId) || m.sortedFloors(app.project)[0] || null;
  },

  setFloor(id) {
    app.floorId = id;
    render();
  },

  // Put a floor's picture in the shared plan. Does nothing if it is already there.
  async showPicture(floor) {
    const id = floor.imageId;
    if (app.shownImage === id) return;
    app.shownImage = id;
    app.plan.show(null);
    app.plan.setMessage("Loading picture...");
    const blob = await app.store.getImage(id);
    if (app.shownImage !== id) return;
    if (blob) await app.plan.show(blob);
    else app.plan.setMessage("This floor's picture is missing. Choose it again on the Floors tab.");
  },

  // Start using a project: a new house, or one read from a file (images: { imageId: data URL }). What came from a
  // file is not this device's work, so there is nothing new to send.
  async adopt(project, images) {
    for (const [id, dataUrl] of Object.entries(images || {})) {
      await app.store.putImage(id, await (await fetch(dataUrl)).blob());
    }
    Object.assign(app, { project, history: createHistory(), ui: {}, mode: null, test: null, floorId: "", shownImage: "", tab: startTab(project),
      sentAt: images ? Date.now() : 0, nudge: false, cameIn: {}, importUndo: null });
    app.store.setSetting("sent", app.sentAt).catch(() => {});
    app.store.setSetting("cameIn", {}).catch(() => {});
    app.saveTest();
    app.save();
    render();
  },

  // When this device last finished sending the project (see sending.js), 0 if never. Not in the project file.
  sentAt: 0,
  // True while "Back up your work" should show. Decided when the app opens.
  nudge: false,
  // Remind me later on the plates bar: hidden until the app is next opened. Not saved.
  platesLater: false,

  // { id: updated }: records and deletions that arrived by Import exactly as they are, which are not this device's work
  // to send (see sending.js unsent). Emptied by a send.
  cameIn: {},
  // Set by bringIn, for Undo import: { project, history, cameIn, after } as they were before it, and the project as it
  // was just after. Lasts for the session.
  importUndo: null,

  markSent(at) {
    app.sentAt = at;
    app.cameIn = {};
    app.nudge = false;
    app.store.setSetting("sent", at).catch(() => {});
    app.store.setSetting("cameIn", {}).catch(() => {});
    render();
  },

  // Take in a merged project (from merge.js) and the pictures that came with the file ({ imageId: data URL }). The
  // ordinary Undo history is emptied: stepping back through it afterwards would record the imported things as deleted.
  async bringIn(merged, images, cameIn) {
    if (app.mode) app.cancelMode();
    const before = { project: structuredClone(app.project), history: app.history, cameIn: app.cameIn };
    for (const floor of merged.floors) {
      const url = images[floor.imageId];
      if (url && !(await app.store.getImage(floor.imageId))) await app.store.putImage(floor.imageId, await (await fetch(url)).blob());
    }
    Object.assign(app.project, merged);
    Object.assign(app, { history: createHistory(), ui: {}, cameIn: { ...app.cameIn, ...cameIn } });
    app.importUndo = { ...before, after: JSON.stringify(app.project) };
    if (app.test && !m.find(app.project, "breakers", app.test.breakerId)) app.test = null;
    app.store.setSetting("cameIn", app.cameIn).catch(() => {});
    app.saveTest();
    app.save();
    render();
  },

  // Put this device back exactly as it was before the last bringIn. Nothing is recorded as deleted.
  undoImport() {
    const { project, history, cameIn } = app.importUndo;
    if (app.mode) app.cancelMode();
    Object.assign(app.project, project);
    Object.assign(app, { history, cameIn, ui: {}, importUndo: null });
    app.store.setSetting("cameIn", cameIn).catch(() => {});
    app.save();
    render();
  },

  // Later on the backup nudge: hide it for a day.
  later() {
    app.nudge = false;
    app.store.setSetting("later", Date.now()).catch(() => {});
    render();
  },

  // { panelId: { at, lines } }: what each panel's door card said when it was last printed from this device (see
  // printing.js). Not in the project file.
  printed: {},

  // The breaker test in progress (see testing.js), or null. Kept on this device, not in the project file, so the
  // "breaker is OFF" bar survives closing the app.
  test: null,

  saveTest() {
    app.store.setSetting("test", app.test && !app.test.done ? app.test : null).catch(() => {});
  },

  render,
};

function render() {
  const p = app.project;
  document.body.classList.toggle("no-project", !p);
  // One banner at the top at a time, the most pressing first: a breaker that is off (safety), then not saving, then
  // the nudge to back up.
  const off = p && app.test && app.test.off && m.find(p, "breakers", app.test.breakerId);
  const plates = p && !off && !app.notSaved && app.tab === "map" && !app.platesLater ? m.platesToRewrite(p).length : 0;
  const nudge = !!p && !off && !app.notSaved && !plates && app.nudge;
  $("top-banner").hidden = !off && !app.notSaved && !plates && !nudge;
  $("top-banner").classList.toggle("calm", !!plates || nudge);
  $("top-banner").replaceChildren(...(
    off ? [h("strong", {}, `Breaker ${breakerName(off)} is OFF`), button("I've switched it back on", () => backOn(app))]
    : app.notSaved ? ["Changes are not being saved on this device."]
    : plates ? [h("strong", {}, `${plural(plates, "plate")} to rewrite`), button("Show", () => platesSheet(app)),
      button("Remind me later", () => { app.platesLater = true; render(); })]
    : nudge ? [h("span", {}, "Back up your work: send a copy to your Mac, or save it to iCloud Drive."),
      button("Send or back up", () => exportSheet(app)), button("Later", app.later)]
    : []));
  if (!p) {
    $("screen").replaceChildren(welcomeView(app));
    return;
  }
  $("house").textContent = p.name;
  const chip = chipText(unsent(p, app.sentAt, app.cameIn), m.platesToRewrite(p).length);
  $("chip").replaceChildren(h("span", { class: "wide-only" }, chip.wide), h("span", { class: "narrow-only" }, chip.narrow));
  const tab = TABS.find((t) => t[0] === app.tab) || TABS[0];
  $("tabs").replaceChildren(...TABS.map(([id, label]) =>
    h("button", { type: "button", "aria-current": tab[0] === id ? "page" : null, onclick: () => app.go(id) }, label)));
  if (!app.mode) {
    // No mode is listening, so the view about to be drawn decides what a tap on the plan does.
    app.plan.onTap = null;
    app.plan.handles = null;
  }
  $("screen").replaceChildren(tab[2](app));
  keepAwake(AWAKE_TABS.includes(tab[0]));
  $("mode-banner").replaceChildren(...(app.mode
    ? [h("span", {}, app.mode.text, app.mode.result && h("strong", { class: "result" }, app.mode.result)),
      ...app.mode.buttons.map((b) => button(b.text, b.run, b.cls || ""))]
    : []));
  const label = undoLabel(app.history);
  $("undo").textContent = label || "Undo";
  $("undo").disabled = !label;
}

$("undo").addEventListener("click", () => app.undo());
$("chip").addEventListener("click", () => sendSheet(app));

// A file dropped on the window is brought in. (With no house yet the first-launch screen takes it.)
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file && app.project && !document.querySelector("dialog[open]")) importFile(app, file);
});

document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return; // a sheet handles its own keys
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === "Escape" && app.mode) {
    app.cancelMode();
  } else if (e.key === "Delete" && !typing && !app.mode && app.project && app.tab === "map") {
    deleteSelected(app);
  } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !typing) {
    // In a field Cmd-Z should undo typing, so it is left alone there.
    e.preventDefault();
    app.undo();
  }
});

let wakeLock = null, askingForLock = false;

async function keepAwake(on) {
  try {
    if (on && !wakeLock && !askingForLock && navigator.wakeLock && document.visibilityState === "visible") {
      askingForLock = true;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
    }
  } catch {
    // The browser said no (low battery, or no support). Nothing to do.
  } finally {
    askingForLock = false;
  }
}

// The browser drops the lock when the app is put away; ask again when it comes back.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && app.project) render();
});
async function boot() {
  try {
    app.store = await openStore();
  } catch {
    app.store = memoryStore();
    app.notSaved = true;
  }
  app.printed = await app.store.getSetting("printed", {});
  app.project = await app.store.loadProject();
  if (app.project) {
    await app.store.pruneImages(app.project.floors.map((f) => f.imageId).filter(Boolean));
    app.tab = startTab(app.project);
    app.sentAt = await app.store.getSetting("sent", 0);
    app.cameIn = await app.store.getSetting("cameIn", {});
    app.nudge = needsBackup(app.project, app.sentAt, await app.store.getSetting("later", 0), Date.now(), app.cameIn);
    app.test = await app.store.getSetting("test", null);
    if (app.test && !m.find(app.project, "breakers", app.test.breakerId)) app.test = null;
  }
  render();
  if (app.test && app.test.off) askBackOn(app);
}

boot();
