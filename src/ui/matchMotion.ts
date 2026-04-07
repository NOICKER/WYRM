export const MATCH_MOTION_MS = {
  roll: 220,
  ghostStep: 70,
  ghostTotal: 240,
  drawFeedback: 220,
  trailFresh: 240,
} as const;

export const BOT_DECISION_DELAY_MS = {
  quick: 90,
  standard: 180,
} as const;

interface ResponsiveMotionInput {
  animationsEnabled: boolean;
  hasPendingMotion: boolean;
}

export function getResponsiveMotionMode({
  animationsEnabled,
  hasPendingMotion,
}: ResponsiveMotionInput): { skip: boolean; durationScale: 0 | 1 } {
  if (!animationsEnabled || hasPendingMotion) {
    return {
      skip: true,
      durationScale: 0,
    };
  }

  return {
    skip: false,
    durationScale: 1,
  };
}
