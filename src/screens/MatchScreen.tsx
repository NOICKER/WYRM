import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContextTooltip } from "../components/ContextTooltip.tsx";
import { RuneTileCard } from "../components/RuneTileCard.tsx";
import { TutorialOverlay, type TutorialBoundingBox } from "../components/TutorialOverlay.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import {
  getContextTooltipTriggers,
  type ContextTooltipTriggerSnapshot,
} from "../components/contextTooltipTriggerModel.ts";
import { getControlledActiveWyrms, TILE_HELP } from "../state/gameLogic.ts";
import {
  getMoveConsequenceSummary,
  getProjectedReachableCellsFromPrefix,
  type DeadEndRisk,
} from "../state/strategicAnalysis.ts";
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
  getTileBadge,
  getPlayerInitial,
  getTileName,
  mapSeatColorsByPlayerId,
  mapSeatNamesByPlayerId,
  type AssemblyRoom,
} from "../ui/appModel.ts";
import {
  getHandCardInteractionMode,
  getMatchInstructionMeta,
  getPrimaryActionConfig,
  getRollFeedbackCopy,
  getTileSelectionPreview,
  getTileSelectionSuggestion,
  getVictoryOverlayCopy,
  shouldShowDeployOverlay,
} from "../ui/matchInteractionModel.ts";
import { MATCH_MOTION_MS, getResponsiveMotionMode } from "../ui/matchMotion.ts";
import { useMatchInteractions } from "../ui/useMatchInteractions.ts";
import { getMatchBoardCellSize } from "./matchBoardSizing.ts";

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
  animationsEnabled: boolean;
  onNavigate: (href: string) => void;
  onAbandonMatch: () => void;
  onOpenGuide: () => void;
  onRestartMatch?: () => void;
  onMatchComplete?: (finalState: GameState) => void;
  showGuestChip?: boolean;
  onDismissGuestChip?: () => void;
  localMode?: boolean;
  localPlayerNames?: Record<number, string>;
  localPlayerBots?: Record<number, BotDifficulty>;
}

interface MatchBoardGridProps {
  cellSize: number;
  state: GameState;
  selectedPath: Coord[];
  currentPosition: Coord | null;
  focusMode: "idle" | "active";
  selectedWyrmId: string | null;
  interactionState: string;
  legalMoveTargets: Coord[];
  moveTargets: StepOption[];
  projectedMoveTargets: Coord[];
  actionTargets: Coord[];
  markedTargets: Coord[];
  freshTrailKeys: string[];
  ghostMove: GhostMoveState | null;
  playerNames: Record<PlayerId, string>;
  disabled: boolean;
  movableWyrmIds: string[];
  onCellClick: (coord: Coord) => void;
  onCellHover: (coord: Coord | null) => void;
}

interface GhostMoveState {
  wyrmId: string;
  originalOwner: PlayerId;
  isElder: boolean;
  path: Coord[];
  stepIndex: number;
}

function coordMatches(coord: Coord, list: Coord[]): boolean {
  return list.some((entry) => entry.row === coord.row && entry.col === coord.col);
}

function findMoveTarget(coord: Coord, moveTargets: StepOption[]): StepOption | undefined {
  return moveTargets.find((entry) => entry.row === coord.row && entry.col === coord.col);
}

function getCoordKey(coord: Coord): string {
  return `${coord.row},${coord.col}`;
}

function getColorValue(color: PlayerColor): string {
  return PLAYER_PALETTE[color].base;
}

