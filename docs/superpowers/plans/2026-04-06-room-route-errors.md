# Room Route Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed room and match route error handling, a dedicated `RoomErrorScreen`, and a one-shot lobby auto-create recovery flow.

**Architecture:** Extend the online protocol with structured route-error messages and keep the mapping logic in focused helper modules so `App.tsx` can stay declarative. Recoveries that create a new room use an app-level in-memory lobby intent, which the lobby consumes once and clears immediately.

**Tech Stack:** React 19, TypeScript, Vite, Node `assert` test files, in-repo WebSocket backend

---

### Task 1: Document the protocol and recovery contract

**Files:**
- Modify: `docs/superpowers/specs/2026-04-06-matchmaking-backend-design.md`

- [ ] **Step 1: Update the spec with typed route errors**

Add protocol entries for `room_not_found`, `room_closed`, `room_full`, and `match_not_found`, plus the room error screen and one-shot lobby intent behavior.

- [ ] **Step 2: Re-read the spec for coverage**

Check that the spec now names:
- the route-error message types
- the `RoomErrorScreen` reasons
- the one-shot auto-create behavior

- [ ] **Step 3: Save the updated spec**

No extra files are required for this task once the spec includes the approved behavior.

### Task 2: Add failing tests for the new behavior boundaries

**Files:**
- Create: `tests/roomRouteErrors.test.ts`
- Modify: `tests/socketClient.test.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
import assert from "node:assert/strict";

import {
  consumeLobbyIntent,
  mapRouteErrorToScreenReason,
} from "../src/ui/roomRouteErrors.ts";

assert.equal(
  mapRouteErrorToScreenReason({ type: "room_not_found", roomId: "ARC-1-2026" }),
  "not_found",
);
assert.equal(
  mapRouteErrorToScreenReason({ type: "room_closed", roomId: "ARC-1-2026", reason: "disconnect_timeout" }),
  "expired",
);
assert.equal(
  mapRouteErrorToScreenReason({ type: "room_full", roomId: "ARC-1-2026", reconnectTokenValid: false }),
  "full",
);
assert.equal(
  mapRouteErrorToScreenReason({ type: "match_not_found", matchId: "match-amber" }),
  "match_not_found",
);
assert.deepEqual(
  consumeLobbyIntent({ type: "auto_create_room" }),
  { shouldAutoCreate: true, nextIntent: null },
);
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `node --experimental-strip-types tests/roomRouteErrors.test.ts`
Expected: FAIL because `src/ui/roomRouteErrors.ts` does not exist yet

- [ ] **Step 3: Extend the socket client test with a structured server message**

```ts
fakeSocket.fireMessage({ type: "room_not_found", roomId: "ARC-1-2026" });

assert.deepEqual(
  messages,
  ["room_not_found", "queue_joined"],
  "structured route-error messages should reach the session layer unchanged",
);
```

- [ ] **Step 4: Run the socket client test to verify it fails for the new expectation**

Run: `node --experimental-strip-types tests/socketClient.test.ts`
Expected: FAIL until the protocol types accept `room_not_found`

### Task 3: Implement typed route-error helpers and protocol support

**Files:**
- Create: `src/ui/roomRouteErrors.ts`
- Modify: `src/online/protocol.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Add the helper module**

```ts
import type { RouteErrorMessage } from "../online/protocol.ts";

export type RoomErrorScreenReason = "not_found" | "expired" | "full" | "match_not_found";
export type LobbyIntent = { type: "auto_create_room" } | null;

export function mapRouteErrorToScreenReason(error: RouteErrorMessage | null): RoomErrorScreenReason | null {
  if (!error) return null;
  if (error.type === "room_not_found") return "not_found";
  if (error.type === "room_closed" && error.reason === "disconnect_timeout") return "expired";
  if (error.type === "room_full" && !error.reconnectTokenValid) return "full";
  if (error.type === "match_not_found") return "match_not_found";
  return null;
}

export function consumeLobbyIntent(intent: LobbyIntent): {
  shouldAutoCreate: boolean;
  nextIntent: LobbyIntent;
} {
  return intent?.type === "auto_create_room"
    ? { shouldAutoCreate: true, nextIntent: null }
    : { shouldAutoCreate: false, nextIntent: intent };
}
```

- [ ] **Step 2: Extend the protocol types**

Add typed server messages for:
- `room_not_found`
- `room_closed`
- `room_full`
- `match_not_found`

Also export a `RouteErrorMessage` union that covers those shapes.

- [ ] **Step 3: Update backend room-watch error emission**

Replace the generic room-watch miss response with:

```ts
send(socket, { type: "room_not_found", roomId: message.roomId });
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run:
- `node --experimental-strip-types tests/roomRouteErrors.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`

Expected: PASS

### Task 4: Build the screen and wire the app-level recovery flow

**Files:**
- Create: `src/screens/RoomErrorScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/online/useOnlineSession.ts`

- [ ] **Step 1: Add the dedicated room error screen**

Create a screen that renders the WYRM wordmark, the context-aware copy, and an amber CTA on the existing deep-green background.

- [ ] **Step 2: Store the typed route error in the online session**

Add session state for the latest route error and set it when the socket receives one of the typed route-error messages.

- [ ] **Step 3: Wire `App.tsx` to render the screen**

Implement these branches:
- `/assembly/:roomId` maps typed route errors to `RoomErrorScreen`
- `/match/:matchId` renders `match_not_found` when no active match can satisfy the route
- expired / full recovery sets a one-shot in-memory lobby intent and navigates to `/lobby`
- the lobby consumes that intent once, triggers the existing room creation flow, and clears the intent immediately

- [ ] **Step 4: Run the targeted tests again**

Run:
- `node --experimental-strip-types tests/roomRouteErrors.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`
- `node --experimental-strip-types tests/ui.test.ts`

Expected: PASS

### Task 5: Verify the integrated change

**Files:**
- Modify: `package.json` only if a missing script is truly required

- [ ] **Step 1: Run the route-error focused tests**

Run:
- `node --experimental-strip-types tests/roomRouteErrors.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`
- `node --experimental-strip-types tests/ui.test.ts`

Expected: PASS

- [ ] **Step 2: Run broader regression checks that still apply**

Run:
- `node --experimental-strip-types tests/onlineSessionModel.test.ts`
- `node --experimental-strip-types tests/roomStore.test.ts`

Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: exit code 0 with Vite build output and no TypeScript errors
