// The two fields that make a room: its name and its label code. The code is suggested from the name until he types
// one himself, is turned into capitals, and a problem with it is said in words.
import { suggestCode } from "../ids.js";
import { codeProblem } from "../flow.js";
import { h } from "../ui.js";

export function roomFields(app) {
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
  return {
    name,
    fields: [h("label", {}, "Room name", name), h("label", {}, "Label code (used on labels like KIT-01)", code), problem],
    // { name, code } if both are usable; otherwise says why, puts the cursor there and returns null.
    read() {
      const roomName = name.value.trim(), roomCode = code.value.trim();
      if (!roomName) {
        problem.textContent = "Give the room a name.";
        name.focus();
        return null;
      }
      const why = codeProblem(app.project, roomCode);
      if (why) {
        problem.textContent = why;
        code.focus();
        return null;
      }
      return { name: roomName, code: roomCode };
    },
  };
}
