export type PlayerId = 1 | 2 | 3 | 4;
export type PlayerCount = 2 | 3 | 4;

export interface Coord {
  row: number;
  col: number;
}

export type CellType =
  | "open"
  | "den_p1"
  | "den_p2"
  | "den_p3"
  | "den_p4"
  | "grove";

export type WyrmId = string;

export interface TrailMarker {
  owner: PlayerId;
  sourceWyrmId: WyrmId;
  placedRound: number;
  expiresAfterRound: number;
}

export interface Cell extends Coord {
  type: CellType;
  trail: TrailMarker | null;
  hasWall: boolean;
  hasPowerRune: boolean;
  occupant: WyrmId | null;
}

export type Board = Cell[][];

export type WyrmStatus = "active" | "in_hoard";

export interface Wyrm {
  id: WyrmId;
  label: string;
  originalOwner: PlayerId;
  currentOwner: PlayerId;
  isElder: boolean;
  position: Coord | null;
  status: WyrmStatus;
  prevPosition: Coord | null;
  serpentBoostTurnsRemaining: number;
}

export type RuneTileType =
  | "fire"
  | "water"
  | "earth"
  | "wind"
  | "shadow"
  | "light"
  | "void"
  | "serpent";

export type PlayerColor = "purple" | "coral" | "teal" | "amber";

export interface PlayerState {
  id: PlayerId;
  color: PlayerColor;
  hand: RuneTileType[];
  hoard: WyrmId[];
  elderTokenAvailable: boolean;
  floodPathTurnsRemaining: number;
  skipTurnsRemaining: number;
  nextDrawCount: 1 | 2;
}

export type TurnPhase = "draw" | "discard" | "roll" | "move" | "play_tile" | "game_over";
export type DieResult = 1 | 2 | 3 | 4 | "coil" | "surge";
export type WinType = "grove" | "domination";
export type MoveMode = "main" | "tempest";

export interface TurnEffects {
  coilChoice: 1 | 2 | 3 | "extra_trail" | null;
  flowWyrmId: WyrmId | null;
  windWyrmId: WyrmId | null;
  tempestRushRemaining: WyrmId[];
  mainMoveCompleted: boolean;
  tileActionUsed: boolean;
}

export interface GameState {
  board: Board;
  players: PlayerState[];
  wyrms: Record<WyrmId, Wyrm>;
  currentPlayerIndex: number;
  currentRound: number;
  turnNumber: number;
  phase: TurnPhase;
  dieResult: DieResult | null;
  deck: RuneTileType[];
  discardPile: RuneTileType[];
  powerRunesRemaining: string[];
  winner: PlayerId | null;
  winType: WinType | null;
  playerCount: PlayerCount;
  mustDiscard: number;
  turnEffects: TurnEffects;
  log: string[];
  error: string | null;
}

export interface MoveProfile {
  mode: MoveMode;
  minSteps: number;
  maxSteps: number;
  exact: boolean;
  allowDiagonal: boolean;
  canEndOnTrail: boolean;
  canIgnoreTrails: boolean;
  canPassThroughOneTrail: boolean;
}

export interface StepOption extends Coord {
  terminal: boolean;
  capture: boolean;
}

export interface TilePlayRequest {
  mode: "single" | "lair";
  tile: RuneTileType;
  wyrmId?: WyrmId;
  opponentId?: PlayerId;
  targetCoords?: Coord[];
  swapWyrmIds?: [WyrmId, WyrmId];
  teleportWyrmId?: WyrmId;
}
