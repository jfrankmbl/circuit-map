// The Switches tab: what each switch controls. Tap a switch, then tap each light or outlet it controls; tap again to
// undo. Or tap a light or outlet first to see what switches it. Many switches can control one load (3-ways and
// 4-ways are just that), and one switch can control loads on other floors.
import * as m from "../model.js";
import { isSwitch, hasHalves } from "../catalog.js";
import { markersNear } from "../placing.js";
import { switchLines } from "../browse.js";
import { canBeSwitched, switchName, switchProgress, progressText, linkBanner, controlRows, switchedRows, halfState } from "../linking.js";
import { h, svg, button, openSheet, toast } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor } from "./markers.js";

const REACH = 22; // screen pixels: half of a 44-point target

// The marker nearest a tap on the floor showing, if one is within reach.
function nearest(app, { x, y }) {
  const floor = app.floor();
  return markersNear(app.project.devices.filter((d) => d.floorId === floor.id), x, y, REACH / app.plan.view.k)[0] || null;
}

export function linkView(app) {
  const p = app.project, floor = app.floor();
  if (!floor) {
    return h("section", { class: "page" }, h("p", {}, "No floors yet. Add one."), button("Go to Floors", () => app.go("floors"), "main"));
  }
  const progress = switchProgress(p);
  if (!progress.total) {
    return h("section", { class: "page" }, h("p", {}, "No switches placed yet. Add them on the Add tab."), button("Go to Add", () => app.go("add"), "main"));
  }
  const linking = app.mode && app.mode.link;
  let main;
  if (floor.imageId) {
    app.showPicture(floor);
    drawFloor(app, floor);
    if (linking) {
      // The floor may have changed since the banner was written; it lists what is on the other floors.
      const sw = m.find(p, "devices", linking.switchId);
      if (sw) app.mode.text = linkBanner(p, sw, linking.toggle, floor.id);
      drawLines(app, floor, linking);
    } else if (!app.mode) {
      app.plan.onTap = (tap) => tapIdle(app, tap);
    }
    main = app.plan.el;
  } else {
    main = h("div", { class: "page" }, h("p", {}, "This floor has no picture yet."));
  }
  return h("section", { class: "plan-screen" },
    floorSwitch(app),
    h("div", { class: "pick-row" },
      h("strong", {}, progressText(progress)),
      progress.todo.length > 0 && button(`Still to do (${progress.todo.length})`, () => todoSheet(app, progress.todo))),
    !app.mode && h("p", { class: "plan-hint" }, "Tap a switch, then tap what it controls. Or tap a light or outlet to see what switches it."),
    main);
}

// A thin line from the picked switch to each thing it controls on this floor.
function drawLines(app, floor, { switchId, toggle }) {
  const p = app.project, sw = m.find(p, "devices", switchId);
  const loads = sw && sw.floorId === floor.id
    ? m.controls(p, switchId, toggle).map((l) => m.find(p, "devices", l.loadId)).filter((d) => d && d.floorId === floor.id)
    : [];
  app.plan.layers.overlay.replaceChildren(...loads.map((d) => svg("line", { class: "link-line", x1: sw.x, y1: sw.y, x2: d.x, y2: d.y })));
}

// Nothing is picked: a switch starts linking it; a light or outlet shows what switches it.
function tapIdle(app, tap) {
  const d = nearest(app, tap);
  if (!d) return;
  if (isSwitch(d.type)) pickSwitch(app, d, (toggle) => startLinking(app, d.id, toggle));
  else if (canBeSwitched(d.type)) switchedBySheet(app, d.id);
  else toast("That can't be switched.");
}

// A plate with several switches asks which one, showing what each controls now.
function pickSwitch(app, plate, onToggle) {
  if (plate.toggles < 2) return onToggle(1);
  openSheet(`${plate.label}: which switch?`, (close) => [
    h("p", { class: "small" }, "Switch 1 is the leftmost as you face the plate (the top one on an upright plate)."),
    h("div", { class: "rows" }, switchLines(app.project, plate).map((s) => button(s.text, () => {
      close();
      onToggle(s.toggle);
    }))),
    button("Cancel", close),
  ]);
}

// "Switch 2 on KIT-01: tap each light or outlet it controls." Linked ones wear a ring and a tick.
function startLinking(app, switchId, toggle) {
  const show = () => {
    const p = app.project, sw = m.find(p, "devices", switchId);
    if (!sw) return app.endMode();
    const linked = m.controls(p, switchId, toggle);
    app.setMode({
      link: { switchId, toggle },
      picked: switchId,
      ringed: new Set(linked.map((l) => l.loadId)),
      dim: new Set(p.devices.filter((d) => !isSwitch(d.type) && !canBeSwitched(d.type)).map((d) => d.id)),
      text: linkBanner(p, sw, toggle, app.floor().id),
      buttons: [
        linked.length > 0 && { text: `What it controls (${linked.length})`, run: () => controlsSheet(app, switchId, toggle, show) },
        { text: "Done", cls: "main", run: () => app.endMode() },
      ].filter(Boolean),
    });
  };
  app.plan.handles = null;
  app.plan.onTap = (tap) => {
    const d = nearest(app, tap), sw = m.find(app.project, "devices", switchId);
    if (!d || !sw) return;
    // Tapping another switch changes which one is picked.
    if (isSwitch(d.type)) return pickSwitch(app, d, (t) => startLinking(app, d.id, t));
    if (!canBeSwitched(d.type)) return toast("That can't be switched.");
    const link = (part) => {
      const on = m.controls(app.project, switchId, toggle).some((l) => l.loadId === d.id && l.loadPart === part);
      app.commit(on ? `took ${d.label} off ${switchName(sw, toggle)}` : `put ${d.label} on ${switchName(sw, toggle)}`,
        (p) => m.toggleLink(p, { switchId, toggle, loadId: d.id, loadPart: part }));
      show();
    };
    if (hasHalves(d.type)) halvesSheet(app, switchId, toggle, d, link);
    else link("");
  };
  show();
}

