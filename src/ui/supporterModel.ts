const SUPPORTER_KEY = "wyrm_supporter_code";
const FOUNDER_PREFIX = "✦ ";
const VALID_CODES = new Set(["WYRM2026", "SERPENT-GOLD", "ANCIENT-ONE"]);

interface SupporterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(): SupporterStorage | undefined {
  const host = globalThis as typeof globalThis & {
    localStorage?: SupporterStorage;
    window?: { localStorage?: SupporterStorage };
  };
  return host.localStorage ?? host.window?.localStorage;
}

export function stripFounderBadge(name: string): string {
  return name.startsWith(FOUNDER_PREFIX) ? name.slice(FOUNDER_PREFIX.length) : name;
}

export function hasFounderBadge(name: string): boolean {
  return name.startsWith(FOUNDER_PREFIX);
}

export function isSupporter(): boolean {
  try {
    const code = getStorage()?.getItem(SUPPORTER_KEY);
    return code != null && VALID_CODES.has(code.toUpperCase().trim());
  } catch {
    return false;
  }
}

export function tryRedeemCode(code: string): boolean {
  const normalized = code.toUpperCase().trim();
  const valid = VALID_CODES.has(normalized);
  if (valid) {
    try {
      getStorage()?.setItem(SUPPORTER_KEY, normalized);
    } catch {
      // Ignore storage failures so the UI can still show the validation result.
    }
  }
  return valid;
}

export function getDisplayName(name: string, applyBadge: boolean): string {
  const baseName = stripFounderBadge(name);
  return applyBadge || hasFounderBadge(name) ? `${FOUNDER_PREFIX}${baseName}` : baseName;
}
