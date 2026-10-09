// The Map tab: look things up. Search and filter, tap a device for its details, or read the list by room.
import * as m from "../model.js";
import { displayName, isSwitch } from "../catalog.js";
import { markersNear } from "../placing.js";
import { plural, heightText } from "../flow.js";
import { searchDevices, listByRoom, circuitText, switchLines, switchedBy, titleText } from "../browse.js";
import { h, button, openSheet, ask, toast } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor, glyph } from "./markers.js";
import { openMarkerSheet } from "./markersheet.js";
import { showOnPanel } from "./panel.js";
import { csvFile } from "../csv.js";
import { saveFile } from "./savefile.js";

const REACH = 22; // screen pixels: half of a 44-point target
const FILTERS = [["", "All"], ["outlet", "Outlets"], ["switch", "Switches"], ["light", "Lights"], ["other", "Other"]];

// What the tab remembers: the search, the group filter, list or plan, the device whose details show, where a jump
// came from (for the Back button), and a second device to ring (see showOnPlan).
const state = (app) => (app.ui.map ||= { query: "", group: "", list: false, selected: "", also: "", back: null });

function select(app, id) {
  const st = state(app);
  if (st.selected === id) return;
  st.selected = id;
  app.render();
}

export function browseView(app) {
  const st = state(app), p = app.project, floor = app.floor();
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!m.find(p, "devices", st.selected)) st.selected = "";

  const status = h("p", { class: "plan-hint", role: "status" });
  const body = h("div", { class: "map-body" });

  // The plan, drawing only what the search found.
  const planEl = (devices, searching) => {
    if (!floor.imageId) {
      return h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."), button("Choose a picture", () => toFloors(floor.id), "main"));
    }
    const here = devices.filter((d) => d.floorId === floor.id);
    app.showPicture(floor);
    drawFloor(app, floor, { only: searching ? new Set(here.map((d) => d.id)) : null, picked: st.selected, also: st.selected ? st.also : "" });
    app.plan.onTap = ({ x, y }) => {
      const near = markersNear(here, x, y, REACH / app.plan.view.k);
      if (near.length < 2) return select(app, near.length ? near[0].id : "");
      openSheet("Which one?", (close) => [
        h("div", { class: "rows" }, near.map((d) => button(`${d.label}, ${displayName(d)}`, () => { close(); select(app, d.id); }))),
        button("Cancel", close),
      ]);
    };
    return app.plan.el;
  };

  // Everything under the search rows. Typing in the search box calls this by itself, so the keyboard stays up.
  const fill = () => {
    const query = st.query.trim(), searching = !!(query || st.group);
    const devices = searchDevices(p, query, st.group);
    const onFloor = (f) => devices.filter((d) => d.floorId === f.id).length;
    status.replaceChildren(...(
      !p.devices.length ? ["Nothing placed yet. Add outlets, switches and lights on the Add tab. ", button("Go to Add", () => app.go("add"))]
      : searching && !devices.length ? [`Nothing matches ${query ? `"${query}"` : "that"}. Check the spelling or clear the search.`]
      : searching && st.list ? [`${plural(devices.length, "device")} found.`]
      : searching ? [`${plural(devices.length, "device")} found, ${onFloor(floor)} on this floor. `,
        ...m.sortedFloors(p).filter((f) => f.id !== floor.id && onFloor(f)).map((f) => button(`${f.name} (${onFloor(f)})`, () => app.setFloor(f.id)))]
      : []));
    const selected = m.find(p, "devices", st.selected);
    const details = selected ? detailsEl(app, selected) : null;
    body.replaceChildren(st.list ? listEl(app, devices) : planEl(devices, searching), ...(details ? [details] : []));
    // On a phone the details sit under the plan; bring them into view once the screen has been drawn.
    if (details) queueMicrotask(() => details.scrollIntoView({ block: "nearest" }));
  };

  const search = h("input", {
    type: "search", value: st.query, placeholder: "Search label, room, type or note", "aria-label": "Search",
    autocomplete: "off", autocorrect: "off", enterKeyHint: "search",
    oninput: () => {
      st.query = search.value;
      fill();
    },
  });
  const pick = (current, value, text, run) => h("button", { type: "button", "aria-pressed": String(current === value), onclick: run }, text);
  const back = st.back;
  fill();
  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    back && h("div", { class: "pick-row" }, button(back.text, () => {
      Object.assign(st, { list: back.list, query: back.query, group: back.group, selected: "", back: null });
      app.setFloor(back.floorId);
    })),
    h("div", { class: "pick-row" },
      search,
      pick(st.list, false, "Plan", () => { st.list = false; app.render(); }),
      pick(st.list, true, "List", () => { st.list = true; app.render(); }),
      button("Key", keySheet),
      button("Download spreadsheet", () => spreadsheetSheet(app))),
    h("div", { class: "pick-row", role: "group", "aria-label": "Show" },
      FILTERS.map(([group, text]) => pick(st.group, group, text, () => { st.group = group; app.render(); }))),
    status,
    body);
}

