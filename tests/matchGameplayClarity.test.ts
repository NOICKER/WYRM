import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createInitialState } from "../src/state/gameLogic.ts";
import {
  getMatchInstruction,
  getMatchInstructionMeta,
  getPrimaryActionConfig,
  getRollFeedbackCopy,
  getTileSelectionPreview,
} from "../src/ui/matchInteractionModel.ts";

{
  const state = createInitialState(2);
  state.phase = "roll";

  assert.equal(
    getMatchInstruction({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    "Roll the dice",
    "the top guidance should keep the roll step simple and explicit",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";
  state.dieResult = 3;

  assert.equal(
    getMatchInstruction({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    "Move a Wyrm exactly 3 spaces",
    "move-step guidance should state the exact movement requirement up front",
  );

  assert.deepEqual(
    getRollFeedbackCopy(state),
    {
      valueLabel: "3 - Glide",
      requirement: "Move exactly 3 spaces",
      emphasis: "exact",
    },
    "rolled movement should be echoed back with a named result and exact-distance reminder",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";
  state.dieResult = "coil";

  assert.equal(
    getMatchInstruction({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    "Choose your Coil move",
    "coil turns should replace the exact-distance prompt with a clear choice prompt",
  );

  assert.deepEqual(
    getRollFeedbackCopy(state),
    {
      valueLabel: "∞ - Coil",
      requirement: "Choose 1, 2, or 3 spaces, or place an extra trail",
      emphasis: "choice",
    },
    "coil should explain the movement choice directly in the roll feedback",
  );
}

{
  const state = createInitialState(2);
  state.phase = "move";
  state.dieResult = 4;

  assert.equal(
    getMatchInstructionMeta({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: true,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    "Selected Wyrm is highlighted. Legal destinations glow on the board.",
    "the move step should call out the selected wyrm and visible legal moves",
  );
}

{
  const state = createInitialState(2);
  state.phase = "play_tile";

  assert.equal(
    getMatchInstruction({
      state,
      tileDraft: null,
      deployWyrmId: null,
      trailWyrmId: null,
      hasSelectedMove: false,
      canConfirmMove: false,
      hoardChoicesCount: 0,
    }),
    "Play a Rune Tile or Skip",
    "the tile step should clearly explain the two valid actions",
  );

  assert.deepEqual(
    getTileSelectionPreview({ tile: "void", mode: "single", opponentId: null, cells: [] }),
    {
      title: "Erasure",
      detail: "Pick one opponent, then remove up to 3 of their trail markers.",
    },
    "selected tile previews should explain the effect in plain language",
  );
}

{
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
    "confirm-move should stay hidden until the player has actually plotted a valid path",
  );
}

{
  const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
  const css = readFileSync(resolve("src/index.css"), "utf8");

  assert.match(
    matchScreen,
    /match-board-guidance__status/,
    "the board guidance should render a dedicated roll-status area for clarity feedback",
  );

  assert.match(
    matchScreen,
    /tile-selection-preview/,
    "selecting a rune tile should surface a persistent preview panel",
  );

  assert.match(
    matchScreen,
    /legalMoveTargets/,
    "the match screen should pass legal move destinations through for board highlighting",
  );

  assert.match(
    matchScreen,
    /projectedMoveTargets/,
    "selecting a wyrm should compute and pass one-turn projection cells into the board grid",
  );

  assert.match(
    matchScreen,
    /move-consequence-hint/,
    "hovering a legal destination should render a dedicated move consequence hint panel",
  );

  assert.match(
    css,
    /\.match-board-cell--legal::after/s,
    "legal move destinations should have a dedicated board highlight treatment",
  );

  assert.match(
    css,
    /\.match-board-cell--projected::after/s,
    "next-turn projection cells should have a lighter overlay treatment than current move targets",
  );

  assert.match(
    css,
    /\.match-board-cell__trail--fresh/s,
    "new trails should get a fresh-entry animation treatment",
  );

  assert.match(
    css,
    /\.match-board-grid__ghost-token/s,
    "movement should render a transient ghost token for cell-by-cell feedback",
  );

  assert.match(
    matchScreen,
    /tile-selection-preview__suggestion/,
    "selected rune tiles should surface contextual strategic suggestions",
  );
}

console.log("Match gameplay clarity test suite passed.");
