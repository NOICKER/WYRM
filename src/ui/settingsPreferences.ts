export const ANIMATIONS_STORAGE_KEY = "wyrm_animations";
export const SOUND_STORAGE_KEY = "wyrm_sound";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SettingsPreferences {
  animationsEnabled: boolean;
  soundEnabled: boolean;
}

export interface PasswordChangeDraft {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function readStoredToggle(
  storage: StorageLike,
  key: string,
  defaultValue: boolean,
): boolean {
  const value = storage.getItem(key);
  if (value == null) {
    return defaultValue;
  }
  return value === "on";
}

export function loadSettingsPreferences(storage: StorageLike): SettingsPreferences {
  return {
    animationsEnabled: readStoredToggle(storage, ANIMATIONS_STORAGE_KEY, true),
    soundEnabled: readStoredToggle(storage, SOUND_STORAGE_KEY, false),
  };
}

export function persistSettingsToggle(
  storage: StorageLike,
  key: typeof ANIMATIONS_STORAGE_KEY | typeof SOUND_STORAGE_KEY,
  enabled: boolean,
): void {
  storage.setItem(key, enabled ? "on" : "off");
}

export function validatePasswordChange(draft: PasswordChangeDraft): string | null {
  if (draft.currentPassword.trim().length === 0) {
    return "Enter your current password.";
  }
  if (draft.newPassword.trim().length < 3) {
    return "Enter a new password.";
  }
  if (draft.confirmPassword !== draft.newPassword) {
    return "New passwords do not match.";
  }
  return null;
}

export function formatMatchHistoryDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(timestamp);
}
