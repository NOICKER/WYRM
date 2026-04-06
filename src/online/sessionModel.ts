export const STABLE_CLIENT_ID_KEY = "wyrm_client_id";

export const MATCHMAKING_SUBTEXTS = [
  "Searching the grove for a worthy challenger...",
  "Listening for serpents on the wind...",
  "The parchment is ready. The trails await.",
] as const;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function formatQueueElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getMatchmakingSubtext(elapsedMs: number): (typeof MATCHMAKING_SUBTEXTS)[number] {
  const index = Math.floor(Math.max(0, elapsedMs) / 8_000) % MATCHMAKING_SUBTEXTS.length;
  return MATCHMAKING_SUBTEXTS[index] ?? MATCHMAKING_SUBTEXTS[0];
}

export function getOrCreateStableClientId(
  storage: StorageLike,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = storage.getItem(STABLE_CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }
  const next = createId();
  storage.setItem(STABLE_CLIENT_ID_KEY, next);
  return next;
}
