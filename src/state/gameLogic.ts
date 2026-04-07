import type {
  Board,
  Cell,
  CellType,
  Coord,
  DieResult,
  GameState,
  MoveMode,
  MoveProfile,
  PlayerColor,
  PlayerCount,
  PlayerId,
  PlayerState,
  RuneTileType,
  StepOption,
  TurnEffects,
  Wyrm,
  WyrmId,
} from "./types.ts";

export const BOARD_SIZE = 12;

export const PLAYER_ORDER_BY_COUNT: Record<PlayerCount, PlayerId[]> = {
  2: [1, 4],
  3: [1, 2, 3],
  4: [1, 2, 3, 4],
};

export const PLAYER_COLORS: Record<PlayerId, PlayerColor> = {
  1: "purple",
  2: "coral",
  3: "teal",
  4: "amber",
};

export const PLAYER_NAMES: Record<PlayerId, string> = {
  1: "Purple",
  2: "Coral",
  3: "Teal",
  4: "Amber",
};

export const DEN_CELLS: Record<PlayerId, Coord[]> = {
  1: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
  2: [
    { row: 0, col: 10 },
    { row: 0, col: 11 },
    { row: 1, col: 10 },
    { row: 1, col: 11 },
  ],
  3: [
    { row: 10, col: 0 },
    { row: 10, col: 1 },
    { row: 11, col: 0 },
    { row: 11, col: 1 },
  ],
  4: [
    { row: 10, col: 10 },
    { row: 10, col: 11 },
    { row: 11, col: 10 },
    { row: 11, col: 11 },
  ],
};

export const DEN_SPAWNS: Record<PlayerId, Coord[]> = {
  1: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
  ],
  2: [
    { row: 0, col: 10 },
    { row: 0, col: 11 },
    { row: 1, col: 11 },
  ],
  3: [
    { row: 10, col: 0 },
    { row: 11, col: 0 },
    { row: 11, col: 1 },
  ],
  4: [
    { row: 10, col: 11 },
    { row: 11, col: 10 },
    { row: 11, col: 11 },
  ],
};

export const SACRED_GROVE_CELLS: Coord[] = [
  { row: 5, col: 5 },
  { row: 5, col: 6 },
  { row: 6, col: 5 },
  { row: 6, col: 6 },
];

export const POWER_RUNE_CELLS: Coord[] = [
  { row: 2, col: 5 },
  { row: 2, col: 6 },
  { row: 5, col: 2 },
  { row: 6, col: 2 },
  { row: 9, col: 5 },
  { row: 9, col: 6 },
  { row: 5, col: 9 },
  { row: 6, col: 9 },
];

export const TILE_ORDER: RuneTileType[] = [
  "fire",
  "water",
  "earth",
  "wind",
  "shadow",
  "light",
  "void",
  "serpent",
];

export const TILE_LABELS: Record<RuneTileType, string> = {
  fire: "Flame",
  water: "Flow",
  earth: "Stone",
  wind: "Gust",
  shadow: "Eclipse",
  light: "Radiance",
  void: "Erasure",
  serpent: "Coil",
};

export const TILE_HELP: Record<RuneTileType, string> = {
  fire: "Clear all of your trails.",
  water: "One chosen wyrm may pass through one trail this turn.",
  earth: "Place a permanent wall on one empty cell.",
  wind: "One chosen wyrm gets +2 movement this turn.",
  shadow: "Swap two of your on-board wyrms.",
  light: "Reveal one opponent's hand.",
  void: "Erase up to 3 trails from one opponent.",
  serpent: "Extend one wyrm's trail to 5 rounds and boost its next turn.",
};

export const TILE_LAIR_HELP: Record<RuneTileType, string> = {
  fire: "Phoenix Molt — remove every trail marker from the entire board.",
  water: "Flood Path — your Wyrms ignore all trails for 3 full turns.",
  earth: "Fortress — place 3 wall tiles anywhere on the board.",
  wind: "Tempest Rush — all 3 of your Wyrms each get a free bonus move of up to 3 spaces.",
  shadow: "Void Walk — teleport any one Wyrm to any empty cell on the board.",
  light: "Blinding Flash — one opponent skips their next 2 turns.",
  void: "Annihilation — remove all trail markers of one colour from the board.",
  serpent: "Ancient Wyrm — instantly promote any Wyrm to Elder status.",
};

