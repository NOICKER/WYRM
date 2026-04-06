import assert from "node:assert/strict";

import { createInitialState, cloneState } from "../src/state/gameLogic.ts";
import type { GameState, StepOption } from "../src/state/types.ts";
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

console.log("Context tooltip trigger test suite passed.");
