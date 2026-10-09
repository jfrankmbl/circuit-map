import { test } from "node:test";
import assert from "node:assert/strict";
import { inIphoneTab } from "../src/homescreen.js";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

test("an iPhone Safari tab is told to add the app to the Home Screen; the Home Screen app and other devices are not", () => {
  assert.equal(inIphoneTab({ ua: SAFARI }), true);
  assert.equal(inIphoneTab({ ua: SAFARI, standalone: true }), false);
  assert.equal(inIphoneTab({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", platform: "MacIntel", touchPoints: 0 }), false);
  assert.equal(inIphoneTab({ ua: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", touchPoints: 5 }), true); // iPad in desktop mode
  assert.equal(inIphoneTab({ ua: SAFARI.replace("Safari/604.1", "CriOS/120 Safari/604.1") }), false);
});
