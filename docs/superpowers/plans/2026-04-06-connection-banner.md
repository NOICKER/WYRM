# Connection Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root-level connection banner that appears only after a previously healthy online session disconnects, retries automatically with capped backoff, and lets the player retry or return to the lobby.

**Architecture:** Keep reconnect state and retry timers inside `useOnlineSession`, backed by a small pure reconnect model helper for TDD-friendly behavior. Keep `ConnectionBanner` presentational and let `App.tsx` provide the root-level retry and lobby callbacks without changing game rules.

**Tech Stack:** React 19, TypeScript, Vite, Node `assert` test files, existing WebSocket session layer

---

## File Structure

- Create: `src/online/reconnectModel.ts`
  Purpose: Pure retry constants and state helpers for delays and banner transitions.
- Create: `src/components/ConnectionBanner.tsx`
  Purpose: Render the non-blocking reconnect UI.
- Create: `tests/reconnectModel.test.ts`
  Purpose: Test the retry model without React hook complexity.
- Modify: `src/online/useOnlineSession.ts`
  Purpose: Own `hasConnectedOnce`, retry timers, banner state, and room re-subscription.
- Modify: `src/App.tsx`
  Purpose: Render the banner at the root and wire retry / go-to-lobby actions.
- Modify: `src/index.css`
  Purpose: Add banner styling, pulse animation, and top-offset handling.
- Modify: `tests/socketClient.test.ts`
  Purpose: Verify reconnect-safe handshake behavior after a close.

### Task 1: Build the reconnect model under TDD

**Files:**
- Create: `src/online/reconnectModel.ts`
- Test: `tests/reconnectModel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";

import {
  MAX_RECONNECT_ATTEMPTS,
  getReconnectDelay,
  getReconnectStatusAfterClose,
  getReconnectStatusAfterFailure,
  getReconnectStatusAfterSuccess,
} from "../src/online/reconnectModel.ts";

assert.equal(MAX_RECONNECT_ATTEMPTS, 5);
assert.equal(getReconnectDelay(1), 1_000);
assert.equal(getReconnectDelay(2), 2_000);
assert.equal(getReconnectDelay(3), 4_000);
assert.equal(getReconnectDelay(4), 8_000);
assert.equal(getReconnectDelay(5), 16_000);
assert.equal(getReconnectDelay(6), null);

assert.deepEqual(
  getReconnectStatusAfterClose(false),
  { shouldRetry: false, status: "connected", attemptCount: 0 },
);

assert.deepEqual(
  getReconnectStatusAfterClose(true),
  { shouldRetry: true, status: "reconnecting", attemptCount: 1 },
);

assert.deepEqual(
  getReconnectStatusAfterFailure(4),
  { shouldRetry: true, status: "reconnecting", attemptCount: 5 },
);

assert.deepEqual(
  getReconnectStatusAfterFailure(5),
  { shouldRetry: false, status: "failed", attemptCount: 5 },
);

assert.deepEqual(
  getReconnectStatusAfterSuccess(),
  { status: "connected", attemptCount: 0 },
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/reconnectModel.test.ts`
Expected: FAIL with module-not-found because `src/online/reconnectModel.ts` does not exist yet

- [ ] **Step 3: Write the minimal implementation**

```ts
export const MAX_RECONNECT_ATTEMPTS = 5;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export type ConnectionBannerStatus = "connected" | "reconnecting" | "failed";

export function getReconnectDelay(attempt: number): number | null {
  return RECONNECT_DELAYS_MS[attempt - 1] ?? null;
}

export function getReconnectStatusAfterClose(hasConnectedOnce: boolean): {
  shouldRetry: boolean;
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  if (!hasConnectedOnce) {
    return { shouldRetry: false, status: "connected", attemptCount: 0 };
  }

  return { shouldRetry: true, status: "reconnecting", attemptCount: 1 };
}

export function getReconnectStatusAfterFailure(attemptCount: number): {
  shouldRetry: boolean;
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  if (attemptCount >= MAX_RECONNECT_ATTEMPTS) {
    return { shouldRetry: false, status: "failed", attemptCount: MAX_RECONNECT_ATTEMPTS };
  }

  return { shouldRetry: true, status: "reconnecting", attemptCount: attemptCount + 1 };
}

export function getReconnectStatusAfterSuccess(): {
  status: ConnectionBannerStatus;
  attemptCount: number;
} {
  return { status: "connected", attemptCount: 0 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/reconnectModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/reconnectModel.test.ts src/online/reconnectModel.ts
git commit -m "test: add reconnect model helpers"
```

### Task 2: Make the socket transport reconnect-safe

**Files:**
- Modify: `tests/socketClient.test.ts`
- Modify: `src/online/socketClient.ts`

- [ ] **Step 1: Write the failing transport test**

Adjust the test to create two fake sockets and verify a second `connect()` after close sends a fresh `hello` handshake.

