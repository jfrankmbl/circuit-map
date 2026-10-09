# Notes on the new look (plan-ui-look)

Contrast, measured in the browser pane:

| Pair | Light | Dark | Target |
| --- | --- | --- | --- |
| Text on page | 17.92 | 15.58 | 4.5 |
| Muted text on page | 6.28 | 8.04 | 4.5 |
| Muted text on panel | 5.51 | 6.90 | 4.5 |
| Main button text | 6.23 | 8.35 | 4.5 |
| Danger on page | 6.54 | 10.59 | 4.5 |
| Field border (`--line-strong`) | 3.36 | 4.03 | 3 |
| Accent bar | 6.23 | 8.12 | 3 |

Checked: Map tab in dark phone width and light 1000 px, the send sheet (with its slide-in), the Breakers tab. No console errors; `node --test` 161 pass.

Not walked through by eye in this pass: first-launch, Plan, Add, Switches, Test, Print preview, toast, the type picker. The print and plan-drawing rules were not edited.

Still looks plain, so candidates for the Web Awesome plan: the Breakers tab's text-only header block (head of the page above the spaces), the sheet buttons, and the plain text inputs.
