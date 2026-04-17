import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { actionDraw } from "../src/state/gameEngine.ts";
import { createInitialState } from "../src/state/gameLogic.ts";

const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
const guidanceModel = readFileSync(resolve("src/ui/guidanceModel.ts"), "utf8");
const matchInteractions = readFileSync(resolve("src/ui/useMatchInteractions.ts"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

assert.match(
  matchScreen,
  /const localPlayerId\b/,
  "the match screen should derive a stable local player id for the viewer",
);

assert.doesNotMatch(
  matchScreen,
  /const trayTiles = currentPlayer\.hand;/,
  "the hand tray should not swap to the active player's hand between turns",
);

assert.match(
  matchScreen,
  /const trayTiles = localPlayer\.hand;/,
  "the hand tray should always render the local player's cards",
);

assert.match(
  matchScreen,
  /match-hand-list__button--discard-required|legacy-tray__card--must-discard/,
  "forced discard mode should clearly mark excess cards instead of making a six-card hand look normal",
);

assert.match(
  css,
  /\.match-hand-list__button--discard-required\s*\{/,
  "forced discard cards should define a dedicated warning treatment in CSS",
);

assert.match(
  guidanceModel,
  /Select a Rune Tile from your hand below/,
  "tile-step instructions should match the actual whole-hand highlight behavior",
);

assert.match(
  guidanceModel,
  /Click one of your Wyrm tokens on the board/,
  "move-step guidance should tell the player exactly what token to click",
);

assert.doesNotMatch(
  guidanceModel,
  /glowing Wyrm|glowing hand cards|glowing blocked Wyrms|already glowing/,
  "guidance copy should not depend on glow language when the UI is not guaranteed to show it reliably",
);

assert.match(
  matchInteractions,
  /console\.assert\(/,
  "move-phase debugging should keep a development-time assertion for missing movable Wyrm ids",
);

assert.match(
  css,
  /\.landing-hero__actions\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*2;/s,
  "landing actions should sit above the decorative preview stack on short viewports",
);

assert.match(
  css,
  /\.landing-hero__preview\s*\{[^}]*max-height:\s*220px;[^}]*overflow:\s*hidden;/s,
  "landing hero preview art should be clipped on short viewports so it cannot cover the CTAs",
);

{
  const state = createInitialState(2);
  const player = state.players[state.currentPlayerIndex];
  player.hand = ["fire", "water", "earth", "wind"];
  player.nextDrawCount = 2;

  const next = actionDraw(state);

  assert.equal(next.phase, "discard", "drawing to six cards should immediately enter discard mode");
  assert.equal(next.mustDiscard, 1, "drawing from four to six cards should require exactly one discard");
}

{
  const state = createInitialState(2);
  const player = state.players[state.currentPlayerIndex];
  player.hand = ["fire", "water", "earth", "wind"];
  player.nextDrawCount = 1;

  const next = actionDraw(state);

  assert.equal(next.phase, "roll", "drawing to five or fewer cards should advance directly to the roll step");
  assert.equal(next.mustDiscard, 0, "no discard should be required when the hand stays at five cards");
}

console.log("Match player-view regression test suite passed.");
