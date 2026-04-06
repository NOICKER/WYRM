import assert from "node:assert/strict";

import {
  ANIMATIONS_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  formatMatchHistoryDate,
  loadSettingsPreferences,
  persistSettingsToggle,
  validatePasswordChange,
} from "../src/ui/settingsPreferences.ts";

{
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  const defaults = loadSettingsPreferences(storage);
  assert.equal(defaults.animationsEnabled, true, "board animations should default to enabled");
  assert.equal(defaults.soundEnabled, false, "sound effects should default to disabled");

  persistSettingsToggle(storage, ANIMATIONS_STORAGE_KEY, false);
  persistSettingsToggle(storage, SOUND_STORAGE_KEY, true);

  const saved = loadSettingsPreferences(storage);
  assert.equal(saved.animationsEnabled, false, "stored animation preferences should reload from localStorage");
  assert.equal(saved.soundEnabled, true, "stored sound preferences should reload from localStorage");
}

{
  assert.equal(
    validatePasswordChange({
      currentPassword: "",
      newPassword: "new-secret",
      confirmPassword: "new-secret",
    }),
    "Enter your current password.",
    "password changes should require the current password",
  );

  assert.equal(
    validatePasswordChange({
      currentPassword: "old-secret",
      newPassword: "new-secret",
      confirmPassword: "different-secret",
    }),
    "New passwords do not match.",
    "password changes should reject mismatched confirmations",
  );

  assert.equal(
    validatePasswordChange({
      currentPassword: "old-secret",
      newPassword: "new-secret",
      confirmPassword: "new-secret",
    }),
    null,
    "valid password change forms should return no validation error",
  );
}

{
  assert.equal(
    formatMatchHistoryDate(Date.UTC(2026, 3, 6)),
    "Apr 6, 2026",
    "match history rows should render a concise readable completion date",
  );
}

console.log("Settings preference test suite passed.");
