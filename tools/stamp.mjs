// Run before shipping a change: node tools/stamp.mjs [--bump]
// Writes the list of files to cache and the version into sw.js, and the date into src/version.js.
// --bump raises the version by one first. Run it with no flag after adding a file, so it is cached too.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const SKIP = /(^|\/)(LICENSE|README\.txt)$/;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// Every file the app needs, as addresses relative to sw.js, "./" first.
export function listFiles(base = root) {
  const files = ["index.html", "styles.css", "manifest.webmanifest"];
  for (const dir of ["src", "vendor", "icons"]) {
    for (const path of walk(join(base, dir))) files.push(relative(base, path).split(sep).join("/"));
  }
  return ["./", ...files.filter((f) => !SKIP.test(f)).sort()];
}

export function swSource(source, version, files) {
  return source
    .replace(/const VERSION = \d+;/, `const VERSION = ${version};`)
    .replace(/const FILES = \[[\s\S]*?\n\];/, `const FILES = [\n${files.map((f) => "  " + JSON.stringify(f)).join(",\n")}\n];`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const versionPath = join(root, "src", "version.js");
  const text = readFileSync(versionPath, "utf8");
  let version = Number(text.match(/VERSION = (\d+)/)[1]);
  const bump = process.argv.includes("--bump");
  if (bump) version += 1;
  const crlf = text.includes("\r\n");
  const released = bump ? new Date().toISOString().slice(0, 10) : text.match(/RELEASED = "([^"]+)"/)[1];
  const next = text.replace(/VERSION = \d+/, `VERSION = ${version}`).replace(/RELEASED = "[^"]+"/, `RELEASED = "${released}"`);
  writeFileSync(versionPath, next);
  const swPath = join(root, "sw.js");
  const sw = readFileSync(swPath, "utf8");
  writeFileSync(swPath, swSource(sw.replace(/\r\n/g, "\n"), version, listFiles()).replace(/\n/g, crlf ? "\r\n" : "\n"));
  console.log(`Version ${version}, ${released}, ${listFiles().length} files cached.`);
}
