import assert from "node:assert/strict";

import { TILE_LAIR_HELP } from "../src/state/gameLogic.ts";
import { getRuneTooltipPlacement } from "../src/components/runeTileTooltipModel.ts";

{
  assert.equal(
    TILE_LAIR_HELP.fire,
    "Phoenix Molt — remove every trail marker from the entire board.",
    "fire should expose the Phoenix Molt lair help copy",
  );
  assert.equal(
    TILE_LAIR_HELP.serpent,
    "Ancient Wyrm — instantly promote any Wyrm to Elder status.",
    "serpent should expose the Ancient Wyrm lair help copy",
  );
}

{
  const centered = getRuneTooltipPlacement({
    cardLeft: 200,
    cardWidth: 138,
    tooltipWidth: 280,
    viewportWidth: 900,
    gutter: 12,
    arrowPadding: 18,
  });
  assert.equal(centered.left, -71, "centered cards should keep the tooltip centered above the card");
  assert.equal(centered.arrowLeft, 140, "centered cards should keep the arrow aligned with the card midpoint");

  const leftEdge = getRuneTooltipPlacement({
    cardLeft: 8,
    cardWidth: 138,
    tooltipWidth: 280,
    viewportWidth: 900,
    gutter: 12,
    arrowPadding: 18,
  });
  assert.equal(leftEdge.left, 4, "left-edge cards should shift the tooltip back onto the screen");
  assert.equal(leftEdge.arrowLeft, 65, "left-edge cards should keep the arrow pointing at the card");

  const rightEdge = getRuneTooltipPlacement({
    cardLeft: 780,
    cardWidth: 138,
    tooltipWidth: 280,
    viewportWidth: 900,
    gutter: 12,
    arrowPadding: 18,
  });
  assert.equal(rightEdge.left, -172, "right-edge cards should shift the tooltip left to stay visible");
  assert.equal(rightEdge.arrowLeft, 241, "right-edge cards should keep the arrow aligned with the card midpoint");
}

console.log("Rune tile tooltip test suite passed.");
