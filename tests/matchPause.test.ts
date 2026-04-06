import assert from "node:assert/strict";

import {
  createReconnectDeadlineTimestamp,
  getDisconnectedSeatLabel,
  getMatchPhaseDisplayLabel,
  getReconnectMinutesRemaining,
  shouldShowPauseOverlay,
} from "../src/screens/matchPauseState.ts";

{
  assert.equal(
    getDisconnectedSeatLabel("Mara Thorne"),
    "Mara Thorne",
    "the disconnected player's display name should be preserved",
  );
  assert.equal(
    getDisconnectedSeatLabel(null),
    "Opponent",
    "the UI should fall back to a generic label when no disconnected name is available",
  );
}

{
  const startTime = Date.UTC(2026, 3, 6, 12, 0, 0);
  const deadline = createReconnectDeadlineTimestamp(startTime, 30);

  assert.equal(
    deadline,
    startTime + 30 * 60 * 1000,
    "the reconnect deadline should be offset by the configured minute window",
  );
  assert.equal(
    getReconnectMinutesRemaining(deadline, startTime + 29 * 60 * 1000 + 1),
    1,
    "the countdown should round up so the final partial minute still shows as remaining",
  );
  assert.equal(
    getReconnectMinutesRemaining(deadline, deadline + 1),
    0,
    "the countdown should stop at zero after the reconnect window expires",
  );
}

{
  assert.equal(
    getMatchPhaseDisplayLabel("active", "move"),
    "MOVE",
    "active matches should continue to show the live phase label",
  );
  assert.equal(
    getMatchPhaseDisplayLabel("paused_disconnected", "move"),
    "PAUSED",
    "paused matches should replace the live phase with a paused label",
  );
}

{
  assert.equal(
    shouldShowPauseOverlay("paused_disconnected", false),
    true,
    "paused matches should show the reconnect overlay until the player dismisses it",
  );
  assert.equal(
    shouldShowPauseOverlay("paused_disconnected", true),
    false,
    "dismissing the reconnect overlay should leave only the slim paused banner visible",
  );
  assert.equal(
    shouldShowPauseOverlay("active", false),
    false,
    "the reconnect overlay should disappear as soon as the room becomes active again",
  );
}

console.log("Match pause helper test suite passed.");
