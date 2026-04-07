import assert from "node:assert/strict";

import { actionMove } from "../src/state/gameEngine.ts";
import { createInitialState } from "../src/state/gameLogic.ts";
import {
  getMoveConsequenceSummary,
  getProjectedReachableCellsFromPrefix,
} from "../src/state/strategicAnalysis.ts";
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

function keys(coords: Coord[]): string[] {
  return coords
    .map((coord) => `${coord.row},${coord.col}`)
    .sort();
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  const enemy = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, enemy, { row: 4, col: 6 });

  const summary = getMoveConsequenceSummary(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);

  assert.equal(
    summary.futureCaptureThreats,
    1,
    "move consequence hints should count captures the hovered move can threaten on the next turn",
  );
  assert.equal(summary.deadEndRisk, "open", "capture pressure setups should stay marked as viable when lanes remain open");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  const enemySource = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  state.board[3][5].hasWall = true;
  state.board[4][6].hasWall = true;
  state.board[5][5].hasWall = true;
  setTrail(state, { row: 3, col: 4 }, 4, enemySource, 1, 4);
  setTrail(state, { row: 5, col: 4 }, 4, enemySource, 1, 4);

  const summary = getMoveConsequenceSummary(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);

  assert.equal(
    summary.deadEndRisk,
    "blocked",
    "move consequence hints should warn when the hovered destination strands the wyrm in a blocked pocket",
  );
  assert.equal(summary.futureReachableCells.length, 0, "blocked destinations should not advertise next-turn projection cells");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  const projected = getProjectedReachableCellsFromPrefix(state, mover, [{ row: 4, col: 4 }]);

  assert.deepEqual(
    keys(projected),
    [
      "2,4",
      "3,3",
      "3,5",
      "4,2",
      "4,6",
      "5,3",
      "5,5",
      "6,4",
    ],
    "selecting a wyrm should expose a light one-turn projection of where it can pressure next after a legal move",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [groveHolder, mover] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, groveHolder, { row: 5, col: 5 });
  activateWyrm(state, mover, { row: 4, col: 6 });

  const summary = getMoveConsequenceSummary(state, mover, [
    { row: 4, col: 6 },
    { row: 5, col: 6 },
  ]);
  const moved = actionMove(state, mover, [
    { row: 4, col: 6 },
    { row: 5, col: 6 },
  ]);

  assert.equal(summary.immediateVictory, true, "winning paths should be identified immediately in the move hint summary");
  assert.equal(moved.winner, 1, "the test fixture should still represent a valid grove-winning move");
}

console.log("Strategic analysis test suite passed.");
