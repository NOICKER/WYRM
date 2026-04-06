import React from "react";

import { describeDieResult } from "../state/gameLogic.ts";
import type { GameState, MoveMode, PlayerCount } from "../state/types.ts";

interface ControlsProps {
  state: GameState;
  instruction: string;
  preferredMoveMode: MoveMode;
  canConfirmMove: boolean;
  canConfirmDiscard: boolean;
  canEndTurn: boolean;
  onStartNewGame: (playerCount: PlayerCount) => void;
  onDraw: () => void;
  onRoll: () => void;
  onEndTurn: () => void;
  onConfirmMove: () => void;
  onConfirmDiscard: () => void;
  onCancelInteraction: () => void;
  onSetCoilChoice: (choice: 1 | 2 | 3 | "extra_trail") => void;
  onSetPreferredMoveMode: (mode: MoveMode) => void;
  extraPanel?: React.ReactNode;
}

export function Controls({
  state,
  instruction,
  preferredMoveMode,
  canConfirmMove,
  canConfirmDiscard,
  canEndTurn,
  onStartNewGame,
  onDraw,
  onRoll,
  onEndTurn,
  onConfirmMove,
  onConfirmDiscard,
  onCancelInteraction,
  onSetCoilChoice,
  onSetPreferredMoveMode,
  extraPanel,
}: ControlsProps): React.JSX.Element {
  const activePlayer = state.players[state.currentPlayerIndex];
  const showCoilChoices = state.phase === "move" && state.dieResult === "coil";
  const showTempestToggle =
    state.phase === "move" &&
    state.turnEffects.tempestRushRemaining.length > 0 &&
    !state.turnEffects.mainMoveCompleted;

  return (
    <aside className="control-panel">
      <div className="control-header">
        <div>
          <p className="eyebrow">Current Turn</p>
          <h2>{activePlayer ? `Player ${activePlayer.id} · ${activePlayer.color}` : "WYRM"}</h2>
        </div>
        <div className="new-game-group">
          {[2, 3, 4].map((count) => (
            <button key={count} type="button" className="ghost-button" onClick={() => onStartNewGame(count as PlayerCount)}>
              {count}P
            </button>
          ))}
        </div>
      </div>

      <div className="status-strip">
        <div>
          <span>Round</span>
          <strong>{state.currentRound}</strong>
        </div>
        <div>
          <span>Phase</span>
          <strong>{state.phase.replace("_", " ")}</strong>
        </div>
        <div>
          <span>Die</span>
          <strong>{describeDieResult(state.dieResult)}</strong>
        </div>
      </div>

      <div className="phase-rail" aria-label="Turn structure">
        {["draw", "roll", "move", "play_tile"].map((phase) => (
          <span
            key={phase}
            className={state.phase === phase ? "phase-chip active" : "phase-chip"}
          >
            {phase === "play_tile" ? "play tile" : phase}
          </span>
        ))}
      </div>

      <div className="instruction-panel">
        <p>{instruction}</p>
        {state.error && <p className="error-banner">{state.error}</p>}
      </div>

      <div className="primary-actions">
        {state.phase === "draw" && (
          <button type="button" className="primary-button" onClick={onDraw}>
            Draw Rune Tile
          </button>
        )}
        {state.phase === "roll" && (
          <button type="button" className="primary-button" onClick={() => onRoll()}>
            Roll Rune Die
          </button>
        )}
        {canConfirmMove && (
          <button type="button" className="primary-button" onClick={onConfirmMove}>
            Confirm Path
          </button>
        )}
        {canConfirmDiscard && (
          <button type="button" className="primary-button" onClick={onConfirmDiscard}>
            Discard Selected Tiles
          </button>
        )}
        {canEndTurn && (
          <button type="button" className="primary-button" onClick={onEndTurn}>
            End Turn
          </button>
        )}
        <button type="button" className="ghost-button" onClick={onCancelInteraction}>
          Clear Selection
        </button>
      </div>

      {showCoilChoices && (
        <div className="sub-panel">
          <h3>Coil Choice</h3>
          <div className="choice-row">
            {[1, 2, 3].map((choice) => (
              <button key={choice} type="button" className="ghost-button" onClick={() => onSetCoilChoice(choice as 1 | 2 | 3)}>
                Move {choice}
              </button>
            ))}
            <button type="button" className="ghost-button" onClick={() => onSetCoilChoice("extra_trail")}>
              Place Trail
            </button>
          </div>
        </div>
      )}

      {showTempestToggle && (
        <div className="sub-panel">
          <h3>Move Mode</h3>
          <div className="choice-row">
            <button
              type="button"
              className={preferredMoveMode === "main" ? "ghost-button active" : "ghost-button"}
              onClick={() => onSetPreferredMoveMode("main")}
            >
              Main Move
            </button>
            <button
              type="button"
              className={preferredMoveMode === "tempest" ? "ghost-button active" : "ghost-button"}
              onClick={() => onSetPreferredMoveMode("tempest")}
            >
              Tempest Rush
            </button>
          </div>
        </div>
      )}

      {extraPanel}
    </aside>
  );
}
