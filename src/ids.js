// Device labels look like KIT-07: a room code, a dash, a number. Labels are permanent once given.

export function labelNumber(label) {
  const m = /-(\d+)$/.exec(label);
  return m ? Number(m[1]) : 0;
}

export function nextLabel(project, code) {
  let max = 0;
  for (const d of project.devices) {
    if (d.label.startsWith(code + "-")) max = Math.max(max, labelNumber(d.label));
  }
  return code + "-" + String(max + 1).padStart(2, "0");
}

// A room code is a capital letter followed by 1-3 capitals or digits.
export const CODE_PATTERN = /^[A-Z][A-Z0-9]{1,3}$/;

export function suggestCode(name, takenCodes = []) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  let base = words.length > 1 ? words.map((w) => w[0]).join("") : words[0] || "RM";
  if (!/^[A-Z]/.test(base)) base = "R" + base;
  base = base.slice(0, 3);
  while (base.length < 2) base += "X";
  if (!takenCodes.includes(base)) return base;
  for (let n = 2; n < 100; n++) {
    const code = base.slice(0, 4 - String(n).length) + n;
    if (!takenCodes.includes(code)) return code;
  }
  throw new Error("no free room code for " + name);
}

// After a merge two devices can share a label. The one created first keeps it; later ones move to the
// next free number. Returns [{id, from, to}] for the summary shown to the user.
export function fixLabelCollisions(project) {
  const order = [...project.devices].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  const keeper = new Map();
  const dupes = [];
  for (const d of order) {
    if (keeper.has(d.label)) dupes.push(d);
    else keeper.set(d.label, d);
  }
  const changes = [];
  for (const d of dupes) {
    const k = keeper.get(d.label);
    const to = nextLabel(project, d.label.replace(/-\d+$/, ""));
    changes.push({ id: d.id, from: d.label, to, keptId: k.id });
    // The old label is still written on this device's plate. Bumping `updated` past the keeper's makes a later merge
    // with a stale copy keep the renumbered version, whichever way round the files are merged.
    d.plateLabel = d.plateLabel || d.label;
    d.updated = Math.max(d.updated || 0, k.updated || 0) + 1;
    d.label = to;
  }
  return changes;
}
