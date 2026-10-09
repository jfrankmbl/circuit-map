// A marker's sheet: what it is and everything that can be changed about it. Every change saves at once (there is no
// Save, only Done) and the sheet is drawn again from the saved device. Also the modes it starts on the Add tab:
// Move, Move to another floor, and saying what a GFCI outlet protects.
import * as m from "../model.js";
import { nextLabel } from "../ids.js";
import { displayName, typeInfo, isSwitch } from "../catalog.js";
import { markersNear, roomChoices } from "../placing.js";
import { plural, typeChangeWarning, togglesWarning, heightText } from "../flow.js";
import { h, button, details, openSheet, ask, toast } from "../ui.js";
import { drawFloor } from "./markers.js";
import { openPalette } from "./palette.js";
import { circuitText } from "../browse.js";
import { startPickingBreaker } from "./panel.js";

const REACH = 22; // screen pixels: half of a 44-point target

// opts: { more: open the More part, focusNote: put the cursor in Note }
export function openMarkerSheet(app, id, opts = {}) {
  const p = app.project, d = m.find(p, "devices", id);
  if (!d) return;
  const room = m.find(p, "rooms", d.roomId), floor = m.find(p, "floors", d.floorId);
  const floors = m.sortedFloors(p), group = typeInfo(d.type).group;

  openSheet(d.label, (close) => {
    // Save one change and draw the sheet again.
    const change = (name, fn, next = {}) => {
      close();
      app.commit(name, fn);
      openMarkerSheet(app, id, next);
    };
    const row = (label, value, run) => button([h("strong", {}, label), h("span", { class: "small" }, value)], run, "row");

    const note = h("input", {
      type: "text", value: d.note, autocomplete: "off", enterKeyHint: "done",
      placeholder: d.notWorking ? "What is wrong? (bulb out, tripped GFCI...)" : "",
      onchange: () => app.commit(`changed the note on ${d.label}`, (p) => m.update(p, "devices", id, { note: note.value.trim() })),
    });
    if (opts.focusNote) requestAnimationFrame(() => note.focus());

    const setSwitches = (count) => {
      const set = () => change(`set ${d.label} to ${count === 1 ? "1 switch" : count + " switches"}`, (p) => m.setToggles(p, id, count));
      const warning = count < d.toggles ? togglesWarning(p, d, count) : "";
      if (!warning) return set();
      close();
      ask("Take it off the plate?", warning, [
        { text: `Keep ${d.toggles} switches`, cls: "main", run: () => openMarkerSheet(app, id) },
        { text: "Take it off", run: set },
      ]);
    };

    const height = h("input", {
      type: "number", min: 0, step: "any", inputMode: "decimal", value: d.heightIn == null ? "" : d.heightIn,
      onchange: () => change(`changed the height of ${d.label}`,
        (p) => m.update(p, "devices", id, { heightIn: height.value === "" ? null : Math.max(0, Number(height.value)) }), { more: true }),
    });
    const setHeight = (heightIn) => change(`changed the height of ${d.label}`, (p) => m.update(p, "devices", id, { heightIn }), { more: true });
    const gfci = m.find(p, "devices", d.gfciId);

    return [
      h("p", {}, `${displayName(d)}, ${room ? room.name : "no room"}${floors.length > 1 ? ", " + floor.name : ""}`),
      d.notWorking && h("p", { class: "error" }, "Not working"),
      d.plateLabel && h("div", { class: "buttons" },
        h("span", {}, `The plate still says ${d.plateLabel}.`),
        button("I've rewritten it", () => change(`rewrote the plate of ${d.label}`, (p) => m.confirmPlate(p, id)))),
      // Correcting a position is the common job, so these come first.
      h("div", { class: "buttons" },
        button("Move", () => { close(); startMoving(app, id); }),
        floors.length > 1 && button("Move to another floor", () => { close(); startMovingFloor(app, id); })),
      row("Type", displayName(d), () => { close(); openPalette(app, "What is it?", (choice) => changeType(app, id, choice)); }),
      row("Room", room ? room.name : "No room", () => { close(); changeRoom(app, id); }),
      // Only for things a breaker feeds. A pick made here is a guess.
      typeInfo(d.type).sweep && row("Breaker", circuitText(p, d), () => { close(); startPickingBreaker(app, id); }),
      h("label", {}, "Note", note),
      isSwitch(d.type) && h("div", { class: "buttons", role: "group", "aria-label": "Switches on this plate" },
        h("strong", {}, "Switches on this plate"),
        [1, 2, 3, 4].map((n) => h("button", { type: "button", "aria-pressed": String(d.toggles === n), onclick: () => n !== d.toggles && setSwitches(n) }, String(n)))),
      details("More", { open: !!opts.more },
        h("label", {}, `Height above the floor, in inches (now: ${heightText(d.heightIn)})`, height),
        h("div", { class: "buttons" }, [12, 18, 48].map((n) => button(String(n), () => setHeight(n))), button("Ceiling", () => setHeight(null))),
        (group === "outlet" || group === "light") && row("Behind a GFCI outlet", gfci ? gfci.label : "None", () => { close(); chooseGfci(app, id); }),
        d.type === "G" && h("div", { class: "buttons" },
          h("span", {}, `Protects ${plural(m.protectedBy(p, id).length, "device")}`),
          button("Change", () => { close(); startProtecting(app, id); })),
        // The word is shown, not just a switch.
        button(`Not working right now: ${d.notWorking ? "On" : "Off"}`, () =>
          change(d.notWorking ? `marked ${d.label} as working` : `marked ${d.label} as not working`,
            (p) => m.setNotWorking(p, id, !d.notWorking), { more: true, focusNote: !d.notWorking }))),
      h("div", { class: "buttons" }, button("Done", close, "main")),
      // Apart from the rest, in plain text; undone, not confirmed.
      button("Delete", () => {
        close();
        app.commit(`deleted ${d.label}`, (p) => m.remove(p, "devices", id));
        toast(`Deleted ${d.label}.`, { text: "Undo", run: () => app.undo() });
      }, "plain danger"),
    ];
  }, "marker");
}

