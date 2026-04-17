import { useEffect, useMemo, useRef, useState } from "react";

import {
  PLAYER_NAMES,
  canResolveBlockedMove,
  getAdjacentEmptyCells,
  getControlledActiveWyrms,
  getCurrentPlayer,
  getDeployTargets,
  getWyrmsWithLegalMoves,
  hasAnyLegalMove,
  validatePathReason,
} from "../state/gameLogic.ts";
import { canEndTurnNow } from "../state/gameEngine.ts";
import type { Coord, MoveMode, PlayerId, RuneTileType, StepOption, Wyrm, WyrmId } from "../state/types.ts";
import { useGame } from "../state/useGameState.tsx";
import {
  getMatchInstruction,
  getMatchPhase,
  hasHoardDeployOpportunity,
  type Phase,
  type TileDraft,
} from "./matchInteractionModel.ts";
import {
  getCorrectiveGuidanceCopy,
  getCurrentPlayerGuidance,
  type HighlightHint,
  type PlayerGuidance,
  type ReasonCode,
} from "./guidanceModel.ts";
import {
  buildTilePlayRequestFromDraft,
  cancelMovementDraft,
  createMovementDraft,
  isInteractionLocked as getInteractionLockState,
  isPreMoveRune,
  isTileDraftReady,
  rebuildMovementDraft,
  stepMovementDraft,
  type InteractionState,
  type MovementDraft,
} from "./matchInteractionState.ts";

interface PendingMoveCommit {
  wyrmId: WyrmId;
  path: Coord[];
  moveMode: MoveMode;
}

interface BoardClickResultNone {
  kind: "none";
}

interface BoardClickResultMoveCommit extends PendingMoveCommit {
  kind: "move_commit";
}

type BoardClickResult = BoardClickResultNone | BoardClickResultMoveCommit;

