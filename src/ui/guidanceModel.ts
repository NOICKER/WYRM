import { getTileName } from "./appModel.ts";
import type { Phase } from "./matchInteractionModel.ts";
import type { InteractionState, TileDraft } from "./matchInteractionState.ts";
import type { Coord, PlayerId, RuneTileType, StepOption, WyrmId } from "../state/types.ts";

export type HighlightHint = "board" | "hand" | "wyrms" | "cells" | "controls" | null;

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
  | "CHOICE_REQUIRED"
  | "GAME_OVER";

export type GuidanceControlId =
  | "primary_action"
  | "confirm_tile"
  | "cancel_interaction"
  | "coil_1"
  | "coil_2"
  | "coil_3"
  | "coil_extra_trail";

export type GuidanceTargetRef =
  | { kind: "cell"; coord: Coord }
  | { kind: "board_wyrm"; wyrmId: WyrmId }
  | { kind: "hand_tile"; tile: RuneTileType }
  | { kind: "discard_index"; index: number }
  | { kind: "hoard_wyrm"; wyrmId: WyrmId }
  | { kind: "player_choice"; playerId: PlayerId }
  | { kind: "control"; control: GuidanceControlId };

export type GuidanceTarget = GuidanceTargetRef & {
  key: string;
  region: HighlightHint;
};

export interface PlayerGuidance {
  type: GuidanceType;
  message: string;
  subMessage?: string;
  highlightHint: HighlightHint;
  priority: number;
  validTargets: GuidanceTarget[];
  suggestedTargetKey: string | null;
  idlePulseHint: HighlightHint;
  signature: string;
}

export interface ActionableGuidanceInput {
  phase: Phase;
  tileDraft: TileDraft | null;
  interactionState: InteractionState;
  selectedWyrmId: WyrmId | null;
  selectedWyrmLabel?: string | null;
  deployWyrmId: WyrmId | null;
  deployWyrmLabel?: string | null;
  trailWyrmId: WyrmId | null;
  trailWyrmLabel?: string | null;
  moveTargets: StepOption[];
  actionTargets: Coord[];
  movableWyrmIds: WyrmId[];
  blockedTrailWyrmIds: WyrmId[];
  discardSelection: number[];
  discardableIndices: number[];
  playableTileTypes: RuneTileType[];
  hoardSelectableWyrmIds: WyrmId[];
  opponentChoiceIds: PlayerId[];
  canConfirmMove: boolean;
  canConfirmDiscard: boolean;
  canConfirmTileDraft: boolean;
  canEndTurn: boolean;
  canPlayTiles: boolean;
  showCoilChoice: boolean;
  showTargetSelection: boolean;
  showSpecialWyrmChoice: boolean;
  stepsRemaining: number;
  mustDiscard: number;
  isAutoCoilState: boolean;
}

function getTargetRegion(target: GuidanceTargetRef): HighlightHint {
  switch (target.kind) {
    case "cell":
      return "cells";
    case "board_wyrm":
      return "wyrms";
    case "hand_tile":
    case "discard_index":
      return "hand";
    case "control":
    case "player_choice":
    case "hoard_wyrm":
      return "controls";
    default:
      return null;
  }
}

export function getGuidanceTargetKey(target: GuidanceTargetRef): string {
  switch (target.kind) {
    case "cell":
      return `cell:${target.coord.row},${target.coord.col}`;
    case "board_wyrm":
      return `board_wyrm:${target.wyrmId}`;
    case "hand_tile":
      return `hand_tile:${target.tile}`;
    case "discard_index":
      return `discard_index:${target.index}`;
    case "hoard_wyrm":
      return `hoard_wyrm:${target.wyrmId}`;
    case "player_choice":
      return `player_choice:${target.playerId}`;
    case "control":
      return `control:${target.control}`;
    default:
      return "target:unknown";
  }
}