function changeType(app, id, choice) {
  const d = m.find(app.project, "devices", id);
  const set = () => {
    app.commit(`changed ${d.label} to ${displayName(choice)}`, (p) => m.changeType(p, id, choice.type, choice.customName));
    openMarkerSheet(app, id);
  };
  const warning = typeChangeWarning(app.project, d, choice.type);
  if (!warning) return set();
  ask("Change what it is?", warning, [
    { text: "Cancel", cls: "main", run: () => openMarkerSheet(app, id) },
    { text: `Change it to ${displayName(choice)}`, run: set },
  ]);
}

// Changing the room never changes the label by itself: a label may already be written on the plate.
function changeRoom(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  const set = (roomId, relabel, name) => () => {
    app.commit(name, (p) => m.setRoom(p, id, roomId, relabel));
    openMarkerSheet(app, id);
  };
  openSheet("Which room is it in?", (close) => [
    h("div", { class: "rows scroll" },
      roomChoices(p, d.floorId, d.roomId).map((r) => button(r.name + (r.id === d.roomId ? " (now)" : ""), () => {
        close();
        if (r.id === d.roomId) return openMarkerSheet(app, id);
        const keep = set(r.id, false, `moved ${d.label} to ${r.name}`);
        if (d.label.startsWith(r.code + "-")) return keep();
        const fresh = nextLabel(p, r.code);
        ask(`Move ${d.label} to ${r.name}?`, "", [
          { text: `Keep the label ${d.label}`, cls: "main", run: keep },
          { text: `Relabel it ${fresh}`, run: set(r.id, true, `moved ${d.label} to ${r.name} as ${fresh}`) },
          { text: "Cancel", run: () => openMarkerSheet(app, id) },
        ]);
      })),
      d.roomId && button("No room", () => { close(); set("", false, `took ${d.label} out of its room`)(); })),
    button("Cancel", () => { close(); openMarkerSheet(app, id); }),
  ]);
}

// Which GFCI outlet's Reset button also controls this device: None, then the GFCI outlets, the same room first.
function chooseGfci(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  const set = (gfciId, name) => () => {
    app.commit(name, (p) => m.setProtection(p, id, gfciId));
    openMarkerSheet(app, id, { more: true });
  };
  const gfcis = p.devices.filter((g) => g.type === "G" && g.id !== id)
    .sort((a, b) => (b.roomId === d.roomId) - (a.roomId === d.roomId) || a.label.localeCompare(b.label, "en", { numeric: true }));
  openSheet("Behind which GFCI outlet?", (close) => [
    h("div", { class: "rows scroll" },
      button("None", () => { close(); set("", `took ${d.label} off its GFCI outlet`)(); }),
      gfcis.map((g) => button(`${g.label}, ${(m.find(p, "rooms", g.roomId) || { name: "no room" }).name}`, () => {
        close();
        set(g.id, `put ${d.label} behind ${g.label}`)();
      }))),
    gfcis.length === 0 && h("p", { class: "small" }, "No GFCI outlets placed yet."),
    button("Cancel", () => { close(); openMarkerSheet(app, id, { more: true }); }),
  ]);
}

