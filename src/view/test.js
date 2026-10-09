// The breaker test: one page of the Breakers tab, in four stages.
//   steps   - turn switches on, reset GFCIs, switch the breaker off
//   marking - walk the house and mark what has no power (a list, or the plan)
//   review  - "still assigned here": things on this breaker that had power
//   summary - what was found, and the next breaker
// The session (app.test) says which stage it is.
import * as m from "../model.js";
import { displayName, typeInfo } from "../catalog.js";
import { markersNear } from "../placing.js";
import { plural } from "../flow.js";
import { breakerName, breakerTitle } from "../panel.js";
import { newSession, joinLabels, testHeader, stepCounts, canTest, hasConflict, conflictText, markDead, unmark, reconcile,
  alsoProtected, roomToMark, stillAssigned, finishSummary, nextToTest } from "../testing.js";
import { h, button, ask, toast } from "../ui.js";
import { floorSwitch } from "./floorswitch.js";
import { drawFloor } from "./markers.js";
import { state, show } from "./panel.js";

const REACH = 22; // screen pixels: half of a 44-point target

export function startTest(app, breaker) {
  app.test = newSession(breaker.id);
  app.saveTest();
  show(app, { page: "test", breakerId: breaker.id });
}

// A change to the project made during the test, then the session saved with it.
const change = (app, name, fn) => {
  app.commit(name, fn);
  app.saveTest();
};

// A change to the session only.
const redraw = (app) => {
  app.saveTest();
  app.render();
};

const drop = (app) => {
  app.test = null;
  app.saveTest();
};

export function testPage(app) {
  const p = app.project, t = app.test, breaker = m.find(p, "breakers", t.breakerId);
  reconcile(p, t);
  const head = testHeader(p, breaker);
  const top = [
    // Leaving before the breaker is off abandons the test. Once it is off the bar keeps it alive.
    button("Back to breakers", () => {
      if (!t.off) drop(app);
      show(app, { page: "" });
    }),
    h("h2", {}, head.title),
    h("p", { class: "small" }, head.breakers),
    h("p", { class: "small" }, head.devices),
  ];
  if (t.done) return summaryPage(app, breaker, top);
  if (t.review) return reviewPage(app, breaker, top);
  if (!canTest(p)) {
    return h("section", { class: "page" }, top,
      h("p", {}, "No outlets or lights placed yet. Add them on the Add tab first."),
      button("Go to Add", () => { drop(app); app.go("add"); }, "main"));
  }
  return t.off ? markPage(app, breaker, top) : stepsPage(app, breaker, top);
}

// ---- stage 1: the three steps

function stepsPage(app, breaker, top) {
  const t = app.test, counts = stepCounts(app.project);
  // With none recorded a step counts as done.
  const step = (i, text, why, none) => h("button", {
    type: "button", class: "step", "aria-pressed": String(t.steps[i] || none), disabled: none,
    onclick: () => { t.steps[i] = !t.steps[i]; redraw(app); },
  }, h("strong", {}, text), h("span", { class: "small" }, why));
  const ready = (t.steps[0] || !counts.switches) && (t.steps[1] || !counts.gfcis);
  return h("section", { class: "page" }, top,
    step(0, "1. Turn every light switch on", `A switched light looks dead even when its breaker is on. ${counts.switchText}.`, !counts.switches),
    step(1, "2. Press Reset on every GFCI outlet", `A tripped one would be mistaken for a dead circuit, and it cannot be reset once the breaker is off. ${counts.gfciText}.`, !counts.gfcis),
    h("button", { type: "button", class: "step main", disabled: !ready, onclick: () => { t.off = true; redraw(app); } },
      h("strong", {}, `3. Switch breaker ${breakerName(breaker)} off, then tap here`),
      h("span", {}, "Keep it short if a freezer or fridge is on this breaker.")),
    !ready && h("p", { class: "small" }, "Tick steps 1 and 2 first."));
}

// ---- stage 2: marking what has no power

