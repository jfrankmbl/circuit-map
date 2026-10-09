// Devices on the plan. A marker is drawn small and keeps its size at any zoom; its shape says what kind of thing it
// is (and so does its colour, but never only its colour).
import * as m from "../model.js";
import { displayName, typeInfo, isSwitch } from "../catalog.js";
import { shapeOf } from "../placing.js";
import { svg } from "../ui.js";
import { fixedAt } from "./plan.js";
import { drawRooms } from "./roomlayer.js";

const SHAPE = {
  circle: (cls) => svg("circle", { class: cls, r: 9 }),
  square: (cls) => svg("rect", { class: cls, x: -9, y: -9, width: 18, height: 18, rx: 2 }),
  diamond: (cls) => svg("path", { class: cls, d: "M0 -11 L11 0 L0 11 L-11 0 Z" }),
  triangle: (cls) => svg("path", { class: cls, d: "M0 -11 L11 8 L-11 8 Z" }),
};

// The shape twice: a wide white line under a thin dark one, so it shows on any picture, light or dark.
function shape(type) {
  const draw = SHAPE[shapeOf(type)];
  return svg("g", { class: "marker-shape " + typeInfo(type).group }, draw("halo"), draw("body"));
}

// The shape by itself, for a button.
export function glyph(type) {
  return svg("svg", { class: "glyph", viewBox: "-14 -14 28 28", width: 28, height: 28, "aria-hidden": "true" }, shape(type));
}

// Draw the devices of `floor` (none if it is null).
// pulse: the id of a device just placed (it wears a ring and its label for two seconds).
// moving: { id, x, y } for the device being moved, drawn there and draggable.
// ringed: a Set of ids to ring and tick.
// only: a Set of ids; devices not in it are left out (a search or filter).
// picked: the id of the device whose details are showing (it wears a ring and its label).
// also: a second device ringed and labelled the same way (the other one that uses a label).
// dim: a Set of ids drawn faint with a dashed outline (things that cannot be used in the current mode).
export function drawMarkers(app, floor, { pulse = "", moving = null, ringed = null, only = null, picked = "", also = "", dim = null } = {}) {
  const devices = floor ? app.project.devices.filter((d) => d.floorId === floor.id && (!only || only.has(d.id))) : [];
  app.plan.layers.markers.replaceChildren(...devices.map((d) => {
    const room = m.find(app.project, "rooms", d.roomId);
    const held = moving && moving.id === d.id;
    const ring = d.id === pulse || d.id === picked || d.id === also || (ringed && ringed.has(d.id));
    const at = held ? moving : d;
    return fixedAt(at.x, at.y, {
      class: "marker" + (d.id === pulse ? " pulse" : "") + (held ? " moving" : "") + (dim && dim.has(d.id) ? " dim" : ""),
      "data-handle": held ? d.id : null,
    },
      svg("title", {}, `${d.label}, ${displayName(d)}${room ? ", " + room.name : ""}`),
      held && svg("circle", { class: "reach", r: 22 }),
      ring && svg("circle", { class: "ring", r: 17 }),
      shape(d.type),
      isSwitch(d.type) && svg("text", { class: "marker-text" }, String(d.toggles)),
      d.notWorking && svg("text", { class: "marker-badge", x: 9, y: -7 }, "!"),
      d.plateLabel && svg("text", { class: "marker-badge", x: -22, y: -7 }, "✎"),
      ringed && ringed.has(d.id) && svg("text", { class: "marker-badge", x: 9, y: 18 }, "✓"),
      (d.id === pulse || d.id === picked || d.id === also) && svg("text", { class: "marker-label", y: 32 }, d.label));
  }));
}

// Everything on a floor: its room outlines and its devices. The mode in progress and the views say what to
// leave out, ring, pulse or drag.
// extra: { only, picked } from the view (see drawMarkers).
export function drawFloor(app, floor, extra = {}) {
  const mode = app.mode || {};
  const shown = mode.noRooms ? null : floor;
  drawRooms(app, shown, mode.hideRoom);
  drawMarkers(app, shown, {
    pulse: app.ui.pulse || "", moving: mode.moving || null, ringed: mode.ringed || null,
    picked: mode.picked || "", dim: mode.dim || null, ...extra,
  });
}
