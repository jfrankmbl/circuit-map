// Combine two copies of the same project (this device's and an imported file's) without losing work.
import { COLLECTIONS } from "./model.js";
import { fixLabelCollisions } from "./ids.js";

// Key order must not matter when comparing two copies of a record. Records are flat except for arrays.
const canon = (rec) => JSON.stringify(rec, Object.keys(rec).sort());

// Later change wins. On a tie any rule will do, as long as both devices pick the same one.
function newer(x, y) {
  if (x.updated !== y.updated) return x.updated > y.updated ? x : y;
  return canon(x) >= canon(y) ? x : y;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Remove or clear anything that points at a record that no longer exists.
function tidy(p) {
  const ids = (coll) => new Set(p[coll].map((r) => r.id));
  const floors = ids("floors"), panels = ids("panels");
  p.rooms = p.rooms.filter((r) => floors.has(r.floorId));
  p.devices = p.devices.filter((d) => floors.has(d.floorId));
  p.breakers = p.breakers.filter((b) => panels.has(b.panelId));
  const rooms = ids("rooms"), breakers = ids("breakers"), devices = ids("devices");
  for (const d of p.devices) {
    if (d.roomId && !rooms.has(d.roomId)) d.roomId = "";
    if (d.breakerId && !breakers.has(d.breakerId)) Object.assign(d, { breakerId: "", tested: false });
    if (d.gfciId && !devices.has(d.gfciId)) d.gfciId = "";
  }
  for (const panel of p.panels) {
    if (panel.fedFromBreakerId && !breakers.has(panel.fedFromBreakerId)) panel.fedFromBreakerId = "";
    if (panel.deviceId && !devices.has(panel.deviceId)) panel.deviceId = "";
  }
  const seen = new Set();
  p.links = p.links.filter((l) => {
    const key = [l.switchId, l.toggle, l.loadId, l.loadPart].join("|");
    if (!devices.has(l.switchId) || !devices.has(l.loadId) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function merge(local, incoming) {
  if (local.id !== incoming.id) {
    const err = new Error("This file is for a different house.");
    err.code = "different-project";
    throw err;
  }
  const gone = new Map();
  for (const t of [...local.deleted, ...incoming.deleted]) gone.set(t.id, Math.max(t.at, gone.get(t.id) || 0));

  const head = newer({ name: local.name, updated: local.updated }, { name: incoming.name, updated: incoming.updated });
  const out = { formatVersion: Math.max(local.formatVersion, incoming.formatVersion), id: local.id,
    name: head.name, updated: head.updated };
  for (const coll of COLLECTIONS) {
    const all = new Map(local[coll].map((r) => [r.id, r]));
    for (const r of incoming[coll]) all.set(r.id, all.has(r.id) ? newer(all.get(r.id), r) : r);
    out[coll] = [...all.values()].filter((r) => !(gone.get(r.id) >= r.updated)).map((r) => structuredClone(r)).sort(byId);
  }
  out.deleted = [...gone].map(([id, at]) => ({ id, at })).sort(byId);
  tidy(out);

  // changed: records whose content differs from this device's copy, with the names of the fields that differ.
  // removedItems: what the merge deleted from this device. Both are for the "Bring them in?" question.
  const summary = { added: 0, updated: 0, removed: 0, renumbered: fixLabelCollisions(out), changed: [], removedItems: [] };
  const nameOf = (r) => r.label || r.name || r.code || r.id;
  for (const coll of COLLECTIONS) {
    const mine = new Map(local[coll].map((r) => [r.id, r]));
    const kept = new Set();
    for (const r of out[coll]) {
      kept.add(r.id);
      if (!mine.has(r.id)) {
        summary.added++;
        continue;
      }
      const was = mine.get(r.id);
      const fields = Object.keys(r).filter((k) => k !== "updated" && JSON.stringify(r[k]) !== JSON.stringify(was[k])).sort();
      if (fields.length) {
        summary.updated++;
        summary.changed.push({ coll, id: r.id, name: nameOf(r), fields });
      }
    }
    for (const [id, was] of mine) {
      if (!kept.has(id)) {
        summary.removed++;
        summary.removedItems.push({ coll, id, name: nameOf(was) });
      }
    }
  }
  return { project: out, summary };
}
