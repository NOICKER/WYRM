import React, { useEffect, useMemo, useRef, useState } from "react";

import { ContextTooltip } from "../components/ContextTooltip.tsx";
import { RuneTileCard } from "../components/RuneTileCard.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { TutorialOverlay, type TutorialBoundingBox } from "../components/TutorialOverlay.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import {
  getContextTooltipTriggers,
  type ContextTooltipTriggerSnapshot,
} from "../components/contextTooltipTriggerModel.ts";
import { PassTheScreenOverlay } from "./PassTheScreenOverlay.tsx";
import {
  createReconnectDeadlineTimestamp,
  getDisconnectedSeatLabel,
  getMatchPhaseDisplayLabel,
  getReconnectMinutesRemaining,
  shouldShowPauseOverlay,
} from "./matchPauseState.ts";
import { getControlledActiveWyrms } from "../state/gameLogic.ts";
import type { Coord, GameState, PlayerColor, PlayerId, RuneTileType, StepOption } from "../state/types.ts";
import {
  TUTORIAL_STORAGE_KEY,
  shouldShowTutorial,
  type TutorialHighlightTarget,
} from "../components/tutorialOverlayModel.ts";
import { useTooltipState } from "../state/useTooltipState.ts";
import {
  PLAYER_PALETTE,
  getPlayerInitial,
  getTileName,
  mapSeatColorsByPlayerId,
  mapSeatNamesByPlayerId,
  type AssemblyRoom,
} from "../ui/appModel.ts";
import { useMatchInteractions } from "../ui/useMatchInteractions.ts";

const LOCAL_PLAYER_COLORS: PlayerColor[] = ["purple", "coral", "teal", "amber"];
const EMPTY_TUTORIAL_BOXES: Record<TutorialHighlightTarget, TutorialBoundingBox | null> = {
  den: null,
  hand: null,
  die: null,
  board: null,
};

