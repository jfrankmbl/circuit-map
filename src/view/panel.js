// The Breakers tab: the panels and their breakers. Four screens, kept in state.page: the panel picture (""),
// "breaker", "settings", and "card" (the answer to "Something has no power").
import * as m from "../model.js";
import { displayName } from "../catalog.js";
import { plural } from "../flow.js";
import { listByRoom } from "../browse.js";
import { spaceName, breakerName, breakerTitle, KIND_WORDS, panelCells, enteredText, nextOpenSpace, pairChoices, findBreakers,
  breakerSummary, feedChoices, powerOutCard, whereChoices } from "../panel.js";
import { h, button, nameField, openSheet, ask, toast } from "../ui.js";
import { showOnPlan } from "./browse.js";
import { openMarkerSheet } from "./markersheet.js";

const KINDS = [["standard", "Standard"], ["GFCI", "GFCI (has a Test button)"], ["AFCI", "AFCI"], ["dual", "Both GFCI and AFCI"]];
const NUMBERINGS = [
  ["oddEven", "1 2\n3 4\n5 6", "A: 1 and 2 side by side, then 3 and 4 (most panels)"],
  ["down", "1 4\n2 5\n3 6", "B: 1 to the middle down the left side, the rest down the right"],
];

// What the tab remembers. lastAmps and lastKind start the next breaker entered, so an ordinary one is only a label.
const state = (app) => (app.ui.panel ||= {
  panelId: "", page: "", breakerId: "", card: null, cardMore: false, cardBack: false, highlight: "",
  lastAmps: 15, lastKind: "standard", lastRoomId: "",
});

const show = (app, changes) => {
  Object.assign(state(app), changes);
  app.render();
};

export function panelView(app) {
  const st = state(app), p = app.project;
  const panel = m.find(p, "panels", st.panelId) || p.panels[0] || null;
  st.panelId = panel ? panel.id : "";
  if (!app.mode) {
    const breaker = m.find(p, "breakers", st.breakerId);
    if (st.page === "card" && st.card) return cardPage(app);
    if (st.page === "breaker" && breaker) return breakerPage(app, breaker);
    if (st.page === "settings" && panel) return settingsPage(app, panel);
  }
  return picturePage(app, panel);
}

// Buttons to choose one of a few values, with an optional box for another number. onPick gets the value.
function choiceRow(name, options, current, onPick, withOther = false) {
  let value = current;
  const buttons = h("span", { class: "buttons" });
  const other = withOther && h("input", {
    type: "number", min: 1, inputMode: "numeric", placeholder: "other", "aria-label": `${name}: other`,
    value: options.some(([v]) => v === value) || !value ? "" : value,
    oninput: () => {
      if (!(Number(other.value) > 0)) return;
      value = Number(other.value);
      onPick(value);
      paint();
    },
  });
  const paint = () => buttons.replaceChildren(...options.map(([v, text]) => h("button", {
    type: "button", "aria-pressed": String(value === v),
    onclick: () => {
      value = v;
      if (other) other.value = "";
      onPick(v);
      paint();
    },
  }, text)));
  paint();
  return h("div", { class: "buttons", role: "group", "aria-label": name }, buttons, other);
}

// The two numbering styles, each with a small drawing.
function numberingRow(current, onPick) {
  return h("div", { class: "rows", role: "group", "aria-label": "Numbering" }, NUMBERINGS.map(([value, drawing, text]) =>
    h("button", { type: "button", class: "numbering", "aria-pressed": String(current === value), onclick: () => onPick(value) },
      h("span", { class: "mini" }, drawing), h("span", {}, text))));
}

// ---- the panel picture

function picturePage(app, panel) {
  const st = state(app), p = app.project;
  const results = h("div", { class: "rows" });
  const search = h("input", {
    type: "search", placeholder: "Find a breaker: number or label", "aria-label": "Find a breaker", autocomplete: "off", enterKeyHint: "search",
    oninput: () => results.replaceChildren(...findBreakers(p, search.value).map(({ breaker, panel }) =>
      button(`${breakerTitle(breaker)}, ${breaker.amps} A, ${panel.name}`, () => openBreaker(app, breaker)))),
  });
  return h("section", { class: "page panel-page" },
    // First on the tab: for when he is at the panel with the lights out.
    !app.mode && button("Something has no power", () => whereSheet(app), "main big"),
    st.cardBack && button("Back to the card", () => show(app, { page: "card", cardBack: false, highlight: "" })),
    !panel
      ? [h("p", {}, "No panels yet. Add the one with your main breaker."), button("Add panel", () => addPanelSheet(app), "main")]
      : [
        p.panels.length > 1 && h("div", { class: "pick-row", role: "group", "aria-label": "Panel" }, p.panels.map((x) =>
          h("button", { type: "button", "aria-pressed": String(x.id === panel.id), onclick: () => show(app, { panelId: x.id }) }, x.name))),
        h("div", { class: "panel-head" },
          h("strong", {}, `${panel.name}: ${enteredText(p, panel)}`),
          !app.mode && h("div", { class: "buttons" },
            button("Panel settings", () => show(app, { page: "settings" })),
            button("Add panel", () => addPanelSheet(app)))),
        !app.mode && [search, results],
        pictureEl(app, panel),
      ]);
}

