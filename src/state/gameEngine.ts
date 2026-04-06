import {
  appendLog,
  canCommitPath,
  canResolveBlockedMove,
  clearTransientState,
  cloneState,
  coordKey,
  createInitialState,
  drawFromDeck,
  getAdjacentEmptyCells,
  getControlledActiveWyrms,
  getCurrentPlayer,
  getDeployTargets,
  isDieResultValue,
  getMoveProfile,
  getPlayerById,
  hasAnyLegalMove,
  isOpponentDenCell,
  isOwnDenCoord,
  PLAYER_NAMES,
} from "./gameLogic.ts";
import type {
  Coord,
  DieResult,
  GameState,
  MoveMode,
  PlayerCount,
  PlayerId,
  RuneTileType,
  TilePlayRequest,
  Wyrm,
  WyrmId,
} from "./types.ts";

function setError(state: GameState, message: string): GameState {
  state.error = message;
  return state;
}

function rollRuneDie(): DieResult {
  const value = Math.random();
  if (value < 1 / 6) return 1;
  if (value < 2 / 6) return 2;
  if (value < 3 / 6) return 3;
  if (value < 4 / 6) return 4;
  if (value < 5 / 6) return "coil";
  return "surge";
}

function consumeTiles(
  hand: RuneTileType[],
  tile: RuneTileType,
  count: number,
): RuneTileType[] | null {
  let remaining = count;
  const nextHand = hand.filter((entry) => {
    if (entry === tile && remaining > 0) {
      remaining -= 1;
      return false;
    }
    return true;
  });

  return remaining === 0 ? nextHand : null;
}

function getTrailDuration(wyrm: Wyrm): number {
  if (wyrm.isElder) {
    return 1;
  }
  return wyrm.serpentBoostTurnsRemaining > 0 ? 5 : 3;
}

function removeTrailsByPredicate(
  state: GameState,
  predicate: (trailOwner: PlayerId, sourceWyrmId: WyrmId) => boolean,
): void {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.trail && predicate(cell.trail.owner, cell.trail.sourceWyrmId)) {
        cell.trail = null;
      }
    }
  }
}

function updateTrailsForSerpent(state: GameState, wyrmId: WyrmId): void {
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.trail?.sourceWyrmId === wyrmId) {
        cell.trail.placedRound = state.currentRound;
        cell.trail.expiresAfterRound = state.currentRound + 5;
      }
    }
  }
}

function captureWyrm(state: GameState, capturedId: WyrmId, captorId: PlayerId): void {
  const captured = state.wyrms[capturedId];
  if (!captured) {
    return;
  }

  if (captured.isElder) {
    const formerController = getPlayerById(state, captured.currentOwner);
    formerController.elderTokenAvailable = true;
  }

  const captor = getPlayerById(state, captorId);
  if (!captor.hoard.includes(capturedId)) {
    captor.hoard.push(capturedId);
  }

  captured.currentOwner = captorId;
  captured.status = "in_hoard";
  captured.position = null;
  captured.prevPosition = null;
  captured.isElder = false;
  captured.serpentBoostTurnsRemaining = 0;
}

function placeTrails(state: GameState, wyrm: Wyrm, path: Coord[]): void {
  const duration = getTrailDuration(wyrm);
  for (const coord of path.slice(0, -1)) {
    if (isOwnDenCoord(wyrm.currentOwner, coord)) {
      continue;
    }
    state.board[coord.row][coord.col].trail = {
      owner: wyrm.currentOwner,
      sourceWyrmId: wyrm.id,
      placedRound: state.currentRound,
      expiresAfterRound: state.currentRound + duration,
    };
  }
}

function maybeCollectPowerRune(state: GameState, coord: Coord, playerId: PlayerId): void {
  const cell = state.board[coord.row][coord.col];
  if (!cell.hasPowerRune) {
    return;
  }

  cell.hasPowerRune = false;
  state.powerRunesRemaining = state.powerRunesRemaining.filter((entry) => entry !== coordKey(coord));
  getPlayerById(state, playerId).nextDrawCount = 2;
  appendLog(state, `${PLAYER_NAMES[playerId]} stored a Power Rune bonus for the next draw.`);
}