function formatMinuteCount(minutes: number): string {
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function describeDeadEndRisk(risk: DeadEndRisk): string {
  switch (risk) {
    case "blocked":
      return "Likely dead end after landing.";
    case "tight":
      return "Tight lane after landing.";
    default:
      return "Open lanes remain after landing.";
  }
}

function describeFuturePressure(captures: number, groveReachableCount: number): string {
  if (captures > 0) {
    return `Threatens ${captures} capture${captures === 1 ? "" : "s"} next turn.`;
  }
  if (groveReachableCount > 0) {
    return `Keeps ${groveReachableCount} Sacred Grove lane${groveReachableCount === 1 ? "" : "s"} in reach.`;
  }
  return "Builds space without an immediate capture threat.";
}

function renderInstructionWithHighlight(instruction: string): React.ReactNode {
  const exactMoveMatch = instruction.match(/\d+\s+space(?:s)?/i);

  if (!exactMoveMatch || exactMoveMatch.index == null) {
    return instruction;
  }

  const before = instruction.slice(0, exactMoveMatch.index);
  const after = instruction.slice(exactMoveMatch.index + exactMoveMatch[0].length);

  return (
    <>
      {before}
      <span className="match-instruction-bar__number">{exactMoveMatch[0]}</span>
      {after}
    </>
  );
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
  currentPosition,
  focusMode,
  selectedWyrmId,
  interactionState,
  legalMoveTargets,
  moveTargets,
  projectedMoveTargets,
  actionTargets,
  markedTargets,
  freshTrailKeys,
  ghostMove,
  playerNames,
  disabled,
  movableWyrmIds,
  onCellClick,
  onCellHover,
}: MatchBoardGridProps): React.JSX.Element {
  const selectedStart = selectedPath[0];
  const ghostCoord = ghostMove ? ghostMove.path[ghostMove.stepIndex] : null;
  const activeGhostMove = ghostMove && ghostCoord ? ghostMove : null;
  const ghostLeft = ghostCoord ? ghostCoord.col * (cellSize + 3) + cellSize / 2 - 14 : 0;
  const ghostTop = ghostCoord ? ghostCoord.row * (cellSize + 3) + cellSize / 2 - 14 : 0;
  const ghostEnd = activeGhostMove ? activeGhostMove.path[activeGhostMove.path.length - 1] : null;
  const displayPosition =
    interactionState === "moving" && selectedWyrmId && currentPosition
      ? currentPosition
      : null;

  return (
    <div
      className="match-board-grid"
      onMouseLeave={() => onCellHover(null)}
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
          const legalMoveTarget = coordMatches(coord, legalMoveTargets);
          const projectedMoveTarget = coordMatches(coord, projectedMoveTargets);
          const inPath = coordMatches(coord, selectedPath);
          const actionTarget = coordMatches(coord, actionTargets);
          const markedTarget = coordMatches(coord, markedTargets);
          const pathIndex = selectedPath.findIndex(
            (entry) => entry.row === coord.row && entry.col === coord.col,
          );
          const engineWyrmId = cell.occupant;
          const displayWyrmId =
            displayPosition && selectedWyrmId && displayPosition.row === coord.row && displayPosition.col === coord.col
              ? selectedWyrmId
              : displayPosition && engineWyrmId === selectedWyrmId
                ? null
                : engineWyrmId;
          const wyrm = displayWyrmId ? state.wyrms[displayWyrmId] : null;
          const trailRoundsRemaining = cell.trail ? cell.trail.expiresAfterRound - state.currentRound : 0;
          const trailOpacity = trailRoundsRemaining >= 2 ? 0.9 : trailRoundsRemaining === 1 ? 0.5 : 0.2;
          const selectedWyrm = selectedWyrmId && wyrm?.id === selectedWyrmId;
          const canUndoStep = inPath && pathIndex === selectedPath.length - 2;
          const canSelectMover =
            Boolean(wyrm && movableWyrmIds.includes(wyrm.id) && (!selectedWyrmId || interactionState === "wyrm_selected"));
          const clickable = !disabled && Boolean(moveTarget || actionTarget || canUndoStep || canSelectMover);
          const focusRelevant =
            moveTarget
            || actionTarget
            || markedTarget
            || inPath
            || projectedMoveTarget
            || canUndoStep
            || selectedWyrm
            || (selectedStart && selectedStart.row === cell.row && selectedStart.col === cell.col)
            || (displayPosition && displayPosition.row === coord.row && displayPosition.col === coord.col);
          const dimmed = focusMode === "active" && !focusRelevant;

          return (
            <button
              key={`${cell.row}-${cell.col}`}
              type="button"
              data-tutorial-den={cell.type.startsWith("den_p") ? cell.type.slice(-1) : undefined}
              className={[
                "match-board-cell",
                `match-board-cell--${cell.type}`,
                legalMoveTarget ? "match-board-cell--legal" : "",
                moveTarget ? (moveTarget.capture ? "match-board-cell--capture" : "match-board-cell--move") : "",
                projectedMoveTarget ? "match-board-cell--projected" : "",
                actionTarget ? "match-board-cell--action" : "",
                markedTarget ? "match-board-cell--marked" : "",
                inPath ? "match-board-cell--path" : "",
                dimmed ? "match-board-cell--dimmed" : "",
                clickable ? "match-board-cell--clickable" : "",
                selectedStart && selectedStart.row === cell.row && selectedStart.col === cell.col
                  ? "match-board-cell--selected-start"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => onCellClick(coord)}
              onMouseEnter={() => onCellHover(coord)}
              onFocus={() => onCellHover(coord)}
              onBlur={() => onCellHover(null)}
            >
              {cell.hasPowerRune ? <span className="match-board-cell__rune">â—†</span> : null}
              {cell.hasWall ? <span className="match-board-cell__wall">{"\u2715"}</span> : null}
              {cell.trail && state.currentRound <= cell.trail.expiresAfterRound ? (
                <span
                  className={[
                    "match-board-cell__trail",
                    `match-board-cell__trail--${cell.trail.owner}`,
                    freshTrailKeys.includes(getCoordKey(coord)) ? "match-board-cell__trail--fresh" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
                    // Dim wyrms that have no legal moves in the move phase (movableWyrmIds set but this wyrm not in it)
                    movableWyrmIds.length > 0 && !movableWyrmIds.includes(wyrm.id) && !selectedWyrmId
                      ? "match-board-cell__token--no-moves"
                      : "",
                    activeGhostMove
                    && wyrm.id === activeGhostMove.wyrmId
                    && ghostEnd
                    && ghostEnd.row === coord.row
                    && ghostEnd.col === coord.col
                      ? "match-board-cell__token--arrival-pending"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {wyrm.isElder ? "\u2605" : getPlayerInitial(playerNames[wyrm.originalOwner])}
                </span>
              ) : null}
            </button>
          );
        }),
      )}
      {activeGhostMove ? (
        <span
          className={[
            "match-board-grid__ghost-token",
            `match-board-cell__token--${activeGhostMove.originalOwner}`,
            activeGhostMove.isElder ? "match-board-cell__token--elder" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ left: `${ghostLeft}px`, top: `${ghostTop}px` }}
          aria-hidden="true"
        >
          {activeGhostMove.isElder ? "\u2726" : getPlayerInitial(playerNames[activeGhostMove.originalOwner])}
        </span>
      ) : null}
    </div>
  );
}

