import assert from "node:assert/strict";

import { createInitialState } from "../src/state/gameLogic.ts";
import {
  actionDraw,
  actionDeploy,
  actionEndTurn,
  actionMove,
  actionPlaceCoilTrail,
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

function primeTurnForForcedEnd(state: GameState): void {
  state.phase = "play_tile";
  state.turnEffects.mainMoveCompleted = true;
  state.turnEffects.tempestRushRemaining = [];
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
  state.phase = "move";
  state.dieResult = 1;

  const opponentWyrm = getPlayerWyrmIds(state, 4)[0];
  if (!opponentWyrm) {
    throw new Error("expected an opposing wyrm");
  }

  relocateWyrm(state, opponentWyrm, { row: 4, col: 4 });
  const rejected = actionMove(state, opponentWyrm, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);

  assert.equal(
    rejected.error,
    "You can only move wyrms controlled by the active player.",
    "players should not be able to move an opposing player's wyrm on their turn",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);

  const [blockedWyrm] = getPlayerWyrmIds(state, 1);
  if (!blockedWyrm) {
    throw new Error("expected a blocked wyrm");
  }

  relocateWyrm(state, blockedWyrm, { row: 4, col: 4 });
  state.wyrms[blockedWyrm].prevPosition = { row: 4, col: 3 };
  state.board[3][4].trail = {
    owner: 2,
    sourceWyrmId: "p4_w1",
    placedRound: 1,
    expiresAfterRound: 4,
  };
  state.board[5][4].hasWall = true;
  state.board[4][5].hasWall = true;
  state.phase = "draw";

  const rejected = actionPlaceCoilTrail(state, blockedWyrm, { row: 4, col: 3 });
  assert.equal(
    rejected.error,
    "Extra trail placement is only available for Coil or a forced blocked move during the move step.",
    "blocked-move trail placement should be rejected outside the move step",
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
  state.phase = "move";
  state.dieResult = 2;
  setHand(state, 0, ["water"]);

  const [mover] = getPlayerWyrmIds(state, 1);
  const [enemySource] = getPlayerWyrmIds(state, 4);
  relocateWyrm(state, mover, { row: 4, col: 4 });
  state.board[4][5].trail = {
    owner: 4,
    sourceWyrmId: enemySource,
    placedRound: 1,
    expiresAfterRound: 4,
  };

  const prepared = actionPlayTile(state, {
    mode: "single",
    tile: "water",
    wyrmId: mover,
  });
  assert.equal(prepared.error, null, "flow should be playable before the move step resolves");
  assert.equal(prepared.turnEffects.flowWyrmId, mover, "flow should mark the selected wyrm for one trail pass");
  assert.equal(prepared.phase, "move", "flow should keep the turn in the move step");

  const moved = actionMove(prepared, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 4, col: 6 },
  ]);
  assert.deepEqual(
    moved.wyrms[mover].position,
    { row: 4, col: 6 },
    "flow should allow the selected wyrm to pass through one trail cell during its move",
  );
  assert.deepEqual(
    moved.board[4][5].trail,
    {
      owner: 4,
      sourceWyrmId: enemySource,
      placedRound: 1,
      expiresAfterRound: 4,
    },
    "flow should not remove or overwrite the trail cell it passes through",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "play_tile";
  setHand(state, 0, ["water"]);

  const [mover] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, mover, { row: 4, col: 4 });

  const rejected = actionPlayTile(state, {
    mode: "single",
    tile: "water",
    wyrmId: mover,
  });
  assert.equal(
    rejected.error,
    "Flow and Gust must be played before moving during the move step.",
    "flow should not remain playable once the turn has advanced to the tile step",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 2;
  setHand(state, 0, ["wind"]);

  const [mover] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, mover, { row: 4, col: 4 });

  const prepared = actionPlayTile(state, {
    mode: "single",
    tile: "wind",
    wyrmId: mover,
  });
  assert.equal(prepared.error, null, "gust should be playable before movement");
  assert.equal(prepared.turnEffects.windWyrmId, mover, "gust should mark the selected wyrm for a +2 move boost");

  const moved = actionMove(prepared, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 4, col: 6 },
    { row: 4, col: 7 },
    { row: 4, col: 8 },
  ]);
  assert.deepEqual(
    moved.wyrms[mover].position,
    { row: 4, col: 8 },
    "gust should add two spaces to the selected wyrm's move this turn",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";
  setHand(state, 0, ["shadow"]);

  const [denWyrm, roamingWyrm] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, roamingWyrm, { row: 4, col: 4 });

  const rejected = actionPlayTile(state, {
    mode: "single",
    tile: "shadow",
    swapWyrmIds: [denWyrm, roamingWyrm],
  });
  assert.equal(
    rejected.error,
    "Eclipse can only swap your on-board wyrms outside every Den.",
    "eclipse should not allow swapping a wyrm that is still sitting inside a Den",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "play_tile";
  setHand(state, 0, ["shadow", "shadow", "shadow"]);

  const [teleportId] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, teleportId, { row: 4, col: 4 });

  const empowered = actionPlayTile(state, {
    mode: "lair",
    tile: "shadow",
    teleportWyrmId: teleportId,
    targetCoords: [{ row: 10, col: 10 }],
  });
  assert.equal(
    empowered.wyrms[teleportId].isElder,
    true,
    "void walk should trigger immediate Elder promotion when it teleports onto an enemy Den",
  );
  assert.deepEqual(
    empowered.wyrms[teleportId].position,
    { row: 10, col: 10 },
    "void walk should place the teleported wyrm directly on the chosen destination",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";
  setHand(state, 0, ["earth"]);

  const fortified = actionPlayTile(state, {
    mode: "single",
    tile: "earth",
    targetCoords: [{ row: 2, col: 5 }],
  });

  assert.equal(fortified.board[2][5].hasWall, true, "stone should place a wall on the selected cell");
  assert.equal(
    fortified.board[2][5].hasPowerRune,
    false,
    "placing a wall on a Power Rune spot should remove the Power Rune token permanently",
  );
  assert.equal(
    fortified.powerRunesRemaining.includes("2,5"),
    false,
    "wall placement should also remove the Power Rune from the tracked remaining list",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;
  state.players[0].hoard = [];

  const advanced = actionEndTurn(state);
  assert.equal(
    advanced.error,
    null,
    "players with zero wyrms on the board and no hoard redeploy should be able to skip straight to the next turn",
  );
  assert.equal(
    advanced.currentPlayerIndex,
    1,
    "ending a zero-wyrm move step should still hand play to the next player in order",
  );
}

{
  const dominated = createInitialState(2);
  clearBoardOccupants(dominated);

  const capturedIds = getPlayerWyrmIds(dominated, 4);
  dominated.players[0].hoard = [...capturedIds];
  for (const wyrmId of capturedIds) {
    dominated.wyrms[wyrmId].currentOwner = 1;
    dominated.wyrms[wyrmId].position = null;
    dominated.wyrms[wyrmId].status = "in_hoard";
  }

  assert.equal(
    checkVictory(dominated).winner,
    1,
    "holding all three original enemy wyrms in the hoard should satisfy domination before any redeploy happens",
  );

  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.players[0].hoard = [...capturedIds];
  for (const wyrmId of capturedIds) {
    state.wyrms[wyrmId].currentOwner = 1;
    state.wyrms[wyrmId].position = null;
    state.wyrms[wyrmId].status = "in_hoard";
  }
  state.phase = "move";
  state.turnEffects.mainMoveCompleted = false;

  const redeployed = actionDeploy(state, capturedIds[0], { row: 0, col: 0 });
  const unresolved = checkVictory(redeployed);
  assert.equal(
    unresolved.winner,
    null,
    "domination should immediately break if one of the original target wyrms is redeployed out of the hoard",
  );
  assert.equal(
    unresolved.wyrms[capturedIds[0]].currentOwner,
    1,
    "redeployed hoard pieces should remain controlled by the player who currently owns them",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;
  state.currentPlayerIndex = 1;

  const [elderId] = getPlayerWyrmIds(state, 1);
  const [captorId] = getPlayerWyrmIds(state, 4);
  relocateWyrm(state, elderId, { row: 5, col: 5 });
  relocateWyrm(state, captorId, { row: 5, col: 4 });
  state.wyrms[elderId].isElder = true;
  state.players[0].elderTokenAvailable = false;

  const captured = actionMove(state, captorId, [
    { row: 5, col: 4 },
    { row: 5, col: 5 },
  ]);
  assert.ok(
    captured.players[1].hoard.includes(elderId),
    "capturing an Elder should still move that token into the captor's hoard",
  );
  assert.equal(
    captured.wyrms[elderId].isElder,
    false,
    "captured Elders should revert to regular wyrms immediately",
  );
  assert.equal(
    captured.players[0].elderTokenAvailable,
    true,
    "capturing an Elder should free the former controller's Elder token for future promotion",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  primeTurnForForcedEnd(state);
  setHand(state, 0, ["water", "water", "water"]);

  const [mover] = getPlayerWyrmIds(state, 1);
  const [enemySource] = getPlayerWyrmIds(state, 4);
  relocateWyrm(state, mover, { row: 4, col: 4 });

  let flooded = actionPlayTile(state, { mode: "lair", tile: "water" });
  assert.equal(
    flooded.players[0].floodPathTurnsRemaining,
    4,
    "flood path should queue three full future turns of trail immunity after the current turn ends",
  );

  for (let turn = 1; turn <= 3; turn += 1) {
    flooded = actionEndTurn(flooded);
    primeTurnForForcedEnd(flooded);
    flooded = actionEndTurn(flooded);

    relocateWyrm(flooded, mover, { row: 4, col: 4 });
    flooded.phase = "move";
    flooded.dieResult = 1;
    flooded.turnEffects.mainMoveCompleted = false;
    flooded.board[4][5].trail = {
      owner: 4,
      sourceWyrmId: enemySource,
      placedRound: flooded.currentRound - 1,
      expiresAfterRound: flooded.currentRound + 2,
    };

    const moved = actionMove(flooded, mover, [
      { row: 4, col: 4 },
      { row: 4, col: 5 },
    ]);
    assert.deepEqual(
      moved.wyrms[mover].position,
      { row: 4, col: 5 },
      `flood path should allow ending on a trail cell during protected turn ${turn}`,
    );
    flooded = moved;
  }

  flooded = actionEndTurn(flooded);
  primeTurnForForcedEnd(flooded);
  flooded = actionEndTurn(flooded);

  relocateWyrm(flooded, mover, { row: 4, col: 4 });
  flooded.phase = "move";
  flooded.dieResult = 1;
  flooded.turnEffects.mainMoveCompleted = false;
  flooded.board[4][5].trail = {
    owner: 4,
    sourceWyrmId: enemySource,
    placedRound: flooded.currentRound - 1,
    expiresAfterRound: flooded.currentRound + 2,
  };

  const expired = actionMove(flooded, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);
  assert.equal(
    expired.error,
    "That path is not legal for the selected wyrm.",
    "flood path should expire after exactly three protected turns",
  );
}

{
  const state = createInitialState(2);
  primeTurnForForcedEnd(state);
  setHand(state, 0, ["light", "light", "light"]);

  let flashed = actionPlayTile(state, {
    mode: "lair",
    tile: "light",
    opponentId: 4,
  });
  assert.equal(
    flashed.players[1].skipTurnsRemaining,
    2,
    "blinding flash should queue exactly two skipped turns for the chosen opponent",
  );

  flashed = actionEndTurn(flashed);
  assert.equal(
    flashed.currentPlayerIndex,
    0,
    "the first skipped turn should immediately skip the blinded opponent and return play to the caster",
  );
  assert.equal(
    flashed.players[1].skipTurnsRemaining,
    1,
    "the skip counter should decrement after the first skipped turn is consumed",
  );

  primeTurnForForcedEnd(flashed);
  flashed = actionEndTurn(flashed);
  assert.equal(
    flashed.currentPlayerIndex,
    0,
    "the second skipped turn should also bypass the blinded opponent entirely",
  );
  assert.equal(
    flashed.players[1].skipTurnsRemaining,
    0,
    "the skip counter should be fully spent after two consecutive skipped turns",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;

  const [existingElder, secondWyrm] = getPlayerWyrmIds(state, 1);
  relocateWyrm(state, existingElder, { row: 5, col: 5 });
  relocateWyrm(state, secondWyrm, { row: 9, col: 10 });
  state.wyrms[existingElder].isElder = true;
  state.players[0].elderTokenAvailable = false;

  const moved = actionMove(state, secondWyrm, [
    { row: 9, col: 10 },
    { row: 10, col: 10 },
  ]);
  assert.equal(
    moved.wyrms[secondWyrm].isElder,
    false,
    "natural Den promotion should fail when that player already has an Elder in play",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";
  setHand(state, 0, ["fire"]);

  const rejected = actionPlayTile(state, {
    mode: "single",
    tile: "fire",
  });

  assert.equal(
    rejected.error,
    "Rune tiles can only be played during the tile step.",
    "tile effects should stay locked until the turn reaches the tile step",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";

  const activeWyrm = getPlayerWyrmIds(state, 1)[0];
  if (!activeWyrm) {
    throw new Error("expected an active wyrm");
  }

  const currentPosition = state.wyrms[activeWyrm].position;
  if (!currentPosition) {
    throw new Error("expected the active wyrm to be on the board");
  }

  const rejected = actionMove(state, activeWyrm, [
    currentPosition,
    { row: currentPosition.row, col: currentPosition.col + 1 },
  ]);

  assert.equal(
    rejected.error,
    "Movement is only available during the move step.",
    "board movement should stay locked once the turn reaches the tile step",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";

  const capturedId = getPlayerWyrmIds(state, 4)[0];
  if (!capturedId) {
    throw new Error("expected a hoarded wyrm");
  }

  state.players[0].hoard = [capturedId];
  const captured = state.wyrms[capturedId];
  if (captured.position) {
    state.board[captured.position.row][captured.position.col].occupant = null;
  }
  captured.position = null;
  captured.status = "in_hoard";
  captured.currentOwner = 1;

  const rejected = actionDeploy(state, capturedId, { row: 1, col: 1 });
  assert.equal(
    rejected.error,
    "Deploy is only available during the move step.",
    "hoard deployment should remain part of the move step instead of leaking into the tile step",
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

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;

  const [mover] = getPlayerWyrmIds(state, 1);
  if (!mover) {
    throw new Error("expected a mover");
  }

  relocateWyrm(state, mover, { row: 4, col: 4 });
  const moved = actionMove(state, mover, [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
  ]);

  let advanced = moved;
  for (let step = 0; step < 6; step += 1) {
    primeTurnForForcedEnd(advanced);
    advanced = actionEndTurn(advanced);
  }

  assert.equal(
    advanced.currentRound,
    4,
    "the turn fast-forward helper should land at the start of round four",
  );
  assert.equal(
    advanced.board[4][4].trail,
    null,
    "regular wyrm trails should be removed after three full rounds",
  );
}

console.log("Rules test suite passed.");
