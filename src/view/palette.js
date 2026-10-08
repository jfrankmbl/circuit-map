// Choosing a kind of thing: the sheet of large buttons by group, the short lists for 240 V outlets and hard-wired
// appliances, and naming "Something else". onChoose gets a choice: { type, customName }.
import { GROUPS, TYPES } from "../catalog.js";
import { HINTS, PICK_LISTS, suggestedNames } from "../placing.js";
import { h, button, openSheet } from "../ui.js";
import { glyph } from "./markers.js";

export function openPalette(app, title, onChoose) {
  openSheet(title, (close) => {
    const pick = (type) => {
      close();
      if (PICK_LISTS[type]) openPickList(type, onChoose);
      else if (type === "X") openNameSheet(suggestedNames(app.project), (name) => onChoose({ type, customName: name }));
      else onChoose({ type, customName: "" });
    };
    const typeButton = ([code, t]) => h("button", { type: "button", class: "type-button", onclick: () => pick(code) },
      glyph(code),
      h("span", {}, h("strong", {}, t.name), HINTS[code] && h("span", { class: "small" }, HINTS[code])));
    return [
      h("div", { class: "scroll" }, GROUPS.filter(([group]) => group !== "custom").map(([group, label]) => [
        h("h3", {}, label),
        h("div", { class: "type-grid" }, Object.entries(TYPES).filter(([, t]) => t.group === group).map(typeButton)),
      ])),
      // Always at the foot, outside the scrolling part, so it never has to be hunted for.
      h("div", { class: "buttons" },
        h("button", { type: "button", class: "recent", onclick: () => pick("X") }, glyph("X"), "Something else"),
        button("Cancel", close)),
    ];
  });
}

function openPickList(type, onChoose) {
  openSheet(type === "R" ? "Which 240 V outlet?" : "Which appliance?", (close) => [
    h("div", { class: "rows" }, PICK_LISTS[type].map(([text, name]) => button(text, () => {
      close();
      if (name) onChoose({ type, customName: name });
      else openNameSheet([], (typed) => onChoose({ type, customName: typed }));
    }))),
    button("Cancel", close),
  ]);
}

// "What is it called?" Tapping a suggestion chooses it at once; an empty name is not accepted.
function openNameSheet(suggestions, onName) {
  openSheet("What is it called?", (close) => {
    const input = h("input", { type: "text", autocomplete: "off", autocorrect: "off", enterKeyHint: "done" });
    const problem = h("p", { class: "error", role: "alert" });
    const done = (typed) => {
      const name = typed.trim();
      if (!name) {
        problem.textContent = "Type a name for it.";
        return;
      }
      close();
      onName(name);
    };
    requestAnimationFrame(() => input.focus());
    return h("form", { onsubmit: (e) => { e.preventDefault(); done(input.value); } },
      suggestions.length > 0 && h("div", { class: "buttons" }, suggestions.map((s) => button(s, () => done(s)))),
      h("label", {}, "Name", input),
      problem,
      h("div", { class: "buttons" }, h("button", { type: "submit", class: "main" }, "Done"), button("Cancel", close)));
  });
}
