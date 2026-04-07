import assert from "node:assert/strict";

import {
  BOT_DECISION_DELAY_MS,
  MATCH_MOTION_MS,
  getResponsiveMotionMode,
} from "../src/ui/matchMotion.ts";

assert.ok(
  MATCH_MOTION_MS.roll <= 300
  && MATCH_MOTION_MS.ghostStep <= 300
  && MATCH_MOTION_MS.ghostTotal <= 300
  && MATCH_MOTION_MS.drawFeedback <= 300
  && MATCH_MOTION_MS.trailFresh <= 300,
  "board motion timings should all stay under the 300ms responsiveness budget",
);

assert.ok(
  BOT_DECISION_DELAY_MS.quick <= 300 && BOT_DECISION_DELAY_MS.standard <= 300,
  "bot phase delays should stay under the same responsiveness budget",
);

assert.deepEqual(
  getResponsiveMotionMode({ animationsEnabled: true, hasPendingMotion: false }),
  { skip: false, durationScale: 1 },
  "normal interactions should preserve the full short animation timings",
);

assert.deepEqual(
  getResponsiveMotionMode({ animationsEnabled: false, hasPendingMotion: false }),
  { skip: true, durationScale: 0 },
  "disabling animations should skip board motion immediately",
);

assert.deepEqual(
  getResponsiveMotionMode({ animationsEnabled: true, hasPendingMotion: true }),
  { skip: true, durationScale: 0 },
  "rapid input should skip lingering motion instead of queueing extra animation delay",
);

console.log("Match motion test suite passed.");
