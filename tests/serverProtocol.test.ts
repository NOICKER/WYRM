import assert from "node:assert/strict";

import { parseClientMessage } from "../server/protocol.ts";

const joinRoom = parseClientMessage(
  JSON.stringify({
    type: "join_room",
    roomId: "ARC-1-2026",
  }),
);

assert.deepEqual(
  joinRoom,
  {
    type: "join_room",
    roomId: "ARC-1-2026",
  },
  "join_room payloads should be accepted by the server protocol parser",
);

const leaveRoom = parseClientMessage(
  JSON.stringify({
    type: "leave_room",
  }),
);

assert.deepEqual(
  leaveRoom,
  {
    type: "leave_room",
  },
  "leave_room payloads should be accepted so clients can detach from match sync without dropping the socket",
);

const matchAction = parseClientMessage(
  JSON.stringify({
    type: "match_action",
    matchId: "match-amber",
    action: {
      type: "draw",
    },
  }),
);

assert.deepEqual(
  matchAction,
  {
    type: "match_action",
    matchId: "match-amber",
    action: {
      type: "draw",
    },
  },
  "match_action payloads should keep their nested action payload intact",
);

console.log("Server protocol test suite passed.");