const DECK_COMPOSITION: RuneTileType[] = TILE_ORDER.flatMap((tile) =>
  Array.from({ length: 5 }, () => tile),
);

const ORTHOGONAL_DIRECTIONS: Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const ALL_DIRECTIONS: Coord[] = [
  ...ORTHOGONAL_DIRECTIONS,
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

const DIE_RESULTS = new Set<DieResult | number>([1, 2, 3, 4, "coil", "surge"]);

export function isDieResultValue(value: unknown): value is DieResult {
  return DIE_RESULTS.has(value as DieResult);
}

export function coordKey(coord: Coord): string {
  return `${coord.row},${coord.col}`;
}

export function sameCoord(a: Coord | null | undefined, b: Coord | null | undefined): boolean {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

export function cloneState<T>(value: T): T {
  return structuredClone(value);
}

export function shuffleTiles(tiles: RuneTileType[]): RuneTileType[] {
  const next = [...tiles];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function isInsideBoard(coord: Coord): boolean {
  return coord.row >= 0 && coord.row < BOARD_SIZE && coord.col >= 0 && coord.col < BOARD_SIZE;
}

export function getCellType(row: number, col: number): CellType {
  if (row <= 1 && col <= 1) return "den_p1";
  if (row <= 1 && col >= 10) return "den_p2";
  if (row >= 10 && col <= 1) return "den_p3";
  if (row >= 10 && col >= 10) return "den_p4";
  if ((row === 5 || row === 6) && (col === 5 || col === 6)) return "grove";
  return "open";
}

export function isPowerRune(coord: Coord): boolean {
  return POWER_RUNE_CELLS.some((cell) => sameCoord(cell, coord));
}

export function getCurrentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

export function getPlayerById(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    throw new Error(`Unknown player ${playerId}`);
  }
  return player;
}

export function getOwnDenType(playerId: PlayerId): CellType {
  return `den_p${playerId}` as CellType;
}

export function getDenCells(playerId: PlayerId): Coord[] {
  return DEN_CELLS[playerId];
}

export function isOwnDenCoord(playerId: PlayerId, coord: Coord): boolean {
  return getDenCells(playerId).some((cell) => sameCoord(cell, coord));
}

export function isOpponentDenCell(playerId: PlayerId, cellType: CellType): boolean {
  return cellType.startsWith("den_") && cellType !== getOwnDenType(playerId);
}

export function getControlledActiveWyrms(state: GameState, playerId: PlayerId): Wyrm[] {
  return Object.values(state.wyrms).filter(
    (wyrm) => wyrm.currentOwner === playerId && wyrm.status === "active" && wyrm.position,
  );
}

export function getControlledHoardWyrms(state: GameState, playerId: PlayerId): Wyrm[] {
  const player = getPlayerById(state, playerId);
  return player.hoard.map((wyrmId) => state.wyrms[wyrmId]).filter(Boolean);
}

function buildBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, col): Cell => ({
      row,
      col,
      type: getCellType(row, col),
      trail: null,
      hasWall: false,
      hasPowerRune: isPowerRune({ row, col }),
      occupant: null,
    })),
  );
}

function createPlayerState(playerId: PlayerId): PlayerState {
  return {
    id: playerId,
    color: PLAYER_COLORS[playerId],
    hand: [],
    hoard: [],
    elderTokenAvailable: true,
    floodPathTurnsRemaining: 0,
    skipTurnsRemaining: 0,
    nextDrawCount: 1,
  };
}

function createWyrm(playerId: PlayerId, index: number, coord: Coord): Wyrm {
  return {
    id: `p${playerId}_w${index + 1}`,
    label: `${PLAYER_NAMES[playerId]} ${String.fromCharCode(65 + index)}`,
    originalOwner: playerId,
    currentOwner: playerId,
    isElder: false,
    position: coord,
    status: "active",
    prevPosition: null,
    serpentBoostTurnsRemaining: 0,
  };
}

function createInitialTurnEffects(): TurnEffects {
  return {
    coilChoice: null,
    flowWyrmId: null,
    windWyrmId: null,
    tempestRushRemaining: [],
    mainMoveCompleted: false,
    tileActionUsed: false,
  };
}

