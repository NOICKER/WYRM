import assert from "node:assert/strict";

import { getMatchBoardCellSize } from "../src/screens/matchBoardSizing.ts";

function getBoardFootprint(cellSize: number, cols: number, rows: number, gap = 3, padding = 14): {
  width: number;
  height: number;
} {
  return {
    width: cols * cellSize + Math.max(0, cols - 1) * gap + padding * 2,
    height: rows * cellSize + Math.max(0, rows - 1) * gap + padding * 2,
  };
}

{
  const cellSize = getMatchBoardCellSize({
    viewportWidth: 715,
    viewportHeight: 715,
    cols: 12,
    rows: 12,
  });

  assert.equal(
    cellSize,
    50,
    "board sizing should leave extra breathing room in square viewports so the board feels comfortably framed instead of edge-packed",
  );

  const footprint = getBoardFootprint(cellSize, 12, 12);
  assert.ok(
    footprint.width <= 715 && footprint.height <= 715,
    "the computed board footprint should fit inside the viewport once gaps and padding are included",
  );
}

{
  const cellSize = getMatchBoardCellSize({
    viewportWidth: 880,
    viewportHeight: 620,
    cols: 12,
    rows: 12,
  });

  assert.equal(
    cellSize,
    42,
    "shorter desktop viewports should reserve extra vertical breathing room so the full board remains visible without feeling cramped at 100% zoom",
  );
}

{
  const cellSize = getMatchBoardCellSize({
    viewportWidth: 1200,
    viewportHeight: 1100,
    cols: 12,
    rows: 12,
  });

  assert.equal(
    cellSize,
    54,
    "roomier viewports should still respect the visual max cell size instead of ballooning the board indefinitely",
  );
}

console.log("Match board sizing test suite passed.");
