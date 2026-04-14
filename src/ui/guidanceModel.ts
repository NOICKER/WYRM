import type { GameState } from "../state/types.ts";
import {
  getCurrentPlayer,
  getWyrmsWithLegalMoves,
  hasAnyLegalMove,
  canResolveBlockedMove,
} from "../state/gameLogic.ts";
import {
  getMatchPhase,
  hasHoardDeployOpportunity,
} from "./matchInteractionModel.ts";
import type { TileDraft } from "./matchInteractionState.ts";

export type ReasonCode =
  | "ACTION_BLOCKED"
  | "DISCARD_REQUIRED"
  | "INVALID_TARGET"
  | "MOVE_NOT_COMPLETED"
  | "TILE_ALREADY_PLAYED"
  | "TILE_REQUIRES_SELECTION"
  | "TILE_REQUIRES_TARGET"
  | "WRONG_PHASE";

export type GuidanceType =
  | "DRAW_REQUIRED"
  | "DISCARD_REQUIRED"
  | "ROLL_REQUIRED"
  | "MOVE_REQUIRED"
  | "SELECTION_REQUIRED"
  | "TARGET_REQUIRED"
  | "TILE_REQUIRED"
  | "ACTION_REQUIRED"
  | "DEAD_END"
  | "GAME_OVER";

export interface PlayerGuidance {
  type: GuidanceType;
  message: string;
  subMessage?: string;
  highlightHint: "board" | "hand" | "wyrms" | "cells" | "controls" | null;
  priority: number;
}

export function isPlayerStuck(state: GameState): boolean {
  const phase = getMatchPhase(state);
  if (phase !== "move") return false;

  const player = getCurrentPlayer(state);

  // If main move is already done, they aren't "stuck" in the move phase sense
  if (state.turnEffects.mainMoveCompleted) return false;

  // Check if any wyrm can move normally
  const canMoveNormally = getWyrmsWithLegalMoves(state, player.id, "main").length > 0;
  if (canMoveNormally) return false;

  // Check if they can deploy from hoard
  const canDeploy = hasHoardDeployOpportunity(state, player.hoard.length);
  if (canDeploy) return false;

  // Check if they are boxed in but can place a trail (Coil or blocked rule)
  const canResolveBlocked = canResolveBlockedMove(state);
  if (canResolveBlocked) return false;

  // Check if they have Tempest Rush moves that could be used?
  // (Usually tempest is after main, but let's be safe)
  const hasTempest = state.turnEffects.tempestRushRemaining.some(id => hasAnyLegalMove(state, id, "tempest"));
  if (hasTempest) return false;

  // If none of the above, they are well and truly stuck
  return true;
}

export function getCurrentPlayerGuidance(
  state: GameState,
  {
    tileDraft,
    hasSelectedMove,
    isMoving,
    isTileDraftReady,
  }: {
    tileDraft: TileDraft | null;
    hasSelectedMove: boolean;
    isMoving: boolean;
    isTileDraftReady: boolean;
  }
): PlayerGuidance {
  const phase = getMatchPhase(state);
  const player = getCurrentPlayer(state);

  if (phase === "end") {
    return {
      type: "GAME_OVER",
      message: "The game has ended.",
      highlightHint: null,
      priority: 0,
    };
  }

  if (phase === "draw") {
    return {
      type: "DRAW_REQUIRED",
      message: "Draw a Rune Tile",
      subMessage: "Add 1 ability card to your hand.",
      highlightHint: "controls",
      priority: 10,
    };
  }

  if (phase === "discard") {
    return {
      type: "DISCARD_REQUIRED",
      message: `Discard ${state.mustDiscard} Rune Tiles`,
      subMessage: "Select tiles from your hand to discard.",
      highlightHint: "hand",
      priority: 10,
    };
  }

  if (phase === "roll") {
    return {
      type: "ROLL_REQUIRED",
      message: "Roll the Dice",
      subMessage: "Determine your movement for this turn.",
      highlightHint: "controls",
      priority: 10,
    };
  }

  if (phase === "move") {
    if (isMoving) {
      return {
        type: "TARGET_REQUIRED",
        message: "Complete your Move",
        subMessage: "Click adjacent cells to build your path.",
        highlightHint: "cells",
        priority: 100,
      };
    }

    if (hasSelectedMove) {
      return {
        type: "TARGET_REQUIRED",
        message: "Plot your Path",
        subMessage: "Start with an adjacent step.",
        highlightHint: "cells",
        priority: 90,
      };
    }

    if (isPlayerStuck(state)) {
      return {
        type: "DEAD_END",
        message: "No Legal Moves Possible",
        subMessage: "Click 'Skip' to proceed to the Tile step.",
        highlightHint: "controls",
        priority: 150,
      };
    }

    const movableWyrmIds = getWyrmsWithLegalMoves(state, player.id, "main");
    if (movableWyrmIds.length > 0 || hasHoardDeployOpportunity(state, player.hoard.length) || canResolveBlockedMove(state)) {
      return {
        type: "SELECTION_REQUIRED",
        message: "Select a Wyrm to Move",
        subMessage: "Highlight a Wyrm in your hand or on the board.",
        highlightHint: "wyrms",
        priority: 80,
      };
    }

    // If main move done but tempest remaining
    if (state.turnEffects.mainMoveCompleted && state.turnEffects.tempestRushRemaining.length > 0) {
      return {
        type: "SELECTION_REQUIRED",
        message: "Select a Tempest Wyrm",
        subMessage: "Use your remaining Rush moves or end turn.",
        highlightHint: "wyrms",
        priority: 70,
      };
    }

    return {
      type: "ACTION_REQUIRED",
      message: "Movement Step Complete",
      subMessage: "Click 'Finish' to proceed.",
      highlightHint: "controls",
      priority: 10,
    };
  }

  if (phase === "tile") {
    if (tileDraft) {
      return {
        type: "TARGET_REQUIRED",
        message: isTileDraftReady ? "Effect Implementation Ready" : "Choose a Target",
        subMessage: isTileDraftReady ? "Confirm to play the tile or cancel preview." : "Click a board cell or Wyrm as required.",
        highlightHint: isTileDraftReady ? "controls" : "cells",
        priority: 100,
      };
    }

    return {
      type: "TILE_REQUIRED",
      message: "Play a Rune Tile or Skip",
      subMessage: "Select a tile from your hand to preview its effect.",
      highlightHint: "hand",
      priority: 50,
    };
  }

  return {
    type: "ACTION_REQUIRED",
    message: "Awaiting next interaction...",
    highlightHint: null,
    priority: 0,
  };
}