function maybePromoteWyrm(state: GameState, wyrm: Wyrm): void {
  if (!wyrm.position || wyrm.isElder) {
    return;
  }

  const destination = state.board[wyrm.position.row][wyrm.position.col];
  if (!isOpponentDenCell(wyrm.currentOwner, destination.type)) {
    return;
  }

  const player = getPlayerById(state, wyrm.currentOwner);
  if (!player.elderTokenAvailable) {
    return;
  }

  wyrm.isElder = true;
  player.elderTokenAvailable = false;
  appendLog(state, `${PLAYER_NAMES[player.id]} promoted ${wyrm.label} to Elder status.`);
}

function advancePhaseAfterMove(state: GameState): void {
  if (state.turnEffects.mainMoveCompleted || state.turnEffects.tempestRushRemaining.length === 0) {
    state.phase = state.turnEffects.tempestRushRemaining.length > 0 ? "move" : "play_tile";
  } else {
    state.phase = "move";
  }
}

function resetTurnEffects(state: GameState): void {
  state.turnEffects = {
    coilChoice: null,
    flowWyrmId: null,
    windWyrmId: null,
    tempestRushRemaining: [],
    mainMoveCompleted: false,
    tileActionUsed: false,
  };
}

export function canEndTurnNow(state: GameState): boolean {
  if (state.phase === "game_over" || state.phase === "draw" || state.phase === "discard" || state.phase === "roll") {
    return false;
  }

  if (state.turnEffects.mainMoveCompleted) {
    return state.turnEffects.tempestRushRemaining.length === 0;
  }

  const player = getCurrentPlayer(state);
  const activeWyrms = getControlledActiveWyrms(state, player.id);
  const hasMainMove = activeWyrms.some((wyrm) => hasAnyLegalMove(state, wyrm.id, "main"));
  const canDeploy = player.hoard.length > 0 && getDeployTargets(state, player.id).length > 0;
  const canResolveBlocked = canResolveBlockedMove(state);
  return !hasMainMove && !canDeploy && !canResolveBlocked;
}

export function actionStartNewGame(playerCount: PlayerCount): GameState {
  return createInitialState(playerCount);
}

export function actionDraw(state: GameState): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "draw") {
    return setError(next, "Draw is only available during the draw step.");
  }

  const player = getCurrentPlayer(next);
  const drawCount = player.nextDrawCount;
  player.nextDrawCount = 1;

  for (let index = 0; index < drawCount; index += 1) {
    const tile = drawFromDeck(next);
    if (tile) {
      player.hand.push(tile);
    }
  }

  appendLog(next, `${PLAYER_NAMES[player.id]} drew ${drawCount} rune ${drawCount === 1 ? "tile" : "tiles"}.`);

  if (player.hand.length > 5) {
    next.mustDiscard = player.hand.length - 5;
    next.phase = "discard";
  } else {
    next.mustDiscard = 0;
    next.phase = "roll";
  }

  return next;
}

export function actionDiscard(state: GameState, tiles: RuneTileType[]): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "discard" || next.mustDiscard <= 0) {
    return setError(next, "There is nothing to discard right now.");
  }

  if (tiles.length !== next.mustDiscard) {
    return setError(next, `Choose exactly ${next.mustDiscard} tile(s) to discard.`);
  }

  const player = getCurrentPlayer(next);
  const nextHand = [...player.hand];

  for (const tile of tiles) {
    const index = nextHand.indexOf(tile);
    if (index === -1) {
      return setError(next, "Discard choices must come from the active hand.");
    }
    nextHand.splice(index, 1);
    next.discardPile.push(tile);
  }

  player.hand = nextHand;
  next.mustDiscard = 0;
  next.phase = "roll";
  appendLog(next, `${PLAYER_NAMES[player.id]} discarded down to five tiles.`);
  return next;
}

export function actionRoll(state: GameState, forced?: DieResult): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "roll") {
    return setError(next, "Roll is only available during the roll step.");
  }

  const rolled = isDieResultValue(forced) ? forced : rollRuneDie();

  next.dieResult = rolled;
  next.phase = "move";
  next.turnEffects.coilChoice = null;
  appendLog(next, `${PLAYER_NAMES[getCurrentPlayer(next).id]} rolled ${rolled === "surge" ? "Surge" : rolled === "coil" ? "Coil" : rolled}.`);
  return next;
}

export function actionSetCoilChoice(
  state: GameState,
  choice: 1 | 2 | 3 | "extra_trail",
): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.dieResult !== "coil" || next.phase !== "move") {
    return setError(next, "Coil choices are only available after rolling Coil.");
  }

  next.turnEffects.coilChoice = choice;
  return next;
}

