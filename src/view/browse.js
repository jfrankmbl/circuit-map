// The Map tab. For now it shows the floor buttons and the plan with its room outlines; markers, search and details
// come with Plans 2c and 2d.
import { h, button } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawRooms } from "./roomlayer.js";

export function browseView(app) {
  const floor = app.floor();
  const toFloors = (floorId) => {
    app.ui.floorPage = floorId;
    app.ui.roomPage = "";
    app.go("floors");
  };
  if (!floor) {
    return h("section", { class: "page" },
      h("p", {}, "No floors yet. Add one."),
      button("Go to Floors", () => toFloors(""), "main"));
  }
  if (!floor.imageId) {
    return h("section", { class: "plan-screen" },
      floorSwitch(app),
      h("div", { class: "page" },
        h("p", {}, "This floor has no picture yet."),
        button("Choose a picture", () => toFloors(floor.id), "main")));
  }
  app.showPicture(floor);
  drawRooms(app, floor);
  return h("section", { class: "plan-screen" }, floorSwitch(app), app.plan.el);
}
