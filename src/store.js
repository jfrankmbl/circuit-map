// Where the project lives on this device: IndexedDB, with pictures as blobs. Nothing here leaves the device.
// Both stores have the same functions: loadProject, saveProject, getSetting, setSetting, getImage, putImage, pruneImages.

const DB_NAME = "circuit-map";

const done = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function openStore() {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore("kv");
    open.result.createObjectStore("images");
  };
  const db = await done(open);
  // Ask the browser not to clear this site's data when space runs short. It may say no; that is fine.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const read = (store) => db.transaction(store).objectStore(store);
  const write = (store) => db.transaction(store, "readwrite").objectStore(store);
  return {
    loadProject: async () => (await done(read("kv").get("project"))) || null,
    saveProject: (project) => done(write("kv").put(project, "project")),
    // Settings are things this device remembers that are not part of the house (the time of the last Export, say).
    getSetting: async (name, fallback) => {
      const value = await done(read("kv").get("setting:" + name));
      return value === undefined ? fallback : value;
    },
    setSetting: (name, value) => done(write("kv").put(value, "setting:" + name)),
    getImage: async (id) => (await done(read("images").get(id))) || null,
    putImage: (id, blob) => done(write("images").put(blob, id)),
    // Drop pictures no floor uses any more. Called once when the app opens, so Undo can still bring one back until then.
    pruneImages: async (keepIds) => {
      const keys = await done(read("images").getAllKeys());
      for (const key of keys) if (!keepIds.includes(key)) await done(write("images").delete(key));
    },
  };
}

// Used when IndexedDB cannot be opened. Everything is lost when the page closes, and the app says so in a banner.
export function memoryStore() {
  let project = null;
  const settings = new Map(), images = new Map();
  return {
    loadProject: async () => project && structuredClone(project),
    saveProject: async (p) => { project = structuredClone(p); },
    getSetting: async (name, fallback) => (settings.has(name) ? settings.get(name) : fallback),
    setSetting: async (name, value) => { settings.set(name, value); },
    getImage: async (id) => images.get(id) || null,
    putImage: async (id, blob) => { images.set(id, blob); },
    pruneImages: async (keepIds) => {
      for (const id of [...images.keys()]) if (!keepIds.includes(id)) images.delete(id);
    },
  };
}