// Two columns of spaces, drawn like the real panel. Nothing here relies on colour: each kind of space says what it is.
function pictureEl(app, panel) {
  const st = state(app), p = app.project, mode = app.mode || {};
  const pairable = mode.pairing ? new Set(pairChoices(p, panel, mode.pairing.n)) : null;
  const facts = (b, extra) => [b.amps ? `${b.amps} A` : "", KIND_WORDS[b.kind], extra].filter(Boolean).join(", ");
  // A breaker: opens its page, or, while a breaker is being picked for a device, is the answer.
  const breakerEl = (b, number, cls, extra) => h("button", {
    type: "button", class: `space ${cls}` + (b.id === st.highlight ? " highlight" : ""), disabled: !!mode.pairing,
    onclick: () => (mode.pickBreaker ? mode.choose(b) : openBreaker(app, b)),
  },
    h("span", { class: "space-no" }, number),
    h("span", { class: "space-label" }, b.label || "(no label)"),
    h("span", { class: "small" }, facts(b, extra)),
    b.id === st.highlight && h("strong", {}, "Check this one"));
  const todoEl = (slot) => {
    const n = parseInt(slot, 10), canPair = pairable && pairable.has(n) && String(n) === slot;
    return h("button", {
      type: "button", class: "space todo", disabled: pairable ? !canPair : !!mode.pickBreaker,
      onclick: () => (canPair ? finishPairing(app, panel, n) : openEntry(app, panel, slot)),
    }, h("span", { class: "space-no" }, spaceName(slot)), h("span", {}, canPair ? "tap to pair" : "tap to add"));
  };
  const cellEl = (cell) => {
    const n = cell.numbers[0];
    if (cell.kind === "todo") return todoEl(String(n));
    if (cell.kind === "tandem") {
      return h("div", { class: "space-pair" },
        cell.top ? breakerEl(cell.top, `${n} top`, "", "") : todoEl(n + "a"),
        cell.bottom ? breakerEl(cell.bottom, `${n} bottom`, "", "") : todoEl(n + "b"));
    }
    if (cell.kind === "empty") {
      return h("button", { type: "button", class: "space empty", disabled: !!app.mode, onclick: () => emptySheet(app, panel, cell.breaker) },
        h("span", { class: "space-no" }, String(n)), h("span", {}, "empty (no breaker)"));
    }
    return cell.kind === "double" ? breakerEl(cell.breaker, cell.numbers.join("/"), "double", "240 V") : breakerEl(cell.breaker, String(n), "", "");
  };
  return h("div", { class: "panel-picture" }, panelCells(p, panel).map((column) => h("div", { class: "panel-col" }, column.map(cellEl))));
}

function openBreaker(app, breaker) {
  show(app, { page: "breaker", breakerId: breaker.id, highlight: "", cardBack: false });
}

// ---- entering and editing a breaker

