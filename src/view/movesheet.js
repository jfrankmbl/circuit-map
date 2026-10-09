// "Move or back up": what the chip in the header opens. Send, bring in a file, and the steps for moving a project.
import { sendStatus, MOVING } from "../sending.js";
import { h, button, openSheet } from "../ui.js";
import { exportSheet } from "./send.js";
import { chooseFile, undoImport } from "./bringin.js";

// Both directions in numbered steps. Also shown on the first-launch screen.
export function movingCard() {
  const steps = (list) => h("ol", {}, list.map((s) => h("li", {}, s)));
  return h("div", { class: "steps" },
    h("h3", {}, "Phone to Mac"), steps(MOVING.phoneToMac),
    h("h3", {}, "Mac to phone"), steps(MOVING.macToPhone),
    h("p", { class: "small" }, MOVING.tip));
}

export function sendSheet(app) {
  openSheet("Move or back up", (close) => [
    h("p", {}, sendStatus(app.project, app.sentAt, Date.now(), app.cameIn)),
    h("p", { class: "small" }, "Send a copy to your Mac, or save it to iCloud Drive. A copy that never leaves this device does not protect against a lost or wiped phone."),
    h("div", { class: "buttons" },
      button("Send or back up", () => { close(); exportSheet(app); }, "main"),
      // The picker is opened here, in the tap itself; the sheet closing first does not stop it.
      button("Bring in a file", () => { close(); chooseFile(app); }),
      button("Moving your project", () => {
        close();
        openSheet("Moving your project", (shut) => [movingCard(), button("Close", shut, "main")]);
      }),
      app.importUndo && button("Undo import", () => { close(); undoImport(app); }),
      button("Close", close)),
  ]);
}
