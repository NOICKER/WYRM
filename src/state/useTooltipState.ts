import { useCallback, useMemo, useState } from "react";

export type TooltipKey =
  | "trail_created"
  | "sacred_grove_nearby"
  | "elder_promotion"
  | "lair_power_available"
  | "coil_choice"
  | "blocked_move_available"
  | "capture_available"
  | "hoard_deploy_available";

export const TOOLTIP_STORAGE_KEY = "wyrm_seen_tooltips";

export interface TooltipQueueState {
  seenKeys: Set<TooltipKey>;
  pendingKeys: TooltipKey[];
}

function isTooltipKey(value: unknown): value is TooltipKey {
  return (
    value === "trail_created"
    || value === "sacred_grove_nearby"
    || value === "elder_promotion"
    || value === "lair_power_available"
    || value === "coil_choice"
    || value === "blocked_move_available"
    || value === "capture_available"
    || value === "hoard_deploy_available"
  );
}

function serializeSeenKeys(seenKeys: Set<TooltipKey>): string {
  return JSON.stringify([...seenKeys]);
}

export function createInitialTooltipQueueState(rawStoredKeys: string | null): TooltipQueueState {
  try {
    const parsed = rawStoredKeys ? (JSON.parse(rawStoredKeys) as unknown) : [];
    const seenKeys = Array.isArray(parsed)
      ? new Set(parsed.filter((entry): entry is TooltipKey => isTooltipKey(entry)))
      : new Set<TooltipKey>();

    return {
      seenKeys,
      pendingKeys: [],
    };
  } catch {
    return {
      seenKeys: new Set<TooltipKey>(),
      pendingKeys: [],
    };
  }
}

export function enqueueTooltipKey(
  state: TooltipQueueState,
  key: TooltipKey,
): TooltipQueueState {
  if (state.seenKeys.has(key) || state.pendingKeys.includes(key)) {
    return state;
  }

  return {
    seenKeys: state.seenKeys,
    pendingKeys: [...state.pendingKeys, key],
  };
}

export function dismissTooltipKey(
  state: TooltipQueueState,
  key: TooltipKey,
): TooltipQueueState {
  const nextSeenKeys = new Set(state.seenKeys);
  nextSeenKeys.add(key);

  return {
    seenKeys: nextSeenKeys,
    pendingKeys: state.pendingKeys.filter((entry) => entry !== key),
  };
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getInitialStateFromStorage(storage: StorageLike | undefined): TooltipQueueState {
  if (!storage) {
    return createInitialTooltipQueueState(null);
  }
  return createInitialTooltipQueueState(storage.getItem(TOOLTIP_STORAGE_KEY));
}

export function useTooltipState() {
  const [queueState, setQueueState] = useState<TooltipQueueState>(() =>
    getInitialStateFromStorage(typeof window === "undefined" ? undefined : window.localStorage),
  );

  const showTooltip = useCallback((key: TooltipKey) => {
    setQueueState((current) => enqueueTooltipKey(current, key));
  }, []);

  const dismissTooltip = useCallback((key: TooltipKey) => {
    setQueueState((current) => {
      const nextState = dismissTooltipKey(current, key);

      try {
        window.localStorage.setItem(TOOLTIP_STORAGE_KEY, serializeSeenKeys(nextState.seenKeys));
      } catch {
        // Ignore storage failures and still dismiss locally.
      }

      return nextState;
    });
  }, []);

  return useMemo(
    () => ({
      seenKeys: queueState.seenKeys,
      activeTooltipKey: queueState.pendingKeys[0] ?? null,
      pendingKeys: queueState.pendingKeys,
      showTooltip,
      dismissTooltip,
    }),
    [queueState.pendingKeys, queueState.seenKeys, showTooltip, dismissTooltip],
  );
}
