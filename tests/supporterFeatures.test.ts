import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getDisplayName,
  hasFounderBadge,
  isSupporter,
  tryRedeemCode,
} from "../src/ui/supporterModel.ts";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

const storage = createStorage();
(globalThis as { window?: { localStorage: ReturnType<typeof createStorage> } }).window = {
  localStorage: storage,
};

assert.equal(isSupporter(), false, "supporter mode should stay off before a code is redeemed");
assert.equal(tryRedeemCode("wyrm-unknown"), false, "unknown supporter codes should be rejected");
assert.equal(tryRedeemCode(" wyrm2026 "), true, "valid supporter codes should ignore case and whitespace");
assert.equal(storage.getItem("wyrm_supporter_code"), "WYRM2026", "valid supporter codes should persist in localStorage");
assert.equal(isSupporter(), true, "supporter mode should turn on after a valid code is saved");
assert.equal(getDisplayName("Shubhi", true), "✦ Shubhi", "supporters should get the Founder badge prefix");
assert.equal(getDisplayName("✦ Shubhi", true), "✦ Shubhi", "display names should not double-prefix the Founder badge");
assert.equal(hasFounderBadge("✦ Shubhi"), true, "shared player labels should expose whether a Founder badge is present");

const supportModal = readFileSync(resolve("src/components/SupportModal.tsx"), "utf8");
const lobbyScreen = readFileSync(resolve("src/screens/LobbyScreen.tsx"), "utf8");
const settingsScreen = readFileSync(resolve("src/screens/SettingsScreen.tsx"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

assert.match(
  supportModal,
  /support-qr\.png/,
  "the support modal should point at the shared QR code asset path",
);

assert.match(
  lobbyScreen,
  /☕ Support/,
  "the lobby should expose a subtle support entry point in the sidebar",
);

assert.match(
  settingsScreen,
  /Support the creator ☕/,
  "the settings screen should expose a support entry point beneath the existing preferences",
);

assert.match(
  css,
  /\.support-modal-backdrop\s*\{/,
  "the support modal should define a backdrop style",
);

assert.match(
  css,
  /\.support-link\s*\{/,
  "support entry buttons should share a subdued text-link treatment",
);

assert.match(
  css,
  /\.match-board-cell__trail--gold\s*\{/,
  "supporters should define a dedicated gold trail treatment",
);

console.log("Supporter feature test suite passed.");
