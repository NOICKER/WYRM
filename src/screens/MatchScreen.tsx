import React, { useMemo, useRef, useState } from "react";

import { RuneTileCard } from "../components/RuneTileCard.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { getControlledActiveWyrms } from "../state/gameLogic.ts";
import type { Coord, GameState, PlayerColor, PlayerId, RuneTileType, StepOption } from "../state/types.ts";
import {
  PLAYER_PALETTE,
  getPhaseLabel,
  getPlayerInitial,
  getTileName,
  mapSeatColorsByPlayerId,
  mapSeatNamesByPlayerId,
  type AssemblyRoom,
} from "../ui/appModel.ts";
import { useMatchInteractions } from "../ui/useMatchInteractions.ts";

interface MatchScreenProps {
  room: AssemblyRoom;
  matchId: string;
  onNavigate: (href: string) => void;
}

interface MatchBoardGridProps {
  cellSize: number;
  state: GameState;
  selectedPath: Coord[];
  selectedWyrmId: string | null;
  moveTargets: StepOption[];
  actionTargets: Coord[];
  markedTargets: Coord[];
  playerNames: Record<PlayerId, string>;
  onCellClick: (coord: Coord) => void;
}

function coordMatches(coord: Coord, list: Coord[]): boolean {
  return list.some((entry) => entry.row === coord.row && entry.col === coord.col);
}

function findMoveTarget(coord: Coord, moveTargets: StepOption[]): StepOption | undefined {
  return moveTargets.find((entry) => entry.row === coord.row && entry.col === coord.col);
}

function getPhaseActionLabel(state: GameState, canConfirmDiscard: boolean): string {
  if (state.phase === "draw") return "Draw Rune Tile";
  if (state.phase === "roll") return "Roll Rune Die";
  if (state.phase === "discard") return canConfirmDiscard ? "Discard Selected" : "Choose Tiles";
  return "Advance";
}

function getColorValue(color: PlayerColor): string {
  return PLAYER_PALETTE[color].base;
}

function MatchBoardGrid({
  cellSize,
  state,
  selectedPath,
  selectedWyrmId,
  moveTargets,
  actionTargets,
  markedTargets,
  playerNames,
  onCellClick,
}: MatchBoardGridProps): React.JSX.Element {
  const selectedStart = selectedPath[0];

  return (
    <div
      className="match-board-grid"
      style={
        {
          "--board-cell-size": `${cellSize}px`,
        } as React.CSSProperties
      }
    >
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
          const trailOpacity = trailAge === 0 ? 0.9 : trailAge === 1 ? 0.5 : 0.2;
          const selectedWyrm = selectedWyrmId && wyrm?.id === selectedWyrmId;

          return (
            <button
              key={`${cell.row}-${cell.col}`}
              type="button"
              className={[
                "match-board-cell",
                `match-board-cell--${cell.type}`,
                moveTarget ? (moveTarget.capture ? "match-board-cell--capture" : "match-board-cell--move") : "",
                actionTarget ? "match-board-cell--action" : "",
                markedTarget ? "match-board-cell--marked" : "",
                inPath ? "match-board-cell--path" : "",
                selectedStart && selectedStart.row === cell.row && selectedStart.col === cell.col
                  ? "match-board-cell--selected-start"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onCellClick(coord)}
            >
              {cell.hasPowerRune ? <span className="match-board-cell__rune">◆</span> : null}
              {cell.hasWall ? <span className="match-board-cell__wall">✕</span> : null}
              {cell.trail ? (
                <span
                  className={`match-board-cell__trail match-board-cell__trail--${cell.trail.owner}`}
                  style={{ opacity: trailOpacity }}
                >
                  {trailAge === 2 ? <span className="match-board-cell__trail-dot" /> : null}
                </span>
              ) : null}
              {inPath && pathIndex > 0 ? <span className="match-board-cell__index">{pathIndex}</span> : null}
              {wyrm ? (
                <span
                  className={[
                    "match-board-cell__token",
                    `match-board-cell__token--${wyrm.currentOwner}`,
                    wyrm.isElder ? "match-board-cell__token--elder" : "",
                    selectedWyrm ? "match-board-cell__token--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {wyrm.isElder ? "★" : getPlayerInitial(playerNames[wyrm.currentOwner])}
                </span>
              ) : null}
            </button>
          );
        }),
      )}
    </div>
  );
}