function markPage(app, breaker, top) {
  const p = app.project, t = app.test, groups = m.sweepList(p, breaker.id);
  const pick = (value, text) => h("button", { type: "button", "aria-pressed": String(t.view === value), onclick: () => { t.view = value; redraw(app); } }, text);
  // Only floors he ticks count in the last step: a device on a floor he has not walked has not been seen.
  const checked = (floor) => h("button", {
    type: "button", "aria-pressed": String(t.floors.includes(floor.id)),
    onclick: () => {
      t.floors = t.floors.includes(floor.id) ? t.floors.filter((id) => id !== floor.id) : [...t.floors, floor.id];
      redraw(app);
    },
  }, "I've checked this floor");
  const head = [top,
    h("p", {}, `Breaker ${breakerName(breaker)} is off. Mark everything that has no power.`),
    h("div", { class: "pick-row", role: "group", "aria-label": "Show as" }, pick("list", "List"), pick("plan", "Plan"))];
  const foot = button("I've switched it back on", () => backOn(app), "main big");

  if (t.view === "plan") {
    const floor = app.floor();
    const devices = groups.filter((g) => g.floorId === floor.id).flatMap((g) => g.devices);
    let plan;
    if (floor.imageId) {
      app.showPicture(floor);
      drawFloor(app, floor, { only: new Set(devices.map((d) => d.id)), ringed: new Set(Object.keys(t.dead)) });
      app.plan.onTap = ({ x, y }) => {
        const d = markersNear(devices, x, y, REACH / app.plan.view.k)[0];
        if (d) toggleDead(app, d.id);
      };
      plan = app.plan.el;
    } else {
      plan = h("p", { class: "plan-hint" }, "This floor has no picture. Use the list.");
    }
    return h("section", { class: "plan-screen" },
      h("div", { class: "page" }, head),
      floorSwitch(app),
      h("div", { class: "pick-row" }, checked(floor), h("span", {}, `${devices.filter((d) => t.dead[d.id]).length} marked No power here`)),
      plan,
      h("div", { class: "page" }, foot));
  }

  const row = (d) => {
    const dead = !!t.dead[d.id];
    const other = !dead && d.breakerId !== breaker.id && m.find(p, "breakers", d.breakerId);
    return h("li", {}, h("button", { type: "button", class: "row dead-toggle", "aria-pressed": String(dead), onclick: () => toggleDead(app, d.id) },
      h("strong", {}, `${d.label}, ${displayName(d)}`),
      h("span", {}, dead ? "✗ No power" : "Tap if it has no power"),
      other && h("span", { class: "small" }, `Now on breaker ${breakerName(other)}${d.tested ? "" : " (guess)"}`)));
  };
  const notWorking = m.notWorking(p).filter((d) => typeInfo(d.type).sweep);
  return h("section", { class: "page" }, head,
    m.sortedFloors(p).map((floor) => {
      const here = groups.filter((g) => g.floorId === floor.id);
      return here.length > 0 && [
        h("div", { class: "buttons" }, h("h3", {}, floor.name), checked(floor)),
        here.map((g) => [
          h("div", { class: "buttons" },
            h("strong", {}, g.roomName),
            roomToMark(p, t, g).length > 1 && button("Whole room has no power", () => wholeRoom(app, g))),
          h("ul", { class: "rows" }, g.devices.map(row)),
        ]),
      ];
    }),
    // Left out of the list until cleared, so a dead bulb is not mistaken for a dead circuit.
    notWorking.length > 0 && h("details", {},
      h("summary", {}, `Not working (${notWorking.length})`),
      h("p", { class: "small" }, "Fix them or find out why; they cannot be tested until then."),
      h("ul", { class: "rows" }, notWorking.map((d) => h("li", {},
        h("span", {}, `${d.label}, ${displayName(d)}`),
        button("Working now", () => change(app, `marked ${d.label} as working`, (p) => m.setNotWorking(p, d.id, false))))))),
    foot);
}

// Tap a device: "No power". Tap again: unmarked.
function toggleDead(app, id) {
  const t = app.test, d = m.find(app.project, "devices", id), breaker = m.find(app.project, "breakers", t.breakerId);
  if (t.dead[id]) {
    change(app, `unmarked ${d.label}`, (p) => unmark(p, t, id));
    return;
  }
  const mark = () => {
    change(app, `found ${d.label} on ${breakerTitle(breaker)}`, (p) => markDead(p, t, id));
    // A GFCI outlet that is dead takes what it protects with it.
    const also = d.type === "G" ? alsoProtected(app.project, t, d) : [];
    if (!also.length) return;
    ask(`Also mark the ${plural(also.length, "device")} it protects?`, "", [
      { text: "Yes", cls: "main", run: () => change(app, `found ${plural(also.length, "device")} behind ${d.label} on ${breakerTitle(breaker)}`, (p) => { for (const x of also) markDead(p, t, x); }) },
      { text: "No" },
    ]);
  };
  if (!hasConflict(app.project, d, t)) return mark();
  const other = m.find(app.project, "breakers", d.breakerId);
  ask(`${d.label} was found before`, conflictText(app.project, d, t), [
    { text: "Move it", cls: "main", run: mark },
    { text: `Keep it on breaker ${breakerName(other)}` },
    // For an outlet that goes dead whatever breaker is off: a tripped GFCI, a loose wire, a switch that is off.
    { text: "It has no power for another reason", cls: "plain", run: () => change(app, `marked ${d.label} as not working`, (p) => m.markNoBreaker(p, id)) },
  ]);
}

