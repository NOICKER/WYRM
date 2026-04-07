import assert from "node:assert/strict";

import * as gameEngine from "../src/state/gameEngine.ts";
import * as gameLogic from "../src/state/gameLogic.ts";
import type { Coord, DieResult, GameState, PlayerId, Wyrm, WyrmId } from "../src/state/types.ts";

type GetLegalMoves = (state: GameState, wyrmId: WyrmId, moveMode?: "main" | "tempest") => Coord[];
type PlaceTrails = (state: GameState, wyrm: Wyrm, path: Coord[]) => void;
type ExpireTrails = (state: GameState) => void;

assert.equal(typeof gameLogic.getLegalMoves, "function", "game logic should expose getLegalMoves for pure rules testing");
assert.equal(typeof gameEngine.placeTrails, "function", "game engine should expose placeTrails for pure trail rules testing");
assert.equal(typeof gameEngine.expireTrails, "function", "game engine should expose expireTrails for pure trail expiry testing");

const { createInitialState, canResolveBlockedMove } = gameLogic;
const { actionMove, checkVictory } = gameEngine;
const getLegalMoves = gameLogic.getLegalMoves as GetLegalMoves;
const placeTrails = gameEngine.placeTrails as PlaceTrails;
const expireTrails = gameEngine.expireTrails as ExpireTrails;

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
  setMoveContext(state, 2);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });

  assert.deepEqual(
    keys(getLegalMoves(state, mover)),
    ["2,4", "3,3", "3,5", "4,2", "4,6", "5,3", "5,5", "6,4"],
    "getLegalMoves should return every exact-distance destination and no shorter endpoints",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 2);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  setTrail(state, { row: 4, col: 5 }, 4, getOriginalWyrmIds(state, 4)[0], 1, 4);

  assert.ok(
    !keys(getLegalMoves(state, mover)).includes("4,6"),
    "getLegalMoves should reject destinations whose only route passes through a trail cell",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  setTrail(state, { row: 4, col: 5 }, 4, getOriginalWyrmIds(state, 4)[0], 1, 4);

  assert.ok(
    !keys(getLegalMoves(state, mover)).includes("4,5"),
    "getLegalMoves should not allow a wyrm to end on a trail cell",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 2);

  const [mover, blocker] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, blocker, { row: 4, col: 5 });

  assert.ok(
    !keys(getLegalMoves(state, mover)).includes("4,6"),
    "getLegalMoves should not route through a friendly wyrm",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [mover, blocker] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, blocker, { row: 4, col: 5 });

  assert.ok(
    !keys(getLegalMoves(state, mover)).includes("4,5"),
    "getLegalMoves should not allow ending on a friendly wyrm",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  const enemy = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, enemy, { row: 4, col: 5 });

  assert.ok(
    keys(getLegalMoves(state, mover)).includes("4,5"),
    "getLegalMoves should allow capturing an enemy only when the enemy is on the final cell",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 2);

  const mover = getOriginalWyrmIds(state, 1)[0];
  const enemy = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, enemy, { row: 4, col: 5 });

  assert.ok(
    !keys(getLegalMoves(state, mover)).includes("4,6"),
    "getLegalMoves should not pass through an enemy wyrm before the final step",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  activateWyrm(state, mover, { row: 4, col: 4 });
  state.wyrms[mover].prevPosition = { row: 4, col: 5 };

  const legal = keys(getLegalMoves(state, mover));
  assert.ok(!legal.includes("4,5"), "getLegalMoves should enforce the no-reversal rule against the previous cell");
  assert.deepEqual(legal, ["3,4", "4,3", "5,4"], "only the non-reversing adjacent moves should remain legal");
}

