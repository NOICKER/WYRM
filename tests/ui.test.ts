import assert from "node:assert/strict";

import {
  buildMatchRecord,
  canHostCommence,
  getProtectedRedirect,
  parseAppRoute,
  seedHostRoom,
  validateAssemblyCode,
} from "../src/ui/appModel.ts";
import { createInitialState } from "../src/state/gameLogic.ts";

{
  assert.deepEqual(parseAppRoute("/"), { name: "landing" }, "root should resolve to the landing screen");
  assert.deepEqual(
    parseAppRoute("/matchmaking"),
    { name: "matchmaking" },
    "matchmaking routes should resolve to the dedicated queue screen",
  );
  assert.deepEqual(
    parseAppRoute("/assembly/ARC-7-2026"),
    { name: "assembly", roomId: "ARC-7-2026" },
    "assembly routes should preserve the room id",
  );
  assert.deepEqual(
    parseAppRoute("/match/match-42/chronicle"),
    { name: "chronicle", matchId: "match-42" },
    "chronicle routes should preserve the match id",
  );
  assert.deepEqual(
    parseAppRoute("/settings"),
    { name: "settings" },
    "settings routes should resolve to the dedicated settings screen",
  );
}

{
  const protectedMatch = parseAppRoute("/match/match-42");
  const protectedResults = parseAppRoute("/match/match-42/results");
  const publicLobby = parseAppRoute("/lobby");

  assert.equal(
    getProtectedRedirect(publicLobby, {
      authenticated: false,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    "/",
    "unauthenticated access should return to auth",
  );
  assert.equal(
    getProtectedRedirect(protectedMatch, {
      authenticated: true,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    null,
    "match routes should stay in place so the app can render a match-not-found recovery screen",
  );
  assert.equal(
    getProtectedRedirect(protectedResults, {
      authenticated: true,
      isGuestSession: false,
      hasActiveMatch: false,
      hasCompletedMatch: true,
    }),
    null,
    "results routes should remain available when a completed match record exists",
  );
  assert.equal(
    getProtectedRedirect(parseAppRoute("/auth"), {
      authenticated: true,
      isGuestSession: true,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    null,
    "guest sessions should still be able to open auth so they can create a full account",
  );
}

{
  assert.equal(validateAssemblyCode("ABC-7-2026"), true, "valid sigil codes should pass");
  assert.equal(validateAssemblyCode("abc-7-2026"), false, "lowercase sigil codes should fail");
  assert.equal(validateAssemblyCode("ABCD"), false, "incomplete sigil codes should fail");
}

{
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    false,
    "the race cannot commence with fewer than two occupied seats",
  );
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: true, ready: false },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    false,
    "the race cannot commence until every occupied seat is ready",
  );
  assert.equal(
    canHostCommence([
      { occupied: true, ready: true },
      { occupied: true, ready: true },
      { occupied: false, ready: false },
      { occupied: false, ready: false },
    ]),
    true,
    "the race can commence once at least two seats are filled and all occupied seats are ready",
  );
}

{
  const record = buildMatchRecord(
    createInitialState(2),
    seedHostRoom({ username: "Sable Quill", level: 7 }),
    { username: "Sable Quill", level: 7 },
    4,
    [],
  );

  assert.equal(
    typeof record.completedAt,
    "number",
    "completed match records should carry a completion timestamp so settings history can show a date",
  );
}

console.log("UI helper test suite passed.");
