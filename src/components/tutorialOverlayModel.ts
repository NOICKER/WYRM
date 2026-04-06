import type { TurnPhase } from "../state/types.ts";

export const TUTORIAL_STORAGE_KEY = "wyrm_has_played";

export type TutorialHighlightTarget = "den" | "hand" | "die" | "board";

export interface TutorialStepDefinition {
  phase: Extract<TurnPhase, "draw" | "roll" | "move">;
  title: string;
  body: string;
  highlight: TutorialHighlightTarget;
}

export interface TutorialProgressSnapshot {
  phase: TurnPhase;
  selectedWyrmId: string | null;
}

export interface TutorialVisibilityOptions {
  hasPlayedFlag: string | null;
  localMode: boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStepDefinition[] = [
  {
    phase: "draw",
    title: "Your Den",
    body:
      "The coloured corner zone is where your Wyrms begin. Captured enemy Wyrms can be redeployed here later.",
    highlight: "den",
  },
  {
    phase: "draw",
    title: "Draw a Rune Tile",
    body:
      "Each turn starts by drawing a tile into your hand. Tiles have one-time effects. Collect 3 matching tiles to trigger a powerful Lair Power.",
    highlight: "hand",
  },
  {
    phase: "roll",
    title: "Roll the die",
    body:
      "The die tells you how many spaces you must move. Coil lets you choose your distance. Surge moves you 5 spaces.",
    highlight: "die",
  },
  {
    phase: "move",
    title: "Move your Wyrm",
    body:
      "Click a Wyrm to see where it can go. Every cell you leave becomes a trail that blocks all movement — including yours.",
    highlight: "board",
  },
] as const;

export function shouldShowTutorial({ hasPlayedFlag, localMode }: TutorialVisibilityOptions): boolean {
  return !localMode && hasPlayedFlag !== "true";
}

export function getAutoAdvancedTutorialIndex(
  currentStepIndex: number,
  previousSnapshot: TutorialProgressSnapshot | null,
  currentSnapshot: TutorialProgressSnapshot,
): number | null {
  if (!previousSnapshot) {
    return currentStepIndex;
  }

  const drawCompleted = previousSnapshot.phase === "draw" && currentSnapshot.phase !== "draw";
  if (drawCompleted && currentStepIndex < 2) {
    return 2;
  }

  const rollCompleted = previousSnapshot.phase === "roll" && currentSnapshot.phase === "move";
  if (rollCompleted && currentStepIndex < 3) {
    return 3;
  }

  const wyrmSelected =
    currentStepIndex === 3 &&
    previousSnapshot.selectedWyrmId == null &&
    currentSnapshot.selectedWyrmId != null;
  if (wyrmSelected) {
    return null;
  }

  return currentStepIndex;
}
