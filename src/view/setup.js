// The Floors tab: the list of floors, and one floor's page (name, picture, scale, rooms, delete).
import * as m from "../model.js";
import { checklist, floorSummary, deleteFloorQuestion, floorAfterDelete } from "../flow.js";
import { readPicture, drawPicture, canvasBlob } from "../picture.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { drawRooms } from "./roomlayer.js";
import { roomsSection, roomPage } from "./rooms.js";
import { scaleSection } from "./scale.js";
import { startLineUp } from "./lineup.js";

const FLOOR_NAMES = ["Basement", "Main floor", "Upstairs", "Attic"];

export function setupView(app) {
  const floor = m.find(app.project, "floors", app.ui.floorPage || "");
  return floor ? floorPage(app, floor) : floorList(app);
}

function openFloor(app, id) {
  app.ui.floorPage = id;
  app.ui.roomPage = "";
  app.floorId = id;
  app.render();
}

function checklistEl(project) {
  const steps = checklist(project);
  if (steps.every((s) => s.done)) return null;
  return h("ol", { class: "checklist" }, steps.map((s) => h("li", { class: s.done ? "done" : "" }, (s.done ? "✓ " : "") + s.text)));
}

function floorList(app) {
  const p = app.project, floors = m.sortedFloors(p);
  const reorder = !!app.ui.reorder && floors.length > 1;
  const row = (f, i) => h("li", {},
    button([h("strong", {}, f.name), h("span", { class: "small" }, floorSummary(p, f))], () => openFloor(app, f.id), "row"),
    reorder && h("div", { class: "buttons" },
      h("button", { type: "button", disabled: i === 0, onclick: () => app.commit(`moved ${f.name} up`, (p) => m.moveFloor(p, f.id, -1)) }, "Move up"),
      h("button", { type: "button", disabled: i === floors.length - 1, onclick: () => app.commit(`moved ${f.name} down`, (p) => m.moveFloor(p, f.id, 1)) }, "Move down")));
  return h("section", { class: "page" },
    checklistEl(p),
    h("label", {}, "House name", nameField(p.name, (name) => app.commit("renamed the house", (p) => m.rename(p, name)))),
    h("h2", {}, "Floors"),
    floors.length
      ? h("ul", { class: "rows" }, floors.map(row))
      : h("p", {}, "No floors yet. Add one."),
    h("div", { class: "buttons" },
      button("Add floor", () => addFloorSheet(app), "main"),
      floors.length > 1 && button(reorder ? "Done" : "Reorder", () => {
        app.ui.reorder = !reorder;
        app.render();
      })));
}

function addFloorSheet(app) {
  openSheet("Add floor", (close) => {
    const add = (typed) => {
      const name = typed.trim();
      if (!name) return;
      close();
      // A basement is the lowest floor, so it goes first; any other new floor goes last.
      const floor = app.commit(`added ${name}`, (p) => m.addFloor(p, name, Date.now(), name === "Basement"));
      openFloor(app, floor.id);
    };
    const taken = new Set(app.project.floors.map((f) => f.name));
    const input = h("input", { type: "text", autocomplete: "off", enterKeyHint: "done" });
    return [
      h("div", { class: "buttons" }, FLOOR_NAMES.filter((n) => !taken.has(n)).map((n) => button(n, () => add(n)))),
      h("form", { onsubmit: (e) => { e.preventDefault(); add(input.value); } },
        h("label", {}, "Or type a name", input),
        h("div", { class: "buttons" },
          h("button", { type: "submit", class: "main" }, "Add"),
          button("Cancel", close))),
    ];
  });
}

