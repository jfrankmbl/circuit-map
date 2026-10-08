// Rooms: the list on a floor's page, Add room, one room's page, Delete room, and the review after an outline changes.
import * as m from "../model.js";
import { suggestCode } from "../ids.js";
import { displayName } from "../catalog.js";
import { plural, roomSummary, deleteRoomQuestion, codeProblem, mismatchText } from "../flow.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { startTracing, startEditing } from "./trace.js";

const CODE_LABEL = "Label code (used on labels like KIT-01)";

// The Rooms part of a floor's page.
export function roomsSection(app, floor) {
  const rooms = app.project.rooms.filter((r) => r.floorId === floor.id).sort((a, b) => a.name.localeCompare(b.name));
  return [
    h("h2", {}, "Rooms"),
    rooms.length
      ? h("ul", { class: "rows" }, rooms.map((r) => h("li", {},
        button([h("strong", {}, r.name), h("span", { class: "small" }, roomSummary(app.project, r))], () => {
          app.ui.roomPage = r.id;
          app.render();
        }, "row"))))
      : h("p", {}, "No rooms yet. Add one, then tap its corners on the plan."),
    button("Add room", () => addRoomSheet(app, floor), "main"),
  ];
}

// Name and label code; the code is suggested from the name until he types one himself.
export function addRoomSheet(app, floor) {
  openSheet("Add room", (close) => {
    const name = h("input", { type: "text", autocomplete: "off", autocorrect: "off", enterKeyHint: "next" });
    const code = h("input", { type: "text", autocomplete: "off", autocapitalize: "characters", maxLength: 4, enterKeyHint: "done" });
    const problem = h("p", { class: "error", role: "alert" });
    let typedCode = false;
    name.addEventListener("input", () => {
      if (!typedCode) code.value = name.value.trim() ? suggestCode(name.value, app.project.rooms.map((r) => r.code)) : "";
    });
    code.addEventListener("input", () => {
      typedCode = code.value !== "";
      code.value = code.value.toUpperCase();
      problem.textContent = "";
    });
    const add = (trace) => {
      const roomName = name.value.trim(), roomCode = code.value.trim();
      if (!roomName) {
        problem.textContent = "Give the room a name.";
        name.focus();
        return;
      }
      const why = codeProblem(app.project, roomCode);
      if (why) {
        problem.textContent = why;
        code.focus();
        return;
      }
      close();
      const room = app.commit(`added ${roomName}`, (p) => m.addRoom(p, { floorId: floor.id, name: roomName, code: roomCode }));
      if (trace) startTracing(app, floor, room);
    };
    requestAnimationFrame(() => name.focus());
    // Tracing needs a picture to trace on.
    return h("form", { onsubmit: (e) => { e.preventDefault(); add(!!floor.imageId); } },
      h("label", {}, "Room name", name),
      h("label", {}, CODE_LABEL, code),
      problem,
      h("div", { class: "buttons" },
        floor.imageId
          ? [h("button", { type: "submit", class: "main" }, "Add, then tap its corners"), button("Add without an outline", () => add(false))]
          : h("button", { type: "submit", class: "main" }, "Add"),
        button("Cancel", close)));
  });
}

// One room: Name, Label code, its outline, Delete room.
export function roomPage(app, floor, room) {
  const p = app.project;
  const hasDevices = p.devices.some((d) => d.roomId === room.id);
  const problem = h("p", { class: "error", role: "alert" });
  const code = h("input", {
    type: "text", value: room.code, autocomplete: "off", autocapitalize: "characters", maxLength: 4, enterKeyHint: "done",
    oninput: () => {
      code.value = code.value.toUpperCase();
      problem.textContent = "";
    },
    onchange: () => {
      const next = code.value.trim();
      if (next === room.code) return;
      const why = codeProblem(p, next, room.id);
      if (why) problem.textContent = why;
      else app.commit(`changed the label code of ${room.name}`, (p) => m.editRoom(p, room.id, { code: next }));
    },
  });
  return h("section", { class: "page" },
    button(`Back to ${floor.name}`, () => {
      app.ui.roomPage = "";
      app.render();
    }),
    h("label", {}, "Room name", nameField(room.name, (name) => app.commit(`renamed ${room.name}`, (p) => m.editRoom(p, room.id, { name })))),
    // Labels are written on cover plates, so once a room has devices its code is shown as plain text, not a dead field.
    hasDevices
      ? h("div", {}, h("strong", {}, `Label code: ${room.code}`),
        h("p", { class: "small" }, `Labels in this room already use ${room.code}, so the code can't change.`))
      : [h("label", {}, CODE_LABEL, code), problem],
    h("p", { class: "small" }, roomSummary(p, room)),
    floor.imageId && (room.outline.length
      ? button("Edit outline", () => startEditing(app, floor, room))
      : button("Tap its corners on the plan", () => startTracing(app, floor, room), "main")),
    button("Delete room", () => deleteRoom(app, room), "plain danger"));
}

function deleteRoom(app, room) {
  const remove = (options) => () => {
    app.ui.roomPage = "";
    app.commit(`deleted ${room.name}`, (p) => m.removeRoom(p, room.id, options));
    toast(`Deleted ${room.name}.`, { text: "Undo", run: () => app.undo() });
  };
  const hasDevices = app.project.devices.some((d) => d.roomId === room.id);
  ask("Delete room", deleteRoomQuestion(app.project, room), hasDevices
    ? [
      { text: "Keep the devices", cls: "main", run: remove({}) }, // they stay on the plan with no room
      { text: "Cancel" },
      { text: "Delete the devices too", cls: "plain danger", run: remove({ deleteDevices: true }) },
    ]
    : [{ text: "Delete", cls: "main", run: remove({}) }, { text: "Cancel" }]);
}

// After an outline is edited: say which devices no longer match it. Changing an outline never moves, relabels or
// reassigns a device by itself; "Move all" is his choice, and keeps their labels.
export function reviewOutline(app, room) {
  const found = m.outlineMismatches(app.project, room.id);
  const text = mismatchText(room, found);
  if (!text.outside && !text.inside) return;
  const row = (d) => h("li", {}, `${d.label}, ${displayName(d)}, ${(m.find(app.project, "rooms", d.roomId) || { name: "no room" }).name}`);
  openSheet(`The ${room.name} outline changed`, (close) => [
    text.outside && [h("p", {}, text.outside), h("ul", {}, found.outside.map(row))],
    text.inside && [
      h("p", {}, text.inside),
      h("ul", {}, found.inside.map(row)),
      button(`Move all to ${room.name}`, () => {
        close();
        app.commit(`moved ${plural(found.inside.length, "device")} into ${room.name}`, (p) => {
          for (const d of found.inside) m.setRoom(p, d.id, room.id, false);
        });
      }),
    ],
    h("p", { class: "small" }, "Nothing has been moved or relabelled."),
    button("Done", close, "main"),
  ]);
}
