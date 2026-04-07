import {
  PLAYER_NAMES,
  getAdjacentEmptyCells,
  getControlledActiveWyrms,
  canResolveBlockedMove,
  getCurrentPlayer,
  getDeployTargets,
  SACRED_GROVE_CELLS,
} from "../state/gameLogic.ts";
import type {
  DieResult,
  GameState,
  PlayerId,
  WyrmId,
} from "../state/types.ts";
import { getTileName } from "./appModel.ts";

export type Phase = "draw" | "discard" | "roll" | "move" | "tile" | "end";
export type HandCardInteractionMode = "discard" | "play" | "disabled";

export type TileDraft =
  | { tile: "water"; mode: "single" }
  | { tile: "wind"; mode: "single" }
  | { tile: "serpent"; mode: "single" }
  | { tile: "earth"; mode: "single" | "lair"; cells: { row: number; col: number }[] }
  | { tile: "shadow"; mode: "single"; wyrmIds: WyrmId[] }
  | { tile: "shadow"; mode: "lair"; wyrmId: WyrmId | null }
  | { tile: "light"; mode: "single" | "lair" }
  | { tile: "void"; mode: "single"; opponentId: PlayerId | null; cells: { row: number; col: number }[] }
  | { tile: "void"; mode: "lair"; opponentId: PlayerId | null }
  | { tile: "serpent"; mode: "lair" };

export interface MatchInstructionInput {
  state: GameState;
  tileDraft: TileDraft | null;
  deployWyrmId: WyrmId | null;
  trailWyrmId: WyrmId | null;
  hasSelectedMove: boolean;
  canConfirmMove: boolean;
  hoardChoicesCount: number;
}

export interface DeployOverlayVisibilityInput {
  state: GameState;
  isPaused: boolean;
  hasTileDraft: boolean;
  deployWyrmId: WyrmId | null;
  hoardChoicesCount: number;
}

export interface HandCardInteractionInput {
  phase: Phase;
  isPaused: boolean;
  canPlayTiles: boolean;
}

export interface PrimaryActionConfigInput {
  phase: Phase;
  canConfirmDiscard: boolean;
  canConfirmMove: boolean;
  canSkipTile: boolean;
  tileActionUsed: boolean;
  hasTileSelection: boolean;
  isPaused: boolean;
}

export interface PrimaryActionConfig {
  visible: boolean;
  label: string;
  disabled: boolean;
}

export interface VictoryOverlayCopy {
  title: string;
  detail: string;
}

export interface RollFeedbackCopy {
  valueLabel: string;
  requirement: string;
  emphasis: "exact" | "choice" | "trail";
}

export interface TileSelectionPreview {
  title: string;
  detail: string;
}

function distanceToNearestGrove(coord: { row: number; col: number }): number {
  return Math.min(
    ...SACRED_GROVE_CELLS.map((cell) =>
      Math.max(Math.abs(cell.row - coord.row), Math.abs(cell.col - coord.col)),
    ),
  );
}

function formatSpaces(count: number): string {
  return `${count} space${count === 1 ? "" : "s"}`;
}

function getRollName(result: DieResult): string {
  switch (result) {
    case 1:
      return "Step";
    case 2:
      return "Stride";
    case 3:
      return "Glide";
    case 4:
      return "Rush";
    case "coil":
      return "Coil";
    case "surge":
      return "Surge";
  }
}

function getMoveRequirementInstruction(
  state: Pick<GameState, "dieResult" | "turnEffects">,
): string {
  if (state.dieResult == null) {
    return "Move a Wyrm";
  }

  if (state.dieResult === "coil") {
    if (state.turnEffects.coilChoice == null) {
      return "Choose your Coil move";
    }

    if (state.turnEffects.coilChoice === "extra_trail") {
      return "Place an extra trail";
    }

    return `Move a Wyrm exactly ${formatSpaces(state.turnEffects.coilChoice)}`;
  }

  const spaces = state.dieResult === "surge" ? 5 : state.dieResult;
  return `Move a Wyrm exactly ${formatSpaces(spaces)}`;
}

