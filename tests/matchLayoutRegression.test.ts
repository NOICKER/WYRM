import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");
const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
const app = readFileSync(resolve("src/App.tsx"), "utf8");

assert.match(
  css,
  /\.app-root\s*\{/,
  "the app root should define a bounded viewport container so sticky banners do not force the match screen to overflow",
);

assert.doesNotMatch(
  css,
  /\.match-screen\s*\{[^}]*width:\s*100vw;/s,
  "the match screen should not use 100vw because it creates horizontal overflow when the page has a vertical scrollbar",
);

assert.doesNotMatch(
  css,
  /\.hand-tray\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--tray-capacity\),\s*1fr\);/s,
  "the hand tray should not depend on an undefined CSS variable for its grid columns",
);

assert.match(
  css,
  /\.match-topbar\s*\{[^}]*padding-left:/s,
  "the top bar should reserve space for the fixed global back button so the wordmark does not render underneath it",
);

assert.ok(
  !matchScreen.includes("width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%'"),
  "the board stage should not hardcode itself to the full row width because that strands floating controls in empty space",
);

assert.match(
  css,
  /\.rune-card-shell--tray\s+\.rune-card\s*\{[^}]*width:\s*\d+px;/s,
  "footer cards should have a dedicated compact tray variant with a smaller real width",
);

assert.doesNotMatch(
  css,
  /\.hand-tray__cards\s*\{[^}]*padding:\s*1\.5rem 1rem 0\.2rem;/s,
  "the hand tray should not keep the tall top padding that pushes cards into the board",
);

assert.match(
  matchScreen,
  /className=\"rune-card-shell--tray\"/,
  "match tray cards should opt into the compact tray card styling",
);

assert.match(
  app,
  /global-back-btn--guest-offset/,
  "the global back button should receive a guest-banner offset class when the sticky guest notice is visible",
);

assert.match(
  css,
  /\.global-back-btn--guest-offset\s*\{/,
  "the guest-banner back button offset should be defined in CSS",
);

console.log("Match layout regression test suite passed.");
