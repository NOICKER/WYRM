import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContextTooltip } from "../components/ContextTooltip.tsx";
import { RuneTileCard } from "../components/RuneTileCard.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { TutorialOverlay, type TutorialBoundingBox } from "../components/TutorialOverlay.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import {
  getContextTooltipTriggers,
  type ContextTooltipTriggerSnapshot,
} from "../components/contextTooltipTriggerModel.ts";
import { getControlledActiveWyrms } from "../state/gameLogic.ts";
import { PlayerSidebar } from "../components/PlayerSidebar.tsx";
import { PassTheScreenOverlay } from "./PassTheScreenOverlay.tsx";
import {
  createReconnectDeadlineTimestamp,
  getDisconnectedSeatLabel,
  getMatchPhaseDisplayLabel,
  getReconnectMinutesRemaining,
  shouldShowPauseOverlay,
} from "./matchPauseState.ts";
import type { Coord, GameState, PlayerColor, PlayerId, RuneTileType, StepOption } from "../state/types.ts";
import {
  TUTORIAL_STORAGE_KEY,
  shouldShowTutorial,
  type TutorialHighlightTarget,
} from "../components/tutorialOverlayModel.ts";
import type { BotDifficulty } from "../state/botEngine.ts";
import { useTooltipState } from "../state/useTooltipState.ts";
import {
  PLAYER_PALETTE,
  getPlayerInitial,
  getTileName,
  mapSeatColorsByPlayerId,
  mapSeatNamesByPlayerId,
  type AssemblyRoom,
} from "../ui/appModel.ts";
import {
  getHandCardInteractionMode,
  getPrimaryActionConfig,
  getVictoryOverlayCopy,
  shouldShowDeployOverlay,
} from "../ui/matchInteractionModel.ts";
import { useMatchInteractions } from "../ui/useMatchInteractions.ts";

const LOCAL_PLAYER_COLORS: PlayerColor[] = ["purple", "coral", "teal", "amber"];
const TURN_PROGRESS_STEPS = [
  { key: "draw", label: "Draw" },
  { key: "roll", label: "Roll" },
  { key: "move", label: "Move" },
  { key: "tile", label: "Tile" },
] as const;
const EMPTY_TUTORIAL_BOXES: Record<TutorialHighlightTarget, TutorialBoundingBox | null> = {
  den: null,
  hand: null,
  die: null,
  board: null,
};

type TurnProgressKey = (typeof TURN_PROGRESS_STEPS)[number]["key"];

interface DrawFeedbackState {
  id: number;
  count: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  active: boolean;
}

interface ToastState {
  id: number;
  message: string;
}

