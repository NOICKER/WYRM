import assert from "node:assert/strict";

import { createInitialState } from "../src/state/gameLogic.ts";
import {
  actionDraw,
  actionDeploy,
  actionMove,
  actionPlayTile,
  actionRoll,
  checkVictory,
} from "../src/state/gameEngine.ts";
import type { Coord, GameState, RuneTileType, WyrmId } from "../src/state/types.ts";

function getPlayerWyrmIds(state: GameState, playerId: number): WyrmId[] {
  return Object.values(state.wyrms)
    .filter((wyrm) => wyrm.originalOwner === playerId)
    .map((wyrm) => wyrm.id);
}

function relocateWyrm(state: GameState, wyrmId: WyrmId, next: Coord): void {
  const wyrm = state.wyrms[wyrmId];
  if (wyrm.position) {
    state.board[wyrm.position.row][wyrm.position.col].occupant = null;
  }
  wyrm.position = next;
  wyrm.status = "active";
  state.board[next.row][next.col].occupant = wyrmId;
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
  }
}

function setHand(state: GameState, playerIndex: number, hand: RuneTileType[]): void {
  state.players[playerIndex].hand = [...hand];
}

{
  const state = createInitialState(4);
  assert.equal(state.players.length, 4, "four-player games should create four player states");
  assert.equal(
    Object.values(state.wyrms).filter((wyrm) => wyrm.status === "active").length,
    12,
    "setup should place three active wyrms per player",
  );
  assert.deepEqual(
    state.players.map((player) => player.hand.length),
    [4, 4, 4, 4],
    "every player should start with four rune tiles",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";
  state.dieResult = 1;

  const mover = getPlayerWyrmIds(state, 1)[0];
  relocateWyrm(state, mover, { row: 2, col: 4 });
  state.board[2][5].hasPowerRune = true;

  const moved = actionMove(state, mover, [
    { row: 2, col: 4 },
    { row: 2, col: 5 },
  ]);
  assert.equal(moved.board[2][4].trail?.owner, 1, "moving should leave a trail on each vacated cell");
  assert.equal(moved.players[0].nextDrawCount, 2, "landing on a power rune should boost the next draw");

  moved.phase = "draw";
  const handBefore = moved.players[0].hand.length;
  const afterDraw = actionDraw(moved);
  assert.equal(afterDraw.players[0].hand.length, handBefore + 2, "the stored power rune bonus should pay out on the next draw");
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;

  const [p1a] = getPlayerWyrmIds(state, 1);
  const [p4a] = getPlayerWyrmIds(state, 4);

  relocateWyrm(state, p1a, { row: 4, col: 4 });
  relocateWyrm(state, p4a, { row: 4, col: 5 });

  const captured = actionMove(state, p1a, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);
  assert.ok(captured.players[0].hoard.includes(p4a), "captured enemy wyrms should enter the captor's hoard");
  assert.equal(captured.wyrms[p4a].currentOwner, 1, "captured wyrms should switch control to the captor");

  captured.phase = "move";
  captured.turnEffects.mainMoveCompleted = false;
  const redeployed = actionDeploy(captured, p4a, { row: 1, col: 1 });
  assert.equal(redeployed.wyrms[p4a].status, "active", "redeployed hoard pieces should become active again");
  assert.deepEqual(
    redeployed.wyrms[p4a].position,
    { row: 1, col: 1 },
    "redeployed hoard pieces should enter the captor's den",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";
  setHand(state, 0, ["serpent"]);

  const [firstWyrm, secondWyrm] = getPlayerWyrmIds(state, 1);
  state.board[3][3].trail = {
    owner: 1,
    sourceWyrmId: firstWyrm,
    placedRound: state.currentRound,
    expiresAfterRound: state.currentRound + 3,
  };
  state.board[3][4].trail = {
    owner: 1,
    sourceWyrmId: secondWyrm,
    placedRound: state.currentRound,
    expiresAfterRound: state.currentRound + 3,
  };

  const empowered = actionPlayTile(state, {
    mode: "single",
    tile: "serpent",
    wyrmId: firstWyrm,
  });
  assert.equal(
    empowered.board[3][3].trail?.expiresAfterRound,
    state.currentRound + 5,
    "serpent should extend the chosen wyrm's existing trail to five rounds from now",
  );
  assert.equal(
    empowered.board[3][4].trail?.expiresAfterRound,
    state.currentRound + 3,
    "serpent should not extend unrelated wyrm trails",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);

  const [firstWyrm, secondWyrm] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, firstWyrm, { row: 5, col: 5 });
  relocateWyrm(state, secondWyrm, { row: 6, col: 6 });

  const withVictory = checkVictory(state);
  assert.equal(withVictory.winner, 1, "two wyrms in the Sacred Grove should trigger an immediate win");
  assert.equal(withVictory.winType, "grove", "the win should be marked as a Sacred Grove victory");
}

{
  const state = createInitialState(2);
  state.phase = "roll";

  const originalRandom = Math.random;
  Math.random = () => 0.1;

  try {
    const poisonedClickEvent = {
      nativeEvent: {},
      preventDefault() {},
      stopPropagation() {},
    } as unknown as Parameters<typeof actionRoll>[1];

    const rolled = actionRoll(state, poisonedClickEvent);
    assert.equal(rolled.dieResult, 1, "invalid forced roll input should fall back to a real die roll");
    assert.equal(rolled.phase, "move", "a recovered roll should still advance to the move phase");
  } finally {
    Math.random = originalRandom;
  }
}

console.log("Rules test suite passed.");