```ts
const sockets = [new FakeSocket(), new FakeSocket()];
const [firstSocket, secondSocket] = sockets;
const client = new OnlineSocketClient({
  url: "ws://example.test/socket",
  clientId: "11111111-1111-4111-8111-111111111111",
  profile: { username: "Sable Quill", level: 7 },
  createSocket: () => sockets.shift()!,
  onMessage: (message) => messages.push(message.type),
  onStateChange: (state) => states.push(state),
});

client.connect();
firstSocket.fireOpen();
firstSocket.close();
client.connect();
secondSocket.fireOpen();

assert.deepEqual(
  secondSocket.sent.map((message) => JSON.parse(message)),
  [
    {
      type: "hello",
      clientId: "11111111-1111-4111-8111-111111111111",
      profile: { username: "Sable Quill", level: 7 },
    },
  ],
);
```

- [ ] **Step 2: Run the transport test to verify it fails**

Run: `node --experimental-strip-types tests/socketClient.test.ts`
Expected: FAIL until the fake socket factory and reconnect path are exercised correctly

- [ ] **Step 3: Write the minimal transport adjustments**

Keep `OnlineSocketClient.connect()` idempotent for open sockets, but allow a fresh socket to be created after `onclose` clears `this.socket`.

```ts
socket.onclose = () => {
  this.socket = null;
  this.onStateChange("closed");
};
```

If the current file already behaves this way, only update the test harness to prove it.

- [ ] **Step 4: Run the transport test to verify it passes**

Run: `node --experimental-strip-types tests/socketClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/socketClient.test.ts src/online/socketClient.ts
git commit -m "test: verify socket reconnect handshake"
```

### Task 3: Add reconnect state and retry timers to `useOnlineSession`

**Files:**
- Modify: `src/online/useOnlineSession.ts`
- Modify: `src/online/reconnectModel.ts`

- [ ] **Step 1: Add the public session fields**

Extend the session state and actions to expose:

```ts
  hasConnectedOnce: boolean;
  connectionBannerStatus: ConnectionBannerStatus;
  reconnectAttemptCount: number;
  retryReconnect: () => void;
```

- [ ] **Step 2: Wire reconnect refs and state**

Add the minimal hook state and refs:

```ts
const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
const [connectionBannerStatus, setConnectionBannerStatus] = useState<ConnectionBannerStatus>("connected");
const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);
const hasConnectedOnceRef = useRef(false);
const reconnectTimerRef = useRef<number | null>(null);
const reconnectAttemptRef = useRef(0);
const suppressReconnectRef = useRef(false);
```

- [ ] **Step 3: Update the `ready` path**

On successful open:

```ts
setHasConnectedOnce(true);
hasConnectedOnceRef.current = true;
const success = getReconnectStatusAfterSuccess();
setConnectionBannerStatus(success.status);
setReconnectAttemptCount(success.attemptCount);
reconnectAttemptRef.current = 0;

if (reconnectTimerRef.current !== null) {
  window.clearTimeout(reconnectTimerRef.current);
  reconnectTimerRef.current = null;
}

for (const roomId of watchedRoomsRef.current) {
  socketRef.current?.send({ type: "room_watch", roomId });
}
```

- [ ] **Step 4: Update the `closed` path**

Use the connected-once-only rule:

```ts
const closeState = getReconnectStatusAfterClose(hasConnectedOnceRef.current);
if (suppressReconnectRef.current || !closeState.shouldRetry) {
  return;
}

setConnectionBannerStatus(closeState.status);
setReconnectAttemptCount(closeState.attemptCount);
reconnectAttemptRef.current = closeState.attemptCount;
scheduleReconnect(closeState.attemptCount);
```

- [ ] **Step 5: Add the retry ladder**

Implement a local scheduler:

```ts
function scheduleReconnect(attemptCount: number): void {
  const delay = getReconnectDelay(attemptCount);
  if (delay === null) {
    setConnectionBannerStatus("failed");
    setReconnectAttemptCount(MAX_RECONNECT_ATTEMPTS);
    reconnectAttemptRef.current = MAX_RECONNECT_ATTEMPTS;
    return;
  }

  reconnectTimerRef.current = window.setTimeout(() => {
    ensureConnected();
  }, delay);
}
```

On subsequent `closed` events after a failed retry, use `getReconnectStatusAfterFailure(reconnectAttemptRef.current)` to either schedule the next attempt or enter `failed`.

- [ ] **Step 6: Add the manual retry action**

```ts
const retryReconnect = useCallback(() => {
  if (reconnectTimerRef.current !== null) {
    window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }

  suppressReconnectRef.current = false;
  setConnectionBannerStatus("reconnecting");
  setReconnectAttemptCount(0);
  reconnectAttemptRef.current = 0;
  ensureConnected();
}, [ensureConnected]);
```

- [ ] **Step 7: Make teardown intentional**

Before any deliberate close due to logout or hook cleanup:

```ts
suppressReconnectRef.current = true;
socketRef.current?.close(1000, "session ended");
```

Reset `suppressReconnectRef.current = false` before future connection attempts.

- [ ] **Step 8: Run the focused tests**

Run:
- `node --experimental-strip-types tests/reconnectModel.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`
- `node --experimental-strip-types tests/onlineSessionModel.test.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/online/useOnlineSession.ts src/online/reconnectModel.ts tests/reconnectModel.test.ts tests/socketClient.test.ts tests/onlineSessionModel.test.ts
git commit -m "feat: add online session reconnect state"
```

