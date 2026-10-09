// Registers the service worker and tells the app what it finds: whether the files are saved for use without a signal,
// and whether a new version is waiting. Nothing here can break the app: any failure leaves "pending".
import { VERSION } from "../version.js";
import { toast } from "../ui.js";

export function startOffline(app, render) {
  if (!("serviceWorker" in navigator)) {
    app.offline = "unsupported";
    return;
  }
  // The dev server on this computer is not cached, so edits show at once. ?sw=1 turns it on for a check.
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && !/[?&]sw=1\b/.test(location.search)) {
    app.offline = "unsupported";
    return;
  }
  app.offline = "pending";

  const check = async () => {
    if (!app.store) return void setTimeout(check, 500); // the store is still opening
    try {
      const ready = await caches.has("circuit-map-v" + VERSION);
      if (ready && app.offline !== "ready") {
        app.offline = "ready";
        if (!(await app.store.getSetting("offlineToast", false))) {
          app.store.setSetting("offlineToast", true).catch(() => {});
          toast("Ready to use without a signal.");
        }
        render();
      }
    } catch {
      // No cache storage: stay pending.
    }
  };
  const watch = (registration) => {
    const seen = () => {
      app.updateWaiting = !!registration.waiting;
      app.controlled = !!navigator.serviceWorker.controller;
      render();
    };
    const track = (worker) => worker && worker.addEventListener("statechange", () => {
      if (worker.state === "installed") { check(); seen(); }
    });
    track(registration.installing);
    registration.addEventListener("updatefound", () => track(registration.installing));
    if (registration.waiting) seen();
  };

  navigator.serviceWorker.register("sw.js").then((registration) => {
    watch(registration);
    return navigator.serviceWorker.ready;
  }).then(check).catch(() => {});
}
