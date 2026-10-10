Goal: produce docs/requirements.md, the single source of truth for Circuit Map, by auditing one requirement area per iteration. Requirements only: do not change code, do not write a design or plan. Commit the file after each iteration.

THE FIXED GOAL (do not widen it):
My dad maps the electrical layout of his own house: 2 stories, a garage and the outside. He (1) gets a floor plan per area into the app, either drawn or imported, (2) logs every electrical fixture on it, (3) gets a testing plan from the app that tells him how to find which breaker feeds each fixture, and (4) records the results so the finished map answers "which breaker is this on?".
- Required: the whole job works on his MacBook.
- Preferred: a laptop-phone workflow with his iPhone, where the phone does what a phone is better at (walking the house).
- Also wanted: he can turn his hand sketch into a clean basic drawing of each floor in the app, and print that as the nice final copy with the fixtures and breaker numbers on it. A simple 2D plan, not CAD.
- He is not technical, but he has an AI coding agent (ChatGPT Codex or Claude Code) on his MacBook.
- I can test on a MacBook and an Android phone. Nobody but Dad can test on an iPhone.

SCOPE TEST for every requirement: "Without this, can Dad still get from an empty app to a tested breaker map on his MacBook?" If yes, it is not a Must. Anything that serves neither the fixed goal nor the two wanted extras (the phone workflow, the clean printed plan) is Won't, however much of it is already built.

SOURCES TO AUDIT (evidence, not authority; they contradict each other):
- docs/superpowers/specs/2026-10-06-circuit-map-app-design.md (phone-first)
- docs/superpowers/specs/2026-10-09-desktop-workspace-design.md (desktop-only rewrite)
- docs/superpowers/plans/ and docs/superpowers/review/
- What is actually built: src/, tests/, index.html. Trust the code over the docs for status.

AREAS, one per iteration, in this order:
1. Users, devices and delivery (how Dad gets it and opens it on a Mac; browsers)
2. Floor plan: import a sketch or blueprint, draw a clean plan over it or from blank, floors, garage, outside, and the printed final copy
3. Logging fixtures: catalog, placing, rooms, labels
4. Switch-to-load links (justify against the goal or cut)
5. Panels and breakers
6. Testing plan: generating it, walking it, recording results, fixing wrong results
7. Laptop-phone workflow: what each device does, how data moves
8. Saving, files, backup, recovery
9. Outputs: print, export
10. Non-functional: Safari on macOS and iOS, data durability (Safari storage eviction), usability for a non-technical user, accessibility, performance with large plan images, privacy, offline, safety wording, updates, and who can verify each: me on the Mac, me on Android, or only Dad
11. Dad's AI agent: for each area already done, could the agent do the job from the project file instead of the app needing a screen for it (for example turning a sketch photo into walls, bulk entry of the panel door labels, fixing mistakes)? What must the file format guarantee for that to be safe? Mark any requirement this lets us cut or downgrade.
12. Final pass: remove duplicates, resolve contradictions between areas, check every Must passes the scope test, write the summary

EACH ITERATION:
1. Read docs/requirements.md if it exists. Its Ledger lists the areas done. Take the next one. If all 12 are done, stop the loop.
2. For that area, read the relevant parts of both specs and the code.
3. Write requirements for the area, each one line in a table:
   ID (FR-n or NFR-n) | Requirement, as one testable sentence about what Dad can do or what holds | Priority (Must / Should / Could / Won't) | Source (goal / spec 10-06 / spec 10-09 / new) | Status (built / partial / missing, with the file) | Acceptance check (what I would see or run)
4. Under the table, list for the area:
   - Cut: features in a spec or the code that fail the scope test, each with one line saying why.
   - Conflicts: where the two specs or the code disagree, and which side the fixed goal supports.
   - Questions for Josh: decisions the goal does not settle. Give your recommendation and what it changes. Do not stop to ask; record them and carry on with the recommendation marked as an assumption.
5. Tick the area in the Ledger, commit, push, continue.

RULES:
- Do not invent features. A new requirement is allowed only when the fixed goal needs it and neither spec has it.
- Do not carry a requirement over because it is already built or already written. Sunk cost is not a reason.
- Requirements say what, never how: no frameworks, libraries or file layouts. If a spec's technology choice matters, put it under Questions for Josh.
- Keep each requirement to one sentence. If it needs a paragraph it is a design, so split it or cut it.
- Anything that only an iPhone can prove is a risk. Prefer requirements for the phone that also hold in Chrome on Android, and mark every one that does not as "iPhone only, Dad must check" in its Acceptance check.
- A requirement may be met by Dad's AI agent working on the project file rather than by a screen, but only if a non-technical person could ask for it in one sentence and check the result in the app. Never for the walk-around testing.
- Commit to the current branch and push it, unless it is main. Never push main, and never merge.
- Plain words. No em dashes.

FILE LAYOUT of docs/requirements.md:
Goal (the fixed goal above, verbatim) / Ledger (12 areas with tick boxes) / one section per area / Summary.

The Summary, written in iteration 12, holds: the count of Must, Should, Could, Won't; the Musts that are missing or partial, as the shortest path to something I can send Dad; every Question for Josh in one list, most blocking first; and one paragraph on where the two specs went off course.

DONE WHEN: all 12 areas are ticked, every requirement has all six columns filled, no Must fails the scope test, and the Summary exists. Then stop the loop and tell me the path to the file and the three most blocking questions.