function wholeRoom(app, group) {
  const t = app.test, ids = roomToMark(app.project, t, group), breaker = m.find(app.project, "breakers", t.breakerId);
  change(app, `found ${plural(ids.length, "device")} in ${group.roomName} on ${breakerTitle(breaker)}`, (p) => { for (const id of ids) markDead(p, t, id); });
  toast(`Marked ${plural(ids.length, "device")}.`, { text: "Undo", run: () => { app.undo(); app.saveTest(); } });
}

// ---- "I've switched it back on": from the bar on any screen, or the foot of the marking page

export function backOn(app) {
  const t = app.test;
  if (!t || !m.find(app.project, "breakers", t.breakerId)) {
    drop(app);
    app.render();
    return;
  }
  if (app.mode) app.cancelMode();
  t.off = false;
  reconcile(app.project, t);
  const left = stillAssigned(app.project, t);
  if (left.guessed.length + left.tested.length) t.review = true;
  else finish(app);
  app.saveTest();
  Object.assign(state(app), { page: "test", breakerId: t.breakerId });
  app.tab = "panel";
  app.render();
}

// The app was opened with a breaker still marked off.
export function askBackOn(app) {
  const breaker = m.find(app.project, "breakers", app.test.breakerId);
  ask(`Is breaker ${breakerName(breaker)} back on?`, "", [
    { text: "Yes, it's back on", cls: "main", run: () => backOn(app) },
    { text: "No, not yet" },
  ]);
}

// Record the breaker as tested (even if nothing was found on it) and show the summary.
function finish(app) {
  const t = app.test, breaker = m.find(app.project, "breakers", t.breakerId);
  t.review = false;
  t.done = true;
  app.commit(`tested ${breakerTitle(breaker)}`, (p) => m.markSwept(p, breaker.id));
  t.summary = finishSummary(app.project, t);
}

// ---- stage 3: still assigned here

function reviewPage(app, breaker, top) {
  const t = app.test, left = stillAssigned(app.project, t);
  const next = () => {
    const now = stillAssigned(app.project, t);
    if (!now.guessed.length && !now.tested.length) finish(app);
    redraw(app);
  };
  const takeOff = (list) => {
    change(app, `took ${joinLabels(list.map((d) => d.label))} off ${breakerTitle(breaker)}`, (p) => { for (const d of list) m.setBreaker(p, d.id, "", false); });
    next();
  };
  const group = (title, list) => list.length > 0 && [
    h("h3", {}, title),
    list.length > 1 && button("Take them all off this breaker", () => takeOff(list)),
    h("ul", { class: "rows" }, list.map((d) => h("li", {},
      h("span", {}, `${d.label}, ${displayName(d)}`),
      h("div", { class: "buttons" },
        button("Take it off", () => takeOff([d]), "main"),
        button("Keep it", () => { t.kept.push(d.id); next(); }))))),
  ];
  return h("section", { class: "page" }, top,
    h("p", {}, left.text),
    h("p", { class: "small" }, "A wrong guess, or a circuit that has been changed, shows up here. Only floors you ticked as checked are counted."),
    group("Guess", left.guessed),
    group("Found by an earlier test", left.tested),
    button("Keep all", () => { finish(app); redraw(app); }));
}

// ---- stage 4: the summary

function summaryPage(app, breaker, top) {
  const s = app.test.summary, next = nextToTest(app.project, breaker.id);
  return h("section", { class: "page" }, top,
    h("p", { class: "found" }, s.found),
    s.guesses.map((line) => h("p", {}, line)),
    h("p", {}, `Breaker ${breakerName(breaker)} is recorded as tested.`),
    next
      ? button(`Next untested breaker (${s.left} left)`, () => startTest(app, next), "main big")
      : h("p", {}, "Every breaker has been tested."));
}