// Moving mode. A marker moves only here, so swiping to pan the plan never drags one. Drag it, or tap where it goes.
export function startMoving(app, id) {
  const d = m.find(app.project, "devices", id);
  if (!d) return;
  const at = { id, x: d.x, y: d.y };
  const moveTo = ({ x, y }) => {
    at.x = Math.round(x);
    at.y = Math.round(y);
    drawFloor(app, app.floor());
  };
  const done = () => {
    const moved = at.x !== d.x || at.y !== d.y;
    if (moved) app.commit(`moved ${d.label}`, (p) => m.update(p, "devices", id, { x: at.x, y: at.y }));
    app.endMode();
    const room = moved && m.roomAt(app.project, d.floorId, at.x, at.y).room;
    if (!room || room.id === d.roomId) return;
    // It ended in another room's outline. The room follows; the label only if he says so.
    const set = (relabel, name) => () => app.commit(name, (p) => m.setRoom(p, id, room.id, relabel));
    const keep = set(false, `moved ${d.label} to ${room.name}`);
    if (d.label.startsWith(room.code + "-")) return keep();
    const fresh = nextLabel(app.project, room.code);
    ask(`Now in ${room.name}`, `Keep the label ${d.label}, or relabel it ${fresh}?`, [
      { text: `Keep the label ${d.label}`, cls: "main", run: keep },
      { text: `Relabel it ${fresh}`, run: set(true, `moved ${d.label} to ${room.name} as ${fresh}`) },
    ]);
  };
  Object.assign(app, { tab: "add", floorId: d.floorId });
  app.plan.handles = { move: (_, point) => moveTo(point), drop: () => {}, tap: () => {} };
  app.plan.onTap = moveTo;
  app.setMode({
    moving: at,
    text: `Moving ${d.label}. Drag it, or tap where it goes, then Done.`,
    buttons: [{ text: "Done", cls: "main", run: done }, { text: "Cancel", run: () => app.endMode() }],
  });
}

// Choose the floor, then tap where it goes there. The label, links and breaker all stay; the room is taken from
// the outline tapped, as when placing.
function startMovingFloor(app, id) {
  const p = app.project, d = m.find(p, "devices", id);
  openSheet(`Move ${d.label} to which floor?`, (close) => [
    h("div", { class: "rows" }, m.sortedFloors(p).filter((f) => f.id !== d.floorId).map((f) => button(f.name, () => {
      close();
      Object.assign(app, { tab: "add", floorId: f.id });
      app.plan.handles = null;
      app.plan.onTap = ({ x, y }) => {
        const room = m.roomAt(app.project, f.id, x, y).room;
        app.commit(`moved ${d.label} to ${f.name}`, (p) => m.moveToFloor(p, id, f.id, Math.round(x), Math.round(y), room ? room.id : ""));
        app.endMode();
        toast(`${d.label} is now on ${f.name}.`);
      };
      app.setMode({ lockFloor: true, text: `Tap where ${d.label} goes on ${f.name}`, buttons: [{ text: "Cancel", run: () => app.endMode() }] });
    }))),
    button("Cancel", () => { close(); openMarkerSheet(app, id); }),
  ]);
}

// "KIT-04: tap each outlet or light that goes dead when this GFCI trips". Each tap saves; tapping again undoes it.
function startProtecting(app, gfciId) {
  const g = m.find(app.project, "devices", gfciId);
  const show = () => app.setMode({
    ringed: new Set(m.protectedBy(app.project, gfciId).map((d) => d.id)),
    text: `${g.label}: tap each outlet or light that goes dead when this GFCI trips`,
    buttons: [{ text: "Done", cls: "main", run: () => app.endMode() }],
  });
  Object.assign(app, { tab: "add", floorId: g.floorId });
  app.plan.handles = null;
  app.plan.onTap = ({ x, y }) => {
    const floor = app.floor();
    const d = markersNear(app.project.devices.filter((x) => x.floorId === floor.id && x.id !== gfciId), x, y, REACH / app.plan.view.k)[0];
    if (!d) return;
    const on = d.gfciId === gfciId;
    app.commit(on ? `took ${d.label} off ${g.label}` : `put ${d.label} behind ${g.label}`, (p) => m.setProtection(p, d.id, on ? "" : gfciId));
    show();
  };
  show();
}