// Every device found, grouped by floor and room. Tapping one shows its details.
function listEl(app, devices) {
  const st = state(app), floors = app.project.floors.length;
  return h("div", { class: "list" }, listByRoom(app.project, devices).map((g) => [
    h("h3", {}, floors > 1 ? `${g.floorName}: ${g.roomName}` : g.roomName),
    h("ul", { class: "rows" }, g.devices.map((d) => h("li", {},
      h("button", { type: "button", class: "row", "aria-pressed": String(d.id === st.selected), onclick: () => select(app, d.id) },
        h("strong", {}, titleText(d)),
        h("span", { class: "small" }, displayName(d) + (d.notWorking ? ", not working" : "")))))),
  ]));
}

// One device: where it is, its breaker, height, note, what it controls and what switches it.
function detailsEl(app, d) {
  const p = app.project, st = state(app);
  const room = m.find(p, "rooms", d.roomId), floor = m.find(p, "floors", d.floorId), gfci = m.find(p, "devices", d.gfciId);
  const line = (label, ...value) => h("p", {}, h("strong", {}, label + ": "), value);
  const show = (id, label) => button(`Show ${label}`, () => showOnPlan(app, id));
  const switches = isSwitch(d.type) ? [] : switchedBy(p, d);
  return h("aside", { class: "details", "aria-label": "Details" },
    h("h2", {}, titleText(d)),
    h("p", {}, `${displayName(d)}, ${room ? room.name : "no room"}, ${floor.name}`),
    d.notWorking && h("p", { class: "error" }, "Not working"),
    line("Breaker", circuitText(p, d), d.breakerId && [" ", button("Show on panel", () => showOnPanel(app, d.breakerId))]),
    line("Height", heightText(d.heightIn)),
    d.note && line("Note", d.note),
    gfci && line("Behind GFCI outlet", gfci.label, " ", show(gfci.id, gfci.label)),
    d.type === "G" && line("Protects", plural(m.protectedBy(p, d.id).length, "device")),
    isSwitch(d.type) && switchLines(p, d).map((s) => h("p", {}, s.text, s.loads.map((l) => [" ", show(l.id, l.label)]))),
    switches.length > 0 && [
      h("p", {}, h("strong", {}, "Switched by")),
      h("ul", {}, switches.map((s) => h("li", {}, s.text, " ", show(s.id, s.label)))),
    ],
    h("div", { class: "buttons" },
      button("Edit", () => openMarkerSheet(app, d.id), "main"),
      (st.list || d.floorId !== app.floor().id) && button("Show on plan", () => showOnPlan(app, d.id)),
      button("Close", () => select(app, ""))));
}

// Jump to a device on the plan. If that changes floor or leaves the list, a Back button says where he came from.
export function showOnPlan(app, id, also = "") {
  const st = state(app), d = m.find(app.project, "devices", id), from = app.floor();
  if (!d) return;
  if (st.list || d.floorId !== from.id) {
    st.back = { list: st.list, query: st.query, group: st.group, floorId: from.id, text: st.list ? "Back to the list" : `Back to ${from.name}` };
  }
  // The search is cleared so the marker is sure to be drawn.
  Object.assign(st, { list: false, query: "", group: "", selected: id, also });
  Object.assign(app, { tab: "map", floorId: d.floorId });
  app.render();
  if (!app.plan.shows(d.x, d.y)) app.plan.fit();
}

// Every marker shape and mark, with its meaning in words.
function keySheet() {
  const item = (mark, text) => h("li", { class: "key-row" }, mark, h("span", {}, text));
  const mark = (text) => h("strong", { class: "key-mark" }, text);
  openSheet("Key", (close) => [
    h("ul", { class: "rows" },
      item(glyph("D"), "Circle: an outlet"),
      item(glyph("S"), "Square: a switch plate. The number inside is how many switches are on it."),
      item(glyph("L"), "Diamond: a light or ceiling fan"),
      item(glyph("SM"), "Triangle: anything else (an alarm, fan, appliance, panel, or something you named)"),
      item(mark("!"), "Not working right now"),
      item(mark("✎"), "Its label changed: the plate needs rewriting"),
      item(mark("◯"), "A ring: the one you picked, or just placed")),
    button("Done", close, "main"),
  ]);
}

// The Delete key on the Map tab removes the picked device. Undone, not confirmed.
export function deleteSelected(app) {
  const st = state(app), d = m.find(app.project, "devices", st.selected);
  if (!d) return;
  st.selected = "";
  app.commit(`deleted ${d.label}`, (p) => m.remove(p, "devices", d.id));
  toast(`Deleted ${d.label}.`, { text: "Undo", run: () => app.undo() });
}

// Everything as a spreadsheet: one row for each device, or one for each breaker.
function spreadsheetSheet(app) {
  const p = app.project, breakers = p.breakers.filter((b) => b.kind !== "empty").length;
  const get = (which) => {
    const file = csvFile(p, which);
    saveFile(file.name, file.text, "text/csv");
  };
  openSheet("Download spreadsheet", (close) => [
    h("p", { class: "small" }, "A file that opens in Excel or Numbers."),
    h("div", { class: "rows" },
      button(`Devices (${p.devices.length}): every outlet, switch and light, with its breaker`, () => { close(); get("devices"); }),
      button(`Breakers (${breakers}): what is on each one, and how sure`, () => { close(); get("breakers"); })),
    button("Cancel", close),
  ]);
}
