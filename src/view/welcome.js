// First launch: nothing on this device yet. Two buttons of the same weight, so after a wiped phone the obvious
// button is not the one that makes an empty house.
import * as m from "../model.js";
import { parse } from "../file.js";
import { describeFile } from "../flow.js";
import { h, button } from "../ui.js";
import { movingCard } from "./movesheet.js";
import { inIphoneTab, HOME_CARD } from "../homescreen.js";

export function welcomeView(app) {
  if (app.ui.naming) return nameScreen(app);
  if (app.ui.offered) return offerScreen(app);
  if (app.ui.finding) return findScreen(app);
  const el = h("section", { class: "page" },
    !app.ui.homeSkipped && inIphoneTab({ ua: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints, standalone: !!navigator.standalone })
      && h("div", { class: "card home-card" }, h("p", {}, HOME_CARD),
        button("Start here anyway", () => { app.ui.homeSkipped = true; app.render(); }, "plain")),
    h("h1", {}, "Circuit Map"),
    h("p", {}, "Map the outlets, switches, lights and breakers of your house on your own floor plan."),
    h("div", { class: "buttons equal" },
      button("Start a new house", () => {
        app.ui.naming = true;
        app.render();
      }, "main"),
      button("I already have a project file", () => {
        app.ui.finding = true;
        app.render();
      }, "main")),
    h("p", { class: "small" },
      "Used this app before? Your house may have been cleared by Safari, or this may be a new phone. Choose I already " +
      "have a project file and pick your latest .circuitmap file (look in Files, Downloads or iCloud Drive, or ask " +
      "your other device to send it).",
      h("span", { class: "wide-only" }, " Or drop the file here.")));
  return dropTarget(app, el);
}

// A file dropped on the screen is read as if it had been chosen.
function dropTarget(app, el) {
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) readFile(app, e.dataTransfer.files[0]);
  });
  return el;
}

// The same steps as in the header sheet, for a device that has nothing yet.
function findScreen(app) {
  const picker = h("input", { type: "file", hidden: true, onchange: () => picker.files[0] && readFile(app, picker.files[0]) });
  return dropTarget(app, h("section", { class: "page" },
    h("h1", {}, "Bring in your project file"),
    movingCard(),
    h("div", { class: "buttons" },
      button("Choose the file", () => picker.click(), "main"),
      button("Back", () => {
        app.ui.finding = false;
        app.ui.fileError = "";
        app.render();
      })),
    picker,
    app.ui.fileError && h("p", { class: "error", role: "alert" }, app.ui.fileError)));
}

async function readFile(app, file) {
  try {
    app.ui.offered = parse(await file.text());
    app.ui.fileError = "";
  } catch (err) {
    app.ui.fileError = err.code ? err.message : "This file could not be read.";
  }
  app.render();
}

function offerScreen(app) {
  const { project, images } = app.ui.offered;
  return h("section", { class: "page" },
    h("p", {}, describeFile(m.describeProject(project)) + " Use this one?"),
    h("div", { class: "buttons" },
      button("Use it", () => app.adopt(project, images), "main"),
      button("Choose another file", () => {
        app.ui.offered = null;
        app.render();
      })));
}

function nameScreen(app) {
  const input = h("input", { type: "text", value: "My house", autocomplete: "off", enterKeyHint: "done" });
  const el = h("form", {
    class: "page",
    onsubmit: (e) => {
      e.preventDefault();
      app.adopt(m.createProject(input.value.trim() || "My house"));
    },
  },
    h("label", {}, "What do you call this house?", input),
    h("div", { class: "buttons" },
      h("button", { type: "submit", class: "main" }, "Start"),
      button("Back", () => {
        app.ui.naming = false;
        app.render();
      })));
  // Selected, so typing replaces "My house". The form is not on the page until the caller adds it.
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  return el;
}
