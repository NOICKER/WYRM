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
import type { InteractionState, TileDraft } from "./matchInteractionState.ts";

export type { InteractionState, TileDraft } from "./matchInteractionState.ts";

export type Phase = "draw" | "discard" | "roll" | "move" | "tile" | "end";
export type HandCardInteractionMode = "discard" | "play" | "disabled";

export interface MatchInstructionInput {
  state: GameState;
  tileDraft: TileDraft | null;
  deployWyrmId: WyrmId | null;
  trailWyrmId: WyrmId | null;
  hasSelectedMove: boolean;
  canConfirmMove: boolean;
  hoardChoicesCount: number;
  interactionState?: InteractionState;
  stepsRemaining?: number;
  tileDraftReady?: boolean;
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
  isInteractionLocked?: boolean;
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
  isInteractionLocked = false,
}: HandCardInteractionInput): HandCardInteractionMode {
  if (isPaused || phase === "end" || isInteractionLocked) {
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
  interactionState,
  stepsRemaining = 0,
  tileDraftReady = false,
}: MatchInstructionInput): string | null {
  const phase = getMatchPhase(state);
  const deployAvailable = hasHoardDeployOpportunity(state, hoardChoicesCount);

  if (tileDraft) {
    switch (tileDraft.tile) {
      case "fire":
        return tileDraftReady
          ? "Previewing every one of your trails. Confirm to burn them away, or cancel."
          : "Previewing every one of your trails.";
      case "water":
        return tileDraftReady
          ? "Preview ready. Confirm Flow to grant that Wyrm one trail pass this turn."
          : "Select one of your active Wyrms for Flow.";
      case "wind":
        return tileDraftReady
          ? "Preview ready. Confirm Gust to give that Wyrm +2 movement."
          : "Select one of your active Wyrms for Gust.";
      case "earth":
        return `${tileDraftReady ? "Preview ready. Confirm after checking the wall placement. " : ""}Choose ${tileDraft.mode === "lair" ? "three" : "one"} empty cell${
          tileDraft.mode === "lair" ? "s" : ""
        } to place Stone.`;
      case "shadow":
        return tileDraft.mode === "single"
          ? tileDraftReady
            ? "Preview ready. Confirm to swap the two highlighted Wyrms."
            : "Choose two of your Wyrms to swap positions."
          : tileDraft.wyrmId
            ? tileDraftReady
              ? "Preview ready. Confirm to teleport the selected Wyrm."
              : "Choose any empty cell to teleport this Wyrm."
            : "Choose a Wyrm on the board or in your hoard to teleport.";
      case "light":
        return tileDraftReady
          ? "Preview ready. Confirm to target the highlighted opponent."
          : "Choose which opponent should reveal their hand or be blinded.";
      case "void":
        return tileDraft.mode === "single"
          ? tileDraft.opponentId
            ? tileDraftReady
              ? "Preview ready. Confirm to erase the highlighted enemy trails."
              : "Select up to 3 trail markers from that opponent."
            : "Choose which opponent's trails you want to erase."
          : tileDraftReady
            ? "Preview ready. Confirm to erase every trail of that color."
            : "Choose one player color to erase completely.";
      case "serpent":
        return tileDraft.mode === "single"
          ? tileDraftReady
            ? "Preview ready. Confirm to extend that Wyrm's trail duration."
            : "Choose the Wyrm whose trail should last longer."
          : tileDraftReady
            ? "Preview ready. Confirm to promote the highlighted Wyrm instantly."
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
    if (interactionState === "moving") {
      return stepsRemaining > 0
        ? `Build the path one step at a time. ${stepsRemaining} step${stepsRemaining === 1 ? "" : "s"} remaining.`
        : canConfirmMove
          ? "Path is ready. Finish the move when you're ready."
          : "Path is ready.";
    }
    return "Selected Wyrm is highlighted. Start plotting the path with an adjacent step.";
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
    case "fire":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Preview your own trails, then confirm to burn them away.",
      };
    case "water":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Select one Wyrm, preview the lane it opens, then confirm.",
      };
    case "wind":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Select one Wyrm, preview the burst, then confirm.",
      };
    case "earth":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Pick 3 empty cells, preview the wall line, then confirm."
            : "Pick 1 empty cell, preview the wall, then confirm.",
      };
    case "shadow":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Choose one Wyrm and a destination, preview the teleport, then confirm."
            : "Choose 2 of your Wyrms, preview the swap, then confirm.",
      };
    case "light":
      return {
        title: getTileName(tileDraft.tile),
        detail: "Choose one opponent, preview the target, then confirm.",
      };
    case "void":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Choose one player color, preview every affected trail, then confirm."
            : "Pick one opponent, preview up to 3 of their trail markers, then confirm.",
      };
    case "serpent":
      return {
        title: getTileName(tileDraft.tile),
        detail:
          tileDraft.mode === "lair"
            ? "Choose one non-Elder Wyrm, preview the promotion, then confirm."
            : "Choose one Wyrm, preview its longer trail window, then confirm.",
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
