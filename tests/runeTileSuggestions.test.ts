import assert from "node:assert/strict";

import { createInitialState } from "../src/state/gameLogic.ts";
import { getTileSelectionSuggestion } from "../src/ui/matchInteractionModel.ts";
import type { Coord, GameState, PlayerId, WyrmId } from "../src/state/types.ts";

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
  state.phase = "play_tile";
  state.dieResult = 1;
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

  const [mover] = getOriginalWyrmIds(state, 1);
  const enemySource = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  state.board[3][4].hasWall = true;
  state.board[4][5].hasWall = true;
  state.board[5][4].hasWall = true;
  setTrail(state, { row: 4, col: 3 }, 4, enemySource, 1, 4);

  const suggestion = getTileSelectionSuggestion(state, { tile: "shadow", mode: "single", wyrmIds: [] });

  assert.equal(suggestion, "Useful when trapped", "shadow previews should call out when the player is boxed in");
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const [mover] = getOriginalWyrmIds(state, 1);
  const enemySource = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  setTrail(state, { row: 4, col: 5 }, 4, enemySource, 1, 4);
  setTrail(state, { row: 4, col: 6 }, 4, enemySource, 1, 4);

  const suggestion = getTileSelectionSuggestion(state, { tile: "water", mode: "single" });

  assert.equal(suggestion, "Good for escaping trails", "flow previews should explain when the tile opens clogged lanes");
}

console.log("Rune tile suggestion test suite passed.");
