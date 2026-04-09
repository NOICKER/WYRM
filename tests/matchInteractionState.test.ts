import assert from "node:assert/strict";

import { createInitialState } from "../src/state/gameLogic.ts";
import type { Coord, GameState, PlayerId, WyrmId } from "../src/state/types.ts";
import {
  buildTilePlayRequestFromDraft,
  cancelMovementDraft,
  createMovementDraft,
  isInteractionLocked,
  isTileDraftReady,
  stepMovementDraft,
  type TileDraft,
} from "../src/ui/matchInteractionState.ts";

function resetTurnEffects(state: GameState): void {
  state.turnEffects = {
    coilChoice: null,
    flowWyrmId: null,
    windWyrmId: null,
    tempestRushRemaining: [],
    mainMoveCompleted: false,
    tileActionUsed: false,
  };
}

function clearBoard(state: GameState): void {
  for (const row of state.board) {
    for (const cell of row) {
      cell.occupant = null;
      cell.trail = null;
      cell.hasWall = false;
      cell.hasPowerRune = false;
    }
  }

  for (const player of state.players) {
    player.hoard = [];
    player.floodPathTurnsRemaining = 0;
    player.skipTurnsRemaining = 0;
    player.nextDrawCount = 1;
  }

  for (const wyrm of Object.values(state.wyrms)) {
    wyrm.currentOwner = wyrm.originalOwner;
    wyrm.isElder = false;
    wyrm.position = null;
    wyrm.status = "in_hoard";
    wyrm.prevPosition = null;
    wyrm.serpentBoostTurnsRemaining = 0;
  }

  state.currentPlayerIndex = 0;
  state.currentRound = 1;
  state.turnNumber = 1;
  state.phase = "move";
  state.dieResult = 3;
  state.winner = null;
  state.winType = null;
  state.error = null;
  state.log = [];
  resetTurnEffects(state);
}

function getOriginalWyrmIds(state: GameState, playerId: PlayerId): WyrmId[] {
  return Object.values(state.wyrms)
    .filter((wyrm) => wyrm.originalOwner === playerId)
    .map((wyrm) => wyrm.id);
}

function activateWyrm(state: GameState, wyrmId: WyrmId, coord: Coord, owner?: PlayerId): void {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm) {
    throw new Error(`Unknown wyrm ${wyrmId}`);
  }

  if (wyrm.position) {
    state.board[wyrm.position.row][wyrm.position.col].occupant = null;
  }

  wyrm.position = { ...coord };
  wyrm.status = "active";
  wyrm.prevPosition = null;
  wyrm.currentOwner = owner ?? wyrm.currentOwner;
  state.board[coord.row][coord.col].occupant = wyrmId;
}

