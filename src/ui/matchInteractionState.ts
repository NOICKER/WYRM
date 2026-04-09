import {
  canCommitPath,
  getMoveProfile,
  getNextPathOptions,
} from "../state/gameLogic.ts";
import type {
  Coord,
  MoveMode,
  PlayerId,
  StepOption,
  TilePlayRequest,
  WyrmId,
} from "../state/types.ts";
import type { GameState, RuneTileType } from "../state/types.ts";

export type InteractionState = "idle" | "wyrm_selected" | "moving" | "tile_preview";

export type TileDraft =
  | { tile: "fire"; mode: "single" | "lair" }
  | { tile: "water"; mode: "single" | "lair"; wyrmId?: WyrmId }
  | { tile: "wind"; mode: "single" | "lair"; wyrmId?: WyrmId }
  | { tile: "earth"; mode: "single" | "lair"; cells: Coord[] }
  | { tile: "shadow"; mode: "single"; wyrmIds: WyrmId[] }
  | { tile: "shadow"; mode: "lair"; wyrmId: WyrmId | null; targetCoord?: Coord | null }
  | { tile: "light"; mode: "single" | "lair"; opponentId?: PlayerId | null }
  | { tile: "void"; mode: "single"; opponentId: PlayerId | null; cells: Coord[] }
  | { tile: "void"; mode: "lair"; opponentId: PlayerId | null }
  | { tile: "serpent"; mode: "single" | "lair"; wyrmId?: WyrmId };

export interface MovementDraft {
  activeWyrmId: WyrmId;
  currentPath: Coord[];
  currentPosition: Coord;
  stepsRemaining: number;
  initialSteps: number;
  interactionState: Exclude<InteractionState, "idle" | "tile_preview">;
  moveMode: MoveMode;
  nextStepOptions: StepOption[];
  canConfirmMove: boolean;
}

export type MovementStepResult =
  | { status: "invalid"; draft: MovementDraft }
  | { status: "updated"; draft: MovementDraft }
  | { status: "committed"; draft: null; pathToCommit: Coord[] };

function buildMovementDraft(
  state: GameState,
  wyrmId: WyrmId,
  currentPath: Coord[],
  moveMode: MoveMode,
): MovementDraft | null {
  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!profile) {
    return null;
  }

  const currentPosition = currentPath[currentPath.length - 1];
  if (!currentPosition) {
    return null;
  }

  const stepsUsed = Math.max(0, currentPath.length - 1);
  const stepsRemaining = Math.max(0, profile.maxSteps - stepsUsed);

  return {
    activeWyrmId: wyrmId,
    currentPath: currentPath.map((coord) => ({ ...coord })),
    currentPosition: { ...currentPosition },
    stepsRemaining,
    initialSteps: profile.maxSteps,
    interactionState: stepsUsed === 0 ? "wyrm_selected" : "moving",
    moveMode,
    nextStepOptions: getNextPathOptions(state, wyrmId, currentPath, moveMode),
    canConfirmMove: stepsUsed > 0 && canCommitPath(state, wyrmId, currentPath, moveMode),
  };
}

export function rebuildMovementDraft(
  state: GameState,
  wyrmId: WyrmId,
  currentPath: Coord[],
  moveMode: MoveMode = "main",
): MovementDraft | null {
  return buildMovementDraft(state, wyrmId, currentPath, moveMode);
}

export function createMovementDraft(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode = "main",
): MovementDraft | null {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm?.position) {
    return null;
  }

  return buildMovementDraft(state, wyrmId, [{ ...wyrm.position }], moveMode);
}

export function stepMovementDraft(
  state: GameState,
  draft: MovementDraft,
  coord: Coord,
): MovementStepResult {
  const option = draft.nextStepOptions.find((entry) => entry.row === coord.row && entry.col === coord.col);
  if (!option) {
    return { status: "invalid", draft };
  }

  const nextPath = [...draft.currentPath, { row: coord.row, col: coord.col }];
  const profile = getMoveProfile(state, draft.activeWyrmId, draft.moveMode);
  if (!profile) {
    return { status: "invalid", draft };
  }

  const stepsRemaining = Math.max(0, profile.maxSteps - (nextPath.length - 1));
  if (option.capture || (stepsRemaining === 0 && canCommitPath(state, draft.activeWyrmId, nextPath, draft.moveMode))) {
    return {
      status: "committed",
      draft: null,
      pathToCommit: nextPath,
    };
  }

  const nextDraft = buildMovementDraft(state, draft.activeWyrmId, nextPath, draft.moveMode);
  if (!nextDraft) {
    return { status: "invalid", draft };
  }

  return { status: "updated", draft: nextDraft };
}