export function checkVictory(state: GameState): GameState {
  for (const player of state.players) {
    const groveCount = Object.values(state.wyrms).filter((wyrm) => {
      if (wyrm.currentOwner !== player.id || wyrm.status !== "active" || !wyrm.position) {
        return false;
      }
      const cell = state.board[wyrm.position.row][wyrm.position.col];
      return cell.type === "grove";
    }).length;

    if (groveCount >= 2) {
      state.winner = player.id;
      state.winType = "grove";
      state.phase = "game_over";
      appendLog(state, `${PLAYER_NAMES[player.id]} claimed the Sacred Grove.`);
      return state;
    }
  }

  for (const captor of state.players) {
    for (const target of state.players) {
      if (captor.id === target.id) {
        continue;
      }

      const targetWyrmIds = Object.values(state.wyrms)
        .filter((wyrm) => wyrm.originalOwner === target.id)
        .map((wyrm) => wyrm.id);

      if (targetWyrmIds.length === 3 && targetWyrmIds.every((wyrmId) => captor.hoard.includes(wyrmId))) {
        state.winner = captor.id;
        state.winType = "domination";
        state.phase = "game_over";
        appendLog(state, `${PLAYER_NAMES[captor.id]} achieved domination over ${PLAYER_NAMES[target.id]}.`);
        return state;
      }
    }
  }

  return state;
}

export function actionMove(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "move" && next.phase !== "play_tile") {
    return setError(next, "Movement is only available during the move step.");
  }

  const profile = getMoveProfile(next, wyrmId, moveMode);
  if (!profile || !canCommitPath(next, wyrmId, path, moveMode)) {
    return setError(next, "That path is not legal for the selected wyrm.");
  }

  const wyrm = next.wyrms[wyrmId];
  if (!wyrm.position) {
    return setError(next, "That wyrm is not on the board.");
  }

  const destination = path[path.length - 1];
  const destinationCell = next.board[destination.row][destination.col];
  const previousPosition = { ...wyrm.position };
  const capturedId = destinationCell.occupant;

  if (capturedId) {
    captureWyrm(next, capturedId, wyrm.currentOwner);
  }

  next.board[previousPosition.row][previousPosition.col].occupant = null;
  wyrm.prevPosition = previousPosition;
  wyrm.position = destination;
  wyrm.status = "active";
  destinationCell.occupant = wyrmId;

  placeTrails(next, wyrm, path);
  maybeCollectPowerRune(next, destination, wyrm.currentOwner);
  maybePromoteWyrm(next, wyrm);

  if (moveMode === "main") {
    next.turnEffects.mainMoveCompleted = true;
  } else {
    next.turnEffects.tempestRushRemaining = next.turnEffects.tempestRushRemaining.filter((entry) => entry !== wyrmId);
  }

  appendLog(next, `${wyrm.label} moved ${path.length - 1} space${path.length === 2 ? "" : "s"}.`);
  checkVictory(next);

  if (next.winner == null) {
    advancePhaseAfterMove(next);
  }

  return next;
}

export function actionPlaceCoilTrail(
  state: GameState,
  wyrmId: WyrmId,
  target?: Coord,
): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  const wyrm = next.wyrms[wyrmId];
  if (!wyrm || !wyrm.position) {
    return setError(next, "Choose an active wyrm first.");
  }

  const availableTargets = getAdjacentEmptyCells(next, wyrmId, true);
  if (!target) {
    if (availableTargets.length > 0) {
      return setError(next, "Choose an empty adjacent cell for the trail marker.");
    }
  } else if (!availableTargets.some((coord) => coord.row === target.row && coord.col === target.col)) {
    return setError(next, "That cell cannot receive a trail marker.");
  }

  if (target) {
    const duration = getTrailDuration(wyrm);
    next.board[target.row][target.col].trail = {
      owner: wyrm.currentOwner,
      sourceWyrmId: wyrm.id,
      placedRound: next.currentRound,
      expiresAfterRound: next.currentRound + duration,
    };
    appendLog(next, `${wyrm.label} placed a trail instead of moving.`);
  } else {
    appendLog(next, `${wyrm.label} was fully blocked and could not place a trail.`);
  }

  next.turnEffects.mainMoveCompleted = true;
  advancePhaseAfterMove(next);
  return next;
}

