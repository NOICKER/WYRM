import type { TooltipKey } from "../state/useTooltipState.ts";

export interface ContextTooltipContent {
  title: string;
  body: string;
}

export const CONTEXT_TOOLTIP_CONTENT: Record<TooltipKey, ContextTooltipContent> = {
  trail_created: {
    title: "Trail created",
    body: "That coloured square is a trail. No piece can enter a trail cell. Trails fade over 3 rounds.",
  },
  sacred_grove_nearby: {
    title: "Sacred Grove nearby",
    body: "A Wyrm is one move from the Sacred Grove. Get two inside simultaneously to win.",
  },
  elder_promotion: {
    title: "Elder promotion",
    body: "Your Wyrm reached an enemy Den and became an Elder. Elders move in 8 directions and choose their own distance.",
  },
  lair_power_available: {
    title: "Lair Power ready",
    body: "You hold 3 matching tiles. Play them together in the Tile step to trigger a Lair Power.",
  },
  coil_choice: {
    title: "Coil choice",
    body: "The Coil face lets you choose your distance (1, 2, or 3 spaces) or place an extra trail marker instead of moving.",
  },
  blocked_move_available: {
    title: "Blocked move",
    body: "That wyrm has no legal path. Select it and place one adjacent trail marker instead of moving.",
  },
  capture_available: {
    title: "Capture available",
    body: "A red ring means you can capture that Wyrm by landing on it. Captured Wyrms go to your Hoard and can be redeployed later.",
  },
  hoard_deploy_available: {
    title: "Hoard deploy",
    body: "You have captured Wyrms. In the Move step, you can deploy one into your Den instead of moving.",
  },
};

export interface ContextTooltipPlacementInput {
  anchorRect: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap: number;
  viewportMargin: number;
  arrowPadding: number;
}

export interface ContextTooltipPlacement {
  top: number;
  left: number;
  arrowLeft: number;
  placement: "above" | "below";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getContextTooltipPlacement({
  anchorRect,
  cardWidth,
  cardHeight,
  viewportWidth,
  viewportHeight,
  gap,
  viewportMargin,
  arrowPadding,
}: ContextTooltipPlacementInput): ContextTooltipPlacement {
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const maxLeft = Math.max(viewportMargin, viewportWidth - cardWidth - viewportMargin);
  const left = clamp(anchorCenterX - cardWidth / 2, viewportMargin, maxLeft);
  const spaceBelow = viewportHeight - anchorRect.bottom - viewportMargin;
  const placement = spaceBelow >= cardHeight + gap ? "below" : "above";
  const top =
    placement === "below"
      ? clamp(anchorRect.bottom + gap, viewportMargin, Math.max(viewportMargin, viewportHeight - cardHeight - viewportMargin))
      : clamp(anchorRect.top - cardHeight - gap, viewportMargin, Math.max(viewportMargin, viewportHeight - cardHeight - viewportMargin));

  return {
    top,
    left,
    arrowLeft: clamp(anchorCenterX - left, arrowPadding, cardWidth - arrowPadding),
    placement,
  };
}
