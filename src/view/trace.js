// Two modes on the plan: tracing a room corner by corner, and editing an outline by dragging its corners.
import * as m from "../model.js";
import { midpoints, insertCorner, removeCorner, moveCorner } from "../outline.js";
import { svg, toast } from "../ui.js";
import { dot } from "./plan.js";
import { addRoomSheet, reviewOutline } from "./rooms.js";

const FIRST_CORNER_REACH = 22; // screen pixels: a tap this close to the first corner finishes the room
const points = (outline) => outline.map((p) => p.join(",")).join(" ");

// Tap each corner of `room` on the plan. Pan and zoom still work, so a closet can be zoomed into first.
export function startTracing(app, floor, room) {
  const plan = app.plan, corners = [];

  const draw = () => plan.layers.overlay.replaceChildren(
    svg("polyline", { class: "trace-line", points: points(corners) }),
    ...corners.map(([x, y], i) => dot(x, y, i === 0 ? "corner first" : "corner")));

  const cancel = () => toast(`${room.name} has no outline yet. Trace it later from its page.`);

  const finish = () => {
    try {
      app.commit(`traced ${room.name}`, (p) => m.setOutline(p, room.id, corners.map((c) => [...c])));
    } catch (err) {
      toast(err.message); // "The lines cross. Undo the last corner or drag a corner."
      return;
    }
    app.endMode();
    app.setMode({
      floorId: floor.id, text: `${room.name} added.`,
      buttons: [
        { text: "Add another room", cls: "main", run: () => { app.endMode(); addRoomSheet(app, floor); } },
        { text: "Done", run: () => app.endMode() },
      ],
    });
  };

  const refresh = () => {
    app.setMode({
      floorId: floor.id, hideRoom: room.id, cancel,
      text: corners.length < 3 ? `Tracing ${room.name}: tap each corner`
        : `Tracing ${room.name}: tap each corner. Tap the first corner again to finish.`,
      buttons: [
        corners.length > 0 && { text: "Undo corner", run: () => { corners.pop(); refresh(); } },
        corners.length >= 3 && { text: "Finish room", cls: "main", run: finish },
        { text: "Cancel", run: () => app.cancelMode() },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = null;
  plan.onTap = ({ x, y }) => {
    if (corners.length >= 3 && Math.hypot(x - corners[0][0], y - corners[0][1]) * plan.view.k < FIRST_CORNER_REACH) {
      finish();
      return;
    }
    corners.push([Math.round(x), Math.round(y)]);
    refresh();
  };
  app.ui.roomPage = "";
  refresh();
}

// Drag a corner to move it; tap a "+" to add a corner on that side; tap a corner to pick it, then Remove corner.
// A plain tap never removes anything, since a tap often means a drag was aimed badly.
export function startEditing(app, floor, room) {
  const plan = app.plan;
  let outline = room.outline.map((p) => [...p]), picked = -1;

  const draw = () => plan.layers.overlay.replaceChildren(
    svg("polygon", { class: "room editing", points: points(outline) }),
    ...midpoints(outline).map(([x, y], i) => dot(x, y, "add-corner", "+" + i, "+")),
    ...outline.map(([x, y], i) => dot(x, y, i === picked ? "corner picked" : "corner", String(i))));

  const done = () => {
    const changed = JSON.stringify(outline) !== JSON.stringify(room.outline);
    if (changed) {
      try {
        app.commit(`changed the ${room.name} outline`, (p) => m.setOutline(p, room.id, outline));
      } catch (err) {
        toast(err.message);
        return;
      }
    }
    app.endMode();
    if (changed) reviewOutline(app, room);
  };

  const startOver = () => {
    app.endMode();
    app.commit(`cleared the ${room.name} outline`, (p) => m.update(p, "rooms", room.id, { outline: [] }));
    startTracing(app, floor, room);
    toast("Outline cleared.", { text: "Undo", run: () => app.undo() });
  };

  const refresh = () => {
    app.setMode({
      floorId: floor.id, hideRoom: room.id,
      text: `Editing the ${room.name} outline: drag a corner to move it`,
      buttons: [
        picked >= 0 && outline.length > 3 && { text: "Remove corner", run: () => { outline = removeCorner(outline, picked); picked = -1; refresh(); } },
        { text: "Done", cls: "main", run: done },
        { text: "Start over", run: startOver },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = {
    move: (id, { x, y }) => {
      if (id[0] === "+") return;
      outline = moveCorner(outline, Number(id), [Math.round(x), Math.round(y)]);
      draw();
    },
    drop: () => {},
    tap: (id) => {
      if (id[0] === "+") {
        const side = Number(id.slice(1));
        outline = insertCorner(outline, side, midpoints(outline)[side].map(Math.round));
        picked = side + 1;
      } else {
        picked = picked === Number(id) ? -1 : Number(id);
      }
      refresh();
    },
  };
  plan.onTap = () => {
    if (picked < 0) return;
    picked = -1;
    refresh();
  };
  app.ui.roomPage = "";
  refresh();
}