function buildTarget(target: GuidanceTargetRef): GuidanceTarget {
  return {
    ...target,
    key: getGuidanceTargetKey(target),
    region: getTargetRegion(target),
  };
}

function buildGuidance({
  type,
  message,
  subMessage,
  highlightHint,
  priority,
  validTargets,
  suggestedTarget,
  idlePulseHint = highlightHint,
}: {
  type: GuidanceType;
  message: string;
  subMessage?: string;
  highlightHint: HighlightHint;
  priority: number;
  validTargets: GuidanceTargetRef[];
  suggestedTarget?: GuidanceTargetRef | null;
  idlePulseHint?: HighlightHint;
}): PlayerGuidance {
  const builtTargets = validTargets.map((target) => buildTarget(target));
  const suggestedTargetKey = suggestedTarget ? getGuidanceTargetKey(suggestedTarget) : null;
  return {
    type,
    message,
    subMessage,
    highlightHint,
    priority,
    validTargets: builtTargets,
    suggestedTargetKey,
    idlePulseHint,
    signature: [
      type,
      message,
      subMessage ?? "",
      highlightHint ?? "none",
      builtTargets.map((target) => target.key).join("|"),
      suggestedTargetKey ?? "none",
    ].join("::"),
  };
}

function cellTarget(coord: Coord): GuidanceTargetRef {
  return { kind: "cell", coord };
}

function boardWyrmTarget(wyrmId: WyrmId): GuidanceTargetRef {
  return { kind: "board_wyrm", wyrmId };
}

function handTileTarget(tile: RuneTileType): GuidanceTargetRef {
  return { kind: "hand_tile", tile };
}

function discardIndexTarget(index: number): GuidanceTargetRef {
  return { kind: "discard_index", index };
}

function hoardWyrmTarget(wyrmId: WyrmId): GuidanceTargetRef {
  return { kind: "hoard_wyrm", wyrmId };
}

function playerChoiceTarget(playerId: PlayerId): GuidanceTargetRef {
  return { kind: "player_choice", playerId };
}

function controlTarget(control: GuidanceControlId): GuidanceTargetRef {
  return { kind: "control", control };
}

function getTileBoardActionCopy(tileDraft: TileDraft, stepsRemaining: number): { message: string; subMessage?: string } {
  const tileName = getTileName(tileDraft.tile);

  switch (tileDraft.tile) {
    case "water":
    case "wind":
      return {
        message: `Click one highlighted Wyrm on the board to target ${tileName}.`,
        subMessage: "Only the highlighted Wyrms are valid for this effect.",
      };
    case "serpent":
      return tileDraft.mode === "lair"
        ? {
            message: `Click one highlighted non-Elder Wyrm on the board to target ${tileName}.`,
            subMessage: "Only the highlighted Wyrms can be promoted right now.",
          }
        : {
            message: `Click one highlighted Wyrm on the board to target ${tileName}.`,
            subMessage: "Only the highlighted Wyrms can extend their trail duration.",
          };
    case "earth": {
      const remaining = Math.max(0, (tileDraft.mode === "lair" ? 3 : 1) - tileDraft.cells.length);
      return {
        message: `Click ${remaining} highlighted empty cell${remaining === 1 ? "" : "s"} on the board to place ${tileName}.`,
        subMessage: "Only the highlighted empty cells can receive a wall.",
      };
    }
    case "shadow":
      if (tileDraft.mode === "single") {
        const remaining = Math.max(0, 2 - tileDraft.wyrmIds.length);
        return {
          message: `Click ${remaining} highlighted Wyrm${remaining === 1 ? "" : "s"} on the board to finish the ${tileName} swap.`,
          subMessage: "Only the highlighted Wyrms can be selected for this swap.",
        };
      }
      if (tileDraft.wyrmId) {
        return {
          message: `Click one highlighted empty cell on the board to place the ${tileName} destination.`,
          subMessage: "Only the highlighted empty cells are valid teleport destinations.",
        };
      }
      return {
        message: `Choose one Wyrm for ${tileName}.`,
        subMessage: "Use the highlighted Wyrm choice to continue the teleport.",
      };
    case "void":
      return {
        message: `Click highlighted enemy trail markers on the board to target ${tileName}.`,
        subMessage: `You can keep selecting until the preview looks right. ${stepsRemaining > 0 ? "" : ""}`.trim(),
      };
    default:
      return {
        message: `Click a highlighted target on the board to continue ${tileName}.`,
        subMessage: "Only the highlighted board targets are valid right now.",
      };
  }
}

