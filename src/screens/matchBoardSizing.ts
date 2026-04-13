const DEFAULT_GRID_GAP = 3;
const DEFAULT_VIEWPORT_PADDING = 14;
const DEFAULT_VERTICAL_BREATHING_ROOM = 48;
const DEFAULT_MIN_CELL_SIZE = 32;
const DEFAULT_MAX_CELL_SIZE = 54;

interface MatchBoardCellSizeOptions {
  viewportWidth: number;
  viewportHeight: number;
  cols: number;
  rows: number;
  gap?: number;
  paddingX?: number;
  paddingY?: number;
  verticalBreathingRoom?: number;
  minCellSize?: number;
  maxCellSize?: number;
}

export function getMatchBoardCellSize({
  viewportWidth,
  viewportHeight,
  cols,
  rows,
  gap = DEFAULT_GRID_GAP,
  paddingX = DEFAULT_VIEWPORT_PADDING,
  paddingY = DEFAULT_VIEWPORT_PADDING,
  verticalBreathingRoom = DEFAULT_VERTICAL_BREATHING_ROOM,
  minCellSize = DEFAULT_MIN_CELL_SIZE,
  maxCellSize = DEFAULT_MAX_CELL_SIZE,
}: MatchBoardCellSizeOptions): number {
  if (cols <= 0 || rows <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return minCellSize;
  }

  const usableWidth = Math.max(0, viewportWidth - paddingX * 2 - gap * Math.max(0, cols - 1));
  const usableHeight = Math.max(
    0,
    viewportHeight - paddingY * 2 - gap * Math.max(0, rows - 1) - verticalBreathingRoom,
  );
  const widthLimitedSize = Math.floor(usableWidth / cols);
  const heightLimitedSize = Math.floor(usableHeight / rows);
  const boundedSize = Math.min(widthLimitedSize, heightLimitedSize, maxCellSize);

  if (boundedSize <= 0) {
    return minCellSize;
  }

  return Math.max(minCellSize, boundedSize);
}