// The sheet for a space (slot "7", "7a" or "7b"), or for a breaker that exists. The keyboard's key saves and moves
// to the next space not yet entered, so the door can be read top to bottom with the keyboard never closing.
function openEntry(app, panel, slot, existing = null) {
  const st = state(app);
  let amps = existing ? existing.amps : st.lastAmps, kind = existing ? existing.kind : st.lastKind;
  openSheet(existing ? breakerTitle(existing) : `Space ${spaceName(slot)}`, (close) => {
    const label = h("input", { type: "text", value: existing ? existing.label : "", autocomplete: "off", enterKeyHint: existing ? "done" : "next" });
    const fields = () => ({ label: label.value.trim(), amps, kind });
    const remember = () => Object.assign(st, { lastAmps: amps, lastKind: kind });
    const add = (slots, extra = {}) => {
      remember();
      app.commit(`added breaker ${slots.map(spaceName).join("/")}`, (p) => m.addBreaker(p, { panelId: panel.id, slots, ...fields(), ...extra }));
    };
    const nextAfter = () => {
      const next = nextOpenSpace(app.project, panel, parseInt(slot, 10));
      if (next) openEntry(app, panel, String(next));
    };
    const save = (thenNext) => {
      close();
      if (existing) {
        remember();
        app.commit(`changed ${breakerTitle(existing)}`, (p) => m.update(p, "breakers", existing.id, fields()));
      } else {
        add([slot]);
        if (thenNext) nextAfter();
      }
    };
    requestAnimationFrame(() => label.focus());
    return h("form", { onsubmit: (e) => { e.preventDefault(); save(!existing); } },
      h("label", {}, "Label (what is written on the door)", label),
      h("strong", {}, "Amps"),
      choiceRow("Amps", [15, 20, 30, 40, 50].map((a) => [a, String(a)]), amps, (v) => { amps = v; }, true),
      h("strong", {}, "Type of breaker"),
      choiceRow("Type of breaker", KINDS, kind, (v) => { kind = v; }),
      h("div", { class: "buttons" },
        h("button", { type: "submit", class: "main" }, existing ? "Save" : "Save, then next space"),
        !existing && button("Save", () => save(false)),
        button("Cancel", close)),
      // Only a whole space can become a double, a tandem or an empty space.
      !existing && /^\d+$/.test(slot) && h("div", { class: "rows" },
        button("Two spaces together (240 V)", () => { close(); remember(); startPairing(app, panel, Number(slot), fields()); }),
        button("Two small breakers in one space", () => { close(); add([slot + "a"]); openEntry(app, panel, slot + "b"); }),
        button("No breaker here", () => {
          close();
          app.commit(`marked space ${slot} empty`, (p) => m.addBreaker(p, { panelId: panel.id, slots: [slot], amps: 0, kind: "empty" }));
          nextAfter();
        })),
      existing && button("Remove this breaker", () => { close(); removeBreaker(app, existing); }, "plain danger"));
  });
}

// "Tap the other space for this double breaker": only the spaces that can pair stay tappable.
function startPairing(app, panel, n, fields) {
  if (!pairChoices(app.project, panel, n).length) {
    toast(`No free space next to space ${n} for a double breaker.`);
    return;
  }
  app.setMode({
    pairing: { n, fields },
    text: `Tap the other space for this double breaker (the one with space ${n}).`,
    buttons: [{ text: "Cancel", run: () => app.endMode() }],
  });
}

function finishPairing(app, panel, other) {
  const { n, fields } = app.mode.pairing;
  const slots = [n, other].sort((a, b) => a - b).map(String);
  app.endMode();
  app.commit(`added breaker ${slots.join("/")}`, (p) => m.addBreaker(p, { panelId: panel.id, slots, ...fields }));
}

function emptySheet(app, panel, marker) {
  ask(`Space ${breakerName(marker)} is marked empty`, "", [
    {
      text: "Put a breaker here", cls: "main",
      run: () => {
        app.commit(`cleared space ${breakerName(marker)}`, (p) => m.remove(p, "breakers", marker.id));
        openEntry(app, panel, marker.slots[0]);
      },
    },
    { text: "Cancel" },
  ]);
}

