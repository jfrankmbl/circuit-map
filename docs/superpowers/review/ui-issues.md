# UI review issues (plan-ui-look)

Found while walking screens. Log here, do not fix during a review round; they are fixed in a batch afterwards, and each is marked whether it needs a change to a building plan (4d and later).

Format: `- [ ] #N screen: what is wrong. Seen: how to reproduce. Plan impact: none | plan name`

## Open

- [ ] #1 Breakers tab: the header block (Something has no power, panel line, Panel settings, Add panel, tested count, Test the next one, Print) fills the first phone screen before any breaker shows. Plan impact: Web Awesome plan.
- [ ] #2 Switches tab: seeded `placeDevice(type: "switch")` showed "No switches placed yet". Probably the wrong type id in the seed, not a bug; confirm the real switch type id and recheck. Plan impact: none.

## Fixed

- Add tab, floor without a picture: content sat off the left edge (d4bc775).
- Test steps with nothing to do were 2.8:1 contrast (d4bc775).
