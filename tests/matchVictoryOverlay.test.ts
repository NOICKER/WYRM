import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");
const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
const interactionModel = readFileSync(resolve("src/ui/matchInteractionModel.ts"), "utf8");

assert.match(
  matchScreen,
  /state\.winner !== null/,
  "the match screen should key the end-state overlay off the winner field",
);

assert.match(
  interactionModel,
  /\u{1F3C6}/u,
  "the victory overlay should use the requested trophy headline",
);

assert.match(
  interactionModel,
  /Sacred Grove Victory \(2 Wyrms reached the center\)/,
  "the overlay should explain the sacred grove win condition",
);

assert.match(
  interactionModel,
  /Domination Victory \(Captured all 3 enemy Wyrms\)/,
  "the overlay should explain the domination win condition",
);

assert.match(
  matchScreen,
  /Play Again/,
  "the overlay should offer a replay button",
);

assert.match(
  matchScreen,
  /Exit Game/,
  "the overlay should offer a clean exit button",
);

assert.match(
  matchScreen,
  /game\.startNewGame\(state\.playerCount\)/,
  "playing again should reset the full game state through the existing game provider",
);

assert.match(
  css,
  /\.match-victory-layer\s*\{/,
  "the match UI should define a full-screen victory layer",
);

assert.match(
  css,
  /\.match-victory-card\s*\{/,
  "the match UI should define a centered victory card",
);

assert.match(
  css,
  /\.match-victory-card::before\s*\{/,
  "the victory card should expose a winning-player accent treatment",
);

console.log("Match victory overlay test suite passed.");
