import assert from "node:assert/strict";

import { MatchmakingRoomStore } from "../server/roomStore.ts";

const store = new MatchmakingRoomStore({
  createRoomId: () => "ARC-1-2026",
  createMatchId: () => "match-amber",
  now: () => 1_775_494_400_000,
});

const record = store.createMatch([
  {
    clientId: "client-a",
    profile: { username: "Mara Thorne", level: 8, isGuest: false },
  },
  {
    clientId: "client-b",
    profile: { username: "Sable Quill", level: 7, isGuest: true },
  },
]);

assert.equal(record.roomId, "ARC-1-2026", "the room id should come from the configured generator");
assert.equal(record.matchId, "match-amber", "the match id should come from the configured generator");

const maraView = store.getAssemblyRoom("ARC-1-2026", "client-a");
assert.ok(maraView, "matched rooms should be watchable after creation");
assert.equal(maraView?.seats.length, 2, "matchmade rooms should only expose two seats");
assert.equal(maraView?.seats[0]?.playerId, 1, "the first matched player should take the purple seat");
assert.equal(maraView?.seats[1]?.playerId, 4, "the second matched player should take the amber seat");
assert.equal(maraView?.seats[0]?.currentUser, true, "room snapshots should be personalized for the viewer");
assert.equal(maraView?.seats[1]?.currentUser, false, "other seats should not be marked as current");

const sableView = store.getAssemblyRoom("ARC-1-2026", "client-b");
assert.equal(sableView?.seats[0]?.currentUser, false, "the first player should not be current in the second player's snapshot");
assert.equal(sableView?.seats[1]?.currentUser, true, "the viewer's own seat should be marked current");
assert.equal(
  store.getMatch("ARC-1-2026")?.createdAt,
  1_775_494_400_000,
  "the canonical room record should keep the initialized match metadata",
);
assert.equal(
  store.getMatch("ARC-1-2026")?.state.phase,
  "draw",
  "newly created matches should keep the initial authoritative game state on the server",
);

const maraMatchView = store.joinMatch("ARC-1-2026", "client-a");
assert.equal(maraMatchView?.matchId, "match-amber", "joined players should receive the server match id");
assert.equal(maraMatchView?.viewerPlayerId, 1, "the first seat should map to player one in the sync view");
assert.equal(maraMatchView?.state.players[0]?.hand.length, 4, "joined players should receive the canonical player state");

const offTurnRoll = store.applyMatchAction("match-amber", "client-b", { type: "roll" });
assert.equal(
  offTurnRoll.status,
  "not_turn",
  "players should not be able to act on turns that belong to another seat",
);

const drawAction = store.applyMatchAction("match-amber", "client-a", { type: "draw" });
assert.equal(drawAction.status, "accepted", "the active seat should be able to advance the server match state");
assert.equal(
  store.joinMatch("ARC-1-2026", "client-b")?.state.phase,
  "roll",
  "state changes should be stored canonically so every player rejoins on the latest phase",
);
assert.equal(store.getAssemblyRoom("missing-room", "client-a"), null, "unknown room watches should return null");

console.log("Room store test suite passed.");
