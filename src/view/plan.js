// The plan: a floor's picture that can be panned and zoomed, with layers above it for outlines and markers.
// One finger or the mouse drags it; two fingers, the wheel or the buttons zoom; a touch that does not move is a tap.
// Anything in a layer with a data-handle attribute can be dragged or tapped by itself (see plan.handles).
import { h, svg, button } from "../ui.js";
import { fit, zoomAt, panBy, toImage } from "../viewport.js";

const TAP_SLOP = 6;    // a touch that moves further than this many pixels is a pan or a drag, not a tap
const TOUCH_LIFT = 44; // a handle dragged by a finger sits this far above the fingertip, so it can be seen

// Something drawn at picture point (x, y) that stays the same size on screen however far the plan is zoomed.
// The kids are drawn around (0, 0) in screen pixels.
export function fixedAt(x, y, attrs, ...kids) {
  return svg("g", { transform: `translate(${x} ${y})`, ...attrs }, svg("g", { class: "fixed" }, kids));
}

// A round mark with a 44-pixel reach. cls styles the visible circle; handle (optional) makes it draggable and
// tappable under that id; text (optional) is drawn inside it.
export function dot(x, y, cls, handle = null, text = "") {
  return fixedAt(x, y, handle == null ? {} : { "data-handle": handle },
    svg("circle", { class: "reach", r: 22 }),
    svg("circle", { class: cls, r: 10 }),
    text && svg("text", { class: "dot-text", "text-anchor": "middle", "dominant-baseline": "central" }, text));
}

