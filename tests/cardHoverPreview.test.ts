import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");

assert.match(
  css,
  /\.hand-tray\s*\{[^}]*overflow:\s*visible;[^}]*position:\s*relative;[^}]*z-index:\s*10;/s,
  "the hand tray should allow hover previews to rise above the tray without clipping",
);

assert.match(
  css,
  /\.hand-tray__cards\s*\{[^}]*overflow:\s*visible;[^}]*position:\s*relative;[^}]*z-index:\s*10;/s,
  "the card row should expose hover previews instead of clipping them",
);

assert.match(
  css,
  /\.hand-tray__card:hover(?:,\s*\.hand-tray__card:focus-within)?\s*\{[^}]*z-index:\s*50;/s,
  "hovered or focused cards should rise above neighboring cards and board chrome",
);

assert.match(
  css,
  /\.hand-tray__card:hover\s+\.rune-card-shell--interactive\s*\{[^}]*translateY\(-20px\)[^}]*scale\(1\.2\)/s,
  "hovered cards should enlarge and lift upward for a readable preview",
);

assert.match(
  css,
  /\.hand-tray__card:focus-within\s+\.rune-card-shell--interactive\s*\{[^}]*translateY\(-20px\)[^}]*scale\(1\.2\)/s,
  "focused cards should use the same preview lift so keyboard interaction stays consistent",
);

assert.match(
  css,
  /\.match-board-stage\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/s,
  "the board stage should remain below the hand tray stack so card previews stay visible",
);

console.log("Card hover preview clipping test suite passed.");
