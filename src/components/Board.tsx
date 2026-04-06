import React from "react";

import type { Coord, GameState, StepOption } from "../state/types.ts";

interface BoardComponentProps {
  state: GameState;
  selectedPath: Coord[];
  moveTargets: StepOption[];
  actionTargets: Coord[];
  markedTargets: Coord[];
  onCellClick: (coord: Coord) => void;
}

function coordMatches(coord: Coord, list: Coord[]): boolean {
  return list.some((entry) => entry.row === coord.row && entry.col === coord.col);
}

function findMoveTarget(coord: Coord, moveTargets: StepOption[]): StepOption | undefined {
  return moveTargets.find((entry) => entry.row === coord.row && entry.col === coord.col);
}

export function BoardComponent({
  state,
  selectedPath,
  moveTargets,
  actionTargets,
  markedTargets,
  onCellClick,
}: BoardComponentProps): React.JSX.Element {
  const selectedStart = selectedPath[0];

  return (
    <div className="board-shell">
      <div className="board-grid">
        {state.board.map((row) =>
          row.map((cell) => {
            const coord = { row: cell.row, col: cell.col };
            const moveTarget = findMoveTarget(coord, moveTargets);
            const inPath = coordMatches(coord, selectedPath);
            const actionTarget = coordMatches(coord, actionTargets);
            const markedTarget = coordMatches(coord, markedTargets);
            const pathIndex = selectedPath.findIndex(
              (entry) => entry.row === coord.row && entry.col === coord.col,
            );

            const wyrm = cell.occupant ? state.wyrms[cell.occupant] : null;
            const trailAge = cell.trail ? Math.min(state.currentRound - cell.trail.placedRound, 2) : 0;
            const extendedTrail =
              cell.trail != null && cell.trail.expiresAfterRound - cell.trail.placedRound > 3;

            return (
              <button
                key={`${cell.row}-${cell.col}`}
                type="button"
                className={[
                  "board-cell",
                  `cell-${cell.type}`,
                  moveTarget ? (moveTarget.capture ? "cell-capture-target" : "cell-move-target") : "",
                  actionTarget ? "cell-action-target" : "",
                  markedTarget ? "cell-marked-target" : "",
                  inPath ? "cell-in-path" : "",
                  selectedStart && selectedStart.row === cell.row && selectedStart.col === cell.col
                    ? "cell-selected-start"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onCellClick(coord)}
              >
                {cell.hasPowerRune && <span className="cell-power-rune" aria-hidden="true" />}
                {cell.hasWall && <span className="cell-wall">✕</span>}
                {cell.trail && (
                  <span
                    className={[
                      "cell-trail",
                      `trail-owner-${cell.trail.owner}`,
                      `trail-age-${trailAge}`,
                      extendedTrail ? "trail-extended" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                )}
                {inPath && pathIndex > 0 && <span className="cell-path-index">{pathIndex}</span>}
                {wyrm && (
                  <span
                    className={[
                      "wyrm-token",
                      wyrm.isElder ? "wyrm-elder" : "wyrm-regular",
                      `wyrm-owner-${wyrm.currentOwner}`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {wyrm.isElder ? "★" : "W"}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className="board-legend">
        <span>
          <span className="legend-dot legend-move" />
          Move target
        </span>
        <span>
          <span className="legend-dot legend-action" />
          Action target
        </span>
        <span>
          <span className="legend-dot legend-capture" />
          Capture
        </span>
      </div>
    </div>
  );
}
