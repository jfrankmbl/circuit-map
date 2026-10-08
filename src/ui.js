// Small DOM helpers. A string passed as a child is always added as text, never as HTML, so names typed by the user are safe.

function fill(el, attrs, kids) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.setAttribute("class", value);
    else if (el instanceof HTMLElement && key in el) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// h("p", { class: "small" }, "text", otherElement, [more, children])
export const h = (tag, attrs = {}, ...kids) => fill(document.createElement(tag), attrs, kids);
export const svg = (tag, attrs = {}, ...kids) => fill(document.createElementNS("http://www.w3.org/2000/svg", tag), attrs, kids);
export const button = (text, onclick, cls = "") => h("button", { type: "button", class: cls, onclick }, text);

// A sheet from the bottom of the screen (a centred box on a wide window). build(close) returns its content.
// Esc and the returned function both close it.
export function openSheet(title, build) {
  const dialog = h("dialog", { class: "sheet" });
  const close = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove());
  dialog.append(h("h2", {}, title), ...[build(close)].flat(Infinity).filter(Boolean));
  document.body.append(dialog);
  dialog.showModal();
  return close;
}

// A question. choices: [{ text, cls, run }]; the sheet closes, then run (if any) is called.
export function ask(title, text, choices) {
  openSheet(title, (close) => [
    text && h("p", {}, text),
    h("div", { class: "buttons" }, choices.map((c) => button(c.text, () => {
      close();
      if (c.run) c.run();
    }, c.cls || ""))),
  ]);
}

let toastTimer = 0;

export function clearToast() {
  clearTimeout(toastTimer);
  document.getElementById("toast").replaceChildren();
}

// A short message above the tab bar. With an action ({ text, run }, usually Undo) it stays for 30 seconds, or until
// the next change; without one, 4 seconds.
export function toast(text, action) {
  clearToast();
  document.getElementById("toast").append(h("div", { class: "toast" },
    h("span", {}, text),
    action && button(action.text, () => {
      clearToast();
      action.run();
    })));
  toastTimer = setTimeout(clearToast, action ? 30000 : 4000);
}