// An ordinary outlet can be switched whole or by halves. Whole first and largest: it is the usual answer.
function halvesSheet(app, switchId, toggle, outlet, onPart) {
  const now = halfState(app.project, switchId, toggle, outlet.id);
  openSheet(`${outlet.label}: which part does it switch?`, (close) => {
    const choose = (run) => () => { close(); run(); };
    return [
      h("div", { class: "buttons equal" },
        h("button", { type: "button", class: "main", "aria-pressed": String(now.whole), onclick: choose(() => onPart("")) }, "Whole outlet")),
      h("div", { class: "buttons" },
        h("button", { type: "button", "aria-pressed": String(now.top), onclick: choose(() => onPart("top")) }, "Top half"),
        h("button", { type: "button", "aria-pressed": String(now.bottom), onclick: choose(() => onPart("bottom")) }, "Bottom half")),
      h("p", { class: "small" }, "A tick means it is switched now; tap it again to undo."),
      button("Cancel", close),
    ];
  });
}

// "What it controls": every load, on any floor, each with Remove. after() redraws the banner.
function controlsSheet(app, switchId, toggle, after) {
  const sw = m.find(app.project, "devices", switchId), rows = controlRows(app.project, switchId, toggle);
  openSheet(`What ${switchName(sw, toggle)} controls`, (close) => [
    rows.length
      ? h("ul", { class: "rows scroll" }, rows.map((r) => h("li", {}, h("span", {}, r.text), button("Remove", () => {
        close();
        app.commit(`took ${r.text.split(",")[0]} off ${switchName(sw, toggle)}`, (p) => m.remove(p, "links", r.link.id));
        after();
        if (rows.length > 1) controlsSheet(app, switchId, toggle, after);
      }))))
      : h("p", {}, "Nothing recorded yet."),
    button("Done", close, "main"),
  ]);
}

// From the load: what switches it, with Remove, and Add a switch.
function switchedBySheet(app, loadId) {
  const d = m.find(app.project, "devices", loadId), rows = switchedRows(app.project, loadId);
  openSheet(`${d.label} is switched by`, (close) => [
    rows.length
      ? h("ul", { class: "rows scroll" }, rows.map((r) => h("li", {}, h("span", {}, r.text), button("Remove", () => {
        close();
        app.commit(`took ${d.label} off ${r.text.split(",")[0]}`, (p) => m.remove(p, "links", r.link.id));
        switchedBySheet(app, loadId);
      }))))
      : h("p", {}, "No switch recorded yet."),
    h("div", { class: "buttons" },
      button("Add a switch", () => { close(); startPickingSwitch(app, loadId); }, "main"),
      button("Done", close)),
  ]);
}

// "Tap the switch that controls KIT-03." It can be on another floor: the floor buttons still work.
function startPickingSwitch(app, loadId) {
  const d = m.find(app.project, "devices", loadId);
  app.plan.handles = null;
  app.plan.onTap = (tap) => {
    const sw = nearest(app, tap);
    if (!sw) return;
    if (!isSwitch(sw.type)) return toast("Tap a switch.");
    pickSwitch(app, sw, (toggle) => {
      const link = (part) => {
        const already = m.controls(app.project, sw.id, toggle).some((l) => l.loadId === loadId && l.loadPart === part);
        if (!already) app.commit(`put ${d.label} on ${switchName(sw, toggle)}`, (p) => m.toggleLink(p, { switchId: sw.id, toggle, loadId, loadPart: part }));
        app.endMode();
        switchedBySheet(app, loadId);
      };
      if (hasHalves(d.type)) halvesSheet(app, sw.id, toggle, d, link);
      else link("");
    });
  };
  app.setMode({
    picked: loadId,
    text: `Tap the switch that controls ${d.label}. It can be on another floor.`,
    buttons: [{ text: "Cancel", run: () => app.endMode() }],
  });
}

// "Still to do": the switches that control nothing yet. Tapping one goes to its floor and starts linking it.
function todoSheet(app, todo) {
  openSheet("Still to do", (close) => [
    h("div", { class: "rows scroll" }, todo.map((t) => button(t.text, () => {
      close();
      app.floorId = m.find(app.project, "devices", t.deviceId).floorId;
      startLinking(app, t.deviceId, t.toggle);
    }))),
    button("Cancel", close),
  ]);
}