interface InteractionErrorState {
  id: number;
  message: string;
  detail?: string;
  highlightHint: HighlightHint;
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function getTrailCoordsByOwner(
  state: ReturnType<typeof useGame>["state"],
  ownerId: PlayerId,
): Coord[] {
  return state.board
    .flat()
    .filter((cell) => cell.trail?.owner === ownerId)
    .map((cell) => ({ row: cell.row, col: cell.col }));
}

function getTrailCoordsBySource(
  state: ReturnType<typeof useGame>["state"],
  wyrmId: WyrmId,
): Coord[] {
  return state.board
    .flat()
    .filter((cell) => cell.trail?.sourceWyrmId === wyrmId)
    .map((cell) => ({ row: cell.row, col: cell.col }));
}

export interface MatchInteractionsResult {
  game: ReturnType<typeof useGame>;
  state: ReturnType<typeof useGame>["state"];
  phase: Phase;
  currentPlayer: ReturnType<typeof getCurrentPlayer>;
  activeControlledWyrms: Wyrm[];
  preferredMoveMode: MoveMode;
  setManualPreferredMoveMode: (mode: MoveMode) => void;
  selectedMove: {
    wyrmId: WyrmId;
    path: Coord[];
    currentPosition: Coord;
    moveMode: MoveMode;
  } | null;
  currentPosition: Coord | null;
  selectedWyrmId: WyrmId | null;
  tileDraft: TileDraft | null;
  deployWyrmId: WyrmId | null;
  trailWyrmId: WyrmId | null;
  discardSelection: number[];
  peekPlayerId: PlayerId | null;
  instruction: string;
  guidance: PlayerGuidance;
  legalMoveTargets: Coord[];
  moveTargets: StepOption[];
  actionTargets: Coord[];
  markedTargets: Coord[];
  selectedPath: Coord[];
  canConfirmMove: boolean;
  canConfirmDiscard: boolean;
  canConfirmTileDraft: boolean;
  canEndTurn: boolean;
  canPlayTiles: boolean;
  clearInteraction: () => void;
  cancelMove: () => void;
  startTileDraft: (tile: RuneTileType, mode: "single" | "lair") => void;
  toggleDiscard: (index: number) => void;
  confirmDiscard: () => void;
  confirmMove: () => void;
  commitMovePath: (commit: PendingMoveCommit) => void;
  chooseOpponent: (opponentId: PlayerId) => void;
  chooseSpecialWyrm: (wyrmId: WyrmId) => void;
  confirmTileDraft: () => boolean;
  confirmVoidSelection: () => boolean;
  prepareDeploy: (wyrmId: WyrmId) => void;
  handleBoardClick: (coord: Coord) => BoardClickResult;
  setPeekPlayerId: (id: PlayerId | null) => void;
  performPhasePrimaryAction: () => BoardClickResult;
  onRoll: () => void;
  onDraw: () => void;
  onEndTurn: () => void;
  onSetCoilChoice: (choice: 1 | 2 | 3 | "extra_trail") => void;
  onSetPreferredMoveMode: (mode: MoveMode) => void;
  deployTargets: Coord[];
  trailTargets: Coord[];
  hoardChoices: { wyrmId: WyrmId; label: string }[];
  opponentChoices: { id: PlayerId; label: string }[];
  canDeployFromHoard: boolean;
  movableWyrmIds: WyrmId[];
  isAutoCoilState: boolean;
  interactionError: InteractionErrorState | null;
  interactionState: InteractionState;
  stepsRemaining: number;
  isInteractionLocked: boolean;
}

export function useMatchInteractions(): MatchInteractionsResult {
  const game = useGame();
  const {
    state,
    draw,
    discard,
    roll,
    setCoilChoice,
    move,
    placeCoilTrail,
    deploy,
    playTile,
    endTurn,
  } = game;

  const [rawSelectedMove, setRawSelectedMove] = useState<MovementDraft | null>(null);
  const [interactionState, setInteractionState] = useState<InteractionState>("idle");
  const [manualPreferredMoveMode, setManualPreferredMoveMode] = useState<MoveMode>("main");
  const [rawTileDraft, setRawTileDraft] = useState<TileDraft | null>(null);
  const [rawDeployWyrmId, setRawDeployWyrmId] = useState<WyrmId | null>(null);
  const [rawTrailWyrmId, setRawTrailWyrmId] = useState<WyrmId | null>(null);
  const [rawDiscardSelection, setRawDiscardSelection] = useState<number[]>([]);
  const [peekPlayerId, setPeekPlayerId] = useState<PlayerId | null>(null);
  const [interactionError, setInteractionError] = useState<InteractionErrorState | null>(null);
  const lastErrorTimeRef = useRef<Record<string, number>>({});

  const currentPlayer = getCurrentPlayer(state);
  const phase = getMatchPhase(state);
  const activeControlledWyrms = getControlledActiveWyrms(state, currentPlayer.id);
  const preMoveTileWindow = phase === "move" && !state.turnEffects.mainMoveCompleted;
  const hasPreMoveRune = currentPlayer.hand.some((tile) => isPreMoveRune(tile));

  const movableWyrmIds = useMemo(() => {
    if (phase !== "move" || state.turnEffects.mainMoveCompleted) {
      return [];
    }

    const mainMovable = getWyrmsWithLegalMoves(state, currentPlayer.id, "main");
    if (mainMovable.length > 0) {
      return mainMovable;
    }

    return state.turnEffects.tempestRushRemaining.filter((id) => hasAnyLegalMove(state, id, "tempest"));
  }, [currentPlayer.id, phase, state]);

  useEffect(() => {
    if (!import.meta.env.DEV || phase !== "move" || state.turnEffects.mainMoveCompleted) {
      return;
    }
    if (state.dieResult === "coil" && state.turnEffects.coilChoice == null) {
      return;
    }

    const mainMovable = getWyrmsWithLegalMoves(state, currentPlayer.id, "main");
    const tempestMovable = state.turnEffects.tempestRushRemaining.filter((id) => hasAnyLegalMove(state, id, "tempest"));
    const hasLegalStarter = mainMovable.length > 0 || tempestMovable.length > 0;

    console.assert(
      !hasLegalStarter || movableWyrmIds.length > 0,
      "Expected movableWyrmIds during move phase when legal moves exist.",
      {
        playerId: currentPlayer.id,
        dieResult: state.dieResult,
        mainMovable,
        tempestMovable,
        movableWyrmIds,
      },
    );
  }, [currentPlayer.id, movableWyrmIds, phase, state]);

  const isAutoCoilState = useMemo(() => {
    if (phase !== "move" || state.turnEffects.mainMoveCompleted) {
      return false;
    }
    if (state.dieResult === "coil" && state.turnEffects.coilChoice == null) {
      return false;
    }
    return movableWyrmIds.length === 0 && canResolveBlockedMove(state);
  }, [movableWyrmIds, phase, state]);

  const tileCounts = currentPlayer.hand.reduce<Record<RuneTileType, number>>((counts, tile) => {
    counts[tile] = (counts[tile] ?? 0) + 1;
    return counts;
  }, {} as Record<RuneTileType, number>);
  const hasTileStepSinglePlay = currentPlayer.hand.some((tile) => !isPreMoveRune(tile));
  const hasAnyLairSet = Object.values(tileCounts).some((count) => count >= 3);
  const preferredMoveMode =
    state.turnEffects.tempestRushRemaining.length === 0
      ? "main"
      : state.turnEffects.mainMoveCompleted
        ? "tempest"
        : manualPreferredMoveMode;
  const canDeployFromHoard = hasHoardDeployOpportunity(state, currentPlayer.hoard.length);
  const hoardChoices = useMemo(
    () =>
      currentPlayer.hoard.map((wyrmId) => ({
        wyrmId,
        label: game.state.wyrms[wyrmId]?.label ?? wyrmId,
      })),
    [currentPlayer.hoard, game.state.wyrms],
  );
  const opponentChoices = useMemo(
    () =>
      state.players
        .filter((player) => player.id !== currentPlayer.id)
        .map((player) => ({
          id: player.id,
          label: PLAYER_NAMES[player.id],
        })),
    [currentPlayer.id, state.players],
  );

  const selectedMoveDraft = phase === "move" ? rawSelectedMove : null;
  const tileDraft =
    phase === "tile"
      ? rawTileDraft
      : preMoveTileWindow
        && rawTileDraft?.mode === "single"
        && isPreMoveRune(rawTileDraft.tile)
          ? rawTileDraft
          : null;
  const trailWyrmId = phase === "move" ? rawTrailWyrmId : null;
  const discardSelection = phase === "discard" ? rawDiscardSelection : [];
  const deployWyrmId =
    phase === "move"
    && rawDeployWyrmId != null
    && canDeployFromHoard
    && currentPlayer.hoard.includes(rawDeployWyrmId)
      ? rawDeployWyrmId
      : null;

  const selectedMove = selectedMoveDraft
    ? {
        wyrmId: selectedMoveDraft.activeWyrmId,
        path: selectedMoveDraft.currentPath,
        currentPosition: selectedMoveDraft.currentPosition,
        moveMode: selectedMoveDraft.moveMode,
      }
    : null;
  const currentPosition = selectedMoveDraft?.currentPosition ?? null;

  const clearInteractionError = () => {
    setInteractionError(null);
  };

  const raiseInteractionError = (
    message: string,
    highlightHint: HighlightHint = null,
    reason?: ReasonCode,
    detail?: string,
  ) => {
    const now = Date.now();
    const key = reason || message;
    const lastTime = lastErrorTimeRef.current[key] || 0;

    if (now - lastTime < 1000) {
      return; // Prevent spam
    }

    lastErrorTimeRef.current[key] = now;
    setInteractionError({
      id: now + Math.floor(Math.random() * 1000),
      message,
      detail,
      highlightHint,
    });
  };

  const effectiveInteractionState: InteractionState =
    selectedMoveDraft?.interactionState
    ?? (tileDraft != null ? "tile_preview" : interactionState);
  const isInteractionLocked = getInteractionLockState({
    interactionState: effectiveInteractionState,
    tileDraft,
    deployWyrmId,
    trailWyrmId,
  });

  useEffect(() => {
    if (!interactionError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInteractionError((current) => (current?.id === interactionError.id ? null : current));
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [interactionError]);

  const clearInteraction = () => {
    setRawSelectedMove(null);
    setRawTileDraft(null);
    setRawDeployWyrmId(null);
    setRawTrailWyrmId(null);
    setRawDiscardSelection([]);
    clearInteractionError();
    setInteractionState("idle");
  };

  const stepsRemaining = selectedMoveDraft?.stepsRemaining ?? 0;
  const moveTargets = useMemo(() => {
    if (!selectedMoveDraft || !currentPosition || stepsRemaining <= 0) {
      return [];
    }

    return selectedMoveDraft.nextStepOptions.filter((entry) => {
      const rowDistance = Math.abs(entry.row - currentPosition.row);
      const colDistance = Math.abs(entry.col - currentPosition.col);
      return rowDistance + colDistance === 1;
    });
  }, [currentPosition, selectedMoveDraft, stepsRemaining]);
  const legalMoveTargets = useMemo(
    () => moveTargets.map((entry) => ({ row: entry.row, col: entry.col })),
    [moveTargets],
  );
  const canConfirmMove = Boolean(selectedMoveDraft?.canConfirmMove);

  const deployTargets = useMemo(
    () => (deployWyrmId ? getDeployTargets(state, currentPlayer.id) : []),
    [currentPlayer.id, deployWyrmId, state],
  );

  const trailTargets = useMemo(
    () => (trailWyrmId ? getAdjacentEmptyCells(state, trailWyrmId, true) : []),
    [state, trailWyrmId],
  );

  const actionTargets = useMemo(() => {
    if (deployWyrmId) {
      return deployTargets;
    }
    if (trailWyrmId) {
      return trailTargets;
    }
    if (!tileDraft) {
      return [];
    }

    switch (tileDraft.tile) {
      case "fire":
        return [];
      case "water":
      case "wind":
        return tileDraft.mode === "single"
          ? activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean)
          : [];
      case "serpent":
        return tileDraft.mode === "single"
          ? activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean)
          : activeControlledWyrms
              .filter((wyrm) => !wyrm.isElder)
              .map((wyrm) => wyrm.position!)
              .filter(Boolean);
      case "earth":
        return state.board
          .flat()
          .filter((cell) => !cell.hasWall && !cell.occupant && !cell.trail)
          .map((cell) => ({ row: cell.row, col: cell.col }));
      case "shadow":
        if (tileDraft.mode === "single") {
          return activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean);
        }
        if (!tileDraft.wyrmId) {
          return activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean);
        }
        return state.board
          .flat()
          .filter((cell) => !cell.hasWall && !cell.occupant && !cell.trail)
          .map((cell) => ({ row: cell.row, col: cell.col }));
      case "void":
        return tileDraft.mode === "single" && tileDraft.opponentId
          ? state.board
              .flat()
              .filter((cell) => cell.trail?.owner === tileDraft.opponentId)
              .map((cell) => ({ row: cell.row, col: cell.col }))
          : [];
      case "light":
        return [];
      default:
        return [];
    }
  }, [activeControlledWyrms, deployTargets, deployWyrmId, state, tileDraft, trailTargets, trailWyrmId]);

  const markedTargets = useMemo(() => {
    if (selectedMoveDraft) {
      return selectedMoveDraft.currentPath;
    }

    if (!tileDraft) {
      return [];
    }

    switch (tileDraft.tile) {
      case "fire":
        return getTrailCoordsByOwner(state, currentPlayer.id);
      case "water":
      case "wind":
        if (tileDraft.mode === "lair") {
          return [];
        }
        if (!tileDraft.wyrmId) {
          return [];
        }
        return state.wyrms[tileDraft.wyrmId]?.position ? [state.wyrms[tileDraft.wyrmId].position!] : [];
      case "serpent":
        if (!tileDraft.wyrmId) {
          return [];
        }
        if (tileDraft.tile === "serpent" && tileDraft.mode === "single") {
          const selectedCoord = state.wyrms[tileDraft.wyrmId]?.position;
          return [
            ...(selectedCoord ? [selectedCoord] : []),
            ...getTrailCoordsBySource(state, tileDraft.wyrmId),
          ];
        }
        return state.wyrms[tileDraft.wyrmId]?.position ? [state.wyrms[tileDraft.wyrmId].position!] : [];
      case "earth":
        return tileDraft.cells;
      case "shadow":
        if (tileDraft.mode === "single") {
          return tileDraft.wyrmIds
            .map((wyrmId) => state.wyrms[wyrmId]?.position)
            .filter((coord): coord is Coord => Boolean(coord));
        }
        return [
          ...(tileDraft.wyrmId && state.wyrms[tileDraft.wyrmId]?.position ? [state.wyrms[tileDraft.wyrmId].position!] : []),
          ...(tileDraft.targetCoord ? [tileDraft.targetCoord] : []),
        ];
      case "void":
        return tileDraft.mode === "single"
          ? tileDraft.cells
          : tileDraft.opponentId != null
            ? getTrailCoordsByOwner(state, tileDraft.opponentId)
            : [];
      case "light":
        return [];
      default:
        return [];
    }
  }, [currentPlayer.id, selectedMoveDraft, state, tileDraft]);

  const canPlayTiles =
    !state.turnEffects.tileActionUsed
    && (
      (phase === "tile" && (hasTileStepSinglePlay || hasAnyLairSet))
      || (preMoveTileWindow && hasPreMoveRune)
    );
  const canConfirmDiscard = phase === "discard" && discardSelection.length === state.mustDiscard;
  const canEndTurn = phase === "tile" && canEndTurnNow(state);
  const canConfirmTileDraft = isTileDraftReady(tileDraft);
  const playableTileTypes = useMemo(() => {
    if (!canPlayTiles) {
      return [];
    }

    const availableTiles =
      phase === "move"
        ? currentPlayer.hand.filter((tile) => isPreMoveRune(tile))
        : currentPlayer.hand;

    return [...new Set(availableTiles)];
  }, [canPlayTiles, currentPlayer.hand, phase]);
  const blockedTrailWyrmIds = useMemo(
    () =>
      activeControlledWyrms
        .filter(
          (wyrm) =>
            wyrm.position
            && !hasAnyLegalMove(state, wyrm.id, "main")
            && !hasAnyLegalMove(state, wyrm.id, "tempest")
            && getAdjacentEmptyCells(state, wyrm.id, true).length > 0,
        )
        .map((wyrm) => wyrm.id),
    [activeControlledWyrms, state],
  );
  const showCoilChoice = phase === "move" && state.dieResult === "coil" && state.turnEffects.coilChoice == null;
  const showTargetSelection =
    (tileDraft?.tile === "light" && !tileDraft.opponentId)
    || (tileDraft?.tile === "void" && !tileDraft.opponentId);
  const showSpecialWyrmChoice =
    (tileDraft?.tile === "shadow" && tileDraft.mode === "lair" && !tileDraft.wyrmId)
    || (tileDraft?.tile === "serpent" && tileDraft.mode === "lair" && !tileDraft.wyrmId);
  const guidance = useMemo(
    () =>
      getCurrentPlayerGuidance({
        phase,
        tileDraft,
        interactionState: effectiveInteractionState,
        selectedWyrmId: selectedMoveDraft?.activeWyrmId ?? null,
        selectedWyrmLabel: selectedMoveDraft ? state.wyrms[selectedMoveDraft.activeWyrmId]?.label ?? null : null,
        deployWyrmId,
        deployWyrmLabel: deployWyrmId ? state.wyrms[deployWyrmId]?.label ?? null : null,
        trailWyrmId,
        trailWyrmLabel: trailWyrmId ? state.wyrms[trailWyrmId]?.label ?? null : null,
        moveTargets,
        actionTargets,
        movableWyrmIds,
        blockedTrailWyrmIds,
        discardSelection,
        discardableIndices: currentPlayer.hand.map((_, index) => index),
        playableTileTypes,
        hoardSelectableWyrmIds: hoardChoices.map((choice) => choice.wyrmId),
        opponentChoiceIds: opponentChoices.map((choice) => choice.id),
        canConfirmMove,
        canConfirmDiscard,
        canConfirmTileDraft,
        canEndTurn,
        canPlayTiles,
        showCoilChoice,
        showTargetSelection,
        showSpecialWyrmChoice,
        stepsRemaining,
        mustDiscard: state.mustDiscard,
        isAutoCoilState,
      }),
    [
      actionTargets,
      canConfirmDiscard,
      canConfirmMove,
      canConfirmTileDraft,
      canEndTurn,
      canPlayTiles,
      currentPlayer.hand,
      deployWyrmId,
      discardSelection,
      effectiveInteractionState,
      hoardChoices,
      isAutoCoilState,
      movableWyrmIds,
      moveTargets,
      opponentChoices,
      phase,
      playableTileTypes,
      selectedMoveDraft,
      showCoilChoice,
      showSpecialWyrmChoice,
      showTargetSelection,
      state,
      stepsRemaining,
      tileDraft,
      trailWyrmId,
      blockedTrailWyrmIds,
    ],
  );
  const raiseGuidedError = (
    reason: ReasonCode,
    override?: Partial<Pick<PlayerGuidance, "message" | "subMessage" | "highlightHint">>,
  ) => {
    const corrective = getCorrectiveGuidanceCopy(guidance);
    raiseInteractionError(
      override?.message ?? corrective.message,
      override?.highlightHint ?? corrective.highlightHint,
      reason,
      override?.subMessage ?? corrective.subMessage,
    );
  };

  const startTileDraft = (tile: RuneTileType, mode: "single" | "lair") => {
    if (state.turnEffects.tileActionUsed) {
      raiseGuidedError("TILE_ALREADY_PLAYED");
      return;
    }

    const inTileStep = phase === "tile" && !(mode === "single" && isPreMoveRune(tile));
    const inPreMoveStep = preMoveTileWindow && mode === "single" && isPreMoveRune(tile);
    if (!inTileStep && !inPreMoveStep) {
      raiseGuidedError("WRONG_PHASE");
      return;
    }

    setRawSelectedMove(null);
    setRawDeployWyrmId(null);
    setRawTrailWyrmId(null);
    setRawDiscardSelection([]);
    clearInteractionError();
    setInteractionState("tile_preview");

    if (tile === "fire") {
      setRawTileDraft({ tile, mode });
      return;
    }
    if (tile === "water") {
      setRawTileDraft({ tile, mode });
      return;
    }
    if (tile === "earth") {
      setRawTileDraft({ tile, mode, cells: [] });
      return;
    }
    if (tile === "wind") {
      setRawTileDraft({ tile, mode });
      return;
    }
    if (tile === "shadow" && mode === "single") {
      setRawTileDraft({ tile, mode, wyrmIds: [] });
      return;
    }
    if (tile === "shadow" && mode === "lair") {
      setRawTileDraft({ tile, mode, wyrmId: null, targetCoord: null });
      return;
    }
    if (tile === "light") {
      setRawTileDraft({ tile, mode, opponentId: null });
      return;
    }
    if (tile === "void" && mode === "single") {
      setRawTileDraft({ tile, mode, opponentId: null, cells: [] });
      return;
    }
    if (tile === "void" && mode === "lair") {
      setRawTileDraft({ tile, mode, opponentId: null });
      return;
    }
    if (tile === "serpent") {
      setRawTileDraft({ tile, mode });
    }
  };

  const toggleDiscard = (index: number) => {
    if (phase !== "discard") {
      raiseGuidedError("WRONG_PHASE");
      return;
    }

    setRawDiscardSelection((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : current.length >= state.mustDiscard
          ? current
          : [...current, index].sort((a, b) => a - b),
    );
  };

  const confirmDiscard = () => {
    if (phase !== "discard" || discardSelection.length !== state.mustDiscard) {
      raiseGuidedError("DISCARD_REQUIRED");
      return;
    }

    const chosenTiles = discardSelection.map((index) => currentPlayer.hand[index]);
    discard(chosenTiles);
    setRawDiscardSelection([]);
    setInteractionState("idle");
  };

  const commitMovePath = ({ wyrmId, path, moveMode }: PendingMoveCommit) => {
    move(wyrmId, path, moveMode);
    setRawSelectedMove(null);
    clearInteractionError();
    setInteractionState("idle");
  };

  const confirmMove = () => {
    if (!selectedMoveDraft || !canConfirmMove) {
      raiseGuidedError(!selectedMoveDraft ? "TILE_REQUIRES_SELECTION" : "MOVE_NOT_COMPLETED");
      return;
    }

    commitMovePath({
      wyrmId: selectedMoveDraft.activeWyrmId,
      path: selectedMoveDraft.currentPath,
      moveMode: selectedMoveDraft.moveMode,
    });
  };

  const chooseOpponent = (opponentId: PlayerId) => {
    if (!tileDraft) {
      raiseGuidedError("TILE_REQUIRES_SELECTION");
      return;
    }

    if (tileDraft.tile === "light") {
      setRawTileDraft({ ...tileDraft, opponentId });
      return;
    }

    if (tileDraft.tile === "void") {
      if (tileDraft.mode === "single") {
        setRawTileDraft({ ...tileDraft, opponentId, cells: [] });
      } else {
        setRawTileDraft({ ...tileDraft, opponentId });
      }
    }
  };

  const chooseSpecialWyrm = (wyrmId: WyrmId) => {
    if (!tileDraft) {
      raiseGuidedError("TILE_REQUIRES_SELECTION");
      return;
    }

    if (tileDraft.tile === "shadow" && tileDraft.mode === "lair") {
      setRawTileDraft({ ...tileDraft, wyrmId, targetCoord: null });
      return;
    }

    if (tileDraft.tile === "serpent" && tileDraft.mode === "lair") {
      setRawTileDraft({ ...tileDraft, wyrmId });
    }
  };

  const confirmTileDraft = () => {
    const request = buildTilePlayRequestFromDraft(tileDraft);
    if (!request || !tileDraft) {
      raiseGuidedError("TILE_REQUIRES_TARGET");
      return false;
    }

    playTile(request);
    if (tileDraft.tile === "light" && tileDraft.mode === "single" && tileDraft.opponentId != null) {
      setPeekPlayerId(tileDraft.opponentId);
    }
    setRawTileDraft(null);
    clearInteractionError();
    setInteractionState("idle");
    return true;
  };

  const confirmVoidSelection = () => confirmTileDraft();

  const prepareDeploy = (wyrmId: WyrmId) => {
    if (!canDeployFromHoard || isInteractionLocked) {
      raiseGuidedError("ACTION_BLOCKED");
      return;
    }
    setRawSelectedMove(null);
    setRawTileDraft(null);
    setRawTrailWyrmId(null);
    setRawDiscardSelection([]);
    clearInteractionError();
    setInteractionState("idle");
    setRawDeployWyrmId((current) => (current === wyrmId ? null : wyrmId));
  };

  const cancelMove = () => {
    if (!selectedMoveDraft) {
      raiseGuidedError("ACTION_BLOCKED");
      return;
    }
    const cancelled = cancelMovementDraft(state, selectedMoveDraft);
    setRawSelectedMove(cancelled);
    clearInteractionError();
    setInteractionState("wyrm_selected");
  };

  const handleTileBoardClick = (coord: Coord): boolean => {
    if (!tileDraft) {
      return false;
    }

    const cell = state.board[coord.row][coord.col];
    const occupant = cell.occupant ? state.wyrms[cell.occupant] : null;

    switch (tileDraft.tile) {
      case "fire":
      case "light":
        return false;
      case "water":
      case "wind":
        if (tileDraft.mode === "lair") {
          return false;
        }
        if (
          occupant
          && occupant.currentOwner === currentPlayer.id
          && occupant.status === "active"
        ) {
          setRawTileDraft({ ...tileDraft, wyrmId: occupant.id });
          return true;
        }
        return false;
      case "serpent":
        if (
          occupant
          && occupant.currentOwner === currentPlayer.id
          && occupant.status === "active"
          && (tileDraft.mode === "single" || !occupant.isElder)
        ) {
          setRawTileDraft({ ...tileDraft, wyrmId: occupant.id });
          return true;
        }
        return false;
      case "earth": {
        if (cell.hasWall || cell.occupant || cell.trail) {
          return false;
        }
        const alreadySelected = tileDraft.cells.some((entry) => sameCoord(entry, coord));
        const nextCells = alreadySelected
          ? tileDraft.cells.filter((entry) => !sameCoord(entry, coord))
          : [...tileDraft.cells, coord].slice(0, tileDraft.mode === "lair" ? 3 : 1);
        setRawTileDraft({ ...tileDraft, cells: nextCells });
        return true;
      }
      case "shadow":
        if (tileDraft.mode === "single") {
          if (!occupant || occupant.currentOwner !== currentPlayer.id || occupant.status !== "active") {
            return false;
          }
          const nextIds = tileDraft.wyrmIds.includes(occupant.id)
            ? tileDraft.wyrmIds.filter((entry) => entry !== occupant.id)
            : [...tileDraft.wyrmIds, occupant.id].slice(0, 2);
          setRawTileDraft({ ...tileDraft, wyrmIds: nextIds });
          return true;
        }

        if (!tileDraft.wyrmId) {
          if (occupant && occupant.currentOwner === currentPlayer.id) {
            setRawTileDraft({ ...tileDraft, wyrmId: occupant.id, targetCoord: null });
            return true;
          }
          return false;
        }

        if (cell.occupant || cell.hasWall || cell.trail) {
          return false;
        }
        setRawTileDraft({ ...tileDraft, targetCoord: coord });
        return true;
      case "void":
        if (
          tileDraft.mode === "single"
          && tileDraft.opponentId
          && cell.trail?.owner === tileDraft.opponentId
        ) {
          const exists = tileDraft.cells.some((entry) => sameCoord(entry, coord));
          const nextCells = exists
            ? tileDraft.cells.filter((entry) => !sameCoord(entry, coord))
            : [...tileDraft.cells, coord].slice(0, 3);
          setRawTileDraft({ ...tileDraft, cells: nextCells });
          return true;
        }
        return false;
      default:
        return false;
    }
  };

  const handleBoardClick = (coord: Coord): BoardClickResult => {
    if (phase !== "move" && tileDraft == null && deployWyrmId == null && trailWyrmId == null) {
      return { kind: "none" };
    }

    if (tileDraft) {
      if (handleTileBoardClick(coord)) {
        clearInteractionError();
      } else {
        raiseGuidedError("INVALID_TARGET");
      }
      return { kind: "none" };
    }

    if (deployWyrmId) {
      if (deployTargets.some((entry) => sameCoord(entry, coord))) {
        deploy(deployWyrmId, coord);
        setRawDeployWyrmId(null);
        setInteractionState("idle");
        clearInteractionError();
      } else {
        raiseGuidedError("INVALID_TARGET");
      }
      return { kind: "none" };
    }

    if (trailWyrmId) {
      if (trailTargets.some((entry) => sameCoord(entry, coord))) {
        placeCoilTrail(trailWyrmId, coord);
        setRawTrailWyrmId(null);
        setInteractionState("idle");
        clearInteractionError();
      } else {
        raiseGuidedError("INVALID_TARGET");
      }
      return { kind: "none" };
    }

    const cell = state.board[coord.row][coord.col];
    const occupant = cell.occupant ? state.wyrms[cell.occupant] : null;

    if (selectedMoveDraft) {
      if (
        selectedMoveDraft.currentPath.length > 1
        && sameCoord(selectedMoveDraft.currentPath[selectedMoveDraft.currentPath.length - 2], coord)
      ) {
        const rewound = rebuildMovementDraft(
          state,
          selectedMoveDraft.activeWyrmId,
          selectedMoveDraft.currentPath.slice(0, -1),
          selectedMoveDraft.moveMode,
        );
        if (rewound) {
          setRawSelectedMove(rewound);
          setInteractionState(rewound.interactionState);
          clearInteractionError();
        }
        return { kind: "none" };
      }

      const stepResult = stepMovementDraft(state, selectedMoveDraft, coord);
      if (stepResult.status === "updated") {
        setRawSelectedMove(stepResult.draft);
        setInteractionState(stepResult.draft.interactionState);
        clearInteractionError();
        return { kind: "none" };
      }

      if (stepResult.status === "committed") {
        const previewDraft = rebuildMovementDraft(
          state,
          selectedMoveDraft.activeWyrmId,
          stepResult.pathToCommit,
          selectedMoveDraft.moveMode,
        );
        if (previewDraft) {
          setRawSelectedMove(previewDraft);
          setInteractionState(previewDraft.interactionState);
        }
        clearInteractionError();
        return {
          kind: "move_commit",
          wyrmId: selectedMoveDraft.activeWyrmId,
          path: stepResult.pathToCommit,
          moveMode: selectedMoveDraft.moveMode,
        };
      }

      if (
        selectedMoveDraft.interactionState === "wyrm_selected"
        && occupant
        && occupant.currentOwner === currentPlayer.id
        && occupant.position
        && occupant.id !== selectedMoveDraft.activeWyrmId
        && movableWyrmIds.includes(occupant.id)
      ) {
        const switched = createMovementDraft(state, occupant.id, selectedMoveDraft.moveMode);
        if (switched) {
          setRawSelectedMove(switched);
          setInteractionState(switched.interactionState);
          clearInteractionError();
        }
        return { kind: "none" };
      }
      const validation = validatePathReason(
        state,
        selectedMoveDraft.activeWyrmId,
        [...selectedMoveDraft.currentPath, coord],
        selectedMoveDraft.moveMode,
      );
      raiseGuidedError("INVALID_TARGET", {
        subMessage: validation.reason ?? guidance.subMessage,
      });
      return { kind: "none" };
    }

    if (!occupant || occupant.currentOwner !== currentPlayer.id || !occupant.position) {
      if (phase === "move") {
        raiseGuidedError("INVALID_TARGET");
      }
      return { kind: "none" };
    }

    if (!state.turnEffects.mainMoveCompleted) {
      if (
        state.dieResult === "coil"
        && !occupant.isElder
        && state.turnEffects.coilChoice === "extra_trail"
      ) {
        setRawTrailWyrmId(occupant.id);
        setInteractionState("idle");
        return { kind: "none" };
      }

      if (preferredMoveMode === "main" && hasAnyLegalMove(state, occupant.id, "main")) {
        const draft = createMovementDraft(state, occupant.id, "main");
        if (draft) {
          setRawSelectedMove(draft);
          setInteractionState(draft.interactionState);
          clearInteractionError();
        }
        return { kind: "none" };
      }

      if (!hasAnyLegalMove(state, occupant.id, "main") && movableWyrmIds.length > 0) {
        raiseGuidedError("INVALID_TARGET");
        return { kind: "none" };
      }
    }

    if (
      state.turnEffects.tempestRushRemaining.includes(occupant.id)
      && hasAnyLegalMove(state, occupant.id, "tempest")
    ) {
      const draft = createMovementDraft(state, occupant.id, "tempest");
      if (draft) {
        setRawSelectedMove(draft);
        setInteractionState(draft.interactionState);
        clearInteractionError();
      }
      return { kind: "none" };
    }

    if (canResolveBlockedMove(state) && getAdjacentEmptyCells(state, occupant.id, true).length > 0) {
      setRawTrailWyrmId(occupant.id);
      setInteractionState("idle");
    }
    return { kind: "none" };
  };

  const instruction = useMemo(
    () =>
      getMatchInstruction({
        state,
        tileDraft,
        deployWyrmId,
        trailWyrmId,
        hasSelectedMove: selectedMoveDraft != null,
        canConfirmMove,
        hoardChoicesCount: currentPlayer.hoard.length,
        interactionState: effectiveInteractionState,
        stepsRemaining,
        tileDraftReady: canConfirmTileDraft,
      }),
    [
      canConfirmMove,
      canConfirmTileDraft,
      currentPlayer.hoard.length,
      deployWyrmId,
      effectiveInteractionState,
      selectedMoveDraft,
      state,
      stepsRemaining,
      tileDraft,
      trailWyrmId,
    ],
  );

  const performPhasePrimaryAction = (): BoardClickResult => {
    if (phase === "draw") {
      draw();
      clearInteractionError();
      setInteractionState("idle");
      return { kind: "none" };
    }
    if (phase === "roll") {
      roll();
      clearInteractionError();
      setInteractionState("idle");
      return { kind: "none" };
    }
    if (phase === "discard" && canConfirmDiscard) {
      confirmDiscard();
      return { kind: "none" };
    }
    if (phase === "move" && selectedMoveDraft && canConfirmMove) {
      return {
        kind: "move_commit",
        wyrmId: selectedMoveDraft.activeWyrmId,
        path: selectedMoveDraft.currentPath,
        moveMode: selectedMoveDraft.moveMode,
      };
    }
    if (phase === "tile" && canEndTurn) {
      endTurn();
      clearInteractionError();
      setInteractionState("idle");
    }
    return { kind: "none" };
  };

  return {
    game,
    state,
    phase,
    currentPlayer,
    activeControlledWyrms,
    preferredMoveMode,
    setManualPreferredMoveMode,
    selectedMove,
    currentPosition,
    selectedWyrmId: selectedMoveDraft?.activeWyrmId ?? null,
    tileDraft,
    deployWyrmId,
    trailWyrmId,
    discardSelection,
    peekPlayerId,
    instruction,
    guidance,
    legalMoveTargets,
    moveTargets,
    actionTargets,
    markedTargets,
    selectedPath: selectedMoveDraft?.currentPath ?? [],
    canConfirmMove,
    canConfirmDiscard,
    canConfirmTileDraft,
    canEndTurn,
    canPlayTiles,
    clearInteraction,
    cancelMove,
    startTileDraft,
    toggleDiscard,
    confirmDiscard,
    confirmMove,
    commitMovePath,
    chooseOpponent,
    chooseSpecialWyrm,
    confirmTileDraft,
    confirmVoidSelection,
    prepareDeploy,
    handleBoardClick,
    setPeekPlayerId,
    performPhasePrimaryAction,
    onRoll: () => roll(),
    onDraw: draw,
    onEndTurn: endTurn,
    onSetCoilChoice: setCoilChoice,
    onSetPreferredMoveMode: setManualPreferredMoveMode,
    deployTargets,
    trailTargets,
    hoardChoices,
    opponentChoices,
    canDeployFromHoard,
    movableWyrmIds,
    isAutoCoilState,
    interactionError,
    interactionState: effectiveInteractionState,
    stepsRemaining,
    isInteractionLocked,
  };
}