function getSuggestedMoveTarget(moveTargets: StepOption[]): GuidanceTargetRef | null {
  const captureTarget = moveTargets.find((target) => target.capture);
  return captureTarget ? cellTarget(captureTarget) : moveTargets[0] ? cellTarget(moveTargets[0]) : null;
}

export function getCurrentPlayerGuidance({
  phase,
  tileDraft,
  selectedWyrmId,
  selectedWyrmLabel,
  deployWyrmId,
  deployWyrmLabel,
  trailWyrmId,
  trailWyrmLabel,
  moveTargets,
  actionTargets,
  movableWyrmIds,
  blockedTrailWyrmIds,
  discardSelection,
  discardableIndices,
  playableTileTypes,
  hoardSelectableWyrmIds,
  opponentChoiceIds,
  canConfirmMove,
  canConfirmDiscard,
  canConfirmTileDraft,
  canEndTurn,
  canPlayTiles,
  showCoilChoice,
  showTargetSelection,
  showSpecialWyrmChoice,
  stepsRemaining,
  mustDiscard,
  isAutoCoilState,
}: ActionableGuidanceInput): PlayerGuidance {
  if (phase === "end") {
    return buildGuidance({
      type: "GAME_OVER",
      message: "The match is over.",
      highlightHint: null,
      priority: 0,
      validTargets: [],
    });
  }

  if (showCoilChoice) {
    const coilTargets = [
      controlTarget("coil_1"),
      controlTarget("coil_2"),
      controlTarget("coil_3"),
      controlTarget("coil_extra_trail"),
    ];
    return buildGuidance({
      type: "CHOICE_REQUIRED",
      message: isAutoCoilState
        ? "Click Place Trail in the overlay to make space for your blocked Wyrm."
        : "Click one Coil button in the overlay to choose this turn's movement.",
      subMessage: "The valid options are Move 1, Move 2, Move 3, and Place Trail.",
      highlightHint: "controls",
      priority: 160,
      validTargets: coilTargets,
      suggestedTarget: isAutoCoilState ? controlTarget("coil_extra_trail") : null,
    });
  }

  if (phase === "draw") {
    return buildGuidance({
      type: "DRAW_REQUIRED",
      message: "Click Draw Rune Tile to start the turn.",
      subMessage: "The draw button is the only valid action right now.",
      highlightHint: "controls",
      priority: 10,
      validTargets: [controlTarget("primary_action")],
      suggestedTarget: controlTarget("primary_action"),
    });
  }

  if (phase === "discard") {
    const discardTargets = discardableIndices.map((index) => discardIndexTarget(index));
    if (canConfirmDiscard) {
      return buildGuidance({
        type: "DISCARD_REQUIRED",
        message: "Click Confirm Discard to lock in the selected Rune Tiles.",
        subMessage: "You can still click a selected card in your hand to change the discard before confirming.",
        highlightHint: "controls",
        priority: 110,
        validTargets: [...discardTargets, controlTarget("primary_action")],
        suggestedTarget: controlTarget("primary_action"),
      });
    }

    const remaining = Math.max(0, mustDiscard - discardSelection.length);
    return buildGuidance({
      type: "DISCARD_REQUIRED",
      message: `Click ${remaining} Rune Tile${remaining === 1 ? "" : "s"} in your hand to discard.`,
      subMessage: `Choose exactly ${mustDiscard} cards from the left sidebar hand list.`,
      highlightHint: "hand",
      priority: 100,
      validTargets: discardTargets,
      suggestedTarget: discardTargets.find(
        (target) => target.kind === "discard_index" && !discardSelection.includes(target.index),
      ) ?? discardTargets[0] ?? null,
    });
  }

  if (phase === "roll") {
    return buildGuidance({
      type: "ROLL_REQUIRED",
      message: "Click Roll Dice to reveal this turn's movement.",
      subMessage: "The roll button is the only valid action right now.",
      highlightHint: "controls",
      priority: 10,
      validTargets: [controlTarget("primary_action")],
      suggestedTarget: controlTarget("primary_action"),
    });
  }

  if (deployWyrmId && actionTargets.length > 0) {
    return buildGuidance({
      type: "TARGET_REQUIRED",
      message: `Click one highlighted Den cell on the board to deploy ${deployWyrmLabel ?? "that Wyrm"}.`,
      subMessage: "Only the highlighted Den cells are valid deployment targets.",
      highlightHint: "cells",
      priority: 140,
      validTargets: [...actionTargets.map((coord) => cellTarget(coord)), controlTarget("cancel_interaction")],
      suggestedTarget: actionTargets[0] ? cellTarget(actionTargets[0]) : controlTarget("cancel_interaction"),
    });
  }

  if (trailWyrmId && actionTargets.length > 0) {
    return buildGuidance({
      type: "TARGET_REQUIRED",
      message: `Click one highlighted adjacent cell on the board to place ${trailWyrmLabel ?? "that Wyrm"}'s trail.`,
      subMessage: "Only the highlighted adjacent cells are valid trail targets.",
      highlightHint: "cells",
      priority: 140,
      validTargets: [...actionTargets.map((coord) => cellTarget(coord)), controlTarget("cancel_interaction")],
      suggestedTarget: actionTargets[0] ? cellTarget(actionTargets[0]) : controlTarget("cancel_interaction"),
    });
  }

  if (tileDraft) {
    const tileName = getTileName(tileDraft.tile);

    if (showTargetSelection && opponentChoiceIds.length > 0) {
      return buildGuidance({
        type: "CHOICE_REQUIRED",
        message: `Click one opponent button in the overlay to target ${tileName}.`,
        subMessage: "Only the visible opponent buttons are valid right now.",
        highlightHint: "controls",
        priority: 135,
        validTargets: opponentChoiceIds.map((playerId) => playerChoiceTarget(playerId)),
        suggestedTarget: opponentChoiceIds.length === 1 ? playerChoiceTarget(opponentChoiceIds[0]) : null,
      });
    }

    if (showSpecialWyrmChoice && hoardSelectableWyrmIds.length > 0) {
      return buildGuidance({
        type: "CHOICE_REQUIRED",
        message: `Click one highlighted Wyrm choice to continue ${tileName}.`,
        subMessage: "Only the visible Wyrm choices are valid for this step.",
        highlightHint: "controls",
        priority: 135,
        validTargets: hoardSelectableWyrmIds.map((wyrmId) => hoardWyrmTarget(wyrmId)),
        suggestedTarget: hoardSelectableWyrmIds.length === 1 ? hoardWyrmTarget(hoardSelectableWyrmIds[0]) : null,
      });
    }

    if (canConfirmTileDraft) {
      return buildGuidance({
        type: "ACTION_REQUIRED",
        message: `Click Confirm Effect to play ${tileName}.`,
        subMessage: "Use Cancel Effect if you want to pick a different target first.",
        highlightHint: "controls",
        priority: 145,
        validTargets: [controlTarget("confirm_tile"), controlTarget("cancel_interaction")],
        suggestedTarget: controlTarget("confirm_tile"),
      });
    }

    if (actionTargets.length > 0) {
      const copy = getTileBoardActionCopy(tileDraft, stepsRemaining);
      return buildGuidance({
        type: "TARGET_REQUIRED",
        message: copy.message,
        subMessage: copy.subMessage,
        highlightHint: "cells",
        priority: 130,
        validTargets: [...actionTargets.map((coord) => cellTarget(coord)), controlTarget("cancel_interaction")],
        suggestedTarget: actionTargets[0] ? cellTarget(actionTargets[0]) : controlTarget("cancel_interaction"),
      });
    }

    return buildGuidance({
      type: "TARGET_REQUIRED",
      message: `Keep building the ${tileName} preview.`,
      subMessage: "Use the highlighted targets or the overlay choices to finish this effect.",
      highlightHint: "controls",
      priority: 120,
      validTargets: [controlTarget("cancel_interaction")],
      suggestedTarget: controlTarget("cancel_interaction"),
    });
  }

  if (phase === "move") {
    if (selectedWyrmId) {
      if (moveTargets.length > 0) {
        return buildGuidance({
          type: "TARGET_REQUIRED",
          message: canConfirmMove
            ? `Click a highlighted adjacent cell to continue ${selectedWyrmLabel ?? "this Wyrm"}, or click Confirm Move to stop here.`
            : `Click one highlighted adjacent cell on the board to start ${selectedWyrmLabel ?? "this Wyrm"}'s path.`,
          subMessage: canConfirmMove
            ? `${stepsRemaining} step${stepsRemaining === 1 ? "" : "s"} remain before the path runs out.`
            : "Only the highlighted adjacent cells are valid next steps.",
          highlightHint: "cells",
          priority: 140,
          validTargets: [
            ...moveTargets.map((target) => cellTarget(target)),
            controlTarget("cancel_interaction"),
            ...(canConfirmMove ? [controlTarget("primary_action")] : []),
          ],
          suggestedTarget: getSuggestedMoveTarget(moveTargets) ?? (canConfirmMove ? controlTarget("primary_action") : controlTarget("cancel_interaction")),
        });
      }

      if (canConfirmMove) {
        return buildGuidance({
          type: "ACTION_REQUIRED",
          message: `Click Confirm Move to finish ${selectedWyrmLabel ?? "this Wyrm"}'s path.`,
          subMessage: "Use Cancel Move if you want to restart from the Wyrm's current position.",
          highlightHint: "controls",
          priority: 145,
          validTargets: [controlTarget("primary_action"), controlTarget("cancel_interaction")],
          suggestedTarget: controlTarget("primary_action"),
        });
      }

      return buildGuidance({
        type: "ACTION_REQUIRED",
        message: `Click Cancel Move to choose a different path for ${selectedWyrmLabel ?? "this Wyrm"}.`,
        subMessage: "There are no other valid clicks until you cancel this move.",
        highlightHint: "controls",
        priority: 130,
        validTargets: [controlTarget("cancel_interaction")],
        suggestedTarget: controlTarget("cancel_interaction"),
      });
    }

    if (movableWyrmIds.length > 0) {
      const boardTargets = movableWyrmIds.map((wyrmId) => boardWyrmTarget(wyrmId));
      const hoardTargets = hoardSelectableWyrmIds.map((wyrmId) => hoardWyrmTarget(wyrmId));
      return buildGuidance({
        type: "SELECTION_REQUIRED",
        message: hoardTargets.length > 0
          ? "Click one glowing Wyrm on the board to start moving, or click a ready hoarded Wyrm in the left sidebar to deploy it."
          : "Click one glowing Wyrm on the board to start your move.",
        subMessage: hoardTargets.length > 0
          ? "Only the glowing board Wyrms and ready hoard tokens are valid move starters."
          : "Only the glowing board Wyrms are valid move starters.",
        highlightHint: "wyrms",
        priority: 120,
        validTargets: [...boardTargets, ...hoardTargets],
        suggestedTarget: boardTargets[0] ?? hoardTargets[0] ?? null,
      });
    }

    if (hoardSelectableWyrmIds.length > 0) {
      return buildGuidance({
        type: "SELECTION_REQUIRED",
        message: "Click one ready hoarded Wyrm in the left sidebar to redeploy it.",
        subMessage: "Only the glowing hoard tokens are valid deployment starters.",
        highlightHint: "controls",
        priority: 120,
        validTargets: hoardSelectableWyrmIds.map((wyrmId) => hoardWyrmTarget(wyrmId)),
        suggestedTarget: hoardSelectableWyrmIds[0] ? hoardWyrmTarget(hoardSelectableWyrmIds[0]) : null,
      });
    }

    if (blockedTrailWyrmIds.length > 0) {
      return buildGuidance({
        type: "SELECTION_REQUIRED",
        message: "Click the blocked Wyrm on the board, then place its highlighted escape trail.",
        subMessage: "Only the glowing blocked Wyrms can place a trail right now.",
        highlightHint: "wyrms",
        priority: 125,
        validTargets: blockedTrailWyrmIds.map((wyrmId) => boardWyrmTarget(wyrmId)),
        suggestedTarget: blockedTrailWyrmIds[0] ? boardWyrmTarget(blockedTrailWyrmIds[0]) : null,
      });
    }
  }

  if (phase === "tile") {
    if (canPlayTiles && playableTileTypes.length > 0) {
      const tileTargets = playableTileTypes.map((tile) => handTileTarget(tile));
      return buildGuidance({
        type: "TILE_REQUIRED",
        message: playableTileTypes.length === 1
          ? `Click ${getTileName(playableTileTypes[0])} in your hand to preview it.`
          : canEndTurn
            ? "Click a highlighted Rune Tile in your hand to preview it, or click Skip to end the turn."
            : "Click a highlighted Rune Tile in your hand to preview it.",
        subMessage: canEndTurn
          ? "The glowing hand cards are playable now, and Skip stays available if you want to hold them."
          : "Only the glowing hand cards are playable right now.",
        highlightHint: "hand",
        priority: 90,
        validTargets: [...tileTargets, ...(canEndTurn ? [controlTarget("primary_action")] : [])],
        suggestedTarget: tileTargets.length === 1 ? tileTargets[0] : tileTargets[0] ?? (canEndTurn ? controlTarget("primary_action") : null),
      });
    }

    if (canEndTurn) {
      return buildGuidance({
        type: "ACTION_REQUIRED",
        message: "Click Skip to end your turn.",
        subMessage: "There are no other active tile actions left right now.",
        highlightHint: "controls",
        priority: 80,
        validTargets: [controlTarget("primary_action")],
        suggestedTarget: controlTarget("primary_action"),
      });
    }
  }

  return buildGuidance({
    type: "ACTION_REQUIRED",
    message: "Use the highlighted action to continue.",
    subMessage: "The next valid target is already glowing.",
    highlightHint: "controls",
    priority: 0,
    validTargets: [],
  });
}

export function guidanceHasTarget(guidance: PlayerGuidance | null, target: GuidanceTargetRef): boolean {
  if (!guidance) {
    return false;
  }
  const key = getGuidanceTargetKey(target);
  return guidance.validTargets.some((entry) => entry.key === key);
}

export function guidanceSuggestsTarget(guidance: PlayerGuidance | null, target: GuidanceTargetRef): boolean {
  if (!guidance || guidance.suggestedTargetKey == null) {
    return false;
  }
  return guidance.suggestedTargetKey === getGuidanceTargetKey(target);
}

export function getCorrectiveGuidanceCopy(guidance: PlayerGuidance): {
  message: string;
  subMessage?: string;
  highlightHint: HighlightHint;
} {
  return {
    message: guidance.message,
    subMessage: guidance.subMessage,
    highlightHint: guidance.highlightHint,
  };
}
