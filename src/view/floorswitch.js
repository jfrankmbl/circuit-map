// The floor buttons above a plan, lowest floor first: a row of up to four, and one button opening a list beyond that.
import * as m from "../model.js";
import { h, button, openSheet } from "../ui.js";

export function floorSwitch(app) {
  const floors = m.sortedFloors(app.project), current = app.floor();
  if (!current) return null;
  if (floors.length <= 4) {
    return h("div", { class: "floor-switch", role: "group", "aria-label": "Floor" },
      floors.map((f) => h("button", { type: "button", "aria-pressed": String(f.id === current.id), onclick: () => app.setFloor(f.id) }, f.name)));
  }
  return h("div", { class: "floor-switch" },
    button("Floor: " + current.name, () => openSheet("Choose a floor", (close) =>
      h("div", { class: "rows" }, floors.map((f) => button(f.name + (f.id === current.id ? " (showing now)" : ""), () => {
        close();
        app.setFloor(f.id);
      }))))));
}
