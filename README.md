# Circuit Map

Map the outlets, switches, lights and breakers of your own house on your own floor plan.
Runs in the browser; your plan and data stay on your device. A personal record, not for permits.

Design: `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md`

Live: https://jfrankmbl.github.io/circuit-map/

Try it here: `node tools/serve.mjs`, then open http://localhost:8765 (Node 22 or later; nothing to install).

Tests: `node --test`.

## Requirements audit (run on the Mac)

The prompt is `docs/requirements-loop.md` on the `desktop` branch; it writes `docs/requirements.md` and changes no code.

1. If the repo is not on the Mac yet: `git clone https://github.com/jfrankmbl/circuit-map.git`, then `cd circuit-map`.
2. `git fetch origin`
3. `git checkout desktop`
4. Open Claude Code in that folder and run `/loop follow docs/requirements-loop.md`.
5. It commits and pushes `desktop` after each area and stops itself after area 12. On the PC, `git pull` on `desktop` to get the result.

Web Awesome (details and callout only) is vendored in `vendor/webawesome/`. To update it: `npm pack @awesome.me/webawesome`, unpack the tarball, run `node tools/vendor-webawesome.mjs <that package folder>`, then `node tools/stamp.mjs`.

Publishing: run `node tools/stamp.mjs --bump` (new version number and date, and the list of files the offline cache saves), run the tests, commit and push. GitHub Pages serves the repository root of `main` (Settings, Pages); a push goes live in about a minute. After adding a file, run `node tools/stamp.mjs` so it is cached; the tests fail until you do.

Offline: the service worker only registers away from localhost. To try it here, open http://localhost:8765/?sw=1.