export function cancelMovementDraft(
  state: GameState,
  draft: MovementDraft,
): MovementDraft {
  const wyrm = state.wyrms[draft.activeWyrmId];
  if (!wyrm?.position) {
    return draft;
  }

  return buildMovementDraft(state, draft.activeWyrmId, [{ ...wyrm.position }], draft.moveMode) ?? draft;
}

export function isTileDraftReady(tileDraft: TileDraft | null): boolean {
  if (!tileDraft) {
    return false;
  }

  switch (tileDraft.tile) {
    case "fire":
      return true;
    case "water":
      return tileDraft.mode === "lair" || typeof tileDraft.wyrmId === "string";
    case "wind":
      return tileDraft.mode === "lair" || typeof tileDraft.wyrmId === "string";
    case "serpent":
      return typeof tileDraft.wyrmId === "string";
    case "earth":
      return tileDraft.cells.length === (tileDraft.mode === "lair" ? 3 : 1);
    case "shadow":
      return tileDraft.mode === "single"
        ? tileDraft.wyrmIds.length === 2
        : tileDraft.wyrmId != null && tileDraft.targetCoord != null;
    case "light":
      return tileDraft.opponentId != null;
    case "void":
      return tileDraft.mode === "single"
        ? tileDraft.opponentId != null && tileDraft.cells.length > 0
        : tileDraft.opponentId != null;
    default:
      return false;
  }
}

export function buildTilePlayRequestFromDraft(
  tileDraft: TileDraft | null,
): TilePlayRequest | null {
  if (!tileDraft || !isTileDraftReady(tileDraft)) {
    return null;
  }

  switch (tileDraft.tile) {
    case "fire":
      return { mode: tileDraft.mode, tile: "fire" };
    case "water":
      if (tileDraft.mode === "lair") {
        return { mode: "lair", tile: "water" };
      }
      return tileDraft.wyrmId ? { mode: "single", tile: "water", wyrmId: tileDraft.wyrmId } : null;
    case "wind":
      if (tileDraft.mode === "lair") {
        return { mode: "lair", tile: "wind" };
      }
      return tileDraft.wyrmId ? { mode: "single", tile: "wind", wyrmId: tileDraft.wyrmId } : null;
    case "earth":
      return { mode: tileDraft.mode, tile: "earth", targetCoords: tileDraft.cells };
    case "shadow":
      if (tileDraft.mode === "single") {
        return tileDraft.wyrmIds.length === 2
          ? { mode: "single", tile: "shadow", swapWyrmIds: [tileDraft.wyrmIds[0], tileDraft.wyrmIds[1]] }
          : null;
      }
      return tileDraft.wyrmId && tileDraft.targetCoord
        ? {
            mode: "lair",
            tile: "shadow",
            teleportWyrmId: tileDraft.wyrmId,
            targetCoords: [tileDraft.targetCoord],
          }
        : null;
    case "light":
      return tileDraft.opponentId != null
        ? { mode: tileDraft.mode, tile: "light", opponentId: tileDraft.opponentId }
        : null;
    case "void":
      if (tileDraft.mode === "single") {
        return tileDraft.opponentId != null
          ? {
              mode: "single",
              tile: "void",
              opponentId: tileDraft.opponentId,
              targetCoords: tileDraft.cells,
            }
          : null;
      }
      return tileDraft.opponentId != null
        ? { mode: "lair", tile: "void", opponentId: tileDraft.opponentId }
        : null;
    case "serpent":
      return tileDraft.wyrmId ? { mode: tileDraft.mode, tile: "serpent", wyrmId: tileDraft.wyrmId } : null;
    default:
      return null;
  }
}

export function isInteractionLocked({
  interactionState,
  tileDraft,
  deployWyrmId,
  trailWyrmId,
}: {
  interactionState: InteractionState;
  tileDraft: TileDraft | null;
  deployWyrmId: WyrmId | null;
  trailWyrmId: WyrmId | null;
}): boolean {
  return (
    interactionState === "moving"
    || interactionState === "tile_preview"
    || tileDraft != null
    || deployWyrmId != null
    || trailWyrmId != null
  );
}

export function isPreMoveRune(tile: RuneTileType): boolean {
  return tile === "water" || tile === "wind";
}
