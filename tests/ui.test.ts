import assert from "node:assert/strict";

import {
  buildMatchRecord,
  canHostCommence,
  getProtectedRedirect,
  parseAppRoute,
  seedHostRoom,
  validateAssemblyCode,
} from "../src/ui/appModel.ts";
import { createInitialState } from "../src/state/gameLogic.ts";
import {
  getHandCardInteractionMode,
  getMatchInstructionMeta,
  getMatchPhase,
  getPrimaryActionConfig,
  getVictoryOverlayCopy,
  hasHoardDeployOpportunity,
  shouldShowDeployOverlay,
} from "../src/ui/matchInteractionModel.ts";
import type { GameState, PlayerId, WyrmId } from "../src/state/types.ts";

function getPlayerWyrmIds(state: GameState, playerId: PlayerId): WyrmId[] {
  return Object.values(state.wyrms)
    .filter((wyrm) => wyrm.originalOwner === playerId)
    .map((wyrm) => wyrm.id);
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

{
  assert.deepEqual(parseAppRoute("/"), { name: "landing" }, "root should resolve to the landing screen");
  assert.deepEqual(
    parseAppRoute("/matchmaking"),
    { name: "matchmaking" },
    "matchmaking routes should resolve to the dedicated queue screen",
  );
  assert.deepEqual(
    parseAppRoute("/assembly/ARC-7-2026"),
    { name: "assembly", roomId: "ARC-7-2026" },
    "assembly routes should preserve the room id",
  );
  assert.deepEqual(
    parseAppRoute("/match/match-42/chronicle"),
    { name: "chronicle", matchId: "match-42" },
    "chronicle routes should preserve the match id",
  );
  assert.deepEqual(
    parseAppRoute("/settings"),
    { name: "settings" },
    "settings routes should resolve to the dedicated settings screen",
  );
}

{
  const protectedMatch = parseAppRoute("/match/match-42");
  const protectedResults = parseAppRoute("/match/match-42/results");
  const publicLobby = parseAppRoute("/lobby");

  assert.equal(
    getProtectedRedirect(publicLobby, {
      authenticated: false,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    "/",
    "unauthenticated access should return to auth",
  );
  assert.equal(
    getProtectedRedirect(protectedMatch, {
      authenticated: true,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    null,
    "match routes should stay in place so the app can render a match-not-found recovery screen",
  );
  assert.equal(
    getProtectedRedirect(protectedResults, {
      authenticated: true,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: true,
    }),
    null,
    "results routes should remain available when a completed match record exists",
  );
  assert.equal(
    getProtectedRedirect(parseAppRoute("/auth"), {
      authenticated: true,
      isGuestSession: true,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    null,
    "guest sessions should still be able to open auth so they can create a full account",
  );
}

{
  assert.equal(validateAssemblyCode("ABC-7-2026"), true, "valid sigil codes should pass");
  assert.equal(validateAssemblyCode("abc-7-2026"), false, "lowercase sigil codes should fail");
  assert.equal(validateAssemblyCode("ABCD"), false, "incomplete sigil codes should fail");
}

{
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    false,
    "the race cannot commence with fewer than two occupied seats",
  );
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: true, ready: false },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    false,
    "the race cannot commence until every occupied seat is ready",
  );
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: true, ready: true },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    true,
    "the race can commence once at least two seats are filled and all occupied seats are ready",
  );
}

{
  const record = buildMatchRecord(
    createInitialState(2),
    seedHostRoom({ username: "Sable Quill", level: 7 }),
    { username: "Sable Quill", level: 7 },
    4,
    [],
  );

  assert.equal(
    typeof record.completedAt,
    "number",
    "completed match records should carry a completion timestamp so settings history can show a date",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";

  const capturedId = getPlayerWyrmIds(state, 4)[0];
  if (!capturedId) {
    throw new Error("expected a captured wyrm");
  }

  const captured = state.wyrms[capturedId];
  if (captured.position) {
    state.board[captured.position.row][captured.position.col].occupant = null;
  }
  captured.position = null;
  captured.status = "in_hoard";
  captured.currentOwner = 1;
  state.players[0].hoard = [capturedId];

  assert.equal(
    hasHoardDeployOpportunity(state, state.players[0].hoard.length),
    true,
    "a hoarded wyrm and an open Den cell should count as a real deploy opportunity",
  );
  assert.equal(
    shouldShowDeployOverlay({
      state,
      isPaused: false,
      hasTileDraft: false,
      deployWyrmId: null,
      hoardChoicesCount: state.players[0].hoard.length,
    }),
    false,
    "the deploy overlay should stay hidden until the player actually chooses a hoarded wyrm",
  );
  assert.equal(
    shouldShowDeployOverlay({
      state,
      isPaused: false,
      hasTileDraft: false,
      deployWyrmId: capturedId,
      hoardChoicesCount: state.players[0].hoard.length,
    }),
    true,
    "the deploy overlay should appear once a hoarded wyrm is intentionally selected",
  );
  assert.match(
    getMatchInstructionMeta({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: state.players[0].hoard.length,
    }),
    /redeploy|Den/i,
    "move-step meta copy should tell the player when a hoard deploy is available",
  );
}

{
  const state = createInitialState(2);
  clearBoardOccupants(state);
  state.phase = "move";
  state.dieResult = 1;

  const [blockedWyrm] = getPlayerWyrmIds(state, 1);
  if (!blockedWyrm) {
    throw new Error("expected a blocked wyrm");
  }

  relocateWyrm(state, blockedWyrm, 4, 4);
  state.wyrms[blockedWyrm].prevPosition = { row: 4, col: 3 };
  state.board[3][4].trail = {
    owner: 2,
    sourceWyrmId: "p4_w1",
    placedRound: 1,
    expiresAfterRound: 4,
  };
  state.board[5][4].hasWall = true;
  state.board[4][5].hasWall = true;

  assert.match(
    getMatchInstructionMeta({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    /place a trail|legal move/i,
    "blocked-move meta copy should explain the forced trail placement instead of telling the player to plot a normal move",
  );
}

{
  const state = createInitialState(2);
  assert.equal(getMatchPhase(state), "draw", "draw should stay the first strict phase");
  state.phase = "play_tile";
  assert.equal(getMatchPhase(state), "tile", "the tile step should map to the strict tile phase");
  state.phase = "game_over";
  assert.equal(getMatchPhase(state), "end", "game over should collapse into the strict end phase");
}

{
  assert.deepEqual(
    getVictoryOverlayCopy({ winner: 1, winType: "grove" }, { 1: "Sable", 2: "Coral", 3: "Teal", 4: "Amber" }),
    {
      title: "🏆 Sable Wins!",
      detail: "Sacred Grove Victory (2 Wyrms reached the center)",
    },
    "grove wins should explain the sacred grove condition in the overlay copy",
  );
  assert.deepEqual(
    getVictoryOverlayCopy({ winner: 4, winType: "domination" }, { 1: "Purple", 2: "Coral", 3: "Teal", 4: "Ember" }),
    {
      title: "🏆 Ember Wins!",
      detail: "Domination Victory (Captured all 3 enemy Wyrms)",
    },
    "domination wins should explain the capture condition in the overlay copy",
  );
  assert.equal(
    getVictoryOverlayCopy({ winner: null, winType: null }, { 1: "Purple", 2: "Coral", 3: "Teal", 4: "Amber" }),
    null,
    "the overlay copy helper should stay null when no winner has been recorded",
  );
}

{
  assert.equal(
    getHandCardInteractionMode({ phase: "discard", isPaused: false, canPlayTiles: false }),
    "discard",
    "bottom cards should enter discard mode during the forced discard step",
  );
  assert.equal(
    getHandCardInteractionMode({ phase: "tile", isPaused: false, canPlayTiles: true }),
    "play",
    "bottom cards should become playable during the tile step",
  );
  assert.equal(
    getHandCardInteractionMode({ phase: "move", isPaused: false, canPlayTiles: false }),
    "disabled",
    "bottom cards should stay disabled during move turns when no pre-move tile is currently legal",
  );
  assert.equal(
    getHandCardInteractionMode({ phase: "move", isPaused: false, canPlayTiles: true }),
    "play",
    "bottom cards should become playable during the move step when a pre-move rune like Flow or Gust is available",
  );
}

{
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "draw",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: false,
      tileActionUsed: false,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: true, label: "Draw Rune Tile", disabled: false },
    "draw should expose only the draw CTA",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "discard",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: false,
      tileActionUsed: false,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: true, label: "Confirm Discard", disabled: true },
    "discard should expose only the discard confirmation CTA",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "move",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: false,
      tileActionUsed: false,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: false, label: "Confirm Move", disabled: true },
    "move should hide the confirmation CTA until a valid path exists",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "move",
      canConfirmDiscard: false,
      canConfirmMove: true,
      canSkipTile: false,
      tileActionUsed: false,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: true, label: "Confirm Move", disabled: false },
    "move should expose the confirmation CTA once a valid path exists",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "tile",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: true,
      tileActionUsed: false,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: true, label: "Skip", disabled: false },
    "tile should show a plain skip CTA until the player actually selects a rune tile",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "tile",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: true,
      tileActionUsed: false,
      hasTileSelection: true,
      isPaused: false,
    }),
    { visible: true, label: "Play Tile", disabled: true },
    "tile should switch the CTA label to Play Tile once a rune tile has been selected",
  );
  assert.deepEqual(
    getPrimaryActionConfig({
      phase: "tile",
      canConfirmDiscard: false,
      canConfirmMove: false,
      canSkipTile: true,
      tileActionUsed: true,
      hasTileSelection: false,
      isPaused: false,
    }),
    { visible: true, label: "End Turn", disabled: false },
    "tile should return to End Turn after the tile action has already been spent",
  );
}

console.log("UI helper test suite passed.");
