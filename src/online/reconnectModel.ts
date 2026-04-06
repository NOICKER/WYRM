export const MAX_RECONNECT_ATTEMPTS = 5;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export type ConnectionBannerStatus = "connected" | "reconnecting" | "failed";

export function getReconnectDelay(attempt: number): number | null {
  return RECONNECT_DELAYS_MS[attempt - 1] ?? null;
}

export function getReconnectStatusAfterClose(hasConnectedOnce: boolean): {
  shouldRetry: boolean;
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  if (!hasConnectedOnce) {
    return {
      shouldRetry: false,
      status: "connected",
      attemptCount: 0,
    };
  }

  return {
    shouldRetry: true,
    status: "reconnecting",
    attemptCount: 1,
  };
}

export function getReconnectStatusAfterFailure(attemptCount: number): {
  shouldRetry: boolean;
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  if (attemptCount >= MAX_RECONNECT_ATTEMPTS) {
    return {
      shouldRetry: false,
      status: "failed",
      attemptCount: MAX_RECONNECT_ATTEMPTS,
    };
  }

  return {
    shouldRetry: true,
    status: "reconnecting",
    attemptCount: attemptCount + 1,
  };
}

export function getReconnectStatusAfterSuccess(): {
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  return {
    status: "connected",
    attemptCount: 0,
  };
}
