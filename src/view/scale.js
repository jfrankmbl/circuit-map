// The Scale part of a floor's page. Optional: only used to show real distances. Positions never depend on it.
import * as m from "../model.js";
import { toInches } from "../flow.js";
import { h, svg, button, openSheet, toast } from "../ui.js";
import { dot } from "./plan.js";

export function scaleSection(app, floor) {
  if (!floor.imageId) return null;
  return [
    h("h2", {}, "Scale (optional)"),
    h("p", { class: "small" }, floor.pxPerIn
      ? "The scale is set, so real distances can be shown."
      : "Only needed to show real distances. Tap two points on the plan and type how far apart they really are."),
    h("div", { class: "buttons" },
      button(floor.pxPerIn ? "Set the scale again" : "Set the scale", () => startScale(app, floor)),
      floor.pxPerIn > 0 && button("Clear the scale", () =>
        app.commit(`cleared the scale of ${floor.name}`, (p) => m.update(p, "floors", floor.id, { pxPerIn: 0 })))),
  ];
}

function startScale(app, floor) {
  const plan = app.plan, ends = [];

  const draw = () => plan.layers.overlay.replaceChildren(
    ...(ends.length === 2 ? [svg("line", { class: "trace-line", x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1] })] : []),
    ...ends.map(([x, y], i) => dot(x, y, "spot", null, String(i + 1))));

  const refresh = () => {
    app.setMode({
      floorId: floor.id,
      text: ends.length === 0 ? "Setting the scale: tap one end of something you know the length of, like a wall"
        : ends.length === 1 ? "Setting the scale: now tap the other end" : "Setting the scale",
      buttons: [{ text: "Cancel", run: () => app.endMode() }],
    });
    draw();
  };

  const askDistance = () => openSheet("How far apart are they really?", (close) => {
    const feet = h("input", { type: "number", min: 0, inputMode: "numeric" });
    const inches = h("input", { type: "number", min: 0, step: "any", inputMode: "decimal" });
    const problem = h("p", { class: "error", role: "alert" });
    requestAnimationFrame(() => feet.focus());
    return h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        const total = toInches(feet.value, inches.value);
        if (!total) {
          problem.textContent = "Type the distance in feet, inches, or both.";
          return;
        }
        close();
        app.endMode();
        app.commit(`set the scale of ${floor.name}`, (p) =>
          m.update(p, "floors", floor.id, { pxPerIn: m.scaleFromPoints(ends[0], ends[1], total) }));
        toast("Scale set.");
      },
    },
      h("label", {}, "feet", feet),
      h("label", {}, "inches", inches),
      problem,
      h("div", { class: "buttons" },
        h("button", { type: "submit", class: "main" }, "Set the scale"),
        button("Cancel", () => { close(); app.endMode(); })));
  });

  plan.handles = null;
  plan.onTap = ({ x, y }) => {
    if (ends.length === 2) ends.length = 0; // the sheet was closed with Esc: start the two points again
    if (ends.length === 1 && Math.hypot(x - ends[0][0], y - ends[0][1]) < 1) {
      toast("Pick two different points.");
      return;
    }
    ends.push([x, y]);
    refresh();
    if (ends.length === 2) askDistance();
  };
  refresh();
}
