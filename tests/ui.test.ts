import assert from "node:assert/strict";

import {
  canHostCommence,
  getProtectedRedirect,
  parseAppRoute,
  validateAssemblyCode,
} from "../src/ui/appModel.ts";

{
  assert.deepEqual(parseAppRoute("/"), { name: "auth" }, "root should resolve to the auth screen");
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
}

{
  const protectedMatch = parseAppRoute("/match/match-42");
  const protectedResults = parseAppRoute("/match/match-42/results");
  const publicLobby = parseAppRoute("/lobby");

  assert.equal(
    getProtectedRedirect(publicLobby, {
      authenticated: false,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    "/",
    "unauthenticated access should return to auth",
  );
  assert.equal(
    getProtectedRedirect(protectedMatch, {
      authenticated: true,
      hasActiveMatch: false,
      hasCompletedMatch: false,
    }),
    "/lobby",
    "match routes should bounce back to the lobby without an active match",
  );
  assert.equal(
    getProtectedRedirect(protectedResults, {
      authenticated: true,
      hasActiveMatch: false,
      hasCompletedMatch: true,
    }),
    null,
    "results routes should remain available when a completed match record exists",
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

console.log("UI helper test suite passed.");
