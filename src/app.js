// The shell: opens the store, loads the project, draws the tabs and the Undo button, and gives each view the `app`
// object. A view is a function (app) => element, called again after every change.
import * as m from "./model.js";
import { openStore, memoryStore } from "./store.js";
import { createHistory, remember, forget, undo, undoLabel } from "./history.js";
import { startTab } from "./flow.js";
import { h, toast, clearToast } from "./ui.js";
import { createPlan } from "./view/plan.js";
import { welcomeView } from "./view/welcome.js";
import { setupView } from "./view/setup.js";

// [id, the word on the tab bar, view]. Tabs appear here as they are built.
const TABS = [["floors", "Floors", setupView]];

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
    const name = undo(app.history, app.project);
    if (!name) return;
    app.save();
    render();
    toast("Undone: " + name);
  },

  go(tab) {
    app.tab = tab;
    render();
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

  // Start using a project: a new house, or one read from a file (images: { imageId: data URL }).
  async adopt(project, images = {}) {
    for (const [id, dataUrl] of Object.entries(images)) {
      await app.store.putImage(id, await (await fetch(dataUrl)).blob());
    }
    Object.assign(app, { project, history: createHistory(), ui: {}, floorId: "", shownImage: "", tab: startTab(project) });
    app.save();
    render();
  },

  render,
};

function render() {
  const p = app.project;
  document.body.classList.toggle("no-project", !p);
  $("top-banner").hidden = !app.notSaved;
  $("top-banner").textContent = app.notSaved ? "Changes are not being saved on this device." : "";
  if (!p) {
    $("screen").replaceChildren(welcomeView(app));
    return;
  }
  $("house").textContent = p.name;
  const tab = TABS.find((t) => t[0] === app.tab) || TABS[0];
  $("tabs").replaceChildren(...TABS.map(([id, label]) =>
    h("button", { type: "button", "aria-current": tab[0] === id ? "page" : null, onclick: () => app.go(id) }, label)));
  $("screen").replaceChildren(tab ? tab[2](app) : h("p", { class: "page" }, "Nothing to show yet."));
  const label = undoLabel(app.history);
  $("undo").textContent = label || "Undo";
  $("undo").disabled = !label;
}

$("undo").addEventListener("click", () => app.undo());

// Cmd-Z or Ctrl-Z, unless he is typing in a field (where it should undo typing) or a sheet is open.
document.addEventListener("keydown", (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z") return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.querySelector("dialog[open]")) return;
  e.preventDefault();
  app.undo();
});

async function boot() {
  try {
    app.store = await openStore();
  } catch {
    app.store = memoryStore();
    app.notSaved = true;
  }
  app.project = await app.store.loadProject();
  if (app.project) {
    await app.store.pruneImages(app.project.floors.map((f) => f.imageId).filter(Boolean));
    app.tab = startTab(app.project);
  }
  render();
}

boot();