export function actionDeploy(state: GameState, wyrmId: WyrmId, target: Coord): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "move" && next.phase !== "play_tile") {
    return setError(next, "Deploy is only available during the move step.");
  }

  if (next.turnEffects.mainMoveCompleted) {
    return setError(next, "The main move has already been used this turn.");
  }

  const player = getCurrentPlayer(next);
  if (!player.hoard.includes(wyrmId)) {
    return setError(next, "Only hoarded wyrms controlled by the active player can be deployed.");
  }

  const deployTargets = getDeployTargets(next, player.id);
  if (!deployTargets.some((coord) => coord.row === target.row && coord.col === target.col)) {
    return setError(next, "That den cell is not available for deployment.");
  }

  player.hoard = player.hoard.filter((entry) => entry !== wyrmId);
  const wyrm = next.wyrms[wyrmId];
  wyrm.currentOwner = player.id;
  wyrm.status = "active";
  wyrm.position = target;
  wyrm.prevPosition = null;
  next.board[target.row][target.col].occupant = wyrmId;

  next.turnEffects.mainMoveCompleted = true;
  appendLog(next, `${PLAYER_NAMES[player.id]} deployed ${wyrm.label} from the hoard.`);
  advancePhaseAfterMove(next);
  checkVictory(next);
  return next;
}

