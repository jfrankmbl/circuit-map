# Circuit Map

Map the outlets, switches, lights and breakers of your own house on your own floor plan.
Runs in the browser; your plan and data stay on your device. A personal record, not for permits.

Design: `docs/superpowers/specs/2026-10-06-circuit-map-app-design.md`

Live: https://jfrankmbl.github.io/circuit-map/

Try it here: `node tools/serve.mjs`, then open http://localhost:8765 (Node 22 or later; nothing to install).

Tests: `node --test`.

Publishing: run `node tools/stamp.mjs --bump` (new version number and date, and the list of files the offline cache saves), run the tests, commit and push. GitHub Pages serves the repository root of `main` (Settings, Pages); a push goes live in about a minute. After adding a file, run `node tools/stamp.mjs` so it is cached; the tests fail until you do.

Offline: the service worker only registers away from localhost. To try it here, open http://localhost:8765/?sw=1.