export function getMatchPhase(state: Pick<GameState, "phase">): Phase {
  switch (state.phase) {
    case "play_tile":
      return "tile";
    case "game_over":
      return "end";
    default:
      return state.phase;
  }
}

export function getVictoryOverlayCopy(
  state: Pick<GameState, "winner" | "winType">,
  playerNames: Record<PlayerId, string>,
): VictoryOverlayCopy | null {
  if (state.winner == null || state.winType == null) {
    return null;
  }

  const winnerName = playerNames[state.winner] ?? PLAYER_NAMES[state.winner];
  return {
    title: `🏆 ${winnerName} Wins!`,
    detail:
      state.winType === "grove"
        ? "Sacred Grove Victory (2 Wyrms reached the center)"
        : "Domination Victory (Captured all 3 enemy Wyrms)",
  };
}

export function hasHoardDeployOpportunity(
  state: GameState,
  hoardChoicesCount: number,
): boolean {
  const currentPlayer = getCurrentPlayer(state);
  return (
    getMatchPhase(state) === "move"
    && !state.turnEffects.mainMoveCompleted
    && hoardChoicesCount > 0
    && getDeployTargets(state, currentPlayer.id).length > 0
  );
}

export function hasBlockedMoveOpportunity(state: GameState): boolean {
  return (
    getMatchPhase(state) === "move"
    && !state.turnEffects.mainMoveCompleted
    && !(state.dieResult === "coil" && state.turnEffects.coilChoice == null)
    && canResolveBlockedMove(state)
  );
}

export function getHandCardInteractionMode({
  phase,
  isPaused,
  canPlayTiles,
}: HandCardInteractionInput): HandCardInteractionMode {
  if (isPaused || phase === "end") {
    return "disabled";
  }

  if (phase === "discard") {
    return "discard";
  }

  if ((phase === "tile" || phase === "move") && canPlayTiles) {
    return "play";
  }

  return "disabled";
}

export function getPrimaryActionConfig({
  phase,
  canConfirmDiscard,
  canConfirmMove,
  canSkipTile,
  tileActionUsed,
  hasTileSelection,
  isPaused,
}: PrimaryActionConfigInput): PrimaryActionConfig {
  if (isPaused || phase === "end") {
    return { visible: false, label: "", disabled: true };
  }

  switch (phase) {
    case "draw":
      return { visible: true, label: "Draw Rune Tile", disabled: false };
    case "discard":
      return { visible: true, label: "Confirm Discard", disabled: !canConfirmDiscard };
    case "roll":
      return { visible: true, label: "Roll Dice", disabled: false };
    case "move":
      return { visible: canConfirmMove, label: "Confirm Move", disabled: !canConfirmMove };
    case "tile":
      if (tileActionUsed) {
        return { visible: true, label: "End Turn", disabled: !canSkipTile };
      }

      if (hasTileSelection) {
        return { visible: true, label: "Play Tile", disabled: true };
      }

      return {
        visible: true,
        label: "Skip",
        disabled: !canSkipTile,
      };
  }
}

export function shouldShowDeployOverlay({
  state,
  isPaused,
  hasTileDraft,
  deployWyrmId,
  hoardChoicesCount,
}: DeployOverlayVisibilityInput): boolean {
  return (
    !isPaused
    && !hasTileDraft
    && deployWyrmId != null
    && hasHoardDeployOpportunity(state, hoardChoicesCount)
  );
}

export function getMatchInstruction({
  state,
  deployWyrmId,
  trailWyrmId,
}: MatchInstructionInput): string {
  const phase = getMatchPhase(state);

  if (deployWyrmId) {
    return "Place the hoarded Wyrm in your Den";
  }

  if (trailWyrmId) {
    return "Place an extra trail";
  }

  if (phase === "discard") {
    return `Discard ${state.mustDiscard} Rune Tile${state.mustDiscard === 1 ? "" : "s"}`;
  }

  if (phase === "draw") {
    return "Draw a Rune Tile";
  }

  if (phase === "roll") {
    return "Roll the dice";
  }

  if (phase === "move") {
    return getMoveRequirementInstruction(state);
  }

  if (phase === "tile") {
    return "Play a Rune Tile or Skip";
  }

  if (phase === "end" && state.winner) {
    return `${PLAYER_NAMES[state.winner]} wins by ${
      state.winType === "grove" ? "claiming the Sacred Grove" : "domination"
    }.`;
  }

  return "WYRM is ready.";
}

