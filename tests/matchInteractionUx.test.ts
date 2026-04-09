import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const matchScreen = readFileSync(resolve("src/screens/MatchScreen.tsx"), "utf8");
const matchInteractions = readFileSync(resolve("src/ui/useMatchInteractions.ts"), "utf8");
const matchInteractionState = readFileSync(resolve("src/ui/matchInteractionState.ts"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

assert.match(
  matchInteractions,
  /interactionState/,
  "the match interaction hook should track an explicit interaction state instead of relying only on nullable selections",
);

assert.match(
  matchInteractions,
  /createMovementDraft/,
  "the hook should route movement through the new step-by-step movement draft helpers",
);

assert.match(
  matchInteractionState,
  /tile_preview/,
  "the interaction state machine should include an explicit tile_preview state for confirm-first rune usage",
);

assert.match(
  matchInteractions,
  /buildTilePlayRequestFromDraft/,
  "tile effects should be converted into engine requests only through an explicit confirm step",
);

assert.match(
  matchInteractions,
  /setInteractionState\("tile_preview"\)/,
  "starting a rune tile preview should move the interaction system into the explicit tile_preview state",
);

assert.match(
  matchScreen,
  /Steps Remaining/i,
  "the board guidance should surface the remaining movement count while plotting a path",
);

assert.match(
  matchScreen,
  /Cancel Move/,
  "players should be able to cancel an in-progress move directly from the match UI",
);

assert.match(
  matchScreen,
  /Confirm Effect/,
  "rune tiles should render an explicit confirm action instead of executing immediately on selection",
);

assert.match(
  matchScreen,
  /Cancel Effect/,
  "rune tiles should render an explicit cancel action during preview mode",
);

assert.match(
  css,
  /\.match-board-cell--clickable\s*\{/,
  "valid movement and rune targets should opt into a dedicated clickable affordance class",
);

assert.match(
  matchScreen,
  /currentPosition|currentPath\[currentPath\.length - 1\]/,
  "the board should derive the active wyrm's display cell from the live movement position while step-building",
);

assert.match(
  matchInteractions,
  /currentPosition/,
  "the match interaction hook should expose a live currentPosition for movement highlights and hover projections",
);

assert.match(
  matchScreen,
  /currentPosition/,
  "the board should use the live currentPosition when rendering movement feedback instead of recomputing from the engine cell",
);

assert.match(
  matchScreen,
  /displayWyrmId/,
  "board rendering should override the visual occupant during movement instead of relying only on engine occupancy",
);

assert.match(
  css,
  /\.tile-selection-preview__actions\s*\{/,
  "tile preview mode should define a dedicated confirm/cancel action row",
);

console.log("Match interaction UX test suite passed.");