export function createPlan() {
  const underlay = svg("image", { preserveAspectRatio: "none" });
  const layers = { outlines: svg("g"), markers: svg("g"), overlay: svg("g") };
  const world = svg("g", {}, underlay, layers.outlines, layers.markers, layers.overlay);
  const root = svg("svg", { class: "plan-svg", role: "img", "aria-label": "Floor plan" }, world);
  const message = h("p", { class: "plan-message", role: "status" });

  const plan = {
    el: null,
    layers,          // drawn into in picture pixels: outlines (rooms), markers (devices), overlay (the current mode)
    onTap: null,     // set by a mode: ({ x, y, inside }) in picture pixels, for a tap that is not on a handle
    handles: null,   // set by a mode: { move(id, { x, y }), drop(id, { x, y }), tap(id) } for [data-handle] elements
    size: null,      // { width, height } of the picture, or null with none
    view: { k: 1, x: 0, y: 0 },
    show, fit: fitView, setMessage,
  };

  let needsFit = false, token = 0, url = "";
  const box = () => root.getBoundingClientRect();
  const apply = () => {
    world.setAttribute("transform", `translate(${plan.view.x} ${plan.view.y}) scale(${plan.view.k})`);
    root.style.setProperty("--k", plan.view.k); // .fixed marks scale by 1 / k to keep their size
  };

  function setMessage(text) {
    message.textContent = text;
  }

  function fitView() {
    const b = box();
    needsFit = !plan.size || !b.width || !b.height;
    if (needsFit) return;
    plan.view = fit(plan.size.width, plan.size.height, b.width, b.height);
    apply();
  }

  // Zoom about a screen point (the middle of the plan if none is given), from half the fitted size up to 8x.
  function zoom(factor, sx, sy) {
    const b = box();
    if (!plan.size || !b.width) return;
    const fitted = fit(plan.size.width, plan.size.height, b.width, b.height).k;
    plan.view = zoomAt(plan.view, sx ?? b.width / 2, sy ?? b.height / 2, factor, fitted / 2, Math.max(8, fitted * 8));
    apply();
  }

  // Show a picture blob, or nothing (null). Fits it to the box. A newer call wins over a slower older one.
  async function show(blob) {
    const mine = ++token;
    if (!blob) {
      plan.size = null;
      underlay.removeAttribute("href");
      if (url) URL.revokeObjectURL(url);
      url = "";
      setMessage("");
      return;
    }
    const next = URL.createObjectURL(blob);
    const img = new Image();
    try {
      // The load event, not img.decode(): decode() waits for the page to be visible.
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = next;
      });
    } catch {
      URL.revokeObjectURL(next);
      if (mine === token) setMessage("This picture could not be shown.");
      return;
    }
    if (mine !== token) {
      URL.revokeObjectURL(next);
      return;
    }
    if (url) URL.revokeObjectURL(url);
    url = next;
    plan.size = { width: img.naturalWidth, height: img.naturalHeight };
    underlay.setAttribute("href", url);
    underlay.setAttribute("width", plan.size.width);
    underlay.setAttribute("height", plan.size.height);
    setMessage("");
    fitView();
  }

  const pointers = new Map(); // pointerId -> [clientX, clientY]
  let start = [0, 0], moved = false;
  let grab = null;            // { id, lift } while a handle is held

  // Where a held handle is, in picture pixels: under the mouse, or above the fingertip.
  const grabPoint = (e, held) => {
    const b = box();
    const [x, y] = toImage(plan.view, e.clientX - b.left, e.clientY - b.top - held.lift);
    return { x, y };
  };

  root.addEventListener("pointerdown", (e) => {
    root.setPointerCapture(e.pointerId);
    const handle = plan.handles && pointers.size === 0 && e.target.closest("[data-handle]");
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      start = [e.clientX, e.clientY];
      moved = false;
      grab = handle ? { id: handle.dataset.handle, lift: e.pointerType === "touch" ? TOUCH_LIFT : 0 } : null;
    } else {
      moved = true; // a second finger: this is a pinch, never a tap
      grab = null;
    }
  });

  root.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = [e.clientX, e.clientY];
    if (pointers.size === 1) {
      if (!moved && Math.hypot(cur[0] - start[0], cur[1] - start[1]) < TAP_SLOP) return;
      moved = true;
      if (grab) {
        if (plan.handles) plan.handles.move(grab.id, grabPoint(e, grab));
      } else {
        plan.view = panBy(plan.view, cur[0] - prev[0], cur[1] - prev[1]);
        apply();
      }
    } else if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
      const after = Math.hypot(cur[0] - other[0], cur[1] - other[1]);
      const b = box();
      plan.view = panBy(plan.view, (cur[0] - prev[0]) / 2, (cur[1] - prev[1]) / 2);
      if (before > 0) zoom(after / before, (cur[0] + other[0]) / 2 - b.left, (cur[1] + other[1]) / 2 - b.top);
      apply();
    }
    pointers.set(e.pointerId, cur);
  });

  const lift = (e) => {
    if (!pointers.delete(e.pointerId)) return;
    const held = grab;
    grab = null;
    if (e.type !== "pointerup" || pointers.size) return;
    if (held) {
      if (!plan.handles) return;
      if (moved) plan.handles.drop(held.id, grabPoint(e, held));
      else plan.handles.tap(held.id);
      return;
    }
    if (moved || !plan.size || !plan.onTap) return;
    const b = box();
    const [x, y] = toImage(plan.view, e.clientX - b.left, e.clientY - b.top);
    plan.onTap({ x, y, inside: x >= 0 && y >= 0 && x <= plan.size.width && y <= plan.size.height });
  };
  root.addEventListener("pointerup", lift);
  root.addEventListener("pointercancel", lift);

  // The wheel zooms. A trackpad pinch arrives as a wheel event with ctrlKey set and small deltas.
  root.addEventListener("wheel", (e) => {
    e.preventDefault();
    const b = box();
    zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });

  plan.el = h("div", { class: "plan" }, root, message,
    h("div", { class: "zoom-buttons" },
      h("button", { type: "button", "aria-label": "Zoom in", onclick: () => zoom(1.5) }, "+"),
      h("button", { type: "button", "aria-label": "Zoom out", onclick: () => zoom(1 / 1.5) }, "−"),
      button("Fit", fitView)));

  // The picture may be loaded before the plan is on screen and has a size; fit it once it has one.
  new ResizeObserver(() => {
    if (needsFit) fitView();
  }).observe(plan.el);

  apply();
  return plan;
}
