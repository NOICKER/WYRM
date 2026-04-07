import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");
const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
const runeTileCard = readFileSync(resolve("src/components/RuneTileCard.tsx"), "utf8");

assert.match(
  matchScreen,
  /Draw Rune Tile → Adds 1 ability card to your hand/,
  "the draw step should explain that drawing adds a rune tile to the player's hand",
);

assert.match(
  matchScreen,
  /Rune Tiles are abilities you can play after moving/,
  "the helper copy should explain what rune tiles are in plain language",
);

assert.match(
  matchScreen,
  /\+1 Rune Tile added/,
  "drawing a tile should surface a clear success toast",
);

assert.doesNotMatch(
  matchScreen,
  /board-instruction-pill/,
  "instruction copy should move out of the floating board overlay",
);

assert.match(
  matchScreen,
  /Turn Progress:/,
  "the hand tray should use a non-clickable turn progress label instead of button-like phase pills",
);

assert.match(
  css,
  /\.draw-feedback-card\s*\{/,
  "the match UI should define a deck-to-hand card animation shell",
);

assert.match(
  css,
  /\.match-toast\s*\{/,
  "the match UI should define a toast style for draw feedback",
);

assert.match(
  css,
  /\.rune-card-shell--interactive\s*\{[^}]*cursor:\s*pointer;/s,
  "interactive rune tiles should advertise clickability with a pointer cursor",
);

assert.match(
  css,
  /\.hand-tray__card:hover\s*\{[^}]*z-index:\s*\d+/s,
  "hovered hand cards should rise above their neighbors so the interaction feels responsive",
);

assert.match(
  css,
  /\.hand-tray__card:hover\s+\.rune-card-shell--interactive\s*\{[^}]*scale\(/s,
  "hovered hand cards should scale up for readability and feedback",
);

assert.match(
  runeTileCard,
  /rune-card-shell--interactive/,
  "rune tile cards should opt into the interactive tray affordance class when clickable",
);

console.log("Match UX clarity test suite passed.");
