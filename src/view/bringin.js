// Bring in a file: read it, say in words what merging would do, merge only when he agrees, then say it is done.
import * as m from "../model.js";
import { parse } from "../file.js";
import { merge } from "../merge.js";
import { importParts, nothingNew, needsCare, changedLine, cameInFrom, differentHouse, unsent } from "../sending.js";
import { h, button, openSheet, ask, toast } from "../ui.js";
import { exportSheet } from "./send.js";

const TITLE = "Bring in a file";

// Open the file picker. Called straight from a tap, because a phone only allows that. The picker shows every file.
export function chooseFile(app) {
  const picker = document.getElementById("picker");
  picker.value = "";
  picker.onchange = () => picker.files[0] && importFile(app, picker.files[0]);
  picker.click();
}

export async function importFile(app, file) {
  const status = h("p", { role: "status" }, "Reading file...");
  const close = openSheet(TITLE, (close) => [status, button("Cancel", close)]);
  let incoming;
  try {
    incoming = parse(await file.text());
  } catch (err) {
    close();
    ask("This file can't be used", err.code ? err.message : "This file could not be read.", [{ text: "OK", cls: "main" }]);
    return;
  }
  if (!status.isConnected) return; // he cancelled while it was being read
  close();
  if (incoming.project.id !== app.project.id) return askDifferentHouse(app, incoming);
  askBringIn(app, incoming, merge(app.project, incoming.project));
}

function askDifferentHouse(app, { project, images }) {
  const replace = () => app.adopt(project, images);
  ask(TITLE, differentHouse(m.describeProject(app.project), m.describeProject(project)), [
    { text: "Save a copy of this device first, then replace", cls: "main", run: () => exportSheet(app, replace) },
    { text: "Replace without saving", cls: "plain danger", run: replace },
    { text: "Cancel" },
  ]);
}

// "From the file: 12 new, 3 changed, 2 deleted. Bring them in?" Nothing changes until he taps Bring them in.
function askBringIn(app, incoming, result) {
  const { project, summary } = result;
  if (nothingNew(summary)) {
    ask(TITLE, "Nothing new: this device already has everything in the file.", [{ text: "OK", cls: "main" }]);
    return;
  }
  const lists = {
    updated: summary.changed.map(changedLine),
    removed: summary.removedItems.map((r) => r.name),
    renumbered: summary.renumbered.map((c) => `${c.from} is now ${c.to}`),
  };
  openSheet(TITLE, (close) => {
    const open = h("div");
    let shown = "";
    const show = (key) => {
      shown = shown === key ? "" : key;
      open.replaceChildren(...(shown ? [h("ul", {}, lists[shown].map((t) => h("li", {}, t)))] : []));
    };
    const parts = importParts(summary).map((part, i) => [i ? ", " : "",
      lists[part.key] ? button(part.text, () => show(part.key), "plain") : part.text]);
    return [
      h("p", {}, "From the file: ", parts, ". Bring them in?"),
      open,
      needsCare(summary) && h("p", { class: "small" },
        "If the same item was changed on both devices, the newer change is kept. Your other work on this device stays."),
      h("div", { class: "buttons" },
        button("Bring them in", async () => {
          close();
          await app.bringIn(project, incoming.images, cameInFrom(project, incoming.project));
          done(app);
        }, "main"),
        button("Cancel", close),
        needsCare(summary) && button("Save a copy of this device first", () => {
          close();
          exportSheet(app, () => askBringIn(app, incoming, result)); // the question comes back once the copy is saved
        })),
    ];
  });
}

// "Done." and, when this device has work the other one has not seen, the offer to send it back: the second half of
// every exchange, without which one device is always behind.
function done(app) {
  const back = unsent(app.project, app.sentAt, app.cameIn) > 0;
  openSheet(TITLE, (close) => [
    h("p", {}, "Done. This device now has everything from both."),
    back && h("p", {}, "The other device does not have this device's work yet. Send this project back to it?"),
    h("div", { class: "buttons" },
      ...(back
        ? [button("Send it back", () => { close(); exportSheet(app); }, "main"), button("Not now", close)]
        : [button("OK", close, "main")]),
      button("Undo import", () => { close(); undoImport(app); })),
  ]);
}

// Available from the "Move or back up" sheet for the rest of the session. If he has changed anything since, he is asked.
export function undoImport(app) {
  const back = () => {
    app.undoImport();
    toast("Import undone.");
  };
  if (JSON.stringify(app.project) === app.importUndo.after) return back();
  ask("Undo import", "You have made changes since bringing in the file. Undo import will take those away too.", [
    { text: "Cancel", cls: "main" },
    { text: "Undo import anyway", cls: "plain danger", run: back },
  ]);
}
