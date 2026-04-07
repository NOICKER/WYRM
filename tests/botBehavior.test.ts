import assert from "node:assert/strict";

import { chooseBotAction } from "../src/state/botEngine.ts";
import { createInitialState } from "../src/state/gameLogic.ts";
import type { Coord, DieResult, GameState, PlayerId, WyrmId } from "../src/state/types.ts";

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
  state.dieResult = 1;
  state.winner = null;
  state.winType = null;
  state.error = null;
  state.log = [];
  resetTurnEffects(state);
}

function setMoveContext(state: GameState, dieResult: DieResult): void {
  state.phase = "move";
  state.dieResult = dieResult;
  state.winner = null;
  state.winType = null;
  state.error = null;
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

function setTrail(
  state: GameState,
  coord: Coord,
  owner: PlayerId,
  sourceWyrmId: WyrmId,
  placedRound: number,
  expiresAfterRound: number,
): void {
  state.board[coord.row][coord.col].trail = {
    owner,
    sourceWyrmId,
    placedRound,
    expiresAfterRound,
  };
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [hunter] = getOriginalWyrmIds(state, 1);
  const [enemy] = getOriginalWyrmIds(state, 4);
  activateWyrm(state, hunter, { row: 4, col: 4 });
  activateWyrm(state, enemy, { row: 4, col: 5 });

  const action = chooseBotAction(state, "hardest");

  assert.deepEqual(
    action,
    {
      type: "move",
      wyrmId: hunter,
      path: [
        { row: 4, col: 4 },
        { row: 4, col: 5 },
      ],
      moveMode: "main",
    },
    "the hardest bot should prioritize an immediate capture when one is available",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [mover] = getOriginalWyrmIds(state, 1);
  const enemySource = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  state.board[3][5].hasWall = true;
  state.board[4][6].hasWall = true;
  state.board[5][5].hasWall = true;
  setTrail(state, { row: 3, col: 4 }, 4, enemySource, 1, 4);
  setTrail(state, { row: 5, col: 4 }, 4, enemySource, 1, 4);

  const action = chooseBotAction(state, "hardest");

  assert.deepEqual(
    action,
    {
      type: "move",
      wyrmId: mover,
      path: [
        { row: 4, col: 4 },
        { row: 4, col: 3 },
      ],
      moveMode: "main",
    },
    "the hardest bot should avoid stepping into a dead end when an open lane is available",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [mover] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, mover, { row: 4, col: 5 });

  const action = chooseBotAction(state, "hardest");

  assert.deepEqual(
    action,
    {
      type: "move",
      wyrmId: mover,
      path: [
        { row: 4, col: 5 },
        { row: 5, col: 5 },
      ],
      moveMode: "main",
    },
    "the hardest bot should lean toward Sacred Grove pressure when the center is available",
  );
}

console.log("Bot behavior test suite passed.");
