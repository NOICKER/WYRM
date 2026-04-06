import assert from "node:assert/strict";

import {
  MATCHMAKING_SUBTEXTS,
  formatQueueElapsed,
  getMatchmakingSubtext,
  getOrCreateStableClientId,
} from "../src/online/sessionModel.ts";

{
  assert.equal(formatQueueElapsed(0), "00:00", "the queue timer should start at zero");
  assert.equal(formatQueueElapsed(65_000), "01:05", "the queue timer should format full minutes and seconds");
}

{
  assert.equal(getMatchmakingSubtext(0), MATCHMAKING_SUBTEXTS[0], "the first subtext should appear immediately");
  assert.equal(getMatchmakingSubtext(8_000), MATCHMAKING_SUBTEXTS[1], "the second subtext should appear after eight seconds");
  assert.equal(getMatchmakingSubtext(16_000), MATCHMAKING_SUBTEXTS[2], "the third subtext should appear after sixteen seconds");
  assert.equal(getMatchmakingSubtext(24_000), MATCHMAKING_SUBTEXTS[0], "the subtext rotation should loop");
}

{
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };

  const created = getOrCreateStableClientId(storage, () => "uuid-1");
  const reused = getOrCreateStableClientId(storage, () => "uuid-2");

  assert.equal(created, "uuid-1", "the first lookup should persist a generated client id");
  assert.equal(reused, "uuid-1", "subsequent lookups should reuse the stored client id");
}

console.log("Online session model test suite passed.");
