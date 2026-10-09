// The offline cache. Everything the app needs is saved when this version installs; after that a request is answered
// from the cache. A new version installs beside the old one and waits: it takes over when every window of the app has
// been closed, so the page never changes under him. VERSION and FILES are written by tools/stamp.mjs.
const VERSION = 1;
const FILES = [
  "./",
  "icons/icon-180.png",
  "index.html",
  "manifest.webmanifest",
  "src/app.js",
  "src/browse.js",
  "src/catalog.js",
  "src/csv.js",
  "src/file.js",
  "src/flow.js",
  "src/history.js",
  "src/homescreen.js",
  "src/ids.js",
  "src/linking.js",
  "src/merge.js",
  "src/model.js",
  "src/offline.js",
  "src/outline.js",
  "src/panel.js",
  "src/picture.js",
  "src/placing.js",
  "src/printing.js",
  "src/sending.js",
  "src/store.js",
  "src/testing.js",
  "src/ui.js",
  "src/version.js",
  "src/view/bringin.js",
  "src/view/browse.js",
  "src/view/floorswitch.js",
  "src/view/lineup.js",
  "src/view/link.js",
  "src/view/markers.js",
  "src/view/markersheet.js",
  "src/view/movesheet.js",
  "src/view/offline.js",
  "src/view/palette.js",
  "src/view/panel.js",
  "src/view/pdfpage.js",
  "src/view/place.js",
  "src/view/plan.js",
  "src/view/plates.js",
  "src/view/print.js",
  "src/view/roomfields.js",
  "src/view/roomlayer.js",
  "src/view/rooms.js",
  "src/view/savefile.js",
  "src/view/scale.js",
  "src/view/send.js",
  "src/view/setup.js",
  "src/view/test.js",
  "src/view/trace.js",
  "src/view/welcome.js",
  "src/viewport.js",
  "styles.css",
  "vendor/pdf.js/pdf.min.mjs",
  "vendor/pdf.js/pdf.worker.min.mjs"
];
const CACHE = "circuit-map-v" + VERSION;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith("circuit-map-v") && key !== CACHE).map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // ignoreSearch: the address may carry ?sw=1 or a hash, which are not different files.
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
});
