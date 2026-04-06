import assert from "node:assert/strict";

import {
  consumeLobbyIntent,
  mapRouteErrorToScreenReason,
} from "../src/ui/roomRouteErrors.ts";

assert.equal(
  mapRouteErrorToScreenReason({ type: "room_not_found", roomId: "ARC-1-2026" }),
  "not_found",
  "missing rooms should map to the room-not-found screen",
);

assert.equal(
  mapRouteErrorToScreenReason({
    type: "room_closed",
    roomId: "ARC-1-2026",
    reason: "disconnect_timeout",
  }),
  "expired",
  "disconnect timeout closures should map to the expired-room screen",
);

assert.equal(
  mapRouteErrorToScreenReason({
    type: "room_full",
    roomId: "ARC-1-2026",
    reconnectTokenValid: false,
  }),
  "full",
  "full rooms without a valid reconnect token should map to the full-room screen",
);

assert.equal(
  mapRouteErrorToScreenReason({ type: "match_not_found", matchId: "match-amber" }),
  "match_not_found",
  "missing matches should map to the match-not-found screen",
);

assert.deepEqual(
  consumeLobbyIntent({ type: "auto_create_room" }),
  { shouldAutoCreate: true, nextIntent: null },
  "the auto-create lobby intent should be consumed once and cleared immediately",
);

assert.deepEqual(
  consumeLobbyIntent(null),
  { shouldAutoCreate: false, nextIntent: null },
  "missing lobby intents should stay empty and should not auto-create a room",
);

console.log("Room route error helper test suite passed.");