export function actionPlayTile(state: GameState, request: TilePlayRequest): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (next.phase !== "move" && next.phase !== "play_tile") {
    return setError(next, "Rune tiles can only be played during the move or tile step.");
  }

  if (next.turnEffects.tileActionUsed) {
    return setError(next, "Only one tile or one Lair Power can be used each turn.");
  }

  const player = getCurrentPlayer(next);
  const copiesNeeded = request.mode === "lair" ? 3 : 1;
  const nextHand = consumeTiles(player.hand, request.tile, copiesNeeded);
  if (!nextHand) {
    return setError(next, "The active hand does not contain the required tile set.");
  }

  const commitCards = () => {
    player.hand = nextHand;
    for (let index = 0; index < copiesNeeded; index += 1) {
      next.discardPile.push(request.tile);
    }
    next.turnEffects.tileActionUsed = true;
  };

  const placeWalls = (targets: Coord[], expected: number): boolean => {
    if (targets.length !== expected) return false;
    const uniqueKeys = new Set(targets.map((coord) => `${coord.row},${coord.col}`));
    if (uniqueKeys.size !== expected) return false;
    return targets.every((coord) => {
      const cell = next.board[coord.row][coord.col];
      return !cell.hasWall && !cell.occupant && !cell.trail;
    });
  };

  if (request.mode === "single") {
    switch (request.tile) {
      case "fire": {
        commitCards();
        removeTrailsByPredicate(next, (owner) => owner === player.id);
        appendLog(next, `${PLAYER_NAMES[player.id]} burned away their own trail network.`);
        break;
      }
      case "water": {
        const wyrmId = request.wyrmId;
        if (!wyrmId || !next.wyrms[wyrmId] || next.wyrms[wyrmId].currentOwner !== player.id || next.wyrms[wyrmId].status !== "active") {
          return setError(next, "Choose one of your active wyrms for Flow.");
        }
        commitCards();
        next.turnEffects.flowWyrmId = wyrmId;
        appendLog(next, `${next.wyrms[wyrmId].label} can pass through one trail this turn.`);
        break;
      }
      case "earth": {
        if (!request.targetCoords || !placeWalls(request.targetCoords, 1)) {
          return setError(next, "Stone needs one empty cell.");
        }
        commitCards();
        const target = request.targetCoords[0];
        next.board[target.row][target.col].hasWall = true;
        next.board[target.row][target.col].hasPowerRune = false;
        next.powerRunesRemaining = next.powerRunesRemaining.filter((entry) => entry !== `${target.row},${target.col}`);
        appendLog(next, `${PLAYER_NAMES[player.id]} raised a wall.`);
        break;
      }
      case "wind": {
        const wyrmId = request.wyrmId;
        if (!wyrmId || !next.wyrms[wyrmId] || next.wyrms[wyrmId].currentOwner !== player.id || next.wyrms[wyrmId].status !== "active") {
          return setError(next, "Choose one of your active wyrms for Gust.");
        }
        commitCards();
        next.turnEffects.windWyrmId = wyrmId;
        appendLog(next, `${next.wyrms[wyrmId].label} gained +2 movement this turn.`);
        break;
      }
      case "shadow": {
        const swapIds = request.swapWyrmIds;
        if (!swapIds) {
          return setError(next, "Eclipse needs two wyrms to swap.");
        }
        const [firstId, secondId] = swapIds;
        const first = next.wyrms[firstId];
        const second = next.wyrms[secondId];
        if (!first?.position || !second?.position || first.currentOwner !== player.id || second.currentOwner !== player.id) {
          return setError(next, "Only your on-board wyrms can be swapped.");
        }
        commitCards();
        const firstPos = { ...first.position };
        const secondPos = { ...second.position };
        next.board[firstPos.row][firstPos.col].occupant = second.id;
        next.board[secondPos.row][secondPos.col].occupant = first.id;
        first.position = secondPos;
        second.position = firstPos;
        appendLog(next, `${PLAYER_NAMES[player.id]} swapped two wyrms with Eclipse.`);
        checkVictory(next);
        break;
      }
      case "light": {
        if (!request.opponentId || request.opponentId === player.id) {
          return setError(next, "Radiance needs one opposing player.");
        }
        commitCards();
        appendLog(next, `${PLAYER_NAMES[player.id]} revealed ${PLAYER_NAMES[request.opponentId]}'s hand.`);
        break;
      }
      case "void": {
        if (!request.opponentId || request.opponentId === player.id || !request.targetCoords || request.targetCoords.length === 0 || request.targetCoords.length > 3) {
          return setError(next, "Erasure needs up to three trails from one opponent.");
        }
        const allValid = request.targetCoords.every((coord) => next.board[coord.row][coord.col].trail?.owner === request.opponentId);
        if (!allValid) {
          return setError(next, "Erasure can only remove trails owned by the chosen opponent.");
        }
        commitCards();
        for (const coord of request.targetCoords) {
          next.board[coord.row][coord.col].trail = null;
        }
        appendLog(next, `${PLAYER_NAMES[player.id]} erased ${request.targetCoords.length} trail marker(s).`);
        break;
      }
      case "serpent": {
        const wyrmId = request.wyrmId;
        if (!wyrmId || !next.wyrms[wyrmId] || next.wyrms[wyrmId].currentOwner !== player.id || next.wyrms[wyrmId].status !== "active") {
          return setError(next, "Coil needs one of your active wyrms.");
        }
        commitCards();
        next.wyrms[wyrmId].serpentBoostTurnsRemaining = 2;
        updateTrailsForSerpent(next, wyrmId);
        appendLog(next, `${next.wyrms[wyrmId].label} now leaves five-round trails.`);
        break;
      }
    }
  } else {
    switch (request.tile) {
      case "fire": {
        commitCards();
        removeTrailsByPredicate(next, () => true);
        appendLog(next, `${PLAYER_NAMES[player.id]} unleashed Phoenix Molt and cleared every trail.`);
        break;
      }
      case "water": {
        commitCards();
        player.floodPathTurnsRemaining = Math.max(player.floodPathTurnsRemaining, 4);
        appendLog(next, `${PLAYER_NAMES[player.id]} activated Flood Path for the next three turns.`);
        break;
      }
      case "earth": {
        if (!request.targetCoords || !placeWalls(request.targetCoords, 3)) {
          return setError(next, "Fortress needs three distinct empty cells.");
        }
        commitCards();
        for (const coord of request.targetCoords) {
          next.board[coord.row][coord.col].hasWall = true;
          next.board[coord.row][coord.col].hasPowerRune = false;
          next.powerRunesRemaining = next.powerRunesRemaining.filter((entry) => entry !== `${coord.row},${coord.col}`);
        }
        appendLog(next, `${PLAYER_NAMES[player.id]} fortified the board with three walls.`);
        break;
      }
      case "wind": {
        commitCards();
        next.turnEffects.tempestRushRemaining = getControlledActiveWyrms(next, player.id).map((wyrm) => wyrm.id);
        next.phase = "move";
        appendLog(next, `${PLAYER_NAMES[player.id]} can make three bonus Tempest Rush moves.`);
        break;
      }
      case "shadow": {
        const targetCoord = request.targetCoords?.[0];
        const teleportId = request.teleportWyrmId;
        if (!targetCoord || !teleportId) {
          return setError(next, "Void Walk needs one wyrm and one empty destination cell.");
        }
        const cell = next.board[targetCoord.row][targetCoord.col];
        if (cell.occupant || cell.hasWall || cell.trail) {
          return setError(next, "Void Walk requires an empty destination cell.");
        }
        const wyrm = next.wyrms[teleportId];
        if (!wyrm || wyrm.currentOwner !== player.id) {
          return setError(next, "Void Walk can only move your controlled wyrms.");
        }
        commitCards();
        if (wyrm.position) {
          next.board[wyrm.position.row][wyrm.position.col].occupant = null;
        } else if (player.hoard.includes(teleportId)) {
          player.hoard = player.hoard.filter((entry) => entry !== teleportId);
        }
        wyrm.position = targetCoord;
        wyrm.status = "active";
        next.board[targetCoord.row][targetCoord.col].occupant = teleportId;
        maybePromoteWyrm(next, wyrm);
        appendLog(next, `${wyrm.label} stepped through the void.`);
        checkVictory(next);
        break;
      }
      case "light": {
        if (!request.opponentId || request.opponentId === player.id) {
          return setError(next, "Blinding Flash needs one opposing player.");
        }
        commitCards();
        getPlayerById(next, request.opponentId).skipTurnsRemaining += 2;
        appendLog(next, `${PLAYER_NAMES[request.opponentId]} will skip the next two turns.`);
        break;
      }
      case "void": {
        if (!request.opponentId || !next.players.some((entry) => entry.id === request.opponentId)) {
          return setError(next, "Annihilation needs one player color to purge.");
        }
        commitCards();
        removeTrailsByPredicate(next, (owner) => owner === request.opponentId);
        appendLog(next, `${PLAYER_NAMES[player.id]} removed every ${PLAYER_NAMES[request.opponentId]} trail marker.`);
        break;
      }
      case "serpent": {
        const wyrmId = request.wyrmId;
        if (!wyrmId) {
          return setError(next, "Ancient Wyrm needs one controlled wyrm.");
        }
        const wyrm = next.wyrms[wyrmId];
        if (!wyrm || wyrm.currentOwner !== player.id || wyrm.isElder) {
          return setError(next, "Choose one of your non-Elder wyrms.");
        }
        if (!player.elderTokenAvailable) {
          return setError(next, "Your Elder token is already in use.");
        }
        commitCards();
        wyrm.isElder = true;
        player.elderTokenAvailable = false;
        appendLog(next, `${wyrm.label} became an Ancient Wyrm.`);
        break;
      }
    }
  }

  if (next.winner == null && next.phase !== "move") {
    next.phase = next.turnEffects.mainMoveCompleted && next.turnEffects.tempestRushRemaining.length === 0 ? "play_tile" : "move";
  }

  return next;
}