{
  for (const choice of [1, 2, 3] as const) {
    const state = createInitialState(2);
    clearBoard(state);
    setMoveContext(state, "coil");

    const mover = getOriginalWyrmIds(state, 1)[0];
    activateWyrm(state, mover, { row: 4, col: 4 });
    state.wyrms[mover].prevPosition = { row: 4, col: 3 };
    state.turnEffects.coilChoice = choice;

    setTrail(state, { row: 3, col: 4 }, 4, getOriginalWyrmIds(state, 4)[0], 1, 4);
    state.board[5][4].hasWall = true;
    state.board[4][5].hasWall = true;

    assert.deepEqual(
      getLegalMoves(state, mover),
      [],
      `getLegalMoves should return no destinations when a Coil choice of ${choice} still leaves the wyrm fully boxed in`,
    );
    assert.equal(
      canResolveBlockedMove(state),
      true,
      "blocked Coil states with no legal moves should fall through to the forced trail-placement resolution",
    );
  }
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 2;

  const mover = state.wyrms[getOriginalWyrmIds(state, 1)[0]];
  mover.currentOwner = 1;

  placeTrails(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 5, col: 5 },
    { row: 5, col: 6 },
  ]);

  assert.deepEqual(
    [
      state.board[4][4].trail?.owner,
      state.board[4][5].trail?.owner,
      state.board[5][5].trail?.owner,
      state.board[5][6].trail,
    ],
    [1, 1, 1, null],
    "placeTrails should mark every vacated cell and never the final destination",
  );
  assert.deepEqual(
    [
      state.board[4][4].trail?.expiresAfterRound,
      state.board[4][5].trail?.expiresAfterRound,
      state.board[5][5].trail?.expiresAfterRound,
    ],
    [5, 5, 5],
    "placeTrails should give normal wyrms a three-round trail duration",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 7;

  const mover = state.wyrms[getOriginalWyrmIds(state, 1)[0]];
  mover.currentOwner = 1;

  placeTrails(state, mover, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ]);

  assert.equal(state.board[0][0].trail, null, "placeTrails should not leave a trail in the mover's own Den");
  assert.equal(state.board[0][1].trail, null, "placeTrails should skip every own-Den cell along the path");
  assert.equal(state.board[0][2].trail?.owner, 1, "placeTrails should still mark the first vacated cell outside the Den");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 5;

  const elder = state.wyrms[getOriginalWyrmIds(state, 4)[0]];
  elder.currentOwner = 4;
  elder.isElder = true;

  placeTrails(state, elder, [
    { row: 7, col: 7 },
    { row: 6, col: 6 },
  ]);

  assert.equal(state.board[7][7].trail?.owner, 4, "placeTrails should assign trail ownership to the wyrm's current owner");
  assert.equal(state.board[7][7].trail?.expiresAfterRound, 6, "placeTrails should give Elder wyrms a one-round trail duration");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 2;

  const mover = state.wyrms[getOriginalWyrmIds(state, 1)[0]];
  const enemySource = getOriginalWyrmIds(state, 4)[0];
  mover.currentOwner = 1;
  setTrail(state, { row: 4, col: 5 }, 4, enemySource, 1, 4);

  placeTrails(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 4, col: 6 },
  ]);

  assert.deepEqual(
    state.board[4][5].trail,
    {
      owner: 4,
      sourceWyrmId: enemySource,
      placedRound: 1,
      expiresAfterRound: 4,
    },
    "placeTrails should preserve an existing trail marker when a movement effect allows a wyrm to pass through it",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 4;

  const mover = state.wyrms[getOriginalWyrmIds(state, 1)[0]];
  mover.currentOwner = 1;

  placeTrails(state, mover, [
    { row: 4, col: 5 },
    { row: 5, col: 5 },
    { row: 6, col: 5 },
  ]);

  assert.equal(
    state.board[5][5].trail?.owner,
    1,
    "placeTrails should allow trail markers to exist inside Sacred Grove cells",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 3;

  const source = getOriginalWyrmIds(state, 1)[0];
  setTrail(state, { row: 2, col: 2 }, 1, source, 1, 4);
  expireTrails(state);

  assert.notEqual(
    state.board[2][2].trail,
    null,
    "expireTrails should keep trails that have not yet reached their expiry round",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  state.currentRound = 5;

  const p1Source = getOriginalWyrmIds(state, 1)[0];
  const p4Source = getOriginalWyrmIds(state, 4)[0];
  setTrail(state, { row: 2, col: 2 }, 1, p1Source, 1, 4);
  setTrail(state, { row: 2, col: 3 }, 4, p4Source, 2, 5);
  setTrail(state, { row: 2, col: 4 }, 1, p1Source, 4, 6);

  expireTrails(state);

  assert.equal(state.board[2][2].trail, null, "expireTrails should remove trails whose expiry round is already reached");
  assert.equal(state.board[2][3].trail, null, "expireTrails should handle multiple expired trails with different timestamps");
  assert.deepEqual(
    state.board[2][4].trail,
    {
      owner: 1,
      sourceWyrmId: p1Source,
      placedRound: 4,
      expiresAfterRound: 6,
    },
    "expireTrails should leave non-expired trails untouched",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const [first, second] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, first, { row: 5, col: 5 });
  activateWyrm(state, second, { row: 6, col: 6 });

  const resolved = checkVictory(state);
  assert.equal(resolved.winner, 1, "checkVictory should award a Sacred Grove win when two allied wyrms occupy the center");
  assert.equal(resolved.winType, "grove", "checkVictory should mark the grove victory type");
  assert.equal(resolved.phase, "game_over", "checkVictory should move the engine into game_over when the grove win triggers");
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const [onlyGrove] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, onlyGrove, { row: 5, col: 5 });

  const resolved = checkVictory(state);
  assert.equal(resolved.winner, null, "checkVictory should remove the Sacred Grove win condition once the count drops below two");
  assert.equal(resolved.winType, null, "checkVictory should not report a grove victory with only one wyrm in the center");
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const [first, second] = getOriginalWyrmIds(state, 1);
  const enemy = getOriginalWyrmIds(state, 4)[0];
  activateWyrm(state, first, { row: 5, col: 5 });
  activateWyrm(state, second, { row: 6, col: 6 });
  activateWyrm(state, enemy, { row: 5, col: 6 });

  const resolved = checkVictory(state);
  assert.equal(
    resolved.winner,
    1,
    "checkVictory should still award the grove when multiple players occupy Sacred Grove simultaneously but one player has at least two wyrms there",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  const capturedIds = getOriginalWyrmIds(state, 4);
  state.players[0].hoard = [...capturedIds];
  for (const wyrmId of capturedIds) {
    const wyrm = state.wyrms[wyrmId];
    wyrm.currentOwner = 1;
    wyrm.position = null;
    wyrm.status = "in_hoard";
  }

  const resolved = checkVictory(state);
  assert.equal(resolved.winner, 1, "checkVictory should award domination when one player holds all three original enemy wyrms");
  assert.equal(resolved.winType, "domination", "checkVictory should mark domination victories correctly");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const [groveHolder, mover] = getOriginalWyrmIds(state, 1);
  activateWyrm(state, groveHolder, { row: 5, col: 5 });
  activateWyrm(state, mover, { row: 4, col: 6 });

  const moved = actionMove(state, mover, [
    { row: 4, col: 6 },
    { row: 5, col: 6 },
  ]);

  assert.equal(moved.winner, 1, "actionMove should trigger Sacred Grove victory immediately after the winning move");
  assert.equal(moved.phase, "game_over", "actionMove should stop the turn immediately when a grove victory happens");
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);
  state.currentPlayerIndex = 1;

  const p1Wyrms = getOriginalWyrmIds(state, 1);
  const p4Wyrms = getOriginalWyrmIds(state, 4);

  activateWyrm(state, p1Wyrms[0], { row: 5, col: 5 });
  activateWyrm(state, p1Wyrms[1], { row: 6, col: 5 });
  activateWyrm(state, p4Wyrms[0], { row: 6, col: 4 });

  const moved = actionMove(state, p4Wyrms[0], [
    { row: 6, col: 4 },
    { row: 6, col: 5 },
  ]);

  assert.equal(
    moved.winner,
    null,
    "actionMove should re-evaluate the Sacred Grove count after a capture and continue when the captured player drops below two wyrms there",
  );
  assert.equal(
    moved.board[6][5].occupant,
    p4Wyrms[0],
    "the capturing wyrm should occupy the Grove cell after removing the defending wyrm",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);

  assert.equal(
    canResolveBlockedMove(state),
    false,
    "canResolveBlockedMove should stay false when the active player has zero wyrms on the board",
  );
}

{
  const state = createInitialState(2);
  clearBoard(state);
  setMoveContext(state, 1);

  const mover = getOriginalWyrmIds(state, 1)[0];
  const victims = getOriginalWyrmIds(state, 4);
  activateWyrm(state, mover, { row: 4, col: 4 });
  activateWyrm(state, victims[0], { row: 4, col: 5 });

  state.players[0].hoard = [victims[1], victims[2]];
  for (const wyrmId of [victims[1], victims[2]]) {
    state.wyrms[wyrmId].currentOwner = 1;
    state.wyrms[wyrmId].position = null;
    state.wyrms[wyrmId].status = "in_hoard";
  }

  const moved = actionMove(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);

  assert.equal(moved.winner, 1, "actionMove should trigger domination immediately after the capture that completes the hoard");
  assert.equal(moved.winType, "domination", "the immediate post-capture victory should be reported as domination");
  assert.equal(moved.phase, "game_over", "the engine should enter game_over immediately after a winning capture");
}

console.log("Game engine logic test suite passed.");