export function createInitialState(playerCount: PlayerCount = 2): GameState {
  const board = buildBoard();
  const players = PLAYER_ORDER_BY_COUNT[playerCount].map(createPlayerState);
  const deck = shuffleTiles(DECK_COMPOSITION);
  const wyrms: Record<WyrmId, Wyrm> = {};

  for (const player of players) {
    DEN_SPAWNS[player.id].forEach((coord, index) => {
      const wyrm = createWyrm(player.id, index, coord);
      wyrms[wyrm.id] = wyrm;
      board[coord.row][coord.col].occupant = wyrm.id;
    });
  }

  for (const player of players) {
    for (let drawIndex = 0; drawIndex < 4; drawIndex += 1) {
      const tile = deck.pop();
      if (tile) {
        player.hand.push(tile);
      }
    }
  }

  return {
    board,
    players,
    wyrms,
    currentPlayerIndex: 0,
    currentRound: 1,
    turnNumber: 1,
    phase: "draw",
    dieResult: null,
    deck,
    discardPile: [],
    powerRunesRemaining: POWER_RUNE_CELLS.map(coordKey),
    winner: null,
    winType: null,
    playerCount,
    mustDiscard: 0,
    turnEffects: createInitialTurnEffects(),
    log: [`${PLAYER_NAMES[players[0].id]} begins the game.`],
    error: null,
  };
}

export function drawFromDeck(state: GameState): RuneTileType | null {
  if (state.deck.length === 0 && state.discardPile.length > 0) {
    state.deck = shuffleTiles(state.discardPile);
    state.discardPile = [];
  }

  return state.deck.pop() ?? null;
}

export function appendLog(state: GameState, message: string): void {
  state.log = [message, ...state.log].slice(0, 12);
}

export function clearTransientState(state: GameState): void {
  state.error = null;
}

function countTrailEntriesOnPath(state: GameState, path: Coord[]): number {
  return path.slice(1).reduce((count, coord) => count + (state.board[coord.row][coord.col].trail ? 1 : 0), 0);
}

function getDirectionsForWyrm(wyrm: Wyrm): Coord[] {
  return wyrm.isElder ? ALL_DIRECTIONS : ORTHOGONAL_DIRECTIONS;
}

export function getMoveProfile(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode = "main",
): MoveProfile | null {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm || !wyrm.position || wyrm.status !== "active") {
    return null;
  }

  const player = getPlayerById(state, wyrm.currentOwner);
  const floodPathActive = player.floodPathTurnsRemaining > 0;
  const windBoost = state.turnEffects.windWyrmId === wyrmId ? 2 : 0;

  if (moveMode === "tempest") {
    if (!state.turnEffects.tempestRushRemaining.includes(wyrmId)) {
      return null;
    }
    return {
      mode: moveMode,
      minSteps: 1,
      maxSteps: 3,
      exact: false,
      allowDiagonal: wyrm.isElder,
      canEndOnTrail: floodPathActive,
      canIgnoreTrails: floodPathActive,
      canPassThroughOneTrail: !floodPathActive && state.turnEffects.flowWyrmId === wyrmId,
    };
  }

  if (state.turnEffects.mainMoveCompleted) {
    return null;
  }

  if (wyrm.isElder) {
    return {
      mode: moveMode,
      minSteps: 1,
      maxSteps: 3 + windBoost,
      exact: false,
      allowDiagonal: true,
      canEndOnTrail: floodPathActive,
      canIgnoreTrails: floodPathActive,
      canPassThroughOneTrail: !floodPathActive && state.turnEffects.flowWyrmId === wyrmId,
    };
  }

  if (state.dieResult == null) {
    return null;
  }

  if (!isDieResultValue(state.dieResult)) {
    return null;
  }

  if (state.dieResult === "coil") {
    if (state.turnEffects.coilChoice == null || state.turnEffects.coilChoice === "extra_trail") {
      return null;
    }

    return {
      mode: moveMode,
      minSteps: state.turnEffects.coilChoice,
      maxSteps: state.turnEffects.coilChoice + windBoost,
      exact: true,
      allowDiagonal: false,
      canEndOnTrail: floodPathActive,
      canIgnoreTrails: floodPathActive,
      canPassThroughOneTrail: !floodPathActive && state.turnEffects.flowWyrmId === wyrmId,
    };
  }

  const baseDistance = state.dieResult === "surge" ? 5 : state.dieResult;
  return {
    mode: moveMode,
    minSteps: baseDistance + windBoost,
    maxSteps: baseDistance + windBoost,
    exact: true,
    allowDiagonal: false,
    canEndOnTrail: floodPathActive,
    canIgnoreTrails: floodPathActive,
    canPassThroughOneTrail: !floodPathActive && state.turnEffects.flowWyrmId === wyrmId,
  };
}

