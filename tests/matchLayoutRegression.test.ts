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

assert.match(
  css,
  /\.match-layout-shell\s*\{[^}]*grid-template-columns:\s*[^;]*minmax\(0,\s*1fr\)[^;]*\}/s,
  "the match screen should define a three-column shell so the board stays centered between fixed sidebars",
);

assert.match(
  matchScreen,
  /match-sidebar match-sidebar--left/,
  "the match layout should render a dedicated left sidebar for the current player's context",
);

assert.match(
  matchScreen,
  /match-sidebar match-sidebar--right/,
  "the match layout should render a dedicated right sidebar for dice and turn state",
);

assert.match(
  matchScreen,
  /match-layout-shell[\s\S]*match-sidebar match-sidebar--left[\s\S]*match-main-column[\s\S]*match-sidebar match-sidebar--right/s,
  "the central board column should sit between the left and right sidebars",
);

assert.doesNotMatch(
  matchScreen,
  /opponent-tracker-bar/,
  "the old horizontal player strip should be removed once its data is redistributed into the sidebars",
);

assert.doesNotMatch(
  matchScreen,
  /hand-tray/,
  "the old bottom hand tray should be removed once player context moves into the left sidebar",
);

assert.match(
  app,
  /!\["auth", "landing", "match", "local_match"\]\.includes\(route\.name\)/,
  "the full-width guest strip should no longer render on match routes",
);

assert.match(
  matchScreen,
  /match-guest-chip/,
  "match routes should render the compact guest chip inside the header instead of a full-width strip",
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
