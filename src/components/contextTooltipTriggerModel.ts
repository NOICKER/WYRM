import type { RuneTileType, GameState, PlayerId, StepOption, Wyrm } from "../state/types.ts";
import type { TooltipKey } from "../state/useTooltipState.ts";

export interface ContextTooltipTriggerSnapshot {
  state: GameState;
  moveTargets: StepOption[];
  hoardChoicesCount: number;
  lairTile: RuneTileType | null;
  viewerPlayerId: PlayerId | null;
}

export interface ContextTooltipTriggerInput {
  previous: ContextTooltipTriggerSnapshot | null;
  current: ContextTooltipTriggerSnapshot;
  isLocalTurn: boolean;
}

function countPlayerTrails(state: GameState, playerId: PlayerId): number {
  return state.board.flat().reduce((count, cell) => count + (cell.trail?.owner === playerId ? 1 : 0), 0);
}

function getOwnedWyrms(state: GameState, playerId: PlayerId): Wyrm[] {
  return Object.values(state.wyrms).filter((wyrm) => wyrm.currentOwner === playerId);
}

function isSacredGroveTarget(state: GameState, option: StepOption): boolean {
  return state.board[option.row]?.[option.col]?.type === "grove";
}

function hasElderPromotion(previous: GameState | null, current: GameState, playerId: PlayerId): boolean {
  return getOwnedWyrms(current, playerId).some((wyrm) => {
    if (!wyrm.isElder) {
      return false;
    }
    const previousWyrm = previous?.wyrms[wyrm.id];
    return previousWyrm?.isElder !== true;
  });
}

function isCoilChoiceActive(state: GameState): boolean {
  return state.phase === "move" && state.dieResult === "coil" && state.turnEffects.coilChoice == null;
}

function hasHoardDeployOpportunity(snapshot: ContextTooltipTriggerSnapshot): boolean {
  return snapshot.hoardChoicesCount > 0 && snapshot.state.phase === "move";
}

export function getContextTooltipTriggers({
  previous,
  current,
  isLocalTurn,
}: ContextTooltipTriggerInput): TooltipKey[] {
  const viewerPlayerId = current.viewerPlayerId;
  if (!isLocalTurn || viewerPlayerId == null) {
    return [];
  }

  const previousState = previous?.state ?? null;
  const previousTrailCount = previousState ? countPlayerTrails(previousState, viewerPlayerId) : 0;
  const currentTrailCount = countPlayerTrails(current.state, viewerPlayerId);
  const previousSacredGroveNearby = previous?.moveTargets.some((option) => isSacredGroveTarget(previous.state, option)) ?? false;
  const currentSacredGroveNearby = current.moveTargets.some((option) => isSacredGroveTarget(current.state, option));
  const previousLairTile = previous?.lairTile ?? null;
  const previousCoilChoiceActive = previous ? isCoilChoiceActive(previous.state) : false;
  const currentCoilChoiceActive = isCoilChoiceActive(current.state);
  const previousCaptureAvailable = previous?.moveTargets.some((option) => option.capture) ?? false;
  const currentCaptureAvailable = current.moveTargets.some((option) => option.capture);
  const previousHoardDeployAvailable = previous ? hasHoardDeployOpportunity(previous) : false;
  const currentHoardDeployAvailable = hasHoardDeployOpportunity(current);

  const triggeredKeys: TooltipKey[] = [];

  if (previousTrailCount === 0 && currentTrailCount > 0) {
    triggeredKeys.push("trail_created");
  }

  if (!previousSacredGroveNearby && currentSacredGroveNearby) {
    triggeredKeys.push("sacred_grove_nearby");
  }

  if (hasElderPromotion(previousState, current.state, viewerPlayerId)) {
    triggeredKeys.push("elder_promotion");
  }

  if (previousLairTile == null && current.lairTile != null) {
    triggeredKeys.push("lair_power_available");
  }

  if (!previousCoilChoiceActive && currentCoilChoiceActive) {
    triggeredKeys.push("coil_choice");
  }

  if (!previousCaptureAvailable && currentCaptureAvailable) {
    triggeredKeys.push("capture_available");
  }

  if (!previousHoardDeployAvailable && currentHoardDeployAvailable) {
    triggeredKeys.push("hoard_deploy_available");
  }

  return triggeredKeys;
}
