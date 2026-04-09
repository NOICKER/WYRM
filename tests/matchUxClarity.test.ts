import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");
const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");

assert.match(
  matchScreen,
  /\+1 Rune Tile added/,
  "drawing a tile should still surface a clear success toast after the layout restructure",
);

assert.match(
  matchScreen,
  /match-toast--error/,
  "invalid actions should continue to render through the bottom toast channel instead of the instruction area",
);

assert.doesNotMatch(
  matchScreen,
  /board-instruction-pill/,
  "instruction copy should remain out of the old floating board overlay",
);

assert.match(
  matchScreen,
  /match-turn-stepper/,
  "turn progress should move into a dedicated vertical stepper inside the right sidebar",
);

assert.match(
  matchScreen,
  /match-die-panel/,
  "the die result should render inside the right sidebar instead of the header",
);

assert.match(
  matchScreen,
  /match-hand-list/,
  "the player's hand should render as a compact vertical list inside the left sidebar",
);

assert.match(
  matchScreen,
  /match-hand-list__item/,
  "hand entries should render as compact list rows instead of full card spreads",
);

assert.match(
  matchScreen,
  /YOUR TURN/,
  "the left sidebar should explicitly mark the active player with a turn label",
);

assert.match(
  matchScreen,
  /DECK|Deck/,
  "the deck should keep an explicit label after the layout reorganization",
);

assert.match(
  matchScreen,
  /DISCARD|Discard/,
  "the discard pile should keep an explicit label after the layout reorganization",
);

assert.doesNotMatch(
  matchScreen,
  /match-board-player-label/,
  "floating board identity labels should be removed once identity lives in the sidebars",
);

assert.match(
  css,
  /\.draw-feedback-card\s*\{/,
  "the match UI should still define a deck-to-hand card animation shell",
);

assert.match(
  css,
  /\.match-toast\s*\{/,
  "the match UI should continue to define a toast style for draw feedback",
);

assert.match(
  css,
  /\.match-toast--error\s*\{/,
  "the match UI should define a dedicated error-toast treatment for invalid actions",
);

assert.match(
  css,
  /\.match-die-panel__feedback\s*\{/,
  "the die panel should define a nearby feedback block for the rolled result and its meaning",
);

assert.match(
  css,
  /\.match-hand-list__item\s*\{/,
  "the compact hand list should define its own row layout",
);

assert.match(
  css,
  /\.match-turn-stepper\s*\{/,
  "the right sidebar should define a vertical stepper layout for turn progress",
);

assert.match(
  css,
  /\.match-guest-chip\s*\{/,
  "the compact guest pill should define its own header placement styling",
);

assert.match(
  css,
  /\.match-instruction-bar__icon\s*\{/,
  "the instruction bar should add the approved leading icon treatment without changing the visual language",
);

console.log("Match UX clarity test suite passed.");