export function getMatchInstructionMeta({
  state,
  tileDraft,
  deployWyrmId,
  trailWyrmId,
  hasSelectedMove,
  canConfirmMove,
  hoardChoicesCount,
}: MatchInstructionInput): string | null {
  const phase = getMatchPhase(state);
  const deployAvailable = hasHoardDeployOpportunity(state, hoardChoicesCount);

  if (tileDraft) {
    switch (tileDraft.tile) {
      case "water":
        return "Select one of your active Wyrms. It can pass through a single trail this turn.";
      case "wind":
        return "Select one of your active Wyrms. It gets +2 movement this turn.";
      case "earth":
        return `Choose ${tileDraft.mode === "lair" ? "three" : "one"} empty cell${
          tileDraft.mode === "lair" ? "s" : ""
        } to place Stone.`;
      case "shadow":
        return tileDraft.mode === "single"
          ? "Choose two of your Wyrms to swap positions."
          : tileDraft.wyrmId
            ? "Choose any empty cell to teleport this Wyrm."
            : "Choose a Wyrm on the board or in your hoard to teleport.";
      case "light":
        return "Choose which opponent should reveal their hand or be blinded.";
      case "void":
        return tileDraft.mode === "single"
          ? tileDraft.opponentId
            ? "Select up to 3 trail markers from that opponent."
            : "Choose which opponent's trails you want to erase."
          : "Choose one player color to erase completely.";
      case "serpent":
        return tileDraft.mode === "single"
          ? "Choose the Wyrm whose trail should last longer."
          : "Choose a non-Elder Wyrm to promote instantly.";
      default:
        return null;
    }
  }

  if (deployWyrmId) {
    return "Click an open Den cell to redeploy the selected hoarded Wyrm.";
  }

  if (trailWyrmId) {
    return "Choose an adjacent empty cell to place the trail marker.";
  }

  if (hasSelectedMove) {
    return canConfirmMove
      ? "Selected Wyrm is highlighted. Confirm this path when you're ready."
      : "Selected Wyrm is highlighted. Legal destinations glow on the board.";
  }

  if (phase === "discard") {
    return "Discard down to five tiles before you can roll.";
  }

  if (phase === "draw") {
    return "Adds 1 ability card to your hand. Power Rune bonuses apply automatically.";
  }

  if (phase === "move") {
    if (state.dieResult === "coil" && state.turnEffects.coilChoice == null) {
      return deployAvailable
        ? "Choose 1, 2, or 3 spaces, or place an extra trail. You can also redeploy from the hoard."
        : "Choose 1, 2, or 3 spaces, or place an extra trail.";
    }

    if (deployAvailable) {
      return "An open Den can redeploy one hoarded Wyrm instead of making a normal move.";
    }

    if (hasBlockedMoveOpportunity(state)) {
      return "No legal move exists. Select the boxed-in Wyrm to place one adjacent trail instead.";
    }

    if (
      state.turnEffects.tempestRushRemaining.length > 0
      && !state.turnEffects.mainMoveCompleted
    ) {
      return "Main and Tempest moves are available. Pick the Wyrm you want to move next.";
    }

    if (state.turnEffects.tempestRushRemaining.length > 0) {
      return "Your main move is complete. Spend the remaining Tempest Rush moves or end the turn.";
    }
  }

  if (phase === "tile") {
    return "Select a Rune Tile to preview its effect, then play it or skip the step.";
  }

  return null;
}

