import { useMemo, useState } from "react";

import {
  PLAYER_NAMES,
  canCommitPath,
  canResolveBlockedMove,
  getAdjacentEmptyCells,
  getControlledActiveWyrms,
  getCurrentPlayer,
  getDeployTargets,
  getLegalMoves,
  getNextPathOptions,
  hasAnyLegalMove,
} from "../state/gameLogic.ts";
import { canEndTurnNow } from "../state/gameEngine.ts";
import { useGame } from "../state/useGameState.tsx";
import {
  getMatchPhase,
  getMatchInstruction,
  hasHoardDeployOpportunity,
  type TileDraft,
} from "./matchInteractionModel.ts";
import type {
  Coord,
  MoveMode,
  PlayerId,
  RuneTileType,
  TilePlayRequest,
  WyrmId,
} from "../state/types.ts";

interface MoveSelection {
  wyrmId: WyrmId;
  path: Coord[];
  moveMode: MoveMode;
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function useMatchInteractions() {
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

  const [rawSelectedMove, setRawSelectedMove] = useState<MoveSelection | null>(null);
  const [manualPreferredMoveMode, setManualPreferredMoveMode] = useState<MoveMode>("main");
  const [rawTileDraft, setRawTileDraft] = useState<TileDraft | null>(null);
  const [rawDeployWyrmId, setRawDeployWyrmId] = useState<WyrmId | null>(null);
  const [rawTrailWyrmId, setRawTrailWyrmId] = useState<WyrmId | null>(null);
  const [rawDiscardSelection, setRawDiscardSelection] = useState<number[]>([]);
  const [peekPlayerId, setPeekPlayerId] = useState<PlayerId | null>(null);

  const currentPlayer = getCurrentPlayer(state);
  const phase = getMatchPhase(state);
  const activeControlledWyrms = getControlledActiveWyrms(state, currentPlayer.id);
  const preMoveTileWindow = phase === "move" && !state.turnEffects.mainMoveCompleted;
  const hasPreMoveRune = currentPlayer.hand.some((tile) => tile === "water" || tile === "wind");
  const tileCounts = currentPlayer.hand.reduce<Record<RuneTileType, number>>((counts, tile) => {
    counts[tile] = (counts[tile] ?? 0) + 1;
    return counts;
  }, {} as Record<RuneTileType, number>);
  const hasTileStepSinglePlay = currentPlayer.hand.some((tile) => tile !== "water" && tile !== "wind");
  const hasAnyLairSet = Object.values(tileCounts).some((count) => count >= 3);
  const preferredMoveMode =
    state.turnEffects.tempestRushRemaining.length === 0
      ? "main"
      : state.turnEffects.mainMoveCompleted
        ? "tempest"
        : manualPreferredMoveMode;
  const canDeployFromHoard = hasHoardDeployOpportunity(state, currentPlayer.hoard.length);
  const selectedMove = phase === "move" ? rawSelectedMove : null;
  const tileDraft =
    phase === "tile"
      ? rawTileDraft
      : preMoveTileWindow
        && rawTileDraft?.mode === "single"
        && (rawTileDraft.tile === "water" || rawTileDraft.tile === "wind")
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

  const clearInteraction = () => {
    setRawSelectedMove(null);
    setRawTileDraft(null);
    setRawDeployWyrmId(null);
    setRawTrailWyrmId(null);
    setRawDiscardSelection([]);
  };

  const moveTargets = useMemo(
    () =>
      selectedMove
        ? getNextPathOptions(state, selectedMove.wyrmId, selectedMove.path, selectedMove.moveMode)
        : [],
    [selectedMove, state],
  );

  const legalMoveTargets = useMemo(
    () =>
      selectedMove && selectedMove.path.length === 1
        ? getLegalMoves(state, selectedMove.wyrmId, selectedMove.moveMode)
        : [],
    [selectedMove, state],
  );

  const canConfirmMove = Boolean(
    selectedMove &&
      selectedMove.path.length > 1 &&
      canCommitPath(state, selectedMove.wyrmId, selectedMove.path, selectedMove.moveMode),
  );

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
      case "water":
      case "wind":
        return activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean);
      case "serpent":
        if (tileDraft.mode === "single") {
          return activeControlledWyrms.map((wyrm) => wyrm.position!).filter(Boolean);
        }
        return activeControlledWyrms
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
        if (tileDraft.mode === "single" && tileDraft.opponentId) {
          return state.board
            .flat()
            .filter((cell) => cell.trail?.owner === tileDraft.opponentId)
            .map((cell) => ({ row: cell.row, col: cell.col }));
        }
        return [];
      case "light":
        return [];
      default:
        return [];
    }
  }, [activeControlledWyrms, deployTargets, deployWyrmId, state, tileDraft, trailTargets, trailWyrmId]);

  const markedTargets = useMemo(() => {
    if (selectedMove) {
      return selectedMove.path;
    }
    if (tileDraft?.tile === "earth") {
      return tileDraft.cells;
    }
    if (tileDraft?.tile === "shadow" && tileDraft.mode === "single") {
      return tileDraft.wyrmIds
        .map((wyrmId) => state.wyrms[wyrmId]?.position)
        .filter((coord): coord is Coord => Boolean(coord));
    }
    if (tileDraft?.tile === "shadow" && tileDraft.mode === "lair" && tileDraft.wyrmId) {
      const coord = state.wyrms[tileDraft.wyrmId]?.position;
      return coord ? [coord] : [];
    }
    if (tileDraft?.tile === "void" && tileDraft.mode === "single") {
      return tileDraft.cells;
    }
    return [];
  }, [selectedMove, state.wyrms, tileDraft]);

  const canPlayTiles =
    !state.turnEffects.tileActionUsed
    && (
      (phase === "tile" && (hasTileStepSinglePlay || hasAnyLairSet))
      || (
        preMoveTileWindow
        && hasPreMoveRune
      )
    );
  const canConfirmDiscard =
    phase === "discard" && discardSelection.length === state.mustDiscard;
  const canEndTurn = phase === "tile" && canEndTurnNow(state);

  const startTileDraft = (tile: RuneTileType, mode: "single" | "lair") => {
    if (state.turnEffects.tileActionUsed) {
      return;
    }

    const inTileStep = phase === "tile" && !(mode === "single" && (tile === "water" || tile === "wind"));
    const inPreMoveStep = preMoveTileWindow && mode === "single" && (tile === "water" || tile === "wind");
    if (!inTileStep && !inPreMoveStep) {
      return;
    }
    clearInteraction();

    const immediateRequest: TilePlayRequest | null =
      tile === "fire"
        ? { mode, tile }
        : tile === "water" && mode === "lair"
          ? { mode, tile }
          : tile === "wind" && mode === "lair"
            ? { mode, tile }
            : null;

    if (immediateRequest) {
      playTile(immediateRequest);
      return;
    }

    if (tile === "earth") {
      setRawTileDraft({ tile, mode, cells: [] });
      return;
    }

    if (tile === "shadow" && mode === "single") {
      setRawTileDraft({ tile, mode, wyrmIds: [] });
      return;
    }

    if (tile === "shadow" && mode === "lair") {
      setRawTileDraft({ tile, mode, wyrmId: null });
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

    if (tile === "light") {
      setRawTileDraft({ tile, mode });
      return;
    }

    if (tile === "serpent" && mode === "lair") {
      setRawTileDraft({ tile, mode });
      return;
    }

    setRawTileDraft({ tile, mode } as TileDraft);
  };

  const toggleDiscard = (index: number) => {
    if (phase !== "discard") {
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
      return;
    }

    const chosenTiles = discardSelection.map((index) => currentPlayer.hand[index]);
    discard(chosenTiles);
    setRawDiscardSelection([]);
  };

  const confirmMove = () => {
    if (!selectedMove || !canConfirmMove) {
      return;
    }
    move(selectedMove.wyrmId, selectedMove.path, selectedMove.moveMode);
    setRawSelectedMove(null);
  };

  const chooseOpponent = (opponentId: PlayerId) => {
    if (!tileDraft) {
      return;
    }

    if (tileDraft.tile === "light") {
      playTile({ mode: tileDraft.mode, tile: "light", opponentId });
      if (tileDraft.mode === "single") {
        setPeekPlayerId(opponentId);
      }
      setRawTileDraft(null);
      return;
    }

    if (tileDraft.tile === "void" && tileDraft.mode === "lair") {
      playTile({ mode: "lair", tile: "void", opponentId });
      setRawTileDraft(null);
      return;
    }

    if (tileDraft.tile === "void" && tileDraft.mode === "single") {
      setRawTileDraft({ ...tileDraft, opponentId, cells: [] });
    }
  };

  const chooseSpecialWyrm = (wyrmId: WyrmId) => {
    if (!tileDraft) {
      return;
    }

    if (tileDraft.tile === "shadow" && tileDraft.mode === "lair") {
      setRawTileDraft({ ...tileDraft, wyrmId });
      return;
    }

    if (tileDraft.tile === "serpent" && tileDraft.mode === "lair") {
      playTile({ mode: "lair", tile: "serpent", wyrmId });
      setRawTileDraft(null);
    }
  };

  const confirmVoidSelection = () => {
    if (
      tileDraft?.tile !== "void" ||
      tileDraft.mode !== "single" ||
      !tileDraft.opponentId ||
      tileDraft.cells.length === 0
    ) {
      return;
    }
    playTile({
      mode: "single",
      tile: "void",
      opponentId: tileDraft.opponentId,
      targetCoords: tileDraft.cells,
    });
    setRawTileDraft(null);
  };

  const prepareDeploy = (wyrmId: WyrmId) => {
    if (!canDeployFromHoard) {
      return;
    }
    clearInteraction();
    setRawDeployWyrmId((current) => (current === wyrmId ? null : wyrmId));
  };

  const handleTileBoardClick = (coord: Coord): boolean => {
    if (!tileDraft) {
      return false;
    }

    const cell = state.board[coord.row][coord.col];
    const occupant = cell.occupant ? state.wyrms[cell.occupant] : null;

    switch (tileDraft.tile) {
      case "water":
      case "wind":
        if (
          occupant &&
          occupant.currentOwner === currentPlayer.id &&
          occupant.status === "active"
        ) {
          playTile({ mode: "single", tile: tileDraft.tile, wyrmId: occupant.id });
          setRawTileDraft(null);
          return true;
        }
        return false;
      case "serpent":
        if (tileDraft.mode === "single") {
          if (
            occupant &&
            occupant.currentOwner === currentPlayer.id &&
            occupant.status === "active"
          ) {
            playTile({ mode: "single", tile: "serpent", wyrmId: occupant.id });
            setRawTileDraft(null);
            return true;
          }
          return false;
        }
        if (occupant && occupant.currentOwner === currentPlayer.id && !occupant.isElder) {
          playTile({ mode: "lair", tile: "serpent", wyrmId: occupant.id });
          setRawTileDraft(null);
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
          : [...tileDraft.cells, coord];
        const needed = tileDraft.mode === "lair" ? 3 : 1;
        if (nextCells.length === needed) {
          playTile({ mode: tileDraft.mode, tile: "earth", targetCoords: nextCells });
          setRawTileDraft(null);
        } else {
          setRawTileDraft({ ...tileDraft, cells: nextCells });
        }
        return true;
      }
      case "shadow":
        if (tileDraft.mode === "single") {
          if (
            !occupant ||
            occupant.currentOwner !== currentPlayer.id ||
            occupant.status !== "active"
          ) {
            return false;
          }
          const nextIds = tileDraft.wyrmIds.includes(occupant.id)
            ? tileDraft.wyrmIds.filter((entry) => entry !== occupant.id)
            : [...tileDraft.wyrmIds, occupant.id];

          if (nextIds.length === 2) {
            playTile({
              mode: "single",
              tile: "shadow",
              swapWyrmIds: [nextIds[0], nextIds[1]],
            });
            setRawTileDraft(null);
          } else {
            setRawTileDraft({ ...tileDraft, wyrmIds: nextIds });
          }
          return true;
        }

        if (!tileDraft.wyrmId) {
          if (occupant && occupant.currentOwner === currentPlayer.id) {
            setRawTileDraft({ ...tileDraft, wyrmId: occupant.id });
            return true;
          }
          return false;
        }

        if (cell.occupant || cell.hasWall || cell.trail) {
          return false;
        }
        playTile({
          mode: "lair",
          tile: "shadow",
          teleportWyrmId: tileDraft.wyrmId,
          targetCoords: [coord],
        });
        setRawTileDraft(null);
        return true;
      case "void":
        if (
          tileDraft.mode === "single" &&
          tileDraft.opponentId &&
          cell.trail?.owner === tileDraft.opponentId
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

  const handleBoardClick = (coord: Coord) => {
    if (phase !== "move" && tileDraft == null && deployWyrmId == null && trailWyrmId == null) {
      return;
    }

    if (handleTileBoardClick(coord)) {
      return;
    }

    if (deployWyrmId) {
      if (deployTargets.some((entry) => sameCoord(entry, coord))) {
        deploy(deployWyrmId, coord);
        setRawDeployWyrmId(null);
      }
      return;
    }

    if (trailWyrmId) {
      if (trailTargets.some((entry) => sameCoord(entry, coord))) {
        placeCoilTrail(trailWyrmId, coord);
        setRawTrailWyrmId(null);
      }
      return;
    }

    const cell = state.board[coord.row][coord.col];
    const occupant = cell.occupant ? state.wyrms[cell.occupant] : null;

    if (selectedMove) {
      const option = moveTargets.find(
        (entry) => entry.row === coord.row && entry.col === coord.col,
      );

      if (
        selectedMove.path.length > 1 &&
        sameCoord(selectedMove.path[selectedMove.path.length - 2], coord)
      ) {
        setRawSelectedMove({
          ...selectedMove,
          path: selectedMove.path.slice(0, -1),
        });
        return;
      }

      if (!option) {
        if (occupant && occupant.currentOwner === currentPlayer.id && occupant.position) {
          setRawSelectedMove(null);
        }
        return;
      }

      const nextPath = [...selectedMove.path, coord];
      setRawSelectedMove({
        ...selectedMove,
        path: nextPath,
      });
      return;
    }

    if (!occupant || occupant.currentOwner !== currentPlayer.id || !occupant.position) {
      return;
    }

    if (!state.turnEffects.mainMoveCompleted) {
      if (
        state.dieResult === "coil" &&
        !occupant.isElder &&
        state.turnEffects.coilChoice === "extra_trail"
      ) {
        setRawTrailWyrmId(occupant.id);
        return;
      }

      if (preferredMoveMode === "main" && hasAnyLegalMove(state, occupant.id, "main")) {
        setRawSelectedMove({
          wyrmId: occupant.id,
          path: [occupant.position],
          moveMode: "main",
        });
        return;
      }
    }

    if (
      state.turnEffects.tempestRushRemaining.includes(occupant.id) &&
      hasAnyLegalMove(state, occupant.id, "tempest")
    ) {
      setRawSelectedMove({
        wyrmId: occupant.id,
        path: [occupant.position],
        moveMode: "tempest",
      });
      return;
    }

    if (
      canResolveBlockedMove(state) &&
      getAdjacentEmptyCells(state, occupant.id, true).length > 0
    ) {
      setRawTrailWyrmId(occupant.id);
    }
  };

  const instruction = useMemo(
    () =>
      getMatchInstruction({
        state,
        tileDraft,
        deployWyrmId,
        trailWyrmId,
        hasSelectedMove: selectedMove != null,
        canConfirmMove,
        hoardChoicesCount: currentPlayer.hoard.length,
      }),
    [
      canConfirmMove,
      currentPlayer.hoard.length,
      deployWyrmId,
      selectedMove,
      state,
      tileDraft,
      trailWyrmId,
    ],
  );

  const performPhasePrimaryAction = () => {
    if (phase === "draw") {
      draw();
      return;
    }
    if (phase === "roll") {
      roll();
      return;
    }
    if (phase === "discard" && canConfirmDiscard) {
      confirmDiscard();
      return;
    }
    if (phase === "move" && canConfirmMove) {
      confirmMove();
      return;
    }
    if (phase === "tile" && canEndTurn) {
      endTurn();
    }
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
    selectedWyrmId: selectedMove?.wyrmId ?? null,
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
    selectedPath: selectedMove?.path ?? [],
    canConfirmMove,
    canConfirmDiscard,
    canEndTurn,
    canPlayTiles,
    clearInteraction,
    startTileDraft,
    toggleDiscard,
    confirmDiscard,
    confirmMove,
    chooseOpponent,
    chooseSpecialWyrm,
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
    hoardChoices: currentPlayer.hoard.map((wyrmId) => ({
      wyrmId,
      label: game.state.wyrms[wyrmId]?.label ?? wyrmId,
    })),
    opponentChoices: state.players
      .filter((player) => player.id !== currentPlayer.id)
      .map((player) => ({
        id: player.id,
        label: PLAYER_NAMES[player.id],
      })),
    canDeployFromHoard,
  };
}
