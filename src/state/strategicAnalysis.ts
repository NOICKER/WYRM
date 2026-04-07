import { actionMove } from "./gameEngine.ts";
import {
  canCommitPath,
  cloneState,
  coordKey,
  getLegalMoves,
  getMoveProfile,
  getNextPathOptions,
  sameCoord,
  SACRED_GROVE_CELLS,
} from "./gameLogic.ts";
import type { Coord, GameState, MoveMode, WyrmId } from "./types.ts";

export type DeadEndRisk = "open" | "tight" | "blocked";

export interface MoveConsequenceSummary {
  futureReachableCells: Coord[];
  futureCaptureThreats: number;
  groveReachableCount: number;
  deadEndRisk: DeadEndRisk;
  immediateVictory: boolean;
}

function createProjectionTurnEffects(wyrmId: WyrmId, moveMode: MoveMode) {
  return {
    coilChoice: null,
    flowWyrmId: null,
    windWyrmId: null,
    tempestRushRemaining: moveMode === "tempest" ? [wyrmId] : [],
    mainMoveCompleted: false,
    tileActionUsed: false,
  } as const;
}

function sortCoords(coords: Coord[]): Coord[] {
  return [...coords].sort((left, right) =>
    left.row === right.row ? left.col - right.col : left.row - right.row,
  );
}

function getProjectionState(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode,
): GameState | null {
  if (!canCommitPath(state, wyrmId, path, moveMode)) {
    return null;
  }

  const moved = actionMove(state, wyrmId, path, moveMode);
  if (moved.error || moved.winner != null) {
    return moved;
  }

  const projected = cloneState(moved);
  projected.phase = "move";
  projected.error = null;
  projected.winner = null;
  projected.winType = null;
  projected.turnEffects = {
    ...createProjectionTurnEffects(wyrmId, moveMode),
    coilChoice: state.dieResult === "coil" ? state.turnEffects.coilChoice : null,
  };

  if (moveMode === "main") {
    projected.dieResult = state.dieResult;
  }

  return projected;
}

function collectProjectedReachableCells(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode,
): Coord[] {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm?.position) {
    return [];
  }

  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!profile) {
    return [];
  }

  return getLegalMoves(state, wyrmId, moveMode);
}

function collectCommittedPathsFromPrefix(
  state: GameState,
  wyrmId: WyrmId,
  pathPrefix: Coord[],
  moveMode: MoveMode,
): Coord[][] {
  const wyrm = state.wyrms[wyrmId];
  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!wyrm?.position || !profile) {
    return [];
  }

  const workingPrefix = pathPrefix.length === 0 ? [wyrm.position] : pathPrefix;
  const committed = new Map<string, Coord[]>();

  const visit = (path: Coord[]): void => {
    if (path.length > 1 && canCommitPath(state, wyrmId, path, moveMode)) {
      committed.set(path.map(coordKey).join("|"), path.map((coord) => ({ ...coord })));
    }

    if (path.length - 1 >= profile.maxSteps) {
      return;
    }

    for (const option of getNextPathOptions(state, wyrmId, path, moveMode)) {
      const nextPath = [...path, { row: option.row, col: option.col }];
      if (option.capture) {
        if (canCommitPath(state, wyrmId, nextPath, moveMode)) {
          committed.set(nextPath.map(coordKey).join("|"), nextPath.map((coord) => ({ ...coord })));
        }
        continue;
      }
      visit(nextPath);
    }
  };

  visit(workingPrefix);

  return [...committed.values()];
}

export function findCommittedPathToDestination(
  state: GameState,
  wyrmId: WyrmId,
  pathPrefix: Coord[],
  destination: Coord,
  moveMode: MoveMode = "main",
): Coord[] | null {
  const paths = collectCommittedPathsFromPrefix(state, wyrmId, pathPrefix, moveMode);
  return paths.find((path) => sameCoord(path[path.length - 1], destination)) ?? null;
}

export function getProjectedReachableCells(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): Coord[] {
  const projectionState = getProjectionState(state, wyrmId, path, moveMode);
  if (!projectionState || projectionState.winner != null) {
    return [];
  }

  return sortCoords(collectProjectedReachableCells(projectionState, wyrmId, moveMode));
}

export function getProjectedReachableCellsFromPrefix(
  state: GameState,
  wyrmId: WyrmId,
  pathPrefix: Coord[],
  moveMode: MoveMode = "main",
): Coord[] {
  const projected = new Map<string, Coord>();

  for (const path of collectCommittedPathsFromPrefix(state, wyrmId, pathPrefix, moveMode)) {
    for (const coord of getProjectedReachableCells(state, wyrmId, path, moveMode)) {
      projected.set(coordKey(coord), coord);
    }
  }

  return sortCoords([...projected.values()]);
}

export function getMoveConsequenceSummary(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): MoveConsequenceSummary {
  const projectionState = getProjectionState(state, wyrmId, path, moveMode);
  const immediateVictory = Boolean(projectionState?.winner != null);
  const futureReachableCells =
    !projectionState || immediateVictory ? [] : collectProjectedReachableCells(projectionState, wyrmId, moveMode);

  const currentOwner = state.wyrms[wyrmId]?.currentOwner;
  const futureCaptureThreats =
    currentOwner == null || !projectionState
      ? 0
      : futureReachableCells.reduce((count, coord) => {
          const occupantId = projectionState.board[coord.row][coord.col].occupant;
          if (!occupantId) {
            return count;
          }
          const occupant = projectionState.wyrms[occupantId];
          return occupant && occupant.currentOwner !== currentOwner ? count + 1 : count;
        }, 0);
  const groveReachableCount = futureReachableCells.filter((coord) =>
    SACRED_GROVE_CELLS.some((cell) => sameCoord(cell, coord)),
  ).length;

  let deadEndRisk: DeadEndRisk = "open";
  if (futureReachableCells.length === 0) {
    deadEndRisk = "blocked";
  } else if (futureReachableCells.length <= 2) {
    deadEndRisk = "tight";
  }

  return {
    futureReachableCells: sortCoords(futureReachableCells),
    futureCaptureThreats,
    groveReachableCount,
    deadEndRisk,
    immediateVictory,
  };
}