export function isPathValid(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): boolean {
  const wyrm = state.wyrms[wyrmId];
  const profile = getMoveProfile(state, wyrmId, moveMode);

  if (!wyrm || !wyrm.position || !profile || path.length < 2 || !sameCoord(path[0], wyrm.position)) {
    return false;
  }

  const steps = path.length - 1;
  if (profile.exact ? steps !== profile.maxSteps : steps < profile.minSteps || steps > profile.maxSteps) {
    return false;
  }

  const allowedDirections = getDirectionsForWyrm(wyrm);
  let trailEntries = 0;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (!isInsideBoard(current)) {
      return false;
    }

    const delta = { row: current.row - previous.row, col: current.col - previous.col };
    const directionAllowed = allowedDirections.some((direction) => sameCoord(direction, delta));
    if (!directionAllowed) {
      return false;
    }

    if (index === 1 && sameCoord(current, wyrm.prevPosition)) {
      return false;
    }

    if (index > 1 && sameCoord(current, path[index - 2])) {
      return false;
    }

    const cell = state.board[current.row][current.col];
    if (cell.hasWall) {
      return false;
    }

    if (cell.trail && !profile.canIgnoreTrails) {
      trailEntries += 1;
      if (!profile.canPassThroughOneTrail || trailEntries > 1) {
        return false;
      }
      if (index === path.length - 1 && !profile.canEndOnTrail) {
        return false;
      }
    }

    if (cell.occupant) {
      const occupant = state.wyrms[cell.occupant];
      if (!occupant) {
        return false;
      }
      if (occupant.currentOwner === wyrm.currentOwner) {
        return false;
      }
      if (index !== path.length - 1) {
        return false;
      }
    }
  }

  return true;
}

export function canCommitPath(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): boolean {
  return isPathValid(state, wyrmId, path, moveMode);
}

export function getLegalMoves(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode = "main",
): Coord[] {
  const wyrm = state.wyrms[wyrmId];
  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!wyrm || !wyrm.position || !profile) {
    return [];
  }

  const destinations = new Map<string, Coord>();

  const search = (path: Coord[]): void => {
    if (path.length > 1 && canCommitPath(state, wyrmId, path, moveMode)) {
      const destination = path[path.length - 1];
      destinations.set(coordKey(destination), destination);
    }

    if (path.length - 1 >= profile.maxSteps) {
      return;
    }

    for (const option of getNextPathOptions(state, wyrmId, path, moveMode)) {
      const nextPath = [...path, { row: option.row, col: option.col }];
      if (option.capture) {
        if (canCommitPath(state, wyrmId, nextPath, moveMode)) {
          destinations.set(coordKey(nextPath[nextPath.length - 1]), nextPath[nextPath.length - 1]);
        }
        continue;
      }
      search(nextPath);
    }
  };

  search([wyrm.position]);

  return [...destinations.values()].sort((left, right) =>
    left.row === right.row ? left.col - right.col : left.row - right.row,
  );
}