function floorPage(app, floor) {
  const p = app.project;

  // In the middle of something on this floor's plan (tracing, editing, scale, line-up): the plan takes the screen.
  if (app.mode && app.mode.floorId === floor.id) {
    if (!app.mode.ownPicture) app.showPicture(floor);
    drawRooms(app, app.mode.noRooms ? null : floor, app.mode.hideRoom);
    return h("section", { class: "plan-screen" }, app.plan.el);
  }

  const room = m.find(p, "rooms", app.ui.roomPage || "");
  if (room && room.floorId === floor.id) return roomPage(app, floor, room);

  const picker = h("input", {
    type: "file", accept: "image/*,application/pdf", hidden: true,
    onchange: () => {
      const file = picker.files[0];
      picker.value = "";
      if (file) choosePicture(app, floor, file);
    },
  });
  let picture;
  if (floor.imageId) {
    app.showPicture(floor);
    drawRooms(app, floor);
    picture = [app.plan.el, button("Replace picture", () => picker.click())];
  } else {
    picture = [
      h("p", {}, "Next: add a picture of the floor."),
      button("Choose a picture", () => picker.click(), "main"),
    ];
  }
  return h("section", { class: "page floor-page" },
    button("Back to floors", () => {
      app.ui.floorPage = "";
      app.ui.roomPage = "";
      app.render();
    }),
    h("label", {}, "Floor name", nameField(floor.name, (name) => app.commit(`renamed ${floor.name}`, (p) => m.update(p, "floors", floor.id, { name })))),
    h("h2", {}, "Picture"),
    picture,
    picker,
    scaleSection(app, floor),
    roomsSection(app, floor),
    button("Delete floor", () => deleteFloor(app, floor), "plain danger"));
}

// Show the chosen picture with Rotate buttons. Use this picture shrinks it and puts it on the floor; if the floor
// already has a picture with rooms or devices on it, the line-up step comes first so they follow the new one.
async function choosePicture(app, floor, file) {
  if (file.type === "application/pdf") {
    toast("A PDF can't be opened yet. Take a screenshot of the page and choose that.");
    return;
  }
  let bitmap;
  try {
    bitmap = await readPicture(file);
  } catch (err) {
    ask("That picture can't be used", err.message, [{ text: "OK", cls: "main" }]);
    return;
  }
  const p = app.project;
  const lineUp = !!floor.imageId && (p.rooms.some((r) => r.floorId === floor.id && r.outline.length) || p.devices.some((d) => d.floorId === floor.id));
  let turns = 0;
  const canvas = h("canvas", { class: "preview" });
  const draw = () => drawPicture(canvas, bitmap, turns);
  draw();
  openSheet("Use this picture?", (close) => {
    const status = h("p", { role: "status" });
    const use = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      status.textContent = "Preparing picture...";
      try {
        const blob = await canvasBlob(canvas);
        if (lineUp) {
          close();
          startLineUp(app, floor, blob);
          return;
        }
        const imageId = m.newId();
        await app.store.putImage(imageId, blob);
        close();
        app.commit(`added a picture to ${floor.name}`, (p) => m.update(p, "floors", floor.id, { imageId }));
      } catch {
        status.textContent = "The picture could not be saved. Try again.";
        btn.disabled = false;
      }
    };
    return [
      canvas,
      status,
      h("div", { class: "buttons" },
        button("Rotate left", () => { turns--; draw(); }),
        button("Rotate right", () => { turns++; draw(); })),
      h("div", { class: "buttons" }, button("Use this picture", use, "main"), button("Cancel", close)),
    ];
  });
}

function deleteFloor(app, floor) {
  ask("Delete floor", deleteFloorQuestion(app.project, floor.id), [
    { text: "Cancel", cls: "main" },
    {
      text: `Delete ${floor.name}`, cls: "plain danger",
      run: () => {
        app.ui.floorPage = "";
        app.floorId = floorAfterDelete(app.project, floor.id);
        app.commit(`deleted ${floor.name}`, (p) => m.remove(p, "floors", floor.id));
        // The picture stays in the store until the app is next opened, so Undo brings the whole floor back.
        toast(`Deleted ${floor.name}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}
