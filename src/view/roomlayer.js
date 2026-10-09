// Room outlines on the plan: a faint tint with the room's name at a point inside it.
import { svg } from "../ui.js";
import { fixedAt } from "./plan.js";
import { labelPoint, roomBox } from "../outline.js";

// Draw the outlines of `floor` (none if it is null). except: a room id to leave out, while its outline is being edited.
export function drawRooms(app, floor, except = "") {
  const rooms = floor ? app.project.rooms.filter((r) => r.floorId === floor.id && r.outline.length >= 3 && r.id !== except) : [];
  app.plan.layers.outlines.replaceChildren(...rooms.flatMap((r) => {
    const [x, y] = labelPoint(r.outline);
    return [
      svg("polygon", { class: "room", points: r.outline.map((p) => p.join(",")).join(" ") }),
      fixedAt(x, y, {}, svg("text", { class: "room-name", "text-anchor": "middle", "dominant-baseline": "central" }, r.name)),
    ];
  }));
  // The plan's Rooms button zooms to any of these.
  app.plan.setRooms(rooms.map((r) => ({ name: r.name, box: roomBox(r.outline) })).sort((a, b) => a.name.localeCompare(b.name)));
}