export function MatchScreen({ room, matchId, onNavigate }: MatchScreenProps): React.JSX.Element {
  const {
    state,
    currentPlayer,
    preferredMoveMode,
    selectedMove,
    selectedWyrmId,
    tileDraft,
    deployWyrmId,
    discardSelection,
    peekPlayerId,
    instruction,
    moveTargets,
    actionTargets,
    markedTargets,
    selectedPath,
    canConfirmMove,
    canConfirmDiscard,
    canEndTurn,
    canPlayTiles,
    clearInteraction,
    startTileDraft,
    toggleDiscard,
    confirmVoidSelection,
    prepareDeploy,
    handleBoardClick,
    setPeekPlayerId,
    performPhasePrimaryAction,
    onRoll,
    onEndTurn,
    onSetCoilChoice,
    onSetPreferredMoveMode,
    chooseOpponent,
    chooseSpecialWyrm,
    hoardChoices,
    opponentChoices,
  } = useMatchInteractions();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [cellSize] = useState(48);
  const [rollingFace, setRollingFace] = useState<string | null>(null);
  const playerNames = useMemo(() => mapSeatNamesByPlayerId(room), [room]);
  const playerColors = useMemo(() => mapSeatColorsByPlayerId(room), [room]);
  const currentPlayerColor = getColorValue(playerColors[currentPlayer.id]);
  const activePlayerName = playerNames[currentPlayer.id];
  const trayTiles = currentPlayer.hand;
  const tileCounts = useMemo(
    () =>
      trayTiles.reduce<Record<RuneTileType, number>>((counts, tile) => {
        counts[tile] = (counts[tile] ?? 0) + 1;
        return counts;
      }, {} as Record<RuneTileType, number>),
    [trayTiles],
  );
  const lairTile = useMemo(
    () => (Object.entries(tileCounts).find(([, count]) => count >= 3)?.[0] ?? null) as RuneTileType | null,
    [tileCounts],
  );
  const lairFocusIndex = useMemo(() => {
    if (!lairTile) {
      return 2;
    }
    const tileIndex = trayTiles.findIndex((tile) => tile === lairTile);
    return tileIndex === -1 ? 2 : tileIndex;
  }, [lairTile, trayTiles]);

  // Fixed cell size to prevent unwanted zooming
  // The board will use the default 48px initialized in the useState

  const phaseActionLabel = getPhaseActionLabel(state, canConfirmDiscard);
  const activeOpponents = state.players.filter((player) => player.id !== currentPlayer.id);
  const visiblePeekHand = peekPlayerId
    ? state.players.find((player) => player.id === peekPlayerId)?.hand ?? []
    : [];
  const dieBadgeValue = rollingFace ?? (state.dieResult == null ? "?" : state.dieResult === "surge" ? "5" : state.dieResult === "coil" ? "∞" : String(state.dieResult));

  const handlePrimaryAction = () => {
    if (state.phase === "roll") {
      const faces = ["1", "2", "3", "4", "∞", "5"];
      let step = 0;
      setRollingFace(faces[0]);
      const interval = window.setInterval(() => {
        step += 1;
        setRollingFace(faces[step % faces.length]);
      }, 90);
      onRoll();
      window.setTimeout(() => {
        window.clearInterval(interval);
        setRollingFace(null);
      }, 600);
      return;
    }
    performPhasePrimaryAction();
  };

  return (
    <main className="match-screen">
      <div className="match-screen__viewport">
        <header className="match-topbar">
          <Wordmark href="/lobby" onNavigate={onNavigate} compact />

          <div className="match-phase">
            <span>{getPhaseLabel(state.phase)}</span>
          </div>

          <div className="match-topbar__right">
            <div className="die-badge" aria-live="polite">
              {dieBadgeValue}
            </div>
            <div className="opponent-trackers">
              {activeOpponents.map((player) => {
                const activeWyrms = getControlledActiveWyrms(state, player.id);
                return (
                  <article key={player.id} className="opponent-card">
                    <div>
                      <strong style={{ color: getColorValue(playerColors[player.id]) }}>{playerNames[player.id]}</strong>
                      <div className="opponent-card__dots">
                        {Array.from({ length: 3 }, (_, index) => (
                          <span
                            key={index}
                            className={index < activeWyrms.length ? "opponent-card__dot opponent-card__dot--live" : "opponent-card__dot"}
                            style={{ backgroundColor: index < activeWyrms.length ? getColorValue(playerColors[player.id]) : undefined }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="opponent-card__count">{player.hand.length}</span>
                  </article>
                );
              })}
            </div>
          </div>
        </header>

        <section className="match-body">
          <aside className="helper-card">
            <div className="helper-card__header">
              <div>
                <span>Action Helper</span>
                <strong>{matchId}</strong>
              </div>
            </div>

            <p className="helper-card__copy">{instruction}</p>

            <div className="helper-card__legend">
              <span><i className="legend-dot legend-dot--move" /> Valid Move</span>
              <span><i className="legend-dot legend-dot--capture" /> Lethal Strike</span>
            </div>

            {(state.phase === "draw" || state.phase === "roll" || state.phase === "discard") ? (
              <button type="button" className="button button--forest button--wide" onClick={handlePrimaryAction}>
                {phaseActionLabel}
              </button>
            ) : null}

            {state.error ? <ScreenError message={state.error} /> : null}

            {state.phase === "move" && state.dieResult === "coil" && !state.turnEffects.coilChoice ? (
              <div className="helper-card__stack">
                {[1, 2, 3].map((choice) => (
                  <button key={choice} type="button" className="button button--outline" onClick={() => onSetCoilChoice(choice as 1 | 2 | 3)}>
                    Move {choice}
                  </button>
                ))}
                <button type="button" className="button button--outline" onClick={() => onSetCoilChoice("extra_trail")}>
                  Place Trail
                </button>
              </div>
            ) : null}

            {state.phase === "move" && state.turnEffects.tempestRushRemaining.length > 0 && !state.turnEffects.mainMoveCompleted ? (
              <div className="helper-card__stack">
                <button
                  type="button"
                  className={preferredMoveMode === "main" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                  onClick={() => onSetPreferredMoveMode("main")}
                >
                  Main Move
                </button>
                <button
                  type="button"
                  className={preferredMoveMode === "tempest" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                  onClick={() => onSetPreferredMoveMode("tempest")}
                >
                  Tempest Rush
                </button>
              </div>
            ) : null}

            {tileDraft?.tile === "light" || (tileDraft?.tile === "void" && !tileDraft.opponentId) || tileDraft?.tile === "void" && tileDraft.mode === "lair" ? (
              <div className="helper-card__stack">
                {opponentChoices.map((opponent) => (
                  <button key={opponent.id} type="button" className="button button--outline" onClick={() => chooseOpponent(opponent.id)}>
                    {opponent.label}
                  </button>
                ))}
              </div>
            ) : null}

            {tileDraft?.tile === "void" && tileDraft.mode === "single" && tileDraft.opponentId ? (
              <button type="button" className="button button--forest button--wide" onClick={confirmVoidSelection}>
                Confirm Erasure
              </button>
            ) : null}

            {(tileDraft?.tile === "shadow" && tileDraft.mode === "lair") || (tileDraft?.tile === "serpent" && tileDraft.mode === "lair") ? (
              <div className="helper-card__stack">
                {hoardChoices.map((choice) => (
                  <button key={choice.wyrmId} type="button" className="button button--outline" onClick={() => chooseSpecialWyrm(choice.wyrmId)}>
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}

            {visiblePeekHand.length > 0 ? (
              <div className="helper-card__peek">
                <div className="helper-card__peek-header">
                  <strong>Revealed Hand</strong>
                  <button type="button" className="text-link" onClick={() => setPeekPlayerId(null)}>
                    Close
                  </button>
                </div>
                <div className="helper-card__peek-list">
                  {visiblePeekHand.map((tile, index) => (
                    <span key={`${tile}-${index}`}>{getTileName(tile)}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {hoardChoices.length > 0 && !tileDraft && (state.phase === "move" || state.phase === "play_tile") ? (
              <div className="helper-card__stack">
                {hoardChoices.map((choice) => (
                  <button
                    key={choice.wyrmId}
                    type="button"
                    className={deployWyrmId === choice.wyrmId ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline"}
                    onClick={() => prepareDeploy(choice.wyrmId)}
                  >
                    Deploy {choice.label}
                  </button>
                ))}
              </div>
            ) : null}

            <button type="button" className="button button--ghost button--wide" onClick={clearInteraction}>
              Clear Selection
            </button>
          </aside>

          <div className="match-board-stage" ref={boardRef}>
            <div className="match-board-scroll">
              <MatchBoardGrid
                cellSize={cellSize}
                state={state}
                selectedPath={selectedPath}
                selectedWyrmId={selectedWyrmId}
                moveTargets={moveTargets}
                actionTargets={actionTargets}
                markedTargets={markedTargets}
                playerNames={playerNames}
                onCellClick={handleBoardClick}
              />
            </div>
          </div>
        </section>

        <footer className="hand-tray">
          <div className="hand-tray__player">
            <h2 style={{ color: currentPlayerColor }}>{activePlayerName}</h2>
            <div className="phase-stepper">
              {["draw", "roll", "move", "play_tile"].map((phase, index) => {
                const active = state.phase === phase;
                const completed =
                  phase === "draw"
                    ? state.phase !== "draw"
                    : phase === "roll"
                      ? ["move", "play_tile", "game_over"].includes(state.phase)
                      : phase === "move"
                        ? state.turnEffects.mainMoveCompleted || state.phase === "play_tile" || state.phase === "game_over"
                        : state.turnEffects.tileActionUsed || state.phase === "game_over";
                return (
                  <span
                    key={phase}
                    className={[
                      "phase-stepper__pill",
                      active ? "phase-stepper__pill--active" : "",
                      completed && !active ? "phase-stepper__pill--done" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={active ? { backgroundColor: currentPlayerColor } : undefined}
                  >
                    {index === 3 ? "Tile" : phase[0].toUpperCase() + phase.slice(1)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="hand-tray__cards">
            {trayTiles.map((tile, index) => {
              const copies = tileCounts[tile];
              const selectedForDiscard = discardSelection.includes(index);
              const cardActive =
                selectedForDiscard ||
                Boolean(tileDraft && "tile" in tileDraft && tileDraft.tile === tile) ||
                Boolean(selectedMove && selectedMove.moveMode === "tempest" && index === 0);

              return (
                <div
                  key={`${tile}-${index}`}
                  className="hand-tray__card"
                  style={{ transform: `translateY(${index === lairFocusIndex && lairTile ? -18 : 0}px) rotate(${(index - (trayTiles.length - 1) / 2) * 3}deg)` }}
                >
                  <RuneTileCard
                    tile={tile}
                    copies={copies}
                    active={cardActive}
                    elevated={index === lairFocusIndex && Boolean(lairTile)}
                    lairReady={lairTile === tile && copies >= 3}
                    disabled={!canPlayTiles && state.phase !== "discard"}
                    onPlay={
                      state.phase === "discard"
                        ? () => toggleDiscard(index)
                        : canPlayTiles
                          ? () => startTileDraft(tile, "single")
                          : undefined
                    }
                    onPlayLair={copies >= 3 && canPlayTiles ? () => startTileDraft(tile, "lair") : undefined}
                  />
                </div>
              );
            })}
          </div>

          <div className="hand-tray__actions">
            <button type="button" className="button button--forest button--wide" disabled={!canConfirmMove} onClick={performPhasePrimaryAction}>
              CONFIRM MOVE
            </button>
            <button type="button" className="button button--outline button--wide" disabled={!canEndTurn} onClick={onEndTurn}>
              END TURN
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