export function getRollFeedbackCopy(
  state: Pick<GameState, "dieResult" | "turnEffects">,
): RollFeedbackCopy | null {
  if (state.dieResult == null) {
    return null;
  }

  if (state.dieResult === "coil") {
    if (state.turnEffects.coilChoice == null) {
      return {
        valueLabel: "∞ - Coil",
        requirement: "Choose 1, 2, or 3 spaces, or place an extra trail",
        emphasis: "choice",
      };
    }

    if (state.turnEffects.coilChoice === "extra_trail") {
      return {
        valueLabel: "∞ - Coil",
        requirement: "Place an extra trail instead of moving",
        emphasis: "trail",
      };
    }

    return {
      valueLabel: `∞ - Coil (${state.turnEffects.coilChoice})`,
      requirement: `Move exactly ${formatSpaces(state.turnEffects.coilChoice)}`,
      emphasis: "exact",
    };
  }

  const spaces = state.dieResult === "surge" ? 5 : state.dieResult;
  const value = state.dieResult === "surge" ? "5" : String(state.dieResult);
  return {
    valueLabel: `${value} - ${getRollName(state.dieResult)}`,
    requirement: `Move exactly ${formatSpaces(spaces)}`,
    emphasis: "exact",
  };
}

export function getTileSelectionPreview(tileDraft: TileDraft | null): TileSelectionPreview | null {
  if (!tileDraft) {
    return null;
  }

  switch (tileDraft.tile) {
    case "water":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Select one Wyrm. It may pass through one trail this turn.",
      };
    case "wind":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Select one Wyrm. It gains +2 movement this turn.",
      };
    case "earth":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Pick 3 empty cells to place permanent wall tiles."
            : "Pick 1 empty cell to place a permanent wall tile.",
      };
    case "shadow":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Teleport one Wyrm to any empty cell."
            : "Choose 2 of your Wyrms and swap their positions.",
      };
    case "light":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Choose one opponent to reveal or disrupt.",
      };
    case "void":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Choose one player color and erase every trail of that color."
            : "Pick one opponent, then remove up to 3 of their trail markers.",
      };
    case "serpent":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Promote one non-Elder Wyrm instantly."
            : "Choose one Wyrm to extend its trail and boost its next turn.",
      };
  }
}

export function getTileSelectionSuggestion(
  state: GameState,
  tileDraft: TileDraft | null,
): string | null {
  if (!tileDraft) {
    return null;
  }

  const currentPlayer = getCurrentPlayer(state);
  const activeWyrms = getControlledActiveWyrms(state, currentPlayer.id);
  const hasTightLane = activeWyrms.some((wyrm) => getAdjacentEmptyCells(state, wyrm.id, false).length <= 1);
  const adjacentTrailPressure = activeWyrms.some((wyrm) => {
    if (!wyrm.position) {
      return false;
    }
    const neighbors = [
      { row: wyrm.position.row - 1, col: wyrm.position.col },
      { row: wyrm.position.row + 1, col: wyrm.position.col },
      { row: wyrm.position.row, col: wyrm.position.col - 1 },
      { row: wyrm.position.row, col: wyrm.position.col + 1 },
    ];
    return neighbors.some((coord) => {
      const cell = state.board[coord.row]?.[coord.col];
      return Boolean(cell?.trail);
    });
  });
  const ownTrailCount = state.board.flat().filter((cell) => cell.trail?.owner === currentPlayer.id).length;
  const groveNearby = activeWyrms.some((wyrm) =>
    wyrm.position ? distanceToNearestGrove(wyrm.position) <= 2 : false,
  );

  switch (tileDraft.tile) {
    case "water":
      if (hasTightLane || ownTrailCount >= 4 || adjacentTrailPressure) {
        return "Good for escaping trails";
      }
      return "Helpful when one blocked lane is stopping your route";
    case "wind":
      if (groveNearby) {
        return "Strong for a burst toward the Sacred Grove";
      }
      return "Great when one extra push unlocks a capture or center line";
    case "shadow":
      if (hasTightLane) {
        return "Useful when trapped";
      }
      return "Strong for rescuing a stranded Wyrm";
    case "earth":
      return "Best for sealing off a lane before it collapses on you";
    case "light":
      return "Useful when you need quick information before committing";
    case "void":
      return "Best when enemy trails are choking the center lanes";
    case "serpent":
      return "Strong on the Wyrm you expect to keep pressuring next turn";
    default:
      return null;
  }
}
