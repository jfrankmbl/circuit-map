// "Print or save as PDF": one page of the Breakers tab. What is on the screen is the printout: the print styles
// hide everything but the paper. It is always black on white, whatever the device's dark mode.
import { h, button } from "../ui.js";
import { doorCard, fullList, printRecord } from "../printing.js";
import { state, show } from "./panel.js";

const PAPER = 744; // CSS pixels: 7.25 in of page with a quarter inch of white each side

// On a phone the paper is shrunk to the width of the screen. "Read it larger" shows it at full size, scrolling sideways.
// It is never enlarged beyond that.
let large = false;
function fit() {
  for (const paper of document.querySelectorAll(".paper")) paper.style.zoom = large ? 1 : Math.min(1, paper.parentElement.clientWidth / PAPER);
}
let listening = false; // for a window that changes size; set up when the page is first drawn

export function printPage(app, panel) {
  const st = state(app), p = app.project, card = doorCard(p, panel);
  const pick = (full, text) => h("button", { type: "button", "aria-pressed": String(st.printFull === full), onclick: () => show(app, { printFull: full }) }, text);
  // Every page carries the house, the panel, the date and what "?" means.
  const head = () => h("div", { class: "paper-head" },
    h("strong", {}, `${card.house}: ${card.panel}`),
    card.fedFrom && h("span", {}, card.fedFrom),
    h("span", {}, card.printed),
    h("span", {}, card.legend));
  // A line with nothing entered is ruled, to write on by hand.
  const lineEl = (line) => h("div", { class: "door-line" + (line.label || line.facts ? "" : " write") },
    h("strong", { class: "door-no" }, line.number),
    h("span", { class: "door-text" },
      h("span", { class: "door-label" }, line.label),
      line.facts && h("span", { class: "door-facts" }, line.facts),
      line.rooms && h("span", { class: "door-rooms" }, line.rooms)));
  const cardEl = () => h("div", { class: "door-card" + (card.wide ? " wide" : "") },
    head(),
    h("div", { class: "door-cols" }, card.columns.map((column) =>
      h("div", { class: "door-col" }, column.map((cell) => h("div", { class: `door-cell ${cell.kind}` }, cell.lines.map(lineEl)))))));
  // A table, so its heading is repeated at the top of every printed page.
  const listEl = () => h("table", { class: "full-list" },
    h("thead", {},
      h("tr", {}, h("th", { colspan: 4 }, head())),
      h("tr", {}, ["Label", "What it is", "Room", ""].map((text) => h("th", {}, text)))),
    h("tbody", {}, fullList(p, panel).map((b) => [
      h("tr", { class: "full-breaker" }, h("th", { colspan: 4 }, b.title)),
      b.rows.length
        ? b.rows.map((row) => h("tr", {}, [row.label, row.type, row.room, row.guess].map((text) => h("td", {}, text))))
        : h("tr", {}, h("td", { colspan: 4 }, b.none)),
    ])));
  const print = () => {
    // Remembered on this device, so the panel can say when the card on the door has gone stale.
    app.printed[panel.id] = printRecord(p, panel);
    app.store.setSetting("printed", app.printed).catch(() => {});
    window.print();
  };
  if (!listening) window.addEventListener("resize", fit);
  listening = true;
  queueMicrotask(fit); // once the page is on the screen
  return h("section", { class: "print-page" },
    h("div", { class: "page no-print" },
      button(`Back to ${panel.name}`, () => show(app, { page: "" })),
      h("h2", {}, `Print ${panel.name}`),
      h("div", { class: "buttons", role: "group", "aria-label": "How much to print" }, pick(false, "Short"), pick(true, "Full")),
      h("p", { class: "small" }, st.printFull
        ? "The card, then a list of every device on each breaker."
        : "A card for the inside of the panel door. Cut along the outer line."),
      button("Print", print, "main big"),
      h("button", { type: "button", "aria-pressed": String(large), onclick: () => { large = !large; show(app, {}); } }, "Read it larger"),
      h("p", { class: "small" }, "To save a PDF instead, choose Save as PDF in the print window (on iPhone: Save to Files).")),
    h("div", { class: "paper-fit" }, h("div", { class: "paper" },
      h("section", { class: "sheet-page" }, cardEl()),
      st.printFull && h("section", { class: "sheet-page" }, listEl()))));
}
