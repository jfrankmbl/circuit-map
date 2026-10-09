// Copies the Web Awesome components the app uses, and every file they import, into vendor/webawesome/.
// Run: node tools/vendor-webawesome.mjs <unpacked @awesome.me/webawesome package dir>
// (npm pack @awesome.me/webawesome, then unpack the tarball; its "package" folder is the argument.)
// Then run node tools/stamp.mjs so the new files are cached.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const COMPONENTS = ["details", "callout"];
const STYLES = ["styles/themes/default.css"];
const IMPORT = /(?:import|export)\s*(?:[^'"]*?from\s*)?["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g;

// The theme and every stylesheet it imports (@import url('...')), as paths inside dist-cdn.
export function styleClosure(dist, styles = STYLES) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(/@import url\(['"]([^'"]+)['"]\)/g)) visit(resolve(dirname(file), m[1]));
  };
  for (const s of styles) visit(join(dist, s));
  return [...seen].map((f) => relative(dist, f));
}

// Every file a component needs, as paths inside dist-cdn.
export function closure(dist, components = COMPONENTS) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) visit(resolve(dirname(file), m[1] || m[2]));
  };
  for (const c of components) visit(join(dist, "components", c, c + ".js"));
  return [...seen].map((f) => relative(dist, f));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pkg = resolve(process.argv[2] || "");
  const dist = join(pkg, "dist-cdn");
  if (!existsSync(dist)) throw new Error("Not an unpacked @awesome.me/webawesome package: " + pkg);
  const out = join(fileURLToPath(import.meta.url), "..", "..", "vendor", "webawesome");
  const files = [...closure(dist), ...styleClosure(dist)].map((f) => f.split(sep).join("/"));
  for (const f of files) {
    mkdirSync(dirname(join(out, f)), { recursive: true });
    copyFileSync(join(dist, f), join(out, f));
  }
  copyFileSync(join(pkg, "LICENSE.md"), join(out, "LICENSE.md"));
  const version = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).version;
  writeFileSync(join(out, "README.txt"),
    `Web Awesome ${version} (MIT), from @awesome.me/webawesome dist-cdn.\n` +
    `Components: ${COMPONENTS.join(", ")}. Copied by tools/vendor-webawesome.mjs; do not edit.\n`);
  const bytes = files.reduce((n, f) => n + statSync(join(out, f)).size, 0);
  console.log(`Copied ${files.length} files (${Math.round(bytes / 1024)} KB) from ${version} into vendor/webawesome/`);
}