function removeBreaker(app, breaker) {
  const lose = m.affected(app.project, "breakers", breaker.id).unassigned || 0;
  ask("Remove this breaker?", `${breakerTitle(breaker)} will be removed.` + (lose ? ` ${plural(lose, "device")} on it will have no breaker recorded.` : ""), [
    { text: "Cancel", cls: "main" },
    {
      text: "Remove it", cls: "plain danger",
      run: () => {
        state(app).page = "";
        app.commit(`removed ${breakerTitle(breaker)}`, (p) => m.remove(p, "breakers", breaker.id));
        toast(`Removed ${breakerTitle(breaker)}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}

// ---- a breaker's page

function breakerPage(app, breaker) {
  const p = app.project, panel = m.find(p, "panels", breaker.panelId), sum = breakerSummary(p, breaker.id);
  // Devices grouped by floor and room, each tagged "guess" where it is one. before() runs first (to close a sheet).
  const groups = (devices, before = () => {}) => listByRoom(p, devices).map((g) => [
    h("h3", {}, `${g.floorName}: ${g.roomName}`),
    h("ul", { class: "rows" }, g.devices.map((d) => h("li", {},
      h("span", {}, `${d.label}, ${displayName(d)}${d.tested ? "" : " (guess)"}`),
      button("Show on plan", () => { before(); showOnPlan(app, d.id); })))),
  ]);
  return h("section", { class: "page" },
    button(`Back to ${panel.name}`, () => show(app, { page: "" })),
    h("h2", {}, breakerTitle(breaker)),
    h("p", {}, [`${breaker.amps} A`, KIND_WORDS[breaker.kind], breaker.poles === 2 && "240 V"].filter(Boolean).join(", ")),
    sum.feeds.map((sub) => h("div", { class: "buttons" }, h("strong", {}, `Feeds ${sub.name}`), button(`Open ${sub.name}`, () => show(app, { panelId: sub.id, page: "" })))),
    // A breaker that feeds a subpanel is not tested itself: its devices belong to the subpanel's breakers.
    sum.text ? h("p", {}, sum.text) : !sum.feeds.length && h("p", {}, "Nothing found on this breaker yet. Test it to find out."),
    groups(sum.direct),
    sum.more && button(sum.more, () => openSheet(`Through ${sum.feeds.map((f) => f.name).join(" and ")}`, (close) => [
      h("div", { class: "scroll" }, groups(sum.downstream, close)),
      button("Done", close, "main"),
    ])),
    button("Edit", () => openEntry(app, panel, breaker.slots[0], breaker)));
}

// ---- adding a panel, and its settings

export function addPanelSheet(app, onAdded = () => {}) {
  let mainAmps = 0, slotCount = 20, numbering = "oddEven";
  openSheet("Add panel", (close) => {
    const name = h("input", { type: "text", value: app.project.panels.length ? "Subpanel" : "Main panel", autocomplete: "off", enterKeyHint: "done" });
    const make = h("input", { type: "text", autocomplete: "off", enterKeyHint: "done" });
    const problem = h("p", { class: "error", role: "alert" });
    const numberingBox = h("div", {});
    const paintNumbering = () => numberingBox.replaceChildren(numberingRow(numbering, (v) => { numbering = v; paintNumbering(); }));
    paintNumbering();
    return h("form", {
      onsubmit: (e) => {
        e.preventDefault();
        if (!name.value.trim()) {
          problem.textContent = "Give the panel a name.";
          return;
        }
        close();
        const panel = app.commit(`added ${name.value.trim()}`, (p) => m.addPanel(p, { name: name.value.trim(), make: make.value.trim(), mainAmps, slotCount, numbering }));
        Object.assign(state(app), { panelId: panel.id, page: "" });
        onAdded(panel);
        app.render();
      },
    },
      h("label", {}, "Name", name),
      h("label", {}, "Make (optional)", make),
      h("strong", {}, "Main breaker size, in amps"),
      choiceRow("Main breaker size", [[100, "100"], [150, "150"], [200, "200"], [0, "Not sure"]], mainAmps, (v) => { mainAmps = v; }, true),
      h("strong", {}, "How many spaces?"),
      choiceRow("How many spaces", [12, 20, 24, 30, 40].map((n) => [n, String(n)]), slotCount, (v) => { slotCount = v; }, true),
      h("p", { class: "small" }, "Not sure? Count the breaker positions down one side and double it. You can change this later."),
      h("strong", {}, "Numbering"),
      numberingBox,
      h("p", { class: "small" }, "Look at the numbers on the breakers or the door. Not sure? Pick A; you can change it."),
      problem,
      h("div", { class: "buttons" }, h("button", { type: "submit", class: "main" }, "Add panel"), button("Cancel", close)));
  });
}

function settingsPage(app, panel) {
  const p = app.project;
  const set = (name, fields) => app.commit(name, (p) => m.update(p, "panels", panel.id, fields));
  const problem = h("p", { class: "error", role: "alert" });
  const make = h("input", { type: "text", value: panel.make, autocomplete: "off", enterKeyHint: "done", onchange: () => set(`changed the make of ${panel.name}`, { make: make.value.trim() }) });
  const amps = h("input", {
    type: "number", min: 0, inputMode: "numeric", value: panel.mainAmps || "",
    onchange: () => set(`changed the main breaker size of ${panel.name}`, { mainAmps: Math.max(0, Number(amps.value) || 0) }),
  });
  const spaces = h("input", {
    type: "number", min: 1, inputMode: "numeric", value: panel.slotCount,
    onchange: () => {
      try {
        app.commit(`changed ${panel.name} to ${spaces.value} spaces`, (p) => m.setSlotCount(p, panel.id, Number(spaces.value)));
      } catch (err) {
        problem.textContent = err.message; // "Space 12 already has a breaker, so the panel cannot have fewer than 12 spaces."
        spaces.value = panel.slotCount;
      }
    },
  });
  const feeder = m.find(p, "breakers", panel.fedFromBreakerId), feederPanel = feeder && m.find(p, "panels", feeder.panelId);
  const choices = feedChoices(p, panel.id), unpaired = m.unpairedBreakers(p, panel.id), marker = m.find(p, "devices", panel.deviceId);
  return h("section", { class: "page" },
    button(`Back to ${panel.name}`, () => show(app, { page: "" })),
    h("label", {}, "Panel name", nameField(panel.name, (name) => set(`renamed ${panel.name}`, { name }))),
    h("label", {}, "Make (optional)", make),
    h("label", {}, "Main breaker size in amps (leave empty if not sure)", amps),
    h("label", {}, "How many spaces?", spaces),
    h("p", { class: "small" }, "Count the breaker positions down one side and double it. It can't go below a space that has a breaker."),
    problem,
    h("strong", {}, "Numbering"),
    numberingRow(panel.numbering, (value) => value !== panel.numbering && app.commit(`changed the numbering of ${panel.name}`, (p) => m.setNumbering(p, panel.id, value))),
    unpaired.length > 0 && [
      h("p", { class: "error" }, `${plural(unpaired.length, "double breaker")} no longer ${unpaired.length === 1 ? "sits" : "sit"} together under this numbering. Check ${unpaired.length === 1 ? "it" : "them"}.`),
      h("ul", { class: "rows" }, unpaired.map((b) => h("li", {}, h("span", {}, breakerTitle(b)), button("Edit", () => openBreaker(app, b))))),
    ],
    // Offered once another panel has breakers: this is what makes a panel a subpanel.
    (choices.length > 0 || feeder) && [
      h("strong", {}, "Which breaker feeds this panel?"),
      h("p", {}, feeder ? `${breakerTitle(feeder)} in ${feederPanel ? feederPanel.name : "another panel"}` : "None: this is a main panel."),
      button("Change", () => feedSheet(app, panel, choices)),
    ],
    marker
      ? button("Show on plan", () => showOnPlan(app, marker.id))
      : h("p", { class: "small" }, "To show where this panel is, place a Breaker panel marker on the Add tab."),
    button("Delete panel", () => deletePanel(app, panel), "plain danger"));
}

function feedSheet(app, panel, choices) {
  const set = (breakerId, name) => () => {
    try {
      app.commit(name, (p) => m.setFedFrom(p, panel.id, breakerId));
    } catch (err) {
      toast(err.message);
    }
  };
  openSheet(`Which breaker feeds ${panel.name}?`, (close) => [
    h("div", { class: "rows scroll" },
      button("None: this is a main panel", () => { close(); set("", `said nothing feeds ${panel.name}`)(); }),
      choices.map((c) => button(c.text, () => { close(); set(c.breaker.id, `said breaker ${breakerName(c.breaker)} feeds ${panel.name}`)(); }))),
    button("Cancel", close),
  ]);
}

function deletePanel(app, panel) {
  const { breakers = 0, unassigned = 0 } = m.affected(app.project, "panels", panel.id);
  const text = [breakers && `Its ${plural(breakers, "breaker")} ${breakers === 1 ? "goes" : "go"} with it.`,
    unassigned && `${plural(unassigned, "device")} will have no breaker recorded.`].filter(Boolean).join(" ");
  ask(`Delete ${panel.name}?`, text, [
    { text: "Cancel", cls: "main" },
    {
      text: `Delete ${panel.name}`, cls: "plain danger",
      run: () => {
        Object.assign(state(app), { page: "", panelId: "" });
        app.commit(`deleted ${panel.name}`, (p) => m.remove(p, "panels", panel.id));
        toast(`Deleted ${panel.name}.`, { text: "Undo", run: () => app.undo() });
      },
    },
  ]);
}

// ---- "Something has no power"

function whereSheet(app) {
  const st = state(app);
  openSheet("Where is the power out?", (close) => {
    const list = h("div", { class: "rows scroll" });
    const search = h("input", { type: "search", placeholder: "A room, or a label like KIT-03", "aria-label": "Search", autocomplete: "off", oninput: () => fill() });
    const fill = () => {
      const choices = whereChoices(app.project, search.value, st.lastRoomId);
      list.replaceChildren(...(choices.length
        ? choices.map((c) => button(c.text, () => {
          close();
          if (c.roomId) st.lastRoomId = c.roomId;
          show(app, { page: "card", card: c.roomId ? { roomId: c.roomId } : { deviceId: c.deviceId }, cardMore: false });
        }))
        : [h("p", {}, search.value.trim() ? "Nothing matches. Check the spelling." : "No rooms yet. Add them on the Floors tab.")]));
    };
    fill();
    return [search, list, button("Cancel", close)];
  });
}

// One card, most useful first, in large type. No more than three lines in a section until he asks for the rest.
function cardPage(app) {
  const st = state(app), card = powerOutCard(app.project, st.card);
  const onPanel = (breakerId) => button("Show on panel", () => {
    const b = m.find(app.project, "breakers", breakerId);
    show(app, { page: "", panelId: b.panelId, highlight: breakerId, cardBack: true });
  });
  const hidden = st.cardMore ? 0 : Math.max(0, card.check.length - 3);
  return h("section", { class: "page card" },
    button("Back to breakers", () => show(app, { page: "", card: null })),
    h("h2", {}, card.title),
    card.check.length > 0 && [
      h("h3", {}, "Check these first (they can look like a tripped breaker)"),
      h("ul", {}, card.check.slice(0, card.check.length - hidden).map((line) => h("li", {}, line))),
      hidden > 0 && button(`and ${hidden} more`, () => show(app, { cardMore: true })),
    ],
    card.likely && [
      h("h3", {}, `Most likely: ${card.likely.title}`),
      h("p", {}, card.likely.sure),
      onPanel(card.likely.breakerId),
      h("p", { class: "small" }, "A tripped breaker sits between On and Off. Push it fully Off, then On. If it trips again straight away, leave it off and call an electrician."),
      card.likely.kindLine && h("p", {}, card.likely.kindLine),
      card.likely.subLine && h("p", {}, card.likely.subLine),
    ],
    card.also.map((a) => h("div", { class: "buttons" }, h("span", {}, a.text), onPanel(a.breakerId))),
    card.unknown && h("p", {}, card.unknown),
    card.none && [h("p", {}, card.none), button("Try another room", () => whereSheet(app))]);
}

// ---- used from other tabs

// From a marker's sheet: tap the breaker this device is on. A pick made here is always a guess; only a test
// can make it tested.
export function startPickingBreaker(app, deviceId) {
  const d = m.find(app.project, "devices", deviceId), from = app.tab;
  if (!app.project.panels.length) {
    toast("Add your panel on the Breakers tab first.");
    return;
  }
  const back = () => {
    app.endMode();
    app.tab = from;
    app.render();
    openMarkerSheet(app, deviceId);
  };
  state(app).page = "";
  app.tab = "panel";
  app.setMode({
    pickBreaker: deviceId,
    cancel: () => { app.tab = from; },
    choose: (b) => {
      app.commit(`put ${d.label} on ${breakerTitle(b)} as a guess`, (p) => m.setBreaker(p, deviceId, b.id, false));
      back();
    },
    text: `Tap the breaker ${d.label} is on. It is a guess until a test confirms it.`,
    buttons: [
      {
        text: "Not sure",
        run: () => {
          if (d.breakerId) app.commit(`cleared the breaker of ${d.label}`, (p) => m.setBreaker(p, deviceId, "", false));
          back();
        },
      },
      { text: "Cancel", run: back },
    ],
  });
}

// Open the panel picture with one breaker ringed.
export function showOnPanel(app, breakerId) {
  const b = m.find(app.project, "breakers", breakerId);
  if (!b) return;
  Object.assign(state(app), { page: "", panelId: b.panelId, highlight: breakerId, cardBack: false });
  app.go("panel");
}

// A Breaker panel or Subpanel marker was just placed: which panel is it?
export function askWhichPanel(app, deviceId) {
  const link = (panel) => app.commit(`marked where ${panel.name} is`, (p) => m.update(p, "panels", panel.id, { deviceId }));
  openSheet("Which panel is this?", (close) => [
    h("div", { class: "rows" },
      app.project.panels.map((panel) => button(panel.name + (panel.deviceId ? " (already on the plan: this replaces it)" : ""), () => { close(); link(panel); })),
      button("New panel", () => { close(); addPanelSheet(app, link); })),
    button("Decide later", close),
  ]);
}
