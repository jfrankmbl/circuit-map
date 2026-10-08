// A floor's picture is being replaced and the floor already has rooms or devices (a sketch replaced by a proper
// drawing, say). He taps the same two spots on the old picture and on the new one, and everything on the floor is
// moved, resized and turned to match. Nothing is changed until Use these spots; Cancel leaves the old picture.
import * as m from "../model.js";
import { refitText, spotsTooClose } from "../flow.js";
import { toast } from "../ui.js";
import { dot } from "./plan.js";

const PROMPTS = {
  old: ["Line up the new picture. Tap a spot you can find on both pictures, like a far corner of the house.",
    "Now tap a second spot, far from the first."],
  new: ["This is the new picture. Tap the same first spot on it.", "Now tap the same second spot."],
};

// blob: the new picture, already turned and shrunk.
export function startLineUp(app, floor, blob) {
  const plan = app.plan;
  const spots = { old: [], new: [] };
  let on = "old"; // which picture is showing

  const draw = () => plan.layers.overlay.replaceChildren(...spots[on].map(([x, y], i) => dot(x, y, "spot", null, String(i + 1))));

  // Store the picture and put it on the floor. fit: the four spots for model.refitFloor, or null to move nothing.
  const save = async (fit) => {
    const imageId = m.newId();
    try {
      await app.store.putImage(imageId, blob);
    } catch {
      toast("The picture could not be saved. Try again.");
      return;
    }
    const moved = app.commit(`replaced the picture of ${floor.name}`, (p) => {
      const result = fit ? m.refitFloor(p, floor.id, fit) : null;
      m.update(p, "floors", floor.id, { imageId });
      return result;
    });
    app.endMode();
    // The old picture stays in the store until the app is next opened, so Undo brings it back.
    toast(moved ? refitText(moved) + " Check the room outlines and fix any that sit wrong with Edit outline." : "Picture replaced.",
      { text: "Undo", run: () => app.undo() });
  };

  const refresh = () => {
    const here = spots[on];
    const ready = on === "new" && here.length === 2;
    app.setMode({
      floorId: floor.id,
      ownPicture: on === "new",  // the floor's page must not put the old picture back
      noRooms: on === "new",     // outlines are still in the old picture's positions
      cancel: () => { app.shownImage = ""; }, // so the old picture is loaded again
      text: ready ? "Both spots are marked." : PROMPTS[on][here.length],
      buttons: [
        ready && { text: "Use these spots", cls: "main", run: () => save({ fromA: spots.old[0], fromB: spots.old[1], toA: spots.new[0], toB: spots.new[1] }) },
        here.length > 0 && { text: "Undo spot", run: () => { here.pop(); refresh(); } },
        on === "old" && here.length === 0 && { text: "Same picture, same size", cls: "plain", run: () => save(null) },
        { text: "Cancel", run: () => app.cancelMode() },
      ].filter(Boolean),
    });
    draw();
  };

  plan.handles = null;
  plan.onTap = async ({ x, y }) => {
    const here = spots[on];
    if (here.length === 2) return;
    if (here.length === 1 && spotsTooClose(here[0], [x, y], plan.size.width)) {
      toast("Pick two spots further apart.");
      return;
    }
    here.push([x, y]);
    if (on === "old" && here.length === 2) {
      on = "new";
      app.shownImage = "line-up"; // not any floor's imageId, so the next showPicture reloads
      refresh();
      await plan.show(blob);
      return;
    }
    refresh();
  };
  refresh();
}