interface MatchScreenProps {
  room: AssemblyRoom;
  matchId: string;
  onNavigate: (href: string) => void;
  onAbandonMatch: () => void;
  localMode?: boolean;
  localPlayerNames?: Record<number, string>;
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
  disabled: boolean;
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

function formatMinuteCount(minutes: number): string {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function createTutorialBoundingBox(
  rect: Pick<TutorialBoundingBox, "top" | "left" | "right" | "bottom">,
  padding: number,
): TutorialBoundingBox {
  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const right = Math.min(window.innerWidth, rect.right + padding);
  const bottom = Math.min(window.innerHeight, rect.bottom + padding);

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function measureNodeTutorialBox(node: Element | null, padding = 0): TutorialBoundingBox | null {
  if (!node) {
    return null;
  }

  return createTutorialBoundingBox(node.getBoundingClientRect(), padding);
}

function measureCombinedTutorialBox(nodes: Element[], padding = 0): TutorialBoundingBox | null {
  if (nodes.length === 0) {
    return null;
  }

  const combined = nodes.reduce(
    (current, node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: Math.min(current.top, rect.top),
        left: Math.min(current.left, rect.left),
        right: Math.max(current.right, rect.right),
        bottom: Math.max(current.bottom, rect.bottom),
      };
    },
    {
      top: Number.POSITIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );

  return createTutorialBoundingBox(combined, padding);
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
  disabled,
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
              data-tutorial-den={cell.type.startsWith("den_p") ? cell.type.slice(-1) : undefined}
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
              disabled={disabled}
              onClick={() => onCellClick(coord)}
            >
              {cell.hasPowerRune ? <span className="match-board-cell__rune">◆</span> : null}
              {cell.hasWall ? <span className="match-board-cell__wall">✕</span> : null}
              {cell.trail && state.currentRound <= cell.trail.expiresAfterRound ? (
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

export function MatchScreen({
  room,
  matchId,
  onNavigate,
  onAbandonMatch,
  localMode = false,
  localPlayerNames,
}: MatchScreenProps): React.JSX.Element {
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
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const handTrayRef = useRef<HTMLElement | null>(null);
  const dieBadgeRef = useRef<HTMLDivElement | null>(null);
  const helperCardRef = useRef<HTMLElement | null>(null);
  const coilChoiceRef = useRef<HTMLDivElement | null>(null);
  const deployAreaRef = useRef<HTMLDivElement | null>(null);
  const previousTooltipSnapshotRef = useRef<ContextTooltipTriggerSnapshot | null>(null);
  const previousTooltipEligibilityRef = useRef(false);
  const { activeTooltipKey, showTooltip, dismissTooltip } = useTooltipState();
  const [cellSize, setCellSize] = useState(48);
  const [rollingFace, setRollingFace] = useState<string | null>(null);
  const [showPassOverlay, setShowPassOverlay] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasResolvedTutorialVisibility, setHasResolvedTutorialVisibility] = useState(localMode);
  const [tutorialBoxes, setTutorialBoxes] = useState<Record<TutorialHighlightTarget, TutorialBoundingBox | null>>(
    EMPTY_TUTORIAL_BOXES,
  );
  const [overlayDismissedForPlayer, setOverlayDismissedForPlayer] = useState<PlayerId | null>(null);
  const [pauseOverlayDismissed, setPauseOverlayDismissed] = useState(false);
  const [reconnectDeadlineAt, setReconnectDeadlineAt] = useState<number | null>(null);
  const [minutesRemaining, setMinutesRemaining] = useState(room.reconnectDeadlineMinutes);

  // In local mode, derive names and colours from localPlayerNames prop instead of room seats
  const playerNames = useMemo<Record<PlayerId, string>>(() => {
    if (localMode && localPlayerNames) {
      return {
        1: localPlayerNames[1] ?? "Player 1",
        2: localPlayerNames[2] ?? "Player 2",
        3: localPlayerNames[3] ?? "Player 3",
        4: localPlayerNames[4] ?? "Player 4",
      };
    }
    return mapSeatNamesByPlayerId(room);
  }, [localMode, localPlayerNames, room]);

  const playerColors = useMemo<Record<PlayerId, PlayerColor>>(() => {
    if (localMode) {
      return {
        1: LOCAL_PLAYER_COLORS[0],
        2: LOCAL_PLAYER_COLORS[1],
        3: LOCAL_PLAYER_COLORS[2],
        4: LOCAL_PLAYER_COLORS[3],
      };
    }
    return mapSeatColorsByPlayerId(room);
  }, [localMode, room]);

  const currentPlayerColor = getColorValue(playerColors[currentPlayer.id]);
  const activePlayerName = playerNames[currentPlayer.id];
  const isPaused = room.matchStatus === "paused_disconnected";
  const passOverlayBlocking = localMode && state.phase !== "game_over" && overlayDismissedForPlayer !== currentPlayer.id;
  const disconnectedSeatLabel = getDisconnectedSeatLabel(room.disconnectedSeatName);
  const phaseDisplayLabel = getMatchPhaseDisplayLabel(room.matchStatus, state.phase);
  const pauseCardVisible = shouldShowPauseOverlay(room.matchStatus, pauseOverlayDismissed);
  const pauseDurationCopy = formatMinuteCount(room.reconnectDeadlineMinutes);
  const pauseRemainingCopy = formatMinuteCount(minutesRemaining);

  // Show pass-the-screen overlay whenever the active player changes in local mode
  useEffect(() => {
    if (!localMode) return;
    if (state.phase === "game_over") return;
    // Only show if the current player hasn't already dismissed for this turn
    if (overlayDismissedForPlayer === currentPlayer.id) return;
    setShowPassOverlay(true);
  }, [currentPlayer.id, localMode, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset dismissed tracker whenever phase returns to draw (new turn)
  useEffect(() => {
    if (!localMode) return;
    if (state.phase === "draw") {
      setOverlayDismissedForPlayer(null);
    }
  }, [localMode, state.phase]);

  useEffect(() => {
    if (!isPaused) {
      setPauseOverlayDismissed(false);
      setReconnectDeadlineAt(null);
      setMinutesRemaining(room.reconnectDeadlineMinutes);
      return;
    }

    const deadlineAt = createReconnectDeadlineTimestamp(Date.now(), room.reconnectDeadlineMinutes);
    setReconnectDeadlineAt(deadlineAt);
    setMinutesRemaining(getReconnectMinutesRemaining(deadlineAt, Date.now()));
  }, [isPaused, room.reconnectDeadlineMinutes]);

  useEffect(() => {
    if (!isPaused || reconnectDeadlineAt == null) {
      return;
    }

    const syncCountdown = () => {
      setMinutesRemaining(getReconnectMinutesRemaining(reconnectDeadlineAt, Date.now()));
    };

    syncCountdown();
    const intervalId = window.setInterval(syncCountdown, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isPaused, reconnectDeadlineAt]);

  useEffect(() => {
    if (!isPaused) {
      return;
    }

    clearInteraction();
    setPeekPlayerId(null);
    setShowPassOverlay(false);
    // The pause state should always drop any in-progress board selection immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  useEffect(() => {
    if (localMode) {
      setShowTutorial(false);
      setHasResolvedTutorialVisibility(true);
      return;
    }

    let hasPlayedFlag: string | null = null;
    try {
      hasPlayedFlag = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
    } catch {
      hasPlayedFlag = null;
    }

    setShowTutorial(shouldShowTutorial({ hasPlayedFlag, localMode }));
    setHasResolvedTutorialVisibility(true);
  }, [localMode, matchId]);

  useEffect(() => {
    if (!showTutorial) {
      return;
    }

    const boardScrollNode = boardScrollRef.current;

    const updateTutorialBoxes = () => {
      const denNodes = boardRef.current
        ? Array.from(boardRef.current.querySelectorAll<HTMLElement>(`[data-tutorial-den="${currentPlayer.id}"]`))
        : [];
      const boardGrid =
        boardScrollNode?.querySelector<HTMLElement>(".match-board-grid") ?? boardScrollNode;

      setTutorialBoxes({
        den: measureCombinedTutorialBox(denNodes, 6),
        hand: measureNodeTutorialBox(handTrayRef.current, 12),
        die: measureNodeTutorialBox(dieBadgeRef.current, 10),
        board: measureNodeTutorialBox(boardGrid, 12),
      });
    };

    updateTutorialBoxes();

    const resizeObserver = new ResizeObserver(() => updateTutorialBoxes());
    const observedNodes = [boardRef.current, boardScrollNode, handTrayRef.current, dieBadgeRef.current].filter(
      (node): node is HTMLElement => node != null,
    );
    for (const node of observedNodes) {
      resizeObserver.observe(node);
    }

    const handleViewportChange = () => updateTutorialBoxes();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    boardScrollNode?.addEventListener("scroll", handleViewportChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      boardScrollNode?.removeEventListener("scroll", handleViewportChange);
    };
  }, [currentPlayer.id, showTutorial]);

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

  const localViewerPlayerId = useMemo<PlayerId | null>(() => {
    if (localMode) {
      return currentPlayer.id;
    }
    return room.seats.find((seat) => seat.currentUser)?.playerId ?? null;
  }, [currentPlayer.id, localMode, room]);

  const canShowContextTooltips =
    hasResolvedTutorialVisibility
    && !showTutorial
    && !passOverlayBlocking
    && !isPaused
    && state.phase !== "game_over"
    && localViewerPlayerId != null
    && currentPlayer.id === localViewerPlayerId;

  const tooltipSnapshot = useMemo<ContextTooltipTriggerSnapshot>(
    () => ({
      state,
      moveTargets,
      hoardChoicesCount: hoardChoices.length,
      lairTile,
      viewerPlayerId: localViewerPlayerId,
    }),
    [state, moveTargets, hoardChoices.length, lairTile, localViewerPlayerId],
  );

  useEffect(() => {
    const previousSnapshot = previousTooltipEligibilityRef.current ? previousTooltipSnapshotRef.current : null;

    if (canShowContextTooltips) {
      const nextKeys = getContextTooltipTriggers({
        previous: previousSnapshot,
        current: tooltipSnapshot,
        isLocalTurn: true,
      });

      for (const key of nextKeys) {
        showTooltip(key);
      }
    }

    previousTooltipSnapshotRef.current = tooltipSnapshot;
    previousTooltipEligibilityRef.current = canShowContextTooltips;
  }, [canShowContextTooltips, showTooltip, tooltipSnapshot]);

  let activeTooltipAnchorRef: React.RefObject<Element | null> = helperCardRef;
  if (activeTooltipKey === "trail_created" || activeTooltipKey === "sacred_grove_nearby" || activeTooltipKey === "capture_available") {
    activeTooltipAnchorRef = boardScrollRef;
  } else if (activeTooltipKey === "lair_power_available") {
    activeTooltipAnchorRef = handTrayRef;
  } else if (activeTooltipKey === "coil_choice") {
    activeTooltipAnchorRef = coilChoiceRef.current ? coilChoiceRef : dieBadgeRef;
  } else if (activeTooltipKey === "hoard_deploy_available") {
    activeTooltipAnchorRef = deployAreaRef.current ? deployAreaRef : helperCardRef;
  }

  useEffect(() => {
    const container = boardRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width > 0 ? entry.contentRect.width : container.clientWidth;
        const height = entry.contentRect.height > 0 ? entry.contentRect.height : container.clientHeight;
        
        let newSize = Math.floor(Math.min(width, height) / 12);
        
        if (state.board[0]) {
          const cols = state.board[0].length;
          const rows = state.board.length;
          const maxByWidth = Math.floor(width / cols);
          const maxByHeight = Math.floor(height / rows);
          
          if (newSize * cols > width) {
            newSize = maxByHeight;
            if (newSize * cols > width) {
                newSize = maxByWidth;
            }
          }
        }
        
        if (newSize < 32) newSize = 32;
        if (newSize > 56) newSize = 56;
        setCellSize(newSize);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [state.board]);

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
      {localMode && showPassOverlay && (
        <PassTheScreenOverlay
          playerName={activePlayerName}
          playerColor={playerColors[currentPlayer.id]}
          onReady={() => {
            setOverlayDismissedForPlayer(currentPlayer.id);
            setShowPassOverlay(false);
          }}
        />
      )}
      {showTutorial ? (
        <TutorialOverlay
          currentPhase={state.phase}
          selectedWyrmId={selectedWyrmId}
          highlightBoxes={tutorialBoxes}
          onComplete={() => setShowTutorial(false)}
        />
      ) : null}
      {canShowContextTooltips && activeTooltipKey ? (
        <ContextTooltip
          tooltipKey={activeTooltipKey}
          anchorRef={activeTooltipAnchorRef}
          onDismiss={() => dismissTooltip(activeTooltipKey)}
        />
      ) : null}
      <div className="match-screen__viewport">
        <header className="match-topbar">
          <Wordmark href="/lobby" onNavigate={onNavigate} compact />

          <div className={isPaused ? "match-phase match-phase--paused" : "match-phase"}>
            <span>{phaseDisplayLabel}</span>
          </div>

          <div className="match-topbar__right">
            <button
              type="button"
              className="button button--outline"
              style={{
                minWidth: "2.85rem",
                minHeight: "2.85rem",
                padding: "0.5rem",
                borderRadius: "999px",
              }}
              onClick={() => onNavigate("/settings")}
              aria-label="Open settings"
              title="Settings"
            >
              ⚙
            </button>
            <div ref={dieBadgeRef} className="die-badge" aria-live="polite">
              {dieBadgeValue}
            </div>
            {!localMode && (
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
            )}
          </div>
        </header>

        <section className="match-body">
          <aside ref={helperCardRef} className="helper-card">
            <div className="helper-card__header">
              <div>
                <span>Action Helper</span>
                <strong>{matchId}</strong>
              </div>
            </div>

            <p className="helper-card__copy">
              {isPaused
                ? `Match paused while we wait for ${disconnectedSeatLabel} to reconnect.`
                : instruction}
            </p>

            <div className="helper-card__legend">
              <span><i className="legend-dot legend-dot--move" /> Valid Move</span>
              <span><i className="legend-dot legend-dot--capture" /> Lethal Strike</span>
            </div>

            {!isPaused && (state.phase === "draw" || state.phase === "roll" || state.phase === "discard") ? (
              <button type="button" className="button button--forest button--wide" onClick={handlePrimaryAction}>
                {phaseActionLabel}
              </button>
            ) : null}

            {state.error ? <ScreenError message={state.error} /> : null}

            {!isPaused && state.phase === "move" && state.dieResult === "coil" && !state.turnEffects.coilChoice ? (
              <div
                ref={coilChoiceRef}
                className="coil-choice-panel"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}
              >
                {[1, 2, 3].map((choice) => (
                  <button key={choice} type="button" className="button button--outline" onClick={() => onSetCoilChoice(choice as 1 | 2 | 3)}>
                    Move {choice}
                  </button>
                ))}
                <button type="button" className="button button--forest" style={{ backgroundColor: "var(--color-primary-base)" }} onClick={() => onSetCoilChoice("extra_trail")}>
                  Place Trail
                </button>
              </div>
            ) : null}

            {!isPaused && state.phase === "move" && state.turnEffects.tempestRushRemaining.length > 0 && !state.turnEffects.mainMoveCompleted ? (
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

            {!isPaused && (tileDraft?.tile === "light" || (tileDraft?.tile === "void" && !tileDraft.opponentId) || tileDraft?.tile === "void" && tileDraft.mode === "lair") ? (
              <div className="helper-card__stack">
                {opponentChoices.map((opponent) => (
                  <button key={opponent.id} type="button" className="button button--outline" onClick={() => chooseOpponent(opponent.id)}>
                    {opponent.label}
                  </button>
                ))}
              </div>
            ) : null}

            {!isPaused && tileDraft?.tile === "void" && tileDraft.mode === "single" && tileDraft.opponentId ? (
              <button type="button" className="button button--forest button--wide" onClick={confirmVoidSelection}>
                Confirm Erasure
              </button>
            ) : null}

            {!isPaused && ((tileDraft?.tile === "shadow" && tileDraft.mode === "lair") || (tileDraft?.tile === "serpent" && tileDraft.mode === "lair")) ? (
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

            {!isPaused && hoardChoices.length > 0 && !tileDraft && (state.phase === "move" || state.phase === "play_tile") ? (
              <div ref={deployAreaRef} className="helper-card__stack">
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

            {!isPaused ? (
              <button type="button" className="button button--ghost button--wide" onClick={clearInteraction}>
              Clear Selection
              </button>
            ) : null}
          </aside>

          <div className={isPaused ? "match-board-stage match-board-stage--paused" : "match-board-stage"} ref={boardRef}>
            {isPaused && pauseOverlayDismissed ? (
              <div className="match-board-pause-banner" role="status" aria-live="polite">
                <span>{disconnectedSeatLabel} disconnected</span>
                <span>{pauseRemainingCopy} remaining</span>
              </div>
            ) : null}
            <div ref={boardScrollRef} className="match-board-scroll">
              <MatchBoardGrid
                cellSize={cellSize}
                state={state}
                selectedPath={selectedPath}
                selectedWyrmId={selectedWyrmId}
                moveTargets={moveTargets}
                actionTargets={actionTargets}
                markedTargets={markedTargets}
                playerNames={playerNames}
                disabled={isPaused}
                onCellClick={handleBoardClick}
              />
            </div>
            {isPaused && pauseCardVisible ? (
              <div className="match-board-pause-layer">
                <article className="match-board-pause-card">
                  <span className="match-board-pause-card__eyebrow">Reconnect Window</span>
                  <h2>{disconnectedSeatLabel} disconnected</h2>
                  <p>
                    Match is paused. The room will be held for {pauseDurationCopy} while we wait for them to return.
                  </p>
                  <div className="match-board-pause-card__timer" aria-live="polite">
                    <strong>{pauseRemainingCopy}</strong>
                    <span>remaining</span>
                  </div>
                  <div className="match-board-pause-card__actions">
                    <button
                      type="button"
                      className="button button--outline"
                      onClick={() => setPauseOverlayDismissed(true)}
                    >
                      Wait
                    </button>
                    <button type="button" className="button button--danger" onClick={onAbandonMatch}>
                      Abandon match
                    </button>
                  </div>
                </article>
              </div>
            ) : null}
          </div>
        </section>

        <footer ref={handTrayRef} className="hand-tray">
          <div className="hand-tray__player">
            <h2 style={{ color: currentPlayerColor }}>{activePlayerName}</h2>
            <div className="phase-stepper">
              {isPaused ? (
                <span className="phase-stepper__pill phase-stepper__pill--paused">Paused</span>
              ) : (
                ["draw", "roll", "move", "play_tile"].map((phase, index) => {
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
                })
              )}
            </div>
          </div>

          <div className="hand-tray__cards">
            {trayTiles.map((tile, index) => {
              const copies = tileCounts[tile];
              const selectedForDiscard = !isPaused && discardSelection.includes(index);
              const cardActive =
                selectedForDiscard ||
                (!isPaused && Boolean(tileDraft && "tile" in tileDraft && tileDraft.tile === tile)) ||
                (!isPaused && Boolean(selectedMove && selectedMove.moveMode === "tempest" && index === 0));

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
                    disabled={isPaused || (!canPlayTiles && state.phase !== "discard")}
                    onPlay={
                      isPaused
                        ? undefined
                        : state.phase === "discard"
                        ? () => toggleDiscard(index)
                        : canPlayTiles
                          ? () => startTileDraft(tile, "single")
                          : undefined
                    }
                    onPlayLair={!isPaused && copies >= 3 && canPlayTiles ? () => startTileDraft(tile, "lair") : undefined}
                  />
                </div>
              );
            })}
          </div>

          <div className="hand-tray__actions">
            {!isPaused ? (
              <>
                <button type="button" className="button button--forest button--wide" disabled={!canConfirmMove} onClick={performPhasePrimaryAction}>
                  CONFIRM MOVE
                </button>
                <button type="button" className="button button--outline button--wide" disabled={!canEndTurn} onClick={onEndTurn}>
                  END TURN
                </button>
              </>
            ) : null}
          </div>
        </footer>
      </div>
    </main>
  );
}