export function actionEndTurn(state: GameState): GameState {
  const next = cloneState(state);
  clearTransientState(next);

  if (!canEndTurnNow(next)) {
    return setError(next, "Finish your move, resolve a blocked move, or use your remaining Tempest Rush before ending the turn.");
  }

  for (const row of next.board) {
    for (const cell of row) {
      if (cell.trail && next.currentRound > cell.trail.expiresAfterRound) {
        cell.trail = null;
      }
    }
  }

  const currentPlayer = getCurrentPlayer(next);
  if (currentPlayer.floodPathTurnsRemaining > 0) {
    currentPlayer.floodPathTurnsRemaining -= 1;
  }

  for (const wyrm of Object.values(next.wyrms)) {
    if (wyrm.currentOwner === currentPlayer.id && wyrm.serpentBoostTurnsRemaining > 0) {
      wyrm.serpentBoostTurnsRemaining -= 1;
    }
  }

  let nextPlayerFound = false;
  while (!nextPlayerFound) {
    next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
    if (next.currentPlayerIndex === 0) {
      next.currentRound += 1;
    }

    const upcomingPlayer = getCurrentPlayer(next);
    if (upcomingPlayer.skipTurnsRemaining > 0) {
      upcomingPlayer.skipTurnsRemaining -= 1;
      appendLog(next, `${PLAYER_NAMES[upcomingPlayer.id]} loses a turn to Blinding Flash.`);
      continue;
    }

    nextPlayerFound = true;
  }

  next.turnNumber += 1;
  next.phase = "draw";
  next.dieResult = null;
  next.mustDiscard = 0;
  resetTurnEffects(next);
  appendLog(next, `${PLAYER_NAMES[getCurrentPlayer(next).id]} begins a new turn.`);
  return next;
}
