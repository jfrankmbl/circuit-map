import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineText, versionText, updateBanner } from "../src/offline.js";

test("the sheet says whether the app works without a signal, and nothing when the browser cannot", () => {
  assert.equal(offlineText("ready"), "Works without a signal");
  assert.equal(offlineText("pending"), "Not saved for offline use yet. Open the app once with a signal.");
  assert.equal(offlineText("unsupported"), "");
});

test("the version reads as a sentence he can say aloud", () => {
  assert.equal(versionText(12, "2026-10-09"), "Circuit Map version 12, 9 Oct 2026");
  assert.equal(versionText(1, "2027-01-31"), "Circuit Map version 1, 31 Jan 2027");
});

test("the update banner needs a waiting version, an older one in control, and no Later", () => {
  assert.equal(updateBanner({ waiting: true, controlled: true }), true);
  assert.equal(updateBanner({ waiting: true, controlled: false }), false);
  assert.equal(updateBanner({ waiting: false, controlled: true }), false);
  assert.equal(updateBanner({ waiting: true, controlled: true, later: true }), false);
  assert.equal(updateBanner(), false);
});