export function MatchScreen({
  room,
  matchId,
  animationsEnabled,
  onNavigate,
  onAbandonMatch,
  onOpenGuide,
  onRestartMatch,
  onMatchComplete,
  showGuestChip = false,
  onDismissGuestChip,
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
    legalMoveTargets,
    moveTargets,
    actionTargets,
    markedTargets,
    selectedPath,
    currentPosition,
    canConfirmMove,
    canConfirmDiscard,
    canConfirmTileDraft,
    canEndTurn,
    canPlayTiles,
    clearInteraction,
    cancelMove,
    startTileDraft,
    toggleDiscard,
    confirmTileDraft,
    commitMovePath,
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
    movableWyrmIds,
    isAutoCoilState,
    interactionError,
    interactionState,
    stepsRemaining,
    isInteractionLocked,
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
  const previousTrailSnapshotRef = useRef<Map<string, string>>(new Map());
  const ghostMoveTimerIdsRef = useRef<number[]>([]);
  const freshTrailTimerIdsRef = useRef<number[]>([]);
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
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [drawFeedback, setDrawFeedback] = useState<DrawFeedbackState | null>(null);
  const [drawToast, setDrawToast] = useState<ToastState | null>(null);
  const [errorToast, setErrorToast] = useState<ToastState | null>(null);
  const [freshTrailKeys, setFreshTrailKeys] = useState<string[]>([]);
  const [ghostMove, setGhostMove] = useState<GhostMoveState | null>(null);
  const [hoveredBoardCoord, setHoveredBoardCoord] = useState<Coord | null>(null);
  const errorToastTimerRef = useRef<number | null>(null);

  const clearDrawFeedbackTimers = useCallback(() => {
    for (const timerId of drawFeedbackTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    drawFeedbackTimerIdsRef.current = [];
  }, []);

  const clearErrorToastTimer = useCallback(() => {
    if (errorToastTimerRef.current != null) {
      window.clearTimeout(errorToastTimerRef.current);
      errorToastTimerRef.current = null;
    }
  }, []);

  const clearGhostMoveTimers = useCallback(() => {
    for (const timerId of ghostMoveTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    ghostMoveTimerIdsRef.current = [];
  }, []);

  const clearFreshTrailTimers = useCallback(() => {
    for (const timerId of freshTrailTimerIdsRef.current) {
      window.clearTimeout(timerId);
    }
    freshTrailTimerIdsRef.current = [];
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

  const playerLabels = useMemo<Record<PlayerId, string>>(() => ({
    1:
      localPlayerBots?.[1] && !playerNames[1].toLowerCase().includes(localPlayerBots[1].toLowerCase())
        ? `${playerNames[1]} (${localPlayerBots[1]})`
        : playerNames[1],
    2:
      localPlayerBots?.[2] && !playerNames[2].toLowerCase().includes(localPlayerBots[2].toLowerCase())
        ? `${playerNames[2]} (${localPlayerBots[2]})`
        : playerNames[2],
    3:
      localPlayerBots?.[3] && !playerNames[3].toLowerCase().includes(localPlayerBots[3].toLowerCase())
        ? `${playerNames[3]} (${localPlayerBots[3]})`
        : playerNames[3],
    4:
      localPlayerBots?.[4] && !playerNames[4].toLowerCase().includes(localPlayerBots[4].toLowerCase())
        ? `${playerNames[4]} (${localPlayerBots[4]})`
        : playerNames[4],
  }), [localPlayerBots, playerNames]);

  const currentPlayerColor = getColorValue(playerColors[currentPlayer.id]);
  const activePlayerName = playerLabels[currentPlayer.id];
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
    isInteractionLocked,
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
    || deployWyrmId != null
    || discardSelection.length > 0;
  const showDrawHelper = !isPaused && phase === "draw";
  const turnProgressPhase: TurnProgressKey =
    phase === "discard" ? "draw" : phase === "end" ? "tile" : phase;
  const turnProgressStepIndex = TURN_PROGRESS_STEPS.findIndex((step) => step.key === turnProgressPhase);
  const showVictoryOverlay = state.winner !== null;
  const matchCompleteCalledRef = useRef(false);
  useEffect(() => {
    if (state.winner !== null && onMatchComplete && !matchCompleteCalledRef.current) {
      matchCompleteCalledRef.current = true;
      onMatchComplete(state);
    }
  }, [state.winner, state, onMatchComplete]);
  const victoryOverlayCopy = getVictoryOverlayCopy(state, playerNames);
  const victoryAccentColor = state.winner ? getColorValue(playerColors[state.winner]) : currentPlayerColor;
  const canRestartMatch = localMode || Boolean(onRestartMatch);
  const instructionMeta = useMemo(
    () =>
      getMatchInstructionMeta({
        state,
        tileDraft,
        deployWyrmId,
        trailWyrmId,
        hasSelectedMove: selectedMove != null,
        canConfirmMove,
        hoardChoicesCount: currentPlayer.hoard.length,
        interactionState,
        stepsRemaining,
        tileDraftReady: canConfirmTileDraft,
      }),
    [
      canConfirmMove,
      canConfirmTileDraft,
      currentPlayer.hoard.length,
      deployWyrmId,
      interactionState,
      selectedMove,
      state,
      stepsRemaining,
      tileDraft,
      trailWyrmId,
    ],
  );
  const rollFeedback = useMemo(() => getRollFeedbackCopy(state), [state]);
  const tileSelectionPreview = useMemo(() => getTileSelectionPreview(tileDraft), [tileDraft]);
  const tileSelectionSuggestion = useMemo(
    () => getTileSelectionSuggestion(state, tileDraft),
    [state, tileDraft],
  );
  const showDieFeedback = Boolean(rollFeedback && (phase === "roll" || phase === "move"));
  const boardFocusMode: "idle" | "active" =
    interactionState === "moving"
    || interactionState === "tile_preview"
    || deployWyrmId != null
    || trailWyrmId != null
      ? "active"
      : "idle";
  const hasPendingMotion = Boolean(rollingFace || drawFeedback || ghostMove || freshTrailKeys.length > 0);
  const motionMode = useMemo(
    () => getResponsiveMotionMode({ animationsEnabled, hasPendingMotion }),
    [animationsEnabled, hasPendingMotion],
  );
  const currentPlayerActiveCount = useMemo(
    () => getControlledActiveWyrms(state, currentPlayer.id).length,
    [currentPlayer.id, state],
  );
  const opponentPlayers = useMemo(
    () => state.players.filter((player) => player.id !== currentPlayer.id),
    [currentPlayer.id, state.players],
  );

  const flushBoardMotion = useCallback(() => {
    clearDrawFeedbackTimers();
    clearGhostMoveTimers();
    clearFreshTrailTimers();
    setRollingFace(null);
    setDrawFeedback(null);
    setGhostMove(null);
    setFreshTrailKeys([]);
  }, [clearDrawFeedbackTimers, clearFreshTrailTimers, clearGhostMoveTimers]);

  const hoveredCommittedPath = useMemo(() => {
    if (!selectedMove || !currentPosition || !hoveredBoardCoord) {
      return null;
    }

    const hoveredOption = moveTargets.find(
      (entry) => entry.row === hoveredBoardCoord.row && entry.col === hoveredBoardCoord.col,
    );
    if (!hoveredOption) {
      return null;
    }

    return [...selectedMove.path.slice(0, -1), currentPosition, hoveredBoardCoord];
  }, [currentPosition, hoveredBoardCoord, moveTargets, selectedMove]);

  const activeMovePath = useMemo(() => {
    if (!selectedMove || !currentPosition) {
      return null;
    }

    return [...selectedMove.path.slice(0, -1), currentPosition];
  }, [currentPosition, selectedMove]);

  const projectedMoveTargets = useMemo(() => {
    if (!selectedMove || !activeMovePath) {
      return [];
    }

    if (hoveredCommittedPath) {
      return getProjectedReachableCellsFromPrefix(
        state,
        selectedMove.wyrmId,
        hoveredCommittedPath,
        selectedMove.moveMode,
      );
    }

    return getProjectedReachableCellsFromPrefix(
      state,
      selectedMove.wyrmId,
      activeMovePath,
      selectedMove.moveMode,
    );
  }, [activeMovePath, hoveredCommittedPath, selectedMove, state]);

  const hoveredMoveSummary = useMemo(() => {
    if (!selectedMove || !hoveredCommittedPath || stepsRemaining > 1) {
      return null;
    }

    return getMoveConsequenceSummary(
      state,
      selectedMove.wyrmId,
      hoveredCommittedPath,
      selectedMove.moveMode,
    );
  }, [hoveredCommittedPath, selectedMove, state, stepsRemaining]);

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

  useEffect(
    () => () => {
      clearErrorToastTimer();
    },
    [clearErrorToastTimer],
  );

  useEffect(
    () => () => {
      clearGhostMoveTimers();
      clearFreshTrailTimers();
    },
    [clearFreshTrailTimers, clearGhostMoveTimers],
  );

  useEffect(() => {
    if (!isPaused) {
      return;
    }

    clearInteraction();
    setPeekPlayerId(null);
    setHoveredBoardCoord(null);
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

  useEffect(() => {
    const nextMessage = interactionError?.message ?? state.error;
    if (!nextMessage) {
      return;
    }

    clearErrorToastTimer();
    const toastId = interactionError?.id ?? Date.now();
    setErrorToast({ id: toastId, message: nextMessage });
    errorToastTimerRef.current = window.setTimeout(() => {
      setErrorToast((current) => (current?.id === toastId ? null : current));
      errorToastTimerRef.current = null;
    }, 1500);
  }, [clearErrorToastTimer, interactionError, state.error]);

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
  const handListEntries = useMemo(() => {
    if (phase === "discard") {
      return trayTiles.map((tile, index) => ({
        key: `${tile}-${index}`,
        tile,
        copies: 1,
        countLabel: `#${index + 1}`,
        detail: discardSelection.includes(index) ? "Selected to discard" : "Tap to discard",
        active: discardSelection.includes(index),
        onActivate: handCardInteractionMode === "discard" ? () => toggleDiscard(index) : undefined,
        onPlayLair: undefined as (() => void) | undefined,
      }));
    }

    const seen = new Set<RuneTileType>();
    return trayTiles.flatMap((tile) => {
      if (seen.has(tile)) {
        return [];
      }

      seen.add(tile);
      const copies = tileCounts[tile];
      const active = Boolean(tileDraft && "tile" in tileDraft && tileDraft.tile === tile);

      return [{
        key: tile,
        tile,
        copies,
        countLabel: `x${copies}`,
        detail:
          handCardInteractionMode === "play"
            ? copies >= 3
              ? "Invoke or use Lair ×3"
              : "Tap to preview"
            : TILE_HELP[tile],
        active,
        onActivate: handCardInteractionMode === "play" ? () => startTileDraft(tile, "single") : undefined,
        onPlayLair:
          handCardInteractionMode === "play" && copies >= 3
            ? () => startTileDraft(tile, "lair")
            : undefined,
      }];
    });
  }, [discardSelection, handCardInteractionMode, phase, startTileDraft, tileCounts, tileDraft, toggleDiscard, trayTiles]);

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
  const showTargetSelection =
    !isPaused
    && (
      (tileDraft?.tile === "light" && !tileDraft.opponentId)
      || (tileDraft?.tile === "void" && !tileDraft.opponentId)
    );
  const showSpecialWyrmChoice =
    !isPaused
    && (
      (tileDraft?.tile === "shadow" && tileDraft.mode === "lair" && !tileDraft.wyrmId)
      || (tileDraft?.tile === "serpent" && tileDraft.mode === "lair" && !tileDraft.wyrmId)
    );
  const showDeployHoard = shouldShowDeployOverlay({
    state,
    isPaused,
    hasTileDraft: tileDraft != null,
    deployWyrmId,
    hoardChoicesCount: hoardChoices.length,
  });
  const showBoardOverlay = showCoilChoice || showTargetSelection || showSpecialWyrmChoice || showDeployHoard;
  const showTempestToggle =
    !isPaused
    && phase === "move"
    && state.turnEffects.tempestRushRemaining.length > 0
    && !state.turnEffects.mainMoveCompleted;

  useEffect(() => {
    const container = boardScrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width > 0 ? entry.contentRect.width : container.clientWidth;
        const height = entry.contentRect.height > 0 ? entry.contentRect.height : container.clientHeight;

        const newSize = getMatchBoardCellSize({
          viewportWidth: width,
          viewportHeight: height,
          cols: state.board[0]?.length ?? 12,
          rows: state.board.length,
        });
        setCellSize(newSize);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [state.board]);

  const visiblePeekHand = peekPlayerId
    ? state.players.find((player) => player.id === peekPlayerId)?.hand ?? []
    : [];
  const dieBadgeValue = rollingFace ?? (state.dieResult == null ? "?" : state.dieResult === "surge" ? "5" : state.dieResult === "coil" ? "\u221E" : String(state.dieResult));

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

        if (motionMode.skip) {
          drawFeedbackTimerIdsRef.current.push(
            window.setTimeout(() => {
              setDrawToast((current) => (current?.id === feedbackId ? null : current));
            }, 900),
          );
          previousDrawSnapshotRef.current = {
            phase,
            playerId: currentPlayer.id,
            handLength: currentPlayer.hand.length,
          };
          return;
        }

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
            }, 12),
          );
          drawFeedbackTimerIdsRef.current.push(
            window.setTimeout(() => {
              setDrawFeedback((current) => (current?.id === feedbackId ? null : current));
            }, MATCH_MOTION_MS.drawFeedback),
          );
        }

        drawFeedbackTimerIdsRef.current.push(
          window.setTimeout(() => {
            setDrawToast((current) => (current?.id === feedbackId ? null : current));
          }, 900),
        );
      }
    }

    previousDrawSnapshotRef.current = {
      phase,
      playerId: currentPlayer.id,
      handLength: currentPlayer.hand.length,
    };
  }, [clearDrawFeedbackTimers, currentPlayer.hand.length, currentPlayer.id, motionMode.skip, phase]);

  useEffect(() => {
    const nextSnapshot = new Map<string, string>();
    const freshKeys: string[] = [];

    for (const row of state.board) {
      for (const cell of row) {
        if (!cell.trail || state.currentRound > cell.trail.expiresAfterRound) {
          continue;
        }

        const key = getCoordKey(cell);
        const signature = `${cell.trail.owner}:${cell.trail.sourceWyrmId}:${cell.trail.placedRound}:${cell.trail.expiresAfterRound}`;
        nextSnapshot.set(key, signature);

        if (previousTrailSnapshotRef.current.get(key) !== signature) {
          freshKeys.push(key);
        }
      }
    }

    previousTrailSnapshotRef.current = nextSnapshot;
    if (freshKeys.length === 0) {
      return;
    }

    clearFreshTrailTimers();
    setFreshTrailKeys(freshKeys);
    if (motionMode.skip) {
      return;
    }
    freshTrailTimerIdsRef.current.push(
      window.setTimeout(() => {
        setFreshTrailKeys([]);
      }, MATCH_MOTION_MS.trailFresh),
    );
  }, [clearFreshTrailTimers, motionMode.skip, state.board, state.currentRound]);

  const hoverTimerRef = useRef<number | null>(null);
  const animateMoveCommit = useCallback(
    (pendingMove: { wyrmId: string; path: Coord[]; moveMode: "main" | "tempest" }) => {
      if (motionMode.skip) {
        flushBoardMotion();
        commitMovePath(pendingMove);
        return;
      }

      const wyrm = state.wyrms[pendingMove.wyrmId];
      if (!wyrm) {
        commitMovePath(pendingMove);
        return;
      }

      const path = pendingMove.path.map((coord) => ({ ...coord }));
      clearGhostMoveTimers();
      setGhostMove({
        wyrmId: pendingMove.wyrmId,
        originalOwner: wyrm.originalOwner,
        isElder: wyrm.isElder,
        path,
        stepIndex: 0,
      });

      const stepCount = Math.max(1, path.length - 1);
      const stepDuration = Math.max(36, Math.floor(MATCH_MOTION_MS.ghostTotal / stepCount));

      for (let index = 1; index < path.length; index += 1) {
        ghostMoveTimerIdsRef.current.push(
          window.setTimeout(() => {
            setGhostMove((current) =>
              current?.wyrmId === pendingMove.wyrmId ? { ...current, stepIndex: index } : current,
            );
          }, index * stepDuration),
        );
      }

      ghostMoveTimerIdsRef.current.push(
        window.setTimeout(() => {
          setGhostMove((current) =>
            current?.wyrmId === pendingMove.wyrmId ? null : current,
          );
          commitMovePath(pendingMove);
        }, Math.min(MATCH_MOTION_MS.ghostTotal, path.length * stepDuration)),
      );
    },
    [clearGhostMoveTimers, commitMovePath, flushBoardMotion, motionMode.skip, state.wyrms],
  );

  const handleBoardCellClick = useCallback(
    (coord: Coord) => {
      if (motionMode.skip) {
        flushBoardMotion();
      }
      setHoveredBoardCoord(null);
      const result = handleBoardClick(coord);
      if (result.kind === "move_commit") {
        animateMoveCommit(result);
      }
    },
    [animateMoveCommit, flushBoardMotion, handleBoardClick, motionMode.skip],
  );

  const handleBoardCellHover = useCallback((coord: Coord | null) => {
    if (isInteractionLocked) {
      setHoveredBoardCoord(null);
      return;
    }
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredBoardCoord((prev) => {
        if (prev === coord) return prev;
        if (prev && coord && prev.row === coord.row && prev.col === coord.col) return prev;
        return coord;
      });
    }, 40);
  }, [isInteractionLocked]);

  const handlePrimaryAction = () => {
    if (motionMode.skip) {
      flushBoardMotion();
    }

    if (phase === "roll") {
      if (motionMode.skip) {
        onRoll();
        return;
      }

      const faces = ["1", "2", "3", "4", "\u221E", "5"];
      let step = 0;
      setRollingFace(faces[0]);
      const interval = window.setInterval(() => {
        step += 1;
        setRollingFace(faces[step % faces.length]);
      }, Math.max(48, Math.floor(MATCH_MOTION_MS.roll / 4)));
      onRoll();
      window.setTimeout(() => {
        window.clearInterval(interval);
        setRollingFace(null);
      }, MATCH_MOTION_MS.roll);
      return;
    }

    const result = performPhasePrimaryAction();
    if (result.kind === "move_commit") {
      animateMoveCommit(result);
    }
  };

  const handleRestartMatch = () => {
    clearDrawFeedbackTimers();
    clearErrorToastTimer();
    clearGhostMoveTimers();
    clearFreshTrailTimers();
    setDrawFeedback(null);
    setDrawToast(null);
    setErrorToast(null);
    setGhostMove(null);
    setFreshTrailKeys([]);
    setHoveredBoardCoord(null);
    setShowDiscardModal(false);
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

      {/* â”€â”€ Sidebar Drawer (slides from right) â”€â”€ */}
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
              {onMatchComplete ? (
                <button type="button" className="button button--ghost" onClick={() => onMatchComplete(state)}>
                  View Results
                </button>
              ) : null}
            </div>
          </article>
        </div>
      ) : null}
      <div className="match-screen__viewport">
        {/* â”€â”€ Row 1: Topbar â”€â”€ */}
        <header className="match-topbar">
          <Wordmark href="/lobby" onNavigate={onNavigate} compact />

          <div className={isPaused ? "match-phase match-phase--paused" : "match-phase"}>
            <span>{phaseDisplayLabel}</span>
          </div>

          <div className="match-topbar__right">
            {showGuestChip ? (
              <button
                type="button"
                className="match-guest-chip"
                onClick={() => onDismissGuestChip?.()}
                aria-label="Dismiss guest notice"
              >
                <span>Playing as guest</span>
                <span aria-hidden="true">&times;</span>
              </button>
            ) : null}
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
              âš™
            </button>
            <div
              className={[
                "match-die-panel",
                rollingFace ? "match-die-panel--rolling" : "",
                showDieFeedback ? "match-die-panel--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div ref={dieBadgeRef} className="die-badge" aria-live="polite">
                {dieBadgeValue}
              </div>
              <div className="match-die-panel__feedback">
                <strong>{showDieFeedback && rollFeedback ? rollFeedback.valueLabel : "Roll"}</strong>
                <span>
                  {showDieFeedback && rollFeedback
                    ? rollFeedback.requirement
                    : "Roll to reveal your exact movement."}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* â”€â”€ Row 2: Opponent Tracker Bar (all 4 players) â”€â”€ */}
        <div className="legacy-opp-bar" style={{ display: "none" }}>
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
                    <span>ðŸ‰{activeCount}</span>
                    <span>ðŸƒ{player.hand.length}</span>
                    <span>{player.elderTokenAvailable ? "â˜…" : "â˜†"}</span>
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
                        {wyrm.isElder ? "â˜…" : getPlayerInitial(playerNames[wyrm.originalOwner as PlayerId])}
                      </span>
                    );
                  }) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* â”€â”€ Row 3: Board Area â”€â”€ */}
        <section className="match-layout-shell">
          <aside ref={handTrayRef} className="match-sidebar match-sidebar--left">
            <div className="match-sidebar__section">
              <div className="match-sidebar__identity">
                <span className="tracker-card__color-dot" style={{ background: currentPlayerColor }} />
                <strong>{activePlayerName}</strong>
                <span className="match-sidebar__turn">YOUR TURN</span>
              </div>
              <div className="match-sidebar__stats">
                <span>{"\u{1F409}"}{currentPlayerActiveCount}</span>
                <span>{"\u{1F0CF}"}{currentPlayer.hand.length}</span>
                <span>{currentPlayer.elderTokenAvailable ? "\u2605" : "\u2606"}</span>
              </div>
            </div>

            <div className="match-sidebar__section">
              <span className="match-sidebar__label">Hoard</span>
              {currentPlayer.hoard.length > 0 ? (
                <div className="match-hoard-list">
                  {currentPlayer.hoard.map((wyrmId) => {
                    const wyrm = state.wyrms[wyrmId];
                    const deployReady = canDeployFromHoard && hoardChoices.some((choice) => choice.wyrmId === wyrmId);
                    const tokenColor = getColorValue(playerColors[wyrm.originalOwner as PlayerId]);

                    return (
                      <button
                        key={wyrmId}
                        type="button"
                        className={[
                          "match-hoard-list__token",
                          deployReady ? "match-hoard-list__token--ready" : "",
                          deployWyrmId === wyrmId ? "match-hoard-list__token--active" : "",
                        ].filter(Boolean).join(" ")}
                        style={{ "--hoard-token-color": tokenColor } as React.CSSProperties}
                        onClick={() => prepareDeploy(wyrmId)}
                        disabled={!deployReady || isPaused}
                        title={deployReady ? `Deploy ${wyrm.label}` : wyrm.label}
                      >
                        {wyrm.isElder ? "\u2726" : getPlayerInitial(playerNames[wyrm.originalOwner as PlayerId])}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="match-sidebar__empty">No hoarded Wyrms</p>
              )}
            </div>

            <div className="match-sidebar__section match-sidebar__section--grow">
              <span className="match-sidebar__label">My Hand</span>
              <div ref={handCardsRef} className="match-hand-list">
                {handListEntries.map((entry) => (
                  <div key={entry.key} className="match-hand-list__item">
                    <button
                      type="button"
                      className={[
                        "match-hand-list__button",
                        entry.active ? "match-hand-list__button--active" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={entry.onActivate}
                      disabled={!entry.onActivate}
                    >
                      <span className={`match-hand-list__swatch rune-card__art rune-card__art--${entry.tile}`}>
                        <span className="match-hand-list__glyph" aria-hidden="true">
                          {getTileBadge(entry.tile)}
                        </span>
                      </span>
                      <span className="match-hand-list__copy">
                        <span className="match-hand-list__copy-top">
                          <span className="rune-card__badge">{getTileBadge(entry.tile)}</span>
                          <span className="match-hand-list__name">{getTileName(entry.tile)}</span>
                        </span>
                        <span className="match-hand-list__detail">{entry.detail}</span>
                      </span>
                      <span className="match-hand-list__count">{entry.countLabel}</span>
                    </button>
                    {entry.onPlayLair ? (
                      <button
                        type="button"
                        className="button button--outline match-hand-list__lair"
                        onClick={entry.onPlayLair}
                      >
                        Lair x3
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="match-main-column">
        <section className="match-body">
          <div
            className={isPaused ? "match-board-stage match-board-stage--paused" : "match-board-stage"}
            ref={boardRef}
            style={{ position: "relative", width: "100%", height: "100%", maxHeight: "100%" }}
          >
            {/* Floating clear selection */}
            {!isPaused && phase !== "end" && hasClearableInteraction ? (
              <div className="board-clear-action">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    setHoveredBoardCoord(null);
                    if (selectedMove) {
                      cancelMove();
                      return;
                    }
                    clearInteraction();
                  }}
                >
                  {selectedMove ? "Cancel Move" : "Clear"}
                </button>
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

            {/* â”€â”€ Board Action Overlay (click-catching) â”€â”€ */}
            {showBoardOverlay ? (
              <div className="board-action-overlay" onClick={(e) => e.stopPropagation()}>
                <div className="board-action-overlay__panel">
                  {/* Coil choice */}
                  {showCoilChoice ? (
                    <>
                      <h4 className="board-action-overlay__title">Coil â€” Choose Movement</h4>
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
                              {wyrm.isElder ? "\u2605" : getPlayerInitial(playerNames[wyrm.currentOwner])}
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
                currentPosition={currentPosition}
                focusMode={boardFocusMode}
                selectedWyrmId={selectedWyrmId}
                interactionState={interactionState}
                legalMoveTargets={legalMoveTargets}
                moveTargets={moveTargets}
                projectedMoveTargets={projectedMoveTargets}
                actionTargets={actionTargets}
                markedTargets={markedTargets}
                freshTrailKeys={freshTrailKeys}
                ghostMove={ghostMove}
                playerNames={playerNames}
                disabled={showVictoryOverlay || isPaused || (phase !== "move" && tileDraft == null && deployWyrmId == null && trailWyrmId == null)}
                movableWyrmIds={movableWyrmIds}
                onCellClick={handleBoardCellClick}
                onCellHover={handleBoardCellHover}
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

          {!isPaused && instruction && phase !== "end" ? (
            <div className="match-instruction-bar" aria-live="polite">
              <span className="match-instruction-bar__icon" aria-hidden="true">&rarr;</span>
              <div className="match-instruction-bar__copy">
                {hoveredMoveSummary ? (
                  <div className="move-consequence-hint">
                    <span className="move-consequence-hint__eyebrow">Hovered Move</span>
                    <strong className="move-consequence-hint__title">
                      {hoveredMoveSummary.immediateVictory ? "Immediate winning line" : "Short-term outlook"}
                    </strong>
                    <p className="move-consequence-hint__detail">
                      {hoveredMoveSummary.immediateVictory
                        ? "This path wins immediately if you commit it."
                        : describeFuturePressure(
                            hoveredMoveSummary.futureCaptureThreats,
                            hoveredMoveSummary.groveReachableCount,
                          )}
                    </p>
                    {!hoveredMoveSummary.immediateVictory ? (
                      <p className="move-consequence-hint__detail">
                        {describeDeadEndRisk(hoveredMoveSummary.deadEndRisk)}
                      </p>
                    ) : null}
                  </div>
                ) : tileSelectionPreview ? (
                  <div className="tile-selection-preview">
                    <span className="tile-selection-preview__eyebrow">Selected Rune Tile</span>
                    <strong className="tile-selection-preview__title">{tileSelectionPreview.title}</strong>
                    <p className="tile-selection-preview__detail">{tileSelectionPreview.detail}</p>
                    {tileSelectionSuggestion ? (
                      <p className="tile-selection-preview__suggestion">{tileSelectionSuggestion}</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <p className="match-board-guidance__instruction">
                      {isAutoCoilState
                        ? "No Wyrms can move — place a trail instead"
                        : renderInstructionWithHighlight(instruction)}
                    </p>
                    {instructionMeta ? (
                      <p className="match-board-guidance__meta">
                        {instructionMeta}
                      </p>
                    ) : null}
                    {selectedMove ? (
                      <div className="match-board-guidance__steps">
                        <span className="match-board-guidance__badge">Steps Remaining</span>
                        <span className="match-board-guidance__badge match-board-guidance__badge--accent">
                          {stepsRemaining}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              <div className="match-instruction-bar__actions">
                {showTempestToggle ? (
                  <div className="match-instruction-bar__toggle-group">
                    <button
                      type="button"
                      className={preferredMoveMode === "main" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                      onClick={() => onSetPreferredMoveMode("main")}
                    >
                      Main
                    </button>
                    <button
                      type="button"
                      className={preferredMoveMode === "tempest" ? "button button--outline helper-card__toggle helper-card__toggle--active" : "button button--outline helper-card__toggle"}
                      onClick={() => onSetPreferredMoveMode("tempest")}
                    >
                      Tempest
                    </button>
                  </div>
                ) : null}

                {tileSelectionPreview ? (
                  <>
                    <button
                      type="button"
                      className="button button--forest"
                      disabled={!canConfirmTileDraft}
                      onClick={confirmTileDraft}
                    >
                      Confirm Effect
                    </button>
                    <button
                      type="button"
                      className="button button--outline"
                      onClick={clearInteraction}
                    >
                      Cancel Effect
                    </button>
                  </>
                ) : (
                  <>
                    {!isPaused && hasClearableInteraction ? (
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => {
                          setHoveredBoardCoord(null);
                          if (selectedMove) {
                            cancelMove();
                            return;
                          }
                          clearInteraction();
                        }}
                      >
                        {selectedMove ? "Cancel Move" : "Clear"}
                      </button>
                    ) : null}
                    {!isPaused && primaryAction.visible ? (
                      <button
                        type="button"
                        className="button button--forest"
                        disabled={primaryAction.disabled}
                        onClick={handlePrimaryAction}
                      >
                        {primaryAction.label}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : null}
        </section>

        {/* â”€â”€ Row 4: Hand Tray (locked 200px) â”€â”€ */}
          </div>

          <aside className="match-sidebar match-sidebar--right">
            <div className="match-sidebar__section match-sidebar__section--die">
              <div
                className={[
                  "match-die-panel",
                  "match-die-panel--sidebar",
                  rollingFace ? "match-die-panel--rolling" : "",
                  showDieFeedback ? "match-die-panel--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div ref={dieBadgeRef} className="die-badge" aria-live="polite">
                  {dieBadgeValue}
                </div>
                <div className="match-die-panel__feedback">
                  <strong>{showDieFeedback && rollFeedback ? rollFeedback.valueLabel : "Roll"}</strong>
                  <span>
                    {showDieFeedback && rollFeedback
                      ? rollFeedback.requirement
                      : "Roll to reveal your exact movement."}
                  </span>
                </div>
              </div>
            </div>

            <div className="match-sidebar__section">
              <span className="match-sidebar__label">Turn Progress</span>
              {isPaused ? (
                <span className="match-turn-stepper__pill">Paused</span>
              ) : (
                <ol className="match-turn-stepper" aria-label="Turn Progress">
                  {TURN_PROGRESS_STEPS.map((step, index) => {
                    const active = phase !== "end" && index === turnProgressStepIndex;
                    const completed = phase === "end" || index < turnProgressStepIndex;
                    return (
                      <li
                        key={step.key}
                        className={[
                          "match-turn-stepper__item",
                          active ? "match-turn-stepper__item--active" : "",
                          completed ? "match-turn-stepper__item--done" : "",
                        ].filter(Boolean).join(" ")}
                        aria-current={active ? "step" : undefined}
                      >
                        <span>{step.label}</span>
                        <span className="match-turn-stepper__marker" aria-hidden="true">
                          {completed ? "\u2713" : active ? "\u2192" : "\u2022"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="match-sidebar__section">
              <span className="match-sidebar__label">Deck &amp; Discard</span>
              <div className="deck-discard-preview">
                <div className="match-deck-panel" title="Draw rune tiles">
                  <div ref={deckCountRef} className="match-deck-panel__stack" aria-label={`Deck: ${state.deck.length} rune tiles`}>
                    <span className="match-deck-panel__card match-deck-panel__card--back" aria-hidden="true" />
                    <span className="match-deck-panel__card match-deck-panel__card--mid" aria-hidden="true" />
                    <span className="match-deck-panel__card match-deck-panel__card--front" aria-hidden="true" />
                    <span className="match-deck-panel__count">{state.deck.length}</span>
                  </div>
                  <span className="match-deck-panel__label">Deck</span>
                  <span className="match-deck-panel__caption">Draw rune tiles</span>
                </div>
                <button
                  type="button"
                  className="match-discard-panel"
                  title="Open discard pile"
                  onClick={() => setShowDiscardModal(true)}
                >
                  <div className="match-discard-panel__stack">
                    {state.discardPile.length > 0 ? (
                      <div className="match-discard-panel__preview">
                        <RuneTileCard tile={state.discardPile[state.discardPile.length - 1]} copies={1} />
                      </div>
                    ) : (
                      <div className="match-discard-panel__empty" />
                    )}
                  </div>
                  <span className="match-deck-panel__label">Discard</span>
                </button>
              </div>
            </div>

            <div className="match-sidebar__section match-sidebar__section--opponents">
              {opponentPlayers.map((player) => {
                const activeCount = getControlledActiveWyrms(state, player.id).length;
                const playerColor = getColorValue(playerColors[player.id]);

                return (
                  <div key={player.id} className="match-sidebar-opponent">
                    <div className="match-sidebar-opponent__identity">
                      <span className="tracker-card__color-dot" style={{ background: playerColor }} />
                      <strong>{playerLabels[player.id]}</strong>
                    </div>
                    <div className="match-sidebar__stats">
                      <span>{"\u{1F409}"}{activeCount}</span>
                      <span>{"\u{1F0CF}"}{player.hand.length}</span>
                      <span>{player.elderTokenAvailable ? "\u2605" : "\u2606"}</span>
                    </div>
                    <div className="match-hoard-list match-hoard-list--opponent">
                      {player.hoard.length > 0 ? player.hoard.map((wyrmId) => {
                        const wyrm = state.wyrms[wyrmId];
                        const tokenColor = getColorValue(playerColors[wyrm.originalOwner as PlayerId]);
                        return (
                          <span
                            key={wyrmId}
                            className="match-hoard-list__token match-hoard-list__token--static"
                            style={{ "--hoard-token-color": tokenColor } as React.CSSProperties}
                            title={wyrm.label}
                          >
                            {wyrm.isElder ? "\u2726" : getPlayerInitial(playerNames[wyrm.originalOwner as PlayerId])}
                          </span>
                        );
                      }) : <span className="match-sidebar__empty">No hoard</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <footer className="legacy-tray" style={{ display: "none" }}>
          <div className="legacy-tray__player">
            <h2 style={{ color: currentPlayerColor }}>{activePlayerName}</h2>
            <div className="legacy-progress" aria-label="Turn Progress">
              <span className="legacy-progress__label">Turn Progress:</span>
              {isPaused ? (
                <span className="legacy-progress__pill legacy-progress__pill--paused">Paused</span>
              ) : (
                TURN_PROGRESS_STEPS.map((step, index) => {
                  const active = phase !== "end" && index === turnProgressStepIndex;
                  const completed = phase === "end" || index < turnProgressStepIndex;
                  return (
                    <React.Fragment key={step.key}>
                      <span
                        className={[
                          "legacy-progress__step",
                          active ? "legacy-progress__step--active" : "",
                          completed ? "legacy-progress__step--done" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={active ? { color: currentPlayerColor } : undefined}
                        aria-current={active ? "step" : undefined}
                      >
                        <span>{step.label}</span>
                        {completed ? <span className="legacy-progress__status" aria-hidden="true">âœ“</span> : null}
                        {!completed && active ? <span className="legacy-progress__status" aria-hidden="true">â—</span> : null}
                      </span>
                      {index < TURN_PROGRESS_STEPS.length - 1 ? (
                        <span className="legacy-progress__separator" aria-hidden="true">â†’</span>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          <div className="legacy-tray__cards">
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
                  className="legacy-tray__card"
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

          <div className="legacy-tray__actions">
            {showDrawHelper ? (
              <div className="turn-helper">
                <span className="turn-helper__copy">Draw Rune Tile â†’ Adds 1 ability card to your hand</span>
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
      {errorToast ? (
        <div key={errorToast.id} className="match-toast match-toast--error" role="alert" aria-live="assertive">
          {errorToast.message}
        </div>
      ) : null}

      {showDiscardModal && (
        <div className="modal-overlay" onClick={() => setShowDiscardModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17, 32, 20, 0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--forest-950)', border: '1px solid var(--forest-800)', padding: '24px', borderRadius: '12px', maxWidth: '80vw', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Discard Pile ({state.discardPile.length})</h2>
              <button type="button" className="text-link" onClick={() => setShowDiscardModal(false)} style={{ fontSize: '1.2rem', padding: '8px', cursor: 'pointer' }}>{"\u2715"}</button>
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






