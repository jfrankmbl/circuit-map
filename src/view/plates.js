// "Plates to rewrite": the list of devices whose label changed while the old one is still written on the cover plate.
import * as m from "../model.js";
import { plural } from "../flow.js";
import { plateRow } from "../browse.js";
import { h, button, openSheet, ask } from "../ui.js";
import { showOnPlan } from "./browse.js";

// The rows and the "rewritten all" button. close shuts the sheet this sits in; again opens it afresh after a change.
export function platesContent(app, close, again) {
  const plates = m.platesToRewrite(app.project);
  const finish = (name, fn) => {
    close();
    app.commit(name, fn);
    again();
  };
  return [
    h("ul", { class: "rows scroll" }, plates.map((d) => {
      const row = plateRow(app.project, d);
      return h("li", {},
        h("strong", {}, row.todo),
        h("span", {}, row.what),
        h("span", { class: "small" }, row.why),
        h("div", { class: "buttons" },
          button("Show on plan", () => { close(); showOnPlan(app, d.id, row.otherId); }),
          button("I've rewritten it", () => finish(`rewrote the plate of ${d.label}`, (p) => m.confirmPlate(p, d.id))),
          row.otherId && button("Swap labels", () => finish(`swapped ${d.label} and ${m.find(app.project, "devices", row.otherId).label}`,
            (p) => m.swapLabels(p, d.id, row.otherId)))),
        row.swap && h("span", { class: "small" }, row.swap));
    })),
    plates.length > 1 && button(`I've rewritten all ${plates.length}`, () => {
      close();
      ask(`Mark all ${plates.length} as done?`, "", [
        { text: "Yes, all rewritten", cls: "main", run: () => app.commit(`rewrote ${plural(plates.length, "plate")}`, (p) => { for (const d of plates) m.confirmPlate(p, d.id); }) },
        { text: "Cancel", run: again },
      ]);
    }),
  ];
}

export function platesSheet(app) {
  if (!m.platesToRewrite(app.project).length) return;
  openSheet("Plates to rewrite", (close) => [...platesContent(app, close, () => platesSheet(app)), button("Done", close, "main")]);
}
