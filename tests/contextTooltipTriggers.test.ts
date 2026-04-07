import assert from "node:assert/strict";

import { createInitialState, cloneState } from "../src/state/gameLogic.ts";
import type { GameState, PlayerId, StepOption, WyrmId } from "../src/state/types.ts";
import { getContextTooltipTriggers } from "../src/components/contextTooltipTriggerModel.ts";

function createMoveTarget(row: number, col: number, capture = false): StepOption {
  return {
    row,
    col,
    capture,
    terminal: true,
  };
}

function createSnapshot(
  state: GameState,
  overrides?: Partial<{
    moveTargets: StepOption[];
    hoardChoicesCount: number;
    lairTile: GameState["players"][number]["hand"][number] | null;
    viewerPlayerId: 1 | 2 | 3 | 4 | null;
  }>,
) {
  return {
    state,
    moveTargets: overrides?.moveTargets ?? [],
    hoardChoicesCount: overrides?.hoardChoicesCount ?? 0,
    lairTile: overrides?.lairTile ?? null,
    viewerPlayerId: overrides?.viewerPlayerId ?? 1,
  };
}

function getPlayerWyrmIds(state: GameState, playerId: PlayerId): WyrmId[] {
  return Object.values(state.wyrms)
    .filter((wyrm) => wyrm.originalOwner === playerId)
    .map((wyrm) => wyrm.id);
}

function clearBoardOccupants(state: GameState): void {
  for (const row of state.board) {
    for (const cell of row) {
      cell.occupant = null;
      cell.trail = null;
      cell.hasWall = false;
      cell.hasPowerRune = false;
    }
  }

  for (const wyrm of Object.values(state.wyrms)) {
    wyrm.position = null;
    wyrm.status = "in_hoard";
    wyrm.prevPosition = null;
  }
}

function relocateWyrm(state: GameState, wyrmId: WyrmId, row: number, col: number): void {
  const wyrm = state.wyrms[wyrmId];
  if (wyrm.position) {
    state.board[wyrm.position.row][wyrm.position.col].occupant = null;
  }
  wyrm.position = { row, col };
  wyrm.status = "active";
  state.board[row][col].occupant = wyrmId;
}

{
  const previous = createInitialState(2);
  const current = cloneState(previous);
  current.board[3][3].trail = {
    owner: 1,
    sourceWyrmId: "p1_w1",
    placedRound: 1,
    expiresAfterRound: 6,
  };

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current),
    isLocalTurn: true,
  });

  assert.deepEqual(
    keys,
    ["trail_created"],
    "the first visible trail for the local player should trigger the trail tooltip",
  );
}

{
  const previous = createInitialState(2);
  const current = cloneState(previous);
  current.phase = "move";
  current.dieResult = "coil";

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current, {
      moveTargets: [createMoveTarget(5, 5), createMoveTarget(4, 4, true)],
      hoardChoicesCount: 2,
      lairTile: "fire",
    }),
    isLocalTurn: true,
  });

  assert.deepEqual(
    keys,
    [
      "sacred_grove_nearby",
      "lair_power_available",
      "coil_choice",
      "capture_available",
      "hoard_deploy_available",
    ],
    "simultaneous tooltip triggers should be queued in the designed priority order",
  );
}

{
  const previous = createInitialState(2);
  const current = cloneState(previous);
  current.wyrms.p1_w1.isElder = true;

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current),
    isLocalTurn: true,
  });

  assert.deepEqual(
    keys,
    ["elder_promotion"],
    "new elder promotions should trigger once when a local player's wyrm ascends",
  );
}

{
  const previous = createInitialState(2);
  const current = cloneState(previous);
  current.phase = "move";
  current.dieResult = "coil";
  current.board[3][3].trail = {
    owner: 1,
    sourceWyrmId: "p1_w1",
    placedRound: 1,
    expiresAfterRound: 6,
  };
  current.wyrms.p1_w1.isElder = true;

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current, {
      moveTargets: [createMoveTarget(5, 5), createMoveTarget(4, 4, true)],
      hoardChoicesCount: 2,
      lairTile: "fire",
    }),
    isLocalTurn: false,
  });

  assert.deepEqual(
    keys,
    [],
    "context tooltips should stay quiet when it is not the local player's turn",
  );
}

{
  const previous = createInitialState(2);
  const current = createInitialState(2);
  clearBoardOccupants(current);
  current.phase = "move";
  current.dieResult = 1;

  const [blockedWyrm] = getPlayerWyrmIds(current, 1);
  if (!blockedWyrm) {
    throw new Error("expected a blocked wyrm");
  }

  relocateWyrm(current, blockedWyrm, 4, 4);
  current.wyrms[blockedWyrm].prevPosition = { row: 4, col: 3 };
  current.board[3][4].trail = {
    owner: 2,
    sourceWyrmId: "p4_w1",
    placedRound: 1,
    expiresAfterRound: 4,
  };
  current.board[5][4].hasWall = true;
  current.board[4][5].hasWall = true;

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current),
    isLocalTurn: true,
  });

  assert.deepEqual(
    keys,
    ["blocked_move_available"],
    "players should get a dedicated tooltip when their only legal resolution is the forced blocked-move trail placement",
  );
}

{
  const previous = createInitialState(2);
  const current = cloneState(previous);
  current.phase = "play_tile";
  current.turnEffects.mainMoveCompleted = true;

  const keys = getContextTooltipTriggers({
    previous: createSnapshot(previous),
    current: createSnapshot(current, { hoardChoicesCount: 2 }),
    isLocalTurn: true,
  });

  assert.deepEqual(
    keys,
    [],
    "deploy tooltips should stay quiet once the main move is already spent for the turn",
  );
}

console.log("Context tooltip trigger test suite passed.");
