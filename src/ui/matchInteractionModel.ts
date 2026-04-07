import {
  PLAYER_NAMES,
  canResolveBlockedMove,
  getCurrentPlayer,
  getDeployTargets,
} from "../state/gameLogic.ts";
import type {
  GameState,
  PlayerId,
  WyrmId,
} from "../state/types.ts";

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

  if (phase === "tile" && canPlayTiles) {
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
      return { visible: true, label: "Confirm Move", disabled: !canConfirmMove };
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
  tileDraft,
  deployWyrmId,
  trailWyrmId,
  hasSelectedMove,
  canConfirmMove,
  hoardChoicesCount,
}: MatchInstructionInput): string {
  const phase = getMatchPhase(state);

  if (tileDraft) {
    switch (tileDraft.tile) {
      case "water":
        return "Choose one of your active wyrms to pass through a single trail this turn.";
      case "wind":
        return "Choose one of your active wyrms to gain +2 movement.";
      case "earth":
        return `Choose ${
          tileDraft.mode === "lair" ? "three" : "one"
        } empty cell${tileDraft.mode === "lair" ? "s" : ""} for Stone.`;
      case "shadow":
        if (tileDraft.mode === "single") {
          return "Choose two of your on-board wyrms to swap with Eclipse.";
        }
        return tileDraft.wyrmId
          ? "Choose an empty cell for Void Walk."
          : "Choose a controlled wyrm on the board or from the hoard for Void Walk.";
      case "light":
        return "Choose an opponent to reveal or blind.";
      case "void":
        return tileDraft.mode === "single"
          ? tileDraft.opponentId
            ? "Pick up to three trail markers from that opponent, then confirm."
            : "Choose which opponent's trails you want to erase."
          : "Choose one player color to erase completely.";
      case "serpent":
        return tileDraft.mode === "single"
          ? "Choose the wyrm whose trail should last five rounds."
          : "Choose a non-Elder wyrm to promote instantly.";
    }
  }

  if (deployWyrmId) {
    return "Click an open Den cell to redeploy the selected hoarded wyrm.";
  }

  if (trailWyrmId) {
    return "Choose an adjacent empty cell to place a trail marker instead of moving.";
  }

  if (hasSelectedMove) {
    return canConfirmMove
      ? "This path is valid. Confirm it now or extend it if the move allows more spaces."
      : "Build the path step by step. Click the previous path cell if you need to back up.";
  }

  if (phase === "discard") {
    return `Select exactly ${state.mustDiscard} tile${
      state.mustDiscard === 1 ? "" : "s"
    } to discard back down to five.`;
  }

  if (phase === "draw") {
    return "Draw from the Rune deck. Power Rune bonuses are applied automatically here.";
  }

  if (phase === "roll") {
    return "Roll the Rune Die to set this turn's movement.";
  }

  if (phase === "move") {
    const deployAvailable = hasHoardDeployOpportunity(state, hoardChoicesCount);

    if (state.dieResult === "coil" && !state.turnEffects.coilChoice) {
      return deployAvailable
        ? "Choose a Coil option first, or redeploy a hoarded wyrm into your Den instead of moving."
        : "Choose a Coil option first: move 1, 2, 3, or place an extra trail.";
    }

    if (deployAvailable) {
      return "You can redeploy a hoarded wyrm into an open Den cell instead of moving, or select a wyrm on the board to move.";
    }

    if (hasBlockedMoveOpportunity(state)) {
      return "No wyrm can make a legal move. Select the boxed-in wyrm and place one adjacent trail instead.";
    }

    if (
      state.turnEffects.tempestRushRemaining.length > 0
      && !state.turnEffects.mainMoveCompleted
    ) {
      return "Choose a wyrm to start the main move, or switch to Tempest Rush first.";
    }

    if (state.turnEffects.tempestRushRemaining.length > 0) {
      return "Your main move is done. Spend remaining Tempest Rush moves or end the turn.";
    }

    return "Select a wyrm on the board to start plotting its move path.";
  }

  if (phase === "tile") {
    return "Choose a rune tile from your hand, or skip the tile step.";
  }

  if (phase === "end" && state.winner) {
    return `${PLAYER_NAMES[state.winner]} wins by ${
      state.winType === "grove" ? "claiming the Sacred Grove" : "domination"
    }.`;
  }

  return "WYRM is ready.";
}
