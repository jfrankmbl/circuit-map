// Send or back up: the whole house, pictures included, as one project file. Also the sheet behind the header chip.
import { fileName, serialize } from "../file.js";
import { sendStatus, sizeText } from "../sending.js";
import { h, button, openSheet } from "../ui.js";
import { saveFile, willShare } from "./savefile.js";

const TYPE = "application/json"; // plain JSON, so the Share sheet accepts it

const dataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// The project file's text: the project, and each floor's picture as a data URL.
async function projectText(app) {
  const images = {};
  for (const floor of app.project.floors) {
    const blob = floor.imageId && await app.store.getImage(floor.imageId);
    if (blob) images[floor.imageId] = await dataUrl(blob);
  }
  return serialize(app.project, images);
}

// Make the file and hand it over. A computer downloads it as soon as it is made. A phone shows "Share it" first: the
// Share sheet only opens straight from a tap, and making the file can take longer than that allows. The house
// counts as sent once the file has really been handed over; after() then runs, if given.
export function exportSheet(app, after) {
  const at = Date.now(), name = fileName(app.project);
  const status = h("p", { role: "status" }, "Preparing file...");
  const actions = h("div", { class: "buttons" });
  const close = openSheet("Send or back up", (close) => [status, actions, button("Cancel", close)]);
  const hand = async (text) => {
    const sent = await saveFile(name, text, TYPE, "To put it on your iPhone: right-click the file, Share, AirDrop.");
    if (!sent) return; // he closed the Share sheet: Share it is still there to try again
    close();
    app.markSent(at);
    if (after) after();
  };
  projectText(app).then((text) => {
    if (!status.isConnected) return; // cancelled while the file was being made
    if (!willShare(name, TYPE)) return hand(text);
    status.textContent = `${name} is ready (${sizeText(new Blob([text]).size)}). AirDrop it to your Mac, or choose Save to Files.`;
    actions.append(button("Share it", () => hand(text), "main"));
  }).catch(() => {
    status.textContent = "The file could not be made. Try again.";
  });
}

// "Move or back up": what the chip in the header opens.
export function sendSheet(app) {
  openSheet("Move or back up", (close) => [
    h("p", {}, sendStatus(app.project, app.sentAt)),
    h("p", { class: "small" }, "Send a copy to your Mac, or save it to iCloud Drive. A copy that never leaves this device does not protect against a lost or wiped phone."),
    h("div", { class: "buttons" },
      button("Send or back up", () => {
        close();
        exportSheet(app);
      }, "main"),
      button("Close", close)),
  ]);
}