export function getNextPathOptions(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  moveMode: MoveMode = "main",
): StepOption[] {
  const wyrm = state.wyrms[wyrmId];
  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!wyrm || !wyrm.position || !profile) {
    return [];
  }

  const workingPath = path.length === 0 ? [wyrm.position] : path;
  const stepsUsed = workingPath.length - 1;
  if (stepsUsed >= profile.maxSteps) {
    return [];
  }

  const last = workingPath[workingPath.length - 1];
  const previous = workingPath.length > 1 ? workingPath[workingPath.length - 2] : null;
  const directions = getDirectionsForWyrm(wyrm);

  return directions.reduce<StepOption[]>((options, direction) => {
    const next: Coord = { row: last.row + direction.row, col: last.col + direction.col };
    if (!isInsideBoard(next)) {
      return options;
    }

    if (previous && sameCoord(previous, next)) {
      return options;
    }

    if (workingPath.length === 1 && sameCoord(next, wyrm.prevPosition)) {
      return options;
    }

    const cell = state.board[next.row][next.col];
    if (cell.hasWall) {
      return options;
    }

    const candidatePath = [...workingPath, next];
    const occupant = cell.occupant ? state.wyrms[cell.occupant] : null;

    if (occupant && occupant.currentOwner === wyrm.currentOwner) {
      return options;
    }

    if (occupant && occupant.currentOwner !== wyrm.currentOwner) {
      if (canCommitPath(state, wyrmId, candidatePath, moveMode)) {
        options.push({ ...next, terminal: true, capture: true });
      }
      return options;
    }

    options.push({
      ...next,
      terminal: canCommitPath(state, wyrmId, candidatePath, moveMode),
      capture: false,
    });
    return options;
  }, []);
}

export function hasAnyLegalMove(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode = "main",
): boolean {
  const wyrm = state.wyrms[wyrmId];
  const profile = getMoveProfile(state, wyrmId, moveMode);
  if (!wyrm || !wyrm.position || !profile) {
    return false;
  }

  const search = (path: Coord[]): boolean => {
    if (path.length > 1 && canCommitPath(state, wyrmId, path, moveMode)) {
      return true;
    }

    if (path.length - 1 >= profile.maxSteps) {
      return false;
    }

    return getNextPathOptions(state, wyrmId, path, moveMode).some((option) =>
      search([...path, { row: option.row, col: option.col }]),
    );
  };

  return search([wyrm.position]);
}

export function getDeployTargets(state: GameState, playerId: PlayerId): Coord[] {
  return getDenCells(playerId).filter((coord) => {
    const cell = state.board[coord.row][coord.col];
    return !cell.occupant && !cell.hasWall && !cell.trail;
  });
}

export function getAdjacentEmptyCells(
  state: GameState,
  wyrmId: WyrmId,
  orthogonalOnly = true,
): Coord[] {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm || !wyrm.position) {
    return [];
  }

  const directions = orthogonalOnly ? ORTHOGONAL_DIRECTIONS : getDirectionsForWyrm(wyrm);
  return directions
    .map((direction) => ({
      row: wyrm.position!.row + direction.row,
      col: wyrm.position!.col + direction.col,
    }))
    .filter(isInsideBoard)
    .filter((coord) => {
      const cell = state.board[coord.row][coord.col];
      return !cell.occupant && !cell.hasWall && !cell.trail;
    });
}

export function canResolveBlockedMove(state: GameState): boolean {
  const player = getCurrentPlayer(state);
  const activeWyrms = getControlledActiveWyrms(state, player.id);
  const anyNormalMove = activeWyrms.some((wyrm) => hasAnyLegalMove(state, wyrm.id, "main"));
  if (anyNormalMove) {
    return false;
  }

  const deployTargets = getDeployTargets(state, player.id);
  if (player.hoard.length > 0 && deployTargets.length > 0) {
    return false;
  }

  return activeWyrms.some((wyrm) => getAdjacentEmptyCells(state, wyrm.id).length > 0);
}

export function hasAnyOptionalPlay(state: GameState): boolean {
  if (state.turnEffects.tempestRushRemaining.length > 0) {
    return true;
  }
  if (!state.turnEffects.mainMoveCompleted) {
    const player = getCurrentPlayer(state);
    return getControlledActiveWyrms(state, player.id).some((wyrm) => hasAnyLegalMove(state, wyrm.id, "main"));
  }
  return false;
}

export function countTrailEntries(state: GameState, path: Coord[]): number {
  return countTrailEntriesOnPath(state, path);
}

export function describeDieResult(result: unknown): string {
  if (result == null) return "Not rolled";
  if (!isDieResultValue(result)) return "Invalid roll";
  if (result === "coil") return "Coil";
  if (result === "surge") return "Surge (5)";
  return String(result);
}