interface MatchScreenProps {
  room: AssemblyRoom;
  matchId: string;
  onNavigate: (href: string) => void;
  onAbandonMatch: () => void;
  onOpenGuide: () => void;
  onRestartMatch?: () => void;
  localMode?: boolean;
  localPlayerNames?: Record<number, string>;
  localPlayerBots?: Record<number, BotDifficulty>;
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
          const trailRoundsRemaining = cell.trail ? cell.trail.expiresAfterRound - state.currentRound : 0;
          const trailOpacity = trailRoundsRemaining >= 2 ? 0.9 : trailRoundsRemaining === 1 ? 0.5 : 0.2;
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
                  {trailRoundsRemaining === 0 ? <span className="match-board-cell__trail-dot" /> : null}
                </span>
              ) : null}
              {inPath && pathIndex > 0 ? <span className="match-board-cell__index">{pathIndex}</span> : null}
              {wyrm ? (
                <span
                  className={[
                    "match-board-cell__token",
                    `match-board-cell__token--${wyrm.originalOwner}`,
                    wyrm.currentOwner !== wyrm.originalOwner ? `match-board-cell__token-control--${wyrm.currentOwner}` : "",
                    wyrm.isElder ? "match-board-cell__token--elder" : "",
                    selectedWyrm ? "match-board-cell__token--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {wyrm.isElder ? "★" : getPlayerInitial(playerNames[wyrm.originalOwner])}
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
  onOpenGuide,
  onRestartMatch,
  localMode = false,
  localPlayerNames,
  localPlayerBots,
}: MatchScreenProps): React.JSX.Element {
  const {
    game,
    state,
    phase,
    currentPlayer,
    preferredMoveMode,
    selectedMove,
    selectedWyrmId,
    tileDraft,
    deployWyrmId,
    trailWyrmId,
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
    onSetCoilChoice,
    onSetPreferredMoveMode,
    chooseOpponent,
    chooseSpecialWyrm,
    hoardChoices,
    opponentChoices,
    canDeployFromHoard,
  } = useMatchInteractions();

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const handTrayRef = useRef<HTMLElement | null>(null);
  const handCardsRef = useRef<HTMLDivElement | null>(null);
  const deckCountRef = useRef<HTMLDivElement | null>(null);
  const dieBadgeRef = useRef<HTMLDivElement | null>(null);
  const coilChoiceRef = useRef<HTMLDivElement | null>(null);
  const deployAreaRef = useRef<HTMLDivElement | null>(null);
  const previousTooltipSnapshotRef = useRef<ContextTooltipTriggerSnapshot | null>(null);
  const previousTooltipEligibilityRef = useRef(false);
  const previousDrawSnapshotRef = useRef<{ phase: string; playerId: PlayerId; handLength: number } | null>(null);
  const drawFeedbackTimerIdsRef = useRef<number[]>([]);
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
  const [showSidebar, setShowSidebar] = useState(false);
  const toggleSidebar = useCallback(() => setShowSidebar((prev) => !prev), []);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [drawFeedback, setDrawFeedback] = useState<DrawFeedbackState | null>(null);
  const [drawToast, setDrawToast] = useState<ToastState | null>(null);

  const clearDrawFeedbackTimers = useCallback(() => {
    for (const timerId of drawFeedbackTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    drawFeedbackTimerIdsRef.current = [];
  }, []);

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
  const isBotPlayer = localPlayerBots && currentPlayer.id in localPlayerBots;
  const passOverlayBlocking = localMode && phase !== "end" && overlayDismissedForPlayer !== currentPlayer.id && !isBotPlayer;
  const disconnectedSeatLabel = getDisconnectedSeatLabel(room.disconnectedSeatName);
  const phaseDisplayLabel = getMatchPhaseDisplayLabel(room.matchStatus, state.phase);
  const pauseCardVisible = shouldShowPauseOverlay(room.matchStatus, pauseOverlayDismissed);
  const pauseDurationCopy = formatMinuteCount(room.reconnectDeadlineMinutes);
  const pauseRemainingCopy = formatMinuteCount(minutesRemaining);
  const handCardInteractionMode = getHandCardInteractionMode({
    phase,
    isPaused,
    canPlayTiles,
  });
  const primaryAction = getPrimaryActionConfig({
    phase,
    canConfirmDiscard,
    canConfirmMove,
    canSkipTile: canEndTurn,
    tileActionUsed: state.turnEffects.tileActionUsed,
    hasTileSelection: tileDraft != null,
    isPaused,
  });
  const hasClearableInteraction =
    selectedMove != null
    || tileDraft != null
    || deployWyrmId != null
    || discardSelection.length > 0;
  const showDrawHelper = !isPaused && phase === "draw";
  const turnProgressPhase: TurnProgressKey =
    phase === "discard" ? "draw" : phase === "end" ? "tile" : phase;
  const turnProgressStepIndex = TURN_PROGRESS_STEPS.findIndex((step) => step.key === turnProgressPhase);
  const showVictoryOverlay = state.winner !== null;
  const victoryOverlayCopy = getVictoryOverlayCopy(state, playerNames);
  const victoryAccentColor = state.winner ? getColorValue(playerColors[state.winner]) : currentPlayerColor;
  const canRestartMatch = localMode || Boolean(onRestartMatch);

  // Show pass-the-screen overlay whenever the active player changes in local mode
  useEffect(() => {
    if (!localMode) return;
    if (phase === "end") return;
    if (localPlayerBots && currentPlayer.id in localPlayerBots) return;
    // Only show if the current player hasn't already dismissed for this turn
    if (overlayDismissedForPlayer === currentPlayer.id) return;
    setShowPassOverlay(true);
  }, [currentPlayer.id, localMode, phase, localPlayerBots]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset dismissed tracker whenever phase returns to draw (new turn)
  useEffect(() => {
    if (!localMode) return;
    if (phase === "draw") {
      setOverlayDismissedForPlayer(null);
    }
  }, [localMode, phase]);

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

  useEffect(
    () => () => {
      clearDrawFeedbackTimers();
    },
    [clearDrawFeedbackTimers],
  );

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
    && phase !== "end"
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

  let activeTooltipAnchorRef: React.RefObject<Element | null> = boardRef;
  if (
    activeTooltipKey === "trail_created"
    || activeTooltipKey === "sacred_grove_nearby"
    || activeTooltipKey === "capture_available"
    || activeTooltipKey === "blocked_move_available"
  ) {
    activeTooltipAnchorRef = boardScrollRef;
  } else if (activeTooltipKey === "lair_power_available") {
    activeTooltipAnchorRef = handTrayRef;
  } else if (activeTooltipKey === "coil_choice") {
    activeTooltipAnchorRef = coilChoiceRef.current ? coilChoiceRef : dieBadgeRef;
  } else if (activeTooltipKey === "hoard_deploy_available") {
    activeTooltipAnchorRef = deployAreaRef.current ? deployAreaRef : boardRef;
  }

  // Determine if the board-action-overlay should render
  const showCoilChoice = !isPaused && phase === "move" && state.dieResult === "coil" && !state.turnEffects.coilChoice;
  const showTargetSelection = !isPaused && (tileDraft?.tile === "light" || (tileDraft?.tile === "void" && !tileDraft.opponentId) || (tileDraft?.tile === "void" && tileDraft.mode === "lair"));
  const showVoidConfirm = !isPaused && tileDraft?.tile === "void" && tileDraft.mode === "single" && Boolean(tileDraft.opponentId);
  const showSpecialWyrmChoice = !isPaused && ((tileDraft?.tile === "shadow" && tileDraft.mode === "lair") || (tileDraft?.tile === "serpent" && tileDraft.mode === "lair"));
  const showDeployHoard = shouldShowDeployOverlay({
    state,
    isPaused,
    hasTileDraft: tileDraft != null,
    deployWyrmId,
    hoardChoicesCount: hoardChoices.length,
  });
  const showBoardOverlay = showCoilChoice || showTargetSelection || showVoidConfirm || showSpecialWyrmChoice || showDeployHoard;

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

  const visiblePeekHand = peekPlayerId
    ? state.players.find((player) => player.id === peekPlayerId)?.hand ?? []
    : [];
  const dieBadgeValue = rollingFace ?? (state.dieResult == null ? "?" : state.dieResult === "surge" ? "5" : state.dieResult === "coil" ? "∞" : String(state.dieResult));

  useEffect(() => {
    const previousSnapshot = previousDrawSnapshotRef.current;

    if (
      previousSnapshot
      && previousSnapshot.playerId === currentPlayer.id
      && previousSnapshot.phase === "draw"
      && phase !== "draw"
    ) {
      const drawnCount = currentPlayer.hand.length - previousSnapshot.handLength;

      if (drawnCount > 0) {
        clearDrawFeedbackTimers();

        const feedbackId = Date.now();
        const toastMessage =
          drawnCount === 1 ? "+1 Rune Tile added" : `+${drawnCount} Rune Tiles added`;
        setDrawToast({ id: feedbackId, message: toastMessage });

        const deckRect = deckCountRef.current?.getBoundingClientRect();
        const handRect =
          handCardsRef.current?.getBoundingClientRect()
          ?? handTrayRef.current?.getBoundingClientRect()
          ?? null;

        if (deckRect && handRect) {
          const startX = deckRect.left + deckRect.width / 2 - 28;
          const startY = deckRect.top + deckRect.height / 2 - 38;
          const endX = handRect.left + handRect.width / 2 - 28;
          const endY = handRect.top + Math.min(18, handRect.height * 0.18);

          setDrawFeedback({
            id: feedbackId,
            count: drawnCount,
            startX,
            startY,
            deltaX: endX - startX,
            deltaY: endY - startY,
            active: false,
          });

          drawFeedbackTimerIdsRef.current.push(
            window.setTimeout(() => {
              setDrawFeedback((current) =>
                current?.id === feedbackId ? { ...current, active: true } : current,
              );
            }, 16),
          );
          drawFeedbackTimerIdsRef.current.push(
            window.setTimeout(() => {
              setDrawFeedback((current) => (current?.id === feedbackId ? null : current));
            }, 520),
          );
        }

        drawFeedbackTimerIdsRef.current.push(
          window.setTimeout(() => {
            setDrawToast((current) => (current?.id === feedbackId ? null : current));
          }, 1900),
        );
      }
    }

    previousDrawSnapshotRef.current = {
      phase,
      playerId: currentPlayer.id,
      handLength: currentPlayer.hand.length,
    };
  }, [clearDrawFeedbackTimers, currentPlayer.hand.length, currentPlayer.id, phase]);

  const handlePrimaryAction = () => {
    if (phase === "roll") {
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

  const handleRestartMatch = () => {
    clearDrawFeedbackTimers();
    setDrawFeedback(null);
    setDrawToast(null);
    setShowDiscardModal(false);
    setShowSidebar(false);
    setShowPassOverlay(false);
    setPauseOverlayDismissed(false);

    if (onRestartMatch) {
      onRestartMatch();
      return;
    }

    game.startNewGame(state.playerCount);
  };

  return (
    <main className="match-screen">
      {localMode && showPassOverlay && !showVictoryOverlay && (
        <PassTheScreenOverlay
          playerName={activePlayerName}
          playerColor={playerColors[currentPlayer.id]}
          onReady={() => {
            setOverlayDismissedForPlayer(currentPlayer.id);
            setShowPassOverlay(false);
          }}
        />
      )}
      {showTutorial && !showVictoryOverlay ? (
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

      {/* ── Sidebar Drawer (slides from right) ── */}
      {showVictoryOverlay && victoryOverlayCopy ? (
        <div
          className="match-victory-layer"
          style={{ "--victory-accent": victoryAccentColor } as React.CSSProperties}
        >
          <article className="match-victory-card" role="dialog" aria-modal="true" aria-labelledby="match-victory-title">
            <span className="match-victory-card__eyebrow">Victory</span>
            <h1 id="match-victory-title" className="match-victory-card__title">
              {victoryOverlayCopy.title}
            </h1>
            <p className="match-victory-card__detail">{victoryOverlayCopy.detail}</p>
            <p className="match-victory-card__meta">
              The match is over. Start a fresh game or exit back out when you&apos;re ready.
            </p>
            <div className="match-victory-card__actions">
              {canRestartMatch ? (
                <button type="button" className="button button--forest" onClick={handleRestartMatch}>
                  Play Again
                </button>
              ) : null}
              <button type="button" className="button button--outline" onClick={onAbandonMatch}>
                Exit Game
              </button>
            </div>
          </article>
        </div>
      ) : null}
      <div
        className={showSidebar ? "sidebar-drawer-backdrop sidebar-drawer-backdrop--open" : "sidebar-drawer-backdrop"}
        onClick={() => setShowSidebar(false)}
      />
      <div className={showSidebar ? "sidebar-drawer sidebar-drawer--open" : "sidebar-drawer"}>
        <div className="sidebar-drawer__header">
          <h3>Game Log</h3>
          <button type="button" className="sidebar-drawer__close" onClick={() => setShowSidebar(false)} aria-label="Close drawer">✕</button>
        </div>
        <PlayerSidebar
          state={state}
          peekPlayerId={peekPlayerId}
          pendingDeployWyrmId={deployWyrmId}
          canDeployFromHoard={canDeployFromHoard}
          onPrepareDeploy={prepareDeploy}
          onClosePeek={() => setPeekPlayerId(null)}
        />
      </div>

      <div className="match-screen__viewport">
        {/* ── Row 1: Topbar ── */}
        <header className="match-topbar">
          <Wordmark href="/lobby" onNavigate={onNavigate} compact />

          <div className={isPaused ? "match-phase match-phase--paused" : "match-phase"}>
            <span>{phaseDisplayLabel}</span>
          </div>

          <div className="match-topbar__right">
            <button
              type="button"
              className="button button--outline"
              style={{ whiteSpace: "nowrap" }}
              onClick={onOpenGuide}
            >
              How to Play
            </button>
            <button
              type="button"
              className="button button--outline sidebar-toggle-btn"
              onClick={toggleSidebar}
              aria-label="Open game log"
              title="Game Log"
            >
              📜
            </button>
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
          </div>
        </header>

        {/* ── Row 2: Opponent Tracker Bar (all 4 players) ── */}
        <div className="opponent-tracker-bar">
          {state.players.map((player) => {
            const activeCount = getControlledActiveWyrms(state, player.id).length;
            const isTurn = player.id === currentPlayer.id;
            const pColor = getColorValue(playerColors[player.id]);
            return (
              <div key={player.id} className={isTurn ? "tracker-card tracker-card--active" : "tracker-card"}>
                <div className="tracker-card__color-dot" style={{ background: pColor }} />
                <div className="tracker-card__info">
                  <div className="tracker-card__name">{playerNames[player.id]}</div>
                  <div className="tracker-card__stats">
                    <span>🐉{activeCount}</span>
                    <span>🃏{player.hand.length}</span>
                    <span>{player.elderTokenAvailable ? "★" : "☆"}</span>
                  </div>
                </div>
                <div className="tracker-card__hoard">
                  {player.hoard.length > 0 ? player.hoard.map((wyrmId) => {
                    const wyrm = state.wyrms[wyrmId];
                    const tokenColor = getColorValue(playerColors[wyrm.originalOwner as PlayerId]);
                    return (
                      <span
                        key={wyrmId}
                        className="tracker-card__hoard-token"
                        style={{ background: tokenColor }}
                        title={wyrm.label}
                      >
                        {wyrm.isElder ? "★" : getPlayerInitial(playerNames[wyrm.originalOwner as PlayerId])}
                      </span>
                    );
                  }) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Row 3: Board Area ── */}
        <section className="match-body">
          {!isPaused && instruction && phase !== "end" ? (
            <div className="match-board-guidance" aria-live="polite">
              <p className="match-board-guidance__instruction">{instruction}</p>
              {phase === "discard" ? (
                <p className="match-board-guidance__meta">
                  Discard down to five tiles before you can roll.
                </p>
              ) : null}
            </div>
          ) : null}
          <div
            className={isPaused ? "match-board-stage match-board-stage--paused" : "match-board-stage"}
            ref={boardRef}
            style={{ position: 'relative', width: 'min(100%, 72rem)', height: '100%', maxHeight: '100%' }}
          >
            {/* Floating clear selection */}
            {!isPaused && phase !== "end" && hasClearableInteraction ? (
              <div className="board-clear-action">
                <button type="button" className="button button--ghost" onClick={clearInteraction}>Clear</button>
              </div>
            ) : null}

            {/* Tempest Rush mode toggle (floating, top-right) */}
            {!isPaused && phase === "move" && state.turnEffects.tempestRushRemaining.length > 0 && !state.turnEffects.mainMoveCompleted ? (
              <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 8, display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className={preferredMoveMode === "main" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: '999px' }}
                  onClick={() => onSetPreferredMoveMode("main")}
                >
                  Main
                </button>
                <button
                  type="button"
                  className={preferredMoveMode === "tempest" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem', borderRadius: '999px' }}
                  onClick={() => onSetPreferredMoveMode("tempest")}
                >
                  Tempest
                </button>
              </div>
            ) : null}

            {/* Deck / Discard preview */}
            <div className="deck-discard-preview" style={{ position: 'absolute', bottom: '3.5rem', right: '0.75rem', display: 'flex', gap: '0.5rem', zIndex: 7, pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center', pointerEvents: 'auto' }}>
                <div ref={deckCountRef} style={{ width: '40px', height: '54px', background: 'var(--forest-800)', borderRadius: '4px', border: '2px solid rgba(240, 234, 214, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(17, 32, 20, 0.4)', color: 'var(--parchment-200)', fontSize: '0.8rem' }}>{state.deck.length}</div>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--parchment-200)', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>Deck</span>
              </div>
              <div style={{ textAlign: 'center', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setShowDiscardModal(true)}>
                <div style={{ width: '40px', height: '54px', position: 'relative', background: 'rgba(17, 32, 20, 0.3)', borderRadius: '4px' }}>
                  {state.discardPile.length > 0 ? (
                    <div style={{ position: 'absolute', inset: -3, transform: 'scale(0.55)', transformOrigin: 'top left' }}>
                      <RuneTileCard tile={state.discardPile[state.discardPile.length - 1]} copies={1} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%', border: '2px dashed rgba(240, 234, 214, 0.2)', borderRadius: '4px' }} />
                  )}
                </div>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--parchment-200)', fontWeight: 'bold', display: 'block', marginTop: '2px' }}>Discard</span>
              </div>
            </div>

            {/* Error display */}
            {state.error ? <div style={{ position: 'absolute', top: '2.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9 }}><ScreenError message={state.error} /></div> : null}

            {/* Peek hand (inline floating) */}
            {visiblePeekHand.length > 0 ? (
              <div style={{ position: 'absolute', top: '2.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9, padding: '0.6rem 1rem', borderRadius: '0.75rem', background: 'rgba(13, 23, 14, 0.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(240, 234, 214, 0.1)', maxWidth: '90%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.75rem' }}>Revealed Hand{peekPlayerId ? `: ${playerNames[peekPlayerId]}` : ""}</strong>
                  <button type="button" className="text-link" style={{ fontSize: '0.75rem' }} onClick={() => setPeekPlayerId(null)}>Close</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {visiblePeekHand.map((tile, index) => (
                    <span key={`${tile}-${index}`} style={{ padding: '0.25rem 0.45rem', borderRadius: '999px', background: 'rgba(184, 134, 11, 0.15)', fontSize: '0.72rem' }}>{getTileName(tile)}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Board Action Overlay (click-catching) ── */}
            {showBoardOverlay ? (
              <div className="board-action-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="board-action-overlay__panel">
                  {/* Coil choice */}
                  {showCoilChoice ? (
                    <>
                      <h4 className="board-action-overlay__title">Coil — Choose Movement</h4>
                      <div ref={coilChoiceRef} className="board-action-overlay__grid">
                        {[1, 2, 3].map((choice) => (
                          <button key={choice} type="button" className="button button--outline" onClick={() => onSetCoilChoice(choice as 1 | 2 | 3)}>
                            Move {choice}
                          </button>
                        ))}
                        <button type="button" className="button button--forest" onClick={() => onSetCoilChoice("extra_trail")}>
                          Place Trail
                        </button>
                      </div>
                    </>
                  ) : null}

                  {/* Target selection (void/light opponent chooser) */}
                  {showTargetSelection ? (
                    <>
                      <h4 className="board-action-overlay__title">Choose Target</h4>
                      <div className="board-action-overlay__grid">
                        {opponentChoices.map((opponent) => (
                          <button key={opponent.id} type="button" className="button button--outline" onClick={() => chooseOpponent(opponent.id)}>
                            {opponent.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {/* Void confirm */}
                  {showVoidConfirm ? (
                    <>
                      <h4 className="board-action-overlay__title">Confirm Void Erasure</h4>
                      <button type="button" className="button button--forest button--wide" onClick={confirmVoidSelection}>
                        Confirm Erasure
                      </button>
                    </>
                  ) : null}

                  {/* Shadow/Serpent lair wyrm choice */}
                  {showSpecialWyrmChoice ? (
                    <>
                      <h4 className="board-action-overlay__title">Select Wyrm</h4>
                      <div className="board-action-overlay__grid">
                        {hoardChoices.map((choice) => (
                          <button key={choice.wyrmId} type="button" className="button button--outline" onClick={() => chooseSpecialWyrm(choice.wyrmId)}>
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {/* Deploy hoard */}
                  {showDeployHoard ? (
                    <>
                      <h4 className="board-action-overlay__title">Deploy from Hoard</h4>
                      <div ref={deployAreaRef} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', padding: '0.5rem 0' }}>
                        {hoardChoices.map((choice) => {
                          const wyrm = state.wyrms[choice.wyrmId];
                          const isSelected = deployWyrmId === choice.wyrmId;
                          return (
                            <button
                              key={choice.wyrmId}
                              type="button"
                              className={[
                                "match-board-cell__token",
                                `match-board-cell__token--${wyrm.currentOwner}`,
                                wyrm.isElder ? "match-board-cell__token--elder" : "",
                                isSelected ? "match-board-cell__token--selected" : ""
                              ].filter(Boolean).join(" ")}
                              style={{
                                position: 'relative',
                                cursor: 'pointer',
                                transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                                boxShadow: isSelected ? '0 0 0 2px white' : 'none',
                                transition: 'all 0.2s',
                                width: '36px',
                                height: '36px',
                              }}
                              onClick={() => prepareDeploy(choice.wyrmId)}
                              aria-label={`Deploy ${choice.label}`}
                              disabled={!canDeployFromHoard}
                            >
                              {wyrm.isElder ? "★" : getPlayerInitial(playerNames[wyrm.currentOwner])}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Pause banner (inline) */}
            {isPaused && pauseOverlayDismissed ? (
              <div className="match-board-pause-banner" role="status" aria-live="polite">
                <span>{disconnectedSeatLabel} disconnected</span>
                <span>{pauseRemainingCopy} remaining</span>
              </div>
            ) : null}

            {/* Board grid */}
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
                disabled={showVictoryOverlay || isPaused || (phase !== "move" && tileDraft == null && deployWyrmId == null && trailWyrmId == null)}
                onCellClick={handleBoardClick}
              />
            </div>

            {/* Pause overlay card */}
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

        {/* ── Row 4: Hand Tray (locked 200px) ── */}
        <footer ref={handTrayRef} className="hand-tray">
          <div className="hand-tray__player">
            <h2 style={{ color: currentPlayerColor }}>{activePlayerName}</h2>
            <div className="turn-progress" aria-label="Turn Progress">
              <span className="turn-progress__label">Turn Progress:</span>
              {isPaused ? (
                <span className="turn-progress__pill turn-progress__pill--paused">Paused</span>
              ) : (
                TURN_PROGRESS_STEPS.map((step, index) => {
                  const active = phase !== "end" && index === turnProgressStepIndex;
                  const completed = phase === "end" || index < turnProgressStepIndex;
                  return (
                    <React.Fragment key={step.key}>
                      <span
                        className={[
                          "turn-progress__step",
                          active ? "turn-progress__step--active" : "",
                          completed ? "turn-progress__step--done" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={active ? { color: currentPlayerColor } : undefined}
                        aria-current={active ? "step" : undefined}
                      >
                        <span>{step.label}</span>
                        {completed ? <span className="turn-progress__status" aria-hidden="true">✓</span> : null}
                        {!completed && active ? <span className="turn-progress__status" aria-hidden="true">●</span> : null}
                      </span>
                      {index < TURN_PROGRESS_STEPS.length - 1 ? (
                        <span className="turn-progress__separator" aria-hidden="true">→</span>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          <div ref={handCardsRef} className="hand-tray__cards">
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
                    className="rune-card-shell--tray"
                    tile={tile}
                    copies={copies}
                    active={cardActive}
                    elevated={index === lairFocusIndex && Boolean(lairTile)}
                    lairReady={lairTile === tile && copies >= 3}
                    disabled={handCardInteractionMode === "disabled"}
                    onActivate={
                      handCardInteractionMode === "discard"
                        ? () => toggleDiscard(index)
                        : handCardInteractionMode === "play"
                          ? () => startTileDraft(tile, "single")
                          : undefined
                    }
                    onPlayLair={
                      handCardInteractionMode === "play" && copies >= 3
                        ? () => startTileDraft(tile, "lair")
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="hand-tray__actions">
            {showDrawHelper ? (
              <div className="turn-helper">
                <span className="turn-helper__copy">Draw Rune Tile → Adds 1 ability card to your hand</span>
                <span className="turn-helper__tooltip">
                  <button type="button" className="turn-helper__tooltip-trigger" aria-label="What are Rune Tiles?">
                    ?
                  </button>
                  <span className="turn-helper__tooltip-bubble" role="tooltip">
                    Rune Tiles are abilities you can play after moving
                  </span>
                </span>
              </div>
            ) : null}
            {!isPaused && primaryAction.visible ? (
              <button
                type="button"
                className="button button--forest button--wide"
                disabled={primaryAction.disabled}
                onClick={handlePrimaryAction}
              >
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        </footer>
      </div>

      {drawFeedback ? (
        <div
          className={drawFeedback.active ? "draw-feedback-card draw-feedback-card--active" : "draw-feedback-card"}
          aria-hidden="true"
          style={
            {
              left: `${drawFeedback.startX}px`,
              top: `${drawFeedback.startY}px`,
              "--draw-feedback-dx": `${drawFeedback.deltaX}px`,
              "--draw-feedback-dy": `${drawFeedback.deltaY}px`,
            } as React.CSSProperties
          }
        >
          <span className="draw-feedback-card__count">+{drawFeedback.count}</span>
        </div>
      ) : null}
      {drawToast ? (
        <div className="match-toast" role="status" aria-live="polite">
          {drawToast.message}
        </div>
      ) : null}

      {showDiscardModal && (
        <div className="modal-overlay" onClick={() => setShowDiscardModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17, 32, 20, 0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--forest-950)', border: '1px solid var(--forest-800)', padding: '24px', borderRadius: '12px', maxWidth: '80vw', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Discard Pile ({state.discardPile.length})</h2>
              <button type="button" className="text-link" onClick={() => setShowDiscardModal(false)} style={{ fontSize: '1.2rem', padding: '8px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {state.discardPile.length > 0 ? [...state.discardPile].reverse().map((tile, i) => (
                <div key={i} style={{ width: '80px', height: '110px', position: 'relative' }}>
                  <div style={{ position: 'absolute', transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                    <RuneTileCard tile={tile} copies={1} />
                  </div>
                </div>
              )) : <p style={{ color: 'var(--forest-600)' }}>Discard pile is empty.</p>}
            </div>
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="button button--outline" onClick={() => setShowDiscardModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
