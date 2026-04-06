import type { GameState } from "../state/types.ts";
import { getPhaseLabel } from "../ui/appModel.ts";
import type { AssemblyRoom } from "../ui/appModel.ts";

export function getDisconnectedSeatLabel(disconnectedSeatName: string | null): string {
  const trimmedName = disconnectedSeatName?.trim();
  return trimmedName ? trimmedName : "Opponent";
}

export function createReconnectDeadlineTimestamp(startTime: number, reconnectDeadlineMinutes: number): number {
  return startTime + reconnectDeadlineMinutes * 60 * 1000;
}

export function getReconnectMinutesRemaining(deadlineTimestamp: number, nowTime: number): number {
  return Math.max(0, Math.ceil((deadlineTimestamp - nowTime) / (60 * 1000)));
}

export function getMatchPhaseDisplayLabel(
  matchStatus: AssemblyRoom["matchStatus"],
  phase: GameState["phase"],
): string {
  return matchStatus === "paused_disconnected" ? "PAUSED" : getPhaseLabel(phase);
}

export function shouldShowPauseOverlay(
  matchStatus: AssemblyRoom["matchStatus"],
  overlayDismissed: boolean,
): boolean {
  return matchStatus === "paused_disconnected" && !overlayDismissed;
}
