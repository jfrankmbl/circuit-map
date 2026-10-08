import * as m from "../src/model.js";

// A one-floor house: a kitchen traced as a 100 x 100 square, and an Exterior room with no outline.
export function sample() {
  const p = m.createProject("Dad's house", 1000);
  const main = m.addFloor(p, "Main", 1000);
  const kit = m.addRoom(p, { floorId: main.id, name: "Kitchen", code: "KIT" }, 1000);
  m.update(p, "rooms", kit.id, { outline: [[0, 0], [100, 0], [100, 100], [0, 100]] }, 1000);
  const ext = m.addRoom(p, { floorId: main.id, name: "Exterior", code: "EXT" }, 1000);
  return { p, main, kit, ext };
}
