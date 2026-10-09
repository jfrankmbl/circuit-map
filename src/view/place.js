// The Add tab: choose what you are adding, then tap the plan. The same thing stays chosen, so a room of outlets is
// one tap each. With nothing chosen, tapping a marker opens its sheet.
import * as m from "../model.js";
import { nextLabel } from "../ids.js";
import { displayName, isSwitch } from "../catalog.js";
import { recentChoices, isRepeatTap, markersNear, roomChoices } from "../placing.js";
import { placedText, addingText } from "../flow.js";
import { h, button, openSheet } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor, glyph } from "./markers.js";
import { openPalette } from "./palette.js";
import { roomFields } from "./roomfields.js";
import { openMarkerSheet } from "./markersheet.js";
import { askWhichPanel } from "./panel.js";

const REACH = 22; // screen pixels: half of a 44-point target
let pulseTimer = 0;

// What the tab remembers: the thing being added, the switch count last used, the room taps are going into, the
// "Placed ..." line, and the last tap (to ignore a double tap).
const state = (app) => (app.ui.place ||= { choice: null, toggles: 1, roomId: "", lastRoomId: "", result: "", last: null });

export function placeView(app) {
  const floor = app.floor(), st = state(app);
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!floor.imageId) {
    return h("section", { class: "plan-screen" }, floorSwitch(app),
      h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."), button("Choose a picture", () => toFloors(floor.id), "main")));
  }
  app.showPicture(floor);
  drawFloor(app, floor);
  if (!app.mode) app.plan.onTap = (tap) => tapMarker(app, tap);

  const recent = recentChoices(app.project);
  const same = (c) => !!st.choice && c.type === st.choice.type && c.customName === st.choice.customName;
  // One extra row above the plan, never two: the switch count while a switch is chosen, the recent things otherwise.
  const row = st.choice && isSwitch(st.choice.type)
    ? h("div", { class: "pick-row", role: "group", "aria-label": "Switches on this plate" },
      h("span", {}, "Switches on this plate"),
      [1, 2, 3, 4].map((n) => h("button", { type: "button", "aria-pressed": String(st.toggles === n), onclick: () => { st.toggles = n; app.render(); } }, String(n))))
    : recent.length > 0 && h("div", { class: "pick-row" },
      recent.map((c) => h("button", { type: "button", class: "recent", "aria-pressed": String(same(c)), onclick: () => choose(app, c) }, glyph(c.type), displayName(c))));

  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    h("div", { class: "pick-row" }, button("What are you adding?", () => openPalette(app, "What are you adding?", (c) => choose(app, c)), "main")),
    row,
    !app.mode && h("p", { class: "plan-hint" }, app.project.devices.length
      ? "Pick what you are adding, or tap a marker to change it."
      : "Pick what you are adding, then tap the plan where it is."),
    app.plan.el);
}

// Start (or switch to) adding this kind of thing.
function choose(app, choice) {
  const st = state(app);
  st.choice = choice;
  st.result = "";
  app.plan.handles = null;
  app.plan.onTap = (tap) => placeAt(app, tap);
  showAdding(app);
}

// The banner: "Adding: Duplex outlet in Garage", the last label placed in large type, a way to change room, Done.
function showAdding(app) {
  const st = state(app), floor = app.floor();
  const kept = m.find(app.project, "rooms", st.roomId);
  const room = kept && floor && kept.floorId === floor.id ? kept : null;
  app.setMode({
    // The room answered for this run ends with it; it is still the first one offered next time.
    cancel: () => { Object.assign(st, { choice: null, result: "", lastRoomId: st.roomId || st.lastRoomId, roomId: "" }); },
    text: addingText(displayName(st.choice), room),
    result: st.result,
    buttons: [
      room && { text: "Change room", run: () => askRoom(app, floor, (r) => { st.roomId = r.id; st.result = ""; showAdding(app); }) },
      { text: "Done", cls: "main", run: () => app.cancelMode() },
    ].filter(Boolean),
  });
}

// While adding, a tap always places, even next to an existing marker.
function placeAt(app, tap) {
  const st = state(app), floor = app.floor(), p = app.project;
  if (!floor || !floor.imageId) return;
  const now = { at: Date.now(), sx: tap.x * app.plan.view.k, sy: tap.y * app.plan.view.k };
  if (isRepeatTap(st.last, now)) return;
  st.last = now;
  const x = Math.round(tap.x), y = Math.round(tap.y);
  // The room is the outline tapped (the inner one of two nested). Outside every outline, or where outlines partly
  // overlap, it is the room already answered for this run, or else he is asked.
  const kept = m.find(p, "rooms", st.roomId);
  const room = m.roomAt(p, floor.id, x, y).room || (kept && kept.floorId === floor.id ? kept : null);
  if (room) place(app, floor, room, x, y);
  else askRoom(app, floor, (r) => place(app, floor, r, x, y));
}

function place(app, floor, room, x, y) {
  const st = state(app), { type, customName } = st.choice;
  st.roomId = room.id;
  const device = app.commit(`placed ${nextLabel(app.project, room.code)}`, (p) =>
    m.placeDevice(p, { floorId: floor.id, roomId: room.id, type, x, y, customName, toggles: st.toggles }));
  st.result = placedText(app.project, device);
  // The new marker wears a ring and its label for two seconds.
  app.ui.pulse = device.id;
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => {
    app.ui.pulse = "";
    app.render();
  }, 2000);
  showAdding(app);
  if (type === "BP" || type === "SP") askWhichPanel(app, device.id);
}

// "Which room is it in?": this floor's rooms, the last one used first, and New room (which has no outline).
function askRoom(app, floor, onRoom) {
  openSheet("Which room is it in?", (close) => {
    const rooms = roomChoices(app.project, floor.id, state(app).roomId || state(app).lastRoomId);
    const fresh = roomFields(app);
    return [
      rooms.length > 0 && h("div", { class: "rows scroll" }, rooms.map((r) => button(r.name, () => { close(); onRoom(r); }))),
      h("form", {
        onsubmit: (e) => {
          e.preventDefault();
          const made = fresh.read();
          if (!made) return;
          close();
          onRoom(app.commit(`added ${made.name}`, (p) => m.addRoom(p, { floorId: floor.id, name: made.name, code: made.code })));
        },
      },
        h("h3", {}, "New room"),
        fresh.fields,
        h("div", { class: "buttons" }, h("button", { type: "submit", class: rooms.length ? "" : "main" }, "Add this room"), button("Cancel", close))),
    ];
  });
}

// Nothing is being added: a tap on a marker opens its sheet. If the tap reaches more than one, he chooses.
function tapMarker(app, { x, y }) {
  const floor = app.floor();
  const near = markersNear(app.project.devices.filter((d) => d.floorId === floor.id), x, y, REACH / app.plan.view.k);
  if (near.length === 1) {
    openMarkerSheet(app, near[0].id);
  } else if (near.length > 1) {
    openSheet("Which one?", (close) => [
      h("div", { class: "rows" }, near.map((d) => button(`${d.label}, ${displayName(d)}`, () => { close(); openMarkerSheet(app, d.id); }))),
      button("Cancel", close),
    ]);
  }
}