### Task 4: Build the presentational banner

**Files:**
- Create: `src/components/ConnectionBanner.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the failing component shape in code**

Create the component with the exact props and branching:

```ts
interface ConnectionBannerProps {
  status: "connected" | "reconnecting" | "failed";
  attemptCount: number;
  onRetry?: () => void;
  onGoToLobby?: () => void;
}
```

- [ ] **Step 2: Implement the minimal presentational component**

```tsx
export function ConnectionBanner({
  status,
  attemptCount,
  onRetry,
  onGoToLobby,
}: ConnectionBannerProps): React.JSX.Element | null {
  if (status === "connected") {
    return null;
  }

  return (
    <div className={`connection-banner connection-banner--${status}`} role="status" aria-live="polite">
      <span>
        {status === "reconnecting"
          ? `Connection lost — reconnecting... (attempt ${attemptCount} of 5)`
          : "Unable to reconnect. Your match may still be saved."}
      </span>
      {status === "failed" ? (
        <div className="connection-banner__actions">
          <button type="button" onClick={onRetry}>Try again</button>
          <button type="button" onClick={onGoToLobby}>Go to lobby</button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Add the banner styles**

Add CSS for:

```css
.connection-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3rem;
  padding: 0.75rem 1rem;
  color: #fff;
}

.connection-banner--reconnecting {
  background: #ba7517;
  animation: connectionBannerPulse 1.8s ease-in-out infinite;
}

.connection-banner--failed {
  background: #a32d2d;
}
```

Also define a small pulse keyframe and a shared offset variable such as `--connection-banner-offset`.

- [ ] **Step 4: Run the build-oriented smoke checks**

Run:
- `node --experimental-strip-types tests/reconnectModel.test.ts`
- `cmd /c npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ConnectionBanner.tsx src/index.css
git commit -m "feat: add connection status banner"
```

### Task 5: Render the banner at the root and wire the actions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Import and render the banner once**

Add:

```tsx
import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
```

Render it near the top of `AppShell`:

```tsx
<ConnectionBanner
  status={onlineSession.connectionBannerStatus}
  attemptCount={onlineSession.reconnectAttemptCount}
  onRetry={onlineSession.retryReconnect}
  onGoToLobby={handleConnectionBannerLobby}
/>
```

- [ ] **Step 2: Add the lobby fallback callback**

```ts
const handleConnectionBannerLobby = useCallback(() => {
  setActiveMatch(null);
  setActiveRoomId(null);
  setPendingAction(null);
  setError(null);
  navigate({ name: "lobby" });
}, [navigate]);
```

- [ ] **Step 3: Account for top offset collisions**

Adjust root layout CSS so the back button and guest banner remain usable when the connection banner is visible.

Example direction:

```tsx
const connectionBannerVisible = onlineSession.connectionBannerStatus !== "connected";
```

```tsx
<div style={{ ["--connection-banner-offset" as const]: connectionBannerVisible ? "3rem" : "0px" }}>
```

Then update `.global-back-btn` and any sticky top UI to use:

```css
top: calc(1.5rem + var(--connection-banner-offset, 0px));
```

- [ ] **Step 4: Run the focused verification**

Run:
- `node --experimental-strip-types tests/reconnectModel.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`
- `node --experimental-strip-types tests/onlineSessionModel.test.ts`
- `cmd /c npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css src/components/ConnectionBanner.tsx src/online/useOnlineSession.ts src/online/reconnectModel.ts tests/reconnectModel.test.ts tests/socketClient.test.ts tests/onlineSessionModel.test.ts
git commit -m "feat: surface reconnect banner across the app"
```

### Task 6: Final verification

**Files:**
- No new files unless a small follow-up fix is required

- [ ] **Step 1: Run the complete targeted suite**

Run:
- `node --experimental-strip-types tests/reconnectModel.test.ts`
- `node --experimental-strip-types tests/socketClient.test.ts`
- `node --experimental-strip-types tests/onlineSessionModel.test.ts`
- `node --experimental-strip-types tests/roomRouteErrors.test.ts`
- `node --experimental-strip-types tests/ui.test.ts`

Expected: PASS

- [ ] **Step 2: Run the production build**

Run: `cmd /c npm run build`
Expected: exit code `0` with TypeScript and Vite build success output

- [ ] **Step 3: Sanity-check the spec requirements**

Confirm all of the following are true:

- the banner only appears after a previously successful connection
- reconnecting shows amber with attempt count
- failed shows red with `Try again` and `Go to lobby`
- `Try again` resets the counter and retries immediately
- reconnect success clears the banner and replays the handshake
- watched rooms are re-subscribed after reconnect

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/ConnectionBanner.tsx src/index.css src/online/reconnectModel.ts src/online/useOnlineSession.ts tests/onlineSessionModel.test.ts tests/reconnectModel.test.ts tests/roomRouteErrors.test.ts tests/socketClient.test.ts tests/ui.test.ts
git commit -m "chore: verify connection banner rollout"
```