function coordKeys(coords: Coord[]): string[] {
  return coords.map((coord) => `${coord.row},${coord.col}`).sort();
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  const draft = createMovementDraft(state, mover, "main");

  assert.ok(draft, "selecting a movable wyrm should create a movement draft");
  assert.equal(draft?.interactionState, "wyrm_selected", "the first click should enter wyrm_selected before any steps are taken");
  assert.equal(draft?.stepsRemaining, 3, "the draft should track the exact remaining steps from the die result");
  assert.deepEqual(
    draft?.currentPosition,
    { row: 4, col: 4 },
    "the movement draft should expose the wyrm's live render position even before any steps are taken",
  );
  assert.deepEqual(
    coordKeys(draft?.nextStepOptions ?? []),
    ["3,4", "4,3", "4,5", "5,4"],
    "movement guidance should highlight only the next adjacent cells, not every final destination",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  const draft = createMovementDraft(state, mover, "main");
  if (!draft) {
    throw new Error("expected a movement draft");
  }

  const next = stepMovementDraft(state, draft, { row: 4, col: 5 });

  assert.equal(next.status, "updated", "a valid adjacent click should extend the current path");
  assert.equal(next.draft?.interactionState, "moving", "taking the first step should lock the interaction into moving");
  assert.equal(next.draft?.stepsRemaining, 2, "each appended step should decrement the remaining count");
  assert.deepEqual(
    next.draft?.currentPosition,
    { row: 4, col: 5 },
    "after each step, the movement draft should advance the live position to the end of the current path",
  );
  assert.deepEqual(
    coordKeys(next.draft?.nextStepOptions ?? []),
    ["3,5", "4,6", "5,5"],
    "the next-step options should stay local and should not allow reversing through the path",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  const draft = createMovementDraft(state, mover, "main");
  if (!draft) {
    throw new Error("expected a movement draft");
  }

  const invalid = stepMovementDraft(state, draft, { row: 4, col: 6 });

  assert.equal(invalid.status, "invalid", "non-adjacent clicks should be rejected by the movement state machine");
  assert.deepEqual(
    invalid.draft,
    draft,
    "invalid clicks should leave the existing movement draft untouched",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.dieResult = 1;

  const mover = getOriginalWyrmIds(state, 1)[0];
  const enemy = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, enemy, { row: 4, col: 5 }, 4);

  const draft = createMovementDraft(state, mover, "main");
  if (!draft) {
    throw new Error("expected a movement draft");
  }

  const committed = stepMovementDraft(state, draft, { row: 4, col: 5 });

  assert.equal(committed.status, "committed", "the last required step should auto-commit instead of waiting for a second click");
  assert.deepEqual(
    committed.pathToCommit,
    [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ],
    "terminal capture paths should still be committed through the same step-by-step flow",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  const draft = createMovementDraft(state, mover, "main");
  if (!draft) {
    throw new Error("expected a movement draft");
  }

  const advanced = stepMovementDraft(state, draft, { row: 4, col: 5 });
  if (!advanced.draft) {
    throw new Error("expected the draft to remain active after the first step");
  }

  const cancelled = cancelMovementDraft(state, advanced.draft);

  assert.equal(cancelled.interactionState, "wyrm_selected", "cancel should return the player to wyrm selection instead of clearing the whole turn context");
  assert.deepEqual(cancelled.currentPath, [{ row: 4, col: 4 }], "cancel should reset the path back to the selected wyrm's current cell");
  assert.deepEqual(cancelled.currentPosition, { row: 4, col: 4 }, "cancel should also rewind the live position back to the wyrm's engine cell");
  assert.equal(cancelled.stepsRemaining, 3, "cancel should restore the original remaining step count");
}

{
  const fireDraft: TileDraft = { tile: "fire", mode: "single" };
  const shadowDraft: TileDraft = { tile: "shadow", mode: "single", wyrmIds: ["p1_w1"] };
  const shadowReadyDraft: TileDraft = { tile: "shadow", mode: "single", wyrmIds: ["p1_w1", "p1_w2"] };
  const voidDraft: TileDraft = {
    tile: "void",
    mode: "single",
    opponentId: 4,
    cells: [{ row: 3, col: 3 }, { row: 3, col: 4 }],
  };

  assert.equal(isTileDraftReady(fireDraft), true, "fire should enter preview mode already ready for confirmation");
  assert.equal(isTileDraftReady(shadowDraft), false, "shadow swap should wait until both wyrms have been chosen");
  assert.equal(isTileDraftReady(shadowReadyDraft), true, "shadow swap should become confirmable only after the second wyrm is selected");
  assert.equal(isTileDraftReady(voidDraft), true, "void single should become confirmable only after both the opponent and target trails are chosen");

  assert.equal(
    buildTilePlayRequestFromDraft(shadowDraft),
    null,
    "building a tile request too early should fail instead of firing immediately",
  );
  assert.deepEqual(
    buildTilePlayRequestFromDraft(shadowReadyDraft),
    {
      mode: "single",
      tile: "shadow",
      swapWyrmIds: ["p1_w1", "p1_w2"],
    },
    "once the preview is ready, confirmation should translate it into a real engine request",
  );
  assert.deepEqual(
    buildTilePlayRequestFromDraft(voidDraft),
    {
      mode: "single",
      tile: "void",
      opponentId: 4,
      targetCoords: [{ row: 3, col: 3 }, { row: 3, col: 4 }],
    },
    "void preview state should build a stable request only on confirm",
  );
}

{
  assert.equal(
    isInteractionLocked({ interactionState: "moving", tileDraft: null, deployWyrmId: null, trailWyrmId: null }),
    true,
    "movement should lock unrelated interaction immediately after the first step is committed into the draft",
  );
  assert.equal(
    isInteractionLocked({ interactionState: "tile_preview", tileDraft: null, deployWyrmId: null, trailWyrmId: null }),
    true,
    "tile preview mode should also lock unrelated interaction even before a board target has been chosen",
  );
  assert.equal(
    isInteractionLocked({ interactionState: "idle", tileDraft: { tile: "fire", mode: "single" }, deployWyrmId: null, trailWyrmId: null }),
    true,
    "tile preview should lock background interaction until the effect is confirmed or canceled",
  );
  assert.equal(
    isInteractionLocked({ interactionState: "idle", tileDraft: null, deployWyrmId: null, trailWyrmId: null }),
    false,
    "idle turns should leave normal board and hand interaction available",
  );
}

console.log("Match interaction state test suite passed.");
