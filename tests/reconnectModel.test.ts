import assert from "node:assert/strict";

import {
  MAX_RECONNECT_ATTEMPTS,
  getReconnectDelay,
  getReconnectStatusAfterClose,
  getReconnectStatusAfterFailure,
  getReconnectStatusAfterSuccess,
} from "../src/online/reconnectModel.ts";

assert.equal(MAX_RECONNECT_ATTEMPTS, 5, "the reconnect ladder should stop after five attempts");

assert.equal(getReconnectDelay(1), 1_000, "attempt one should wait one second");
assert.equal(getReconnectDelay(2), 2_000, "attempt two should wait two seconds");
assert.equal(getReconnectDelay(3), 4_000, "attempt three should wait four seconds");
assert.equal(getReconnectDelay(4), 8_000, "attempt four should wait eight seconds");
assert.equal(getReconnectDelay(5), 16_000, "attempt five should wait sixteen seconds");
assert.equal(getReconnectDelay(6), null, "attempts beyond the cap should not schedule another retry");

assert.deepEqual(
  getReconnectStatusAfterClose(false),
  { shouldRetry: false, status: "connected", attemptCount: 0 },
  "first-connect failures should not show a reconnect banner",
);

assert.deepEqual(
  getReconnectStatusAfterClose(true),
  { shouldRetry: true, status: "reconnecting", attemptCount: 1 },
  "healthy sessions should enter reconnecting state on the first unexpected close",
);

assert.deepEqual(
  getReconnectStatusAfterFailure(4),
  { shouldRetry: true, status: "reconnecting", attemptCount: 5 },
  "the fifth attempt should still be scheduled",
);

assert.deepEqual(
  getReconnectStatusAfterFailure(5),
  { shouldRetry: false, status: "failed", attemptCount: 5 },
  "after the fifth failed attempt the banner should enter the failed state",
);

assert.deepEqual(
  getReconnectStatusAfterSuccess(),
  { status: "connected", attemptCount: 0 },
  "successful reconnects should clear the banner and reset the counter",
);

console.log("Reconnect model test suite passed.");
