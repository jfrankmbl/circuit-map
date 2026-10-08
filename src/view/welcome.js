// First launch: nothing on this device yet. Two buttons of the same weight, so after a wiped phone the obvious
// button is not the one that makes an empty house.
import * as m from "../model.js";
import { parse } from "../file.js";
import { describeFile } from "../flow.js";
import { h, button } from "../ui.js";

export function welcomeView(app) {
  if (app.ui.naming) return nameScreen(app);
  if (app.ui.offered) return offerScreen(app);
  const picker = h("input", { type: "file", hidden: true, onchange: () => picker.files[0] && readFile(app, picker.files[0]) });
  const el = h("section", { class: "page" },
    h("h1", {}, "Circuit Map"),
    h("p", {}, "Map the outlets, switches, lights and breakers of your house on your own floor plan."),
    h("div", { class: "buttons equal" },
      button("Start a new house", () => {
        app.ui.naming = true;
        app.render();
      }, "main"),
      button("I already have a project file", () => picker.click(), "main")),
    picker,
    app.ui.fileError && h("p", { class: "error", role: "alert" }, app.ui.fileError),
    h("p", { class: "small" },
      "Used this app before? Your house may have been cleared by Safari, or this may be a new phone. Choose I already " +
      "have a project file and pick your latest .circuitmap file (look in Files, Downloads or iCloud Drive, or ask " +
      "your other device to send it).",
      h("span", { class: "wide-only" }, " Or drop the file here.")));
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) readFile(app, e.dataTransfer.files[0]);
  });
  return el;
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
