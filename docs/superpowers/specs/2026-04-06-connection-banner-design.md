# Connection Banner Design

Date: 2026-04-06
Status: Approved
Scope: Non-blocking WebSocket connection status UX for online sessions. This does not change gameplay rules or match logic.

## Current State

The app already has a client-side online session layer in `src/online/useOnlineSession.ts` and `src/online/socketClient.ts`.

- `useOnlineSession` owns socket creation, queue state, watched rooms, and route errors.
- `OnlineSocketClient` reports `connecting`, `ready`, and `closed`, and it always re-sends the `hello` handshake when a socket opens.
- If the socket drops while browsing an online room or match, the UI has no persistent reconnect feedback.
- If the first connection attempt after login fails, existing loading and inline error states already cover that case.

This leaves a gap for mid-session disconnects: the player can land in a frozen-feeling board state with no clear explanation.

## Goals

Add a root-level, non-blocking connection banner that appears only after the app has successfully connected once in the current session and then loses the socket.

Required behavior:

- Track `hasConnectedOnce`
- Track `connectionBannerStatus: "connected" | "reconnecting" | "failed"`
- Track `reconnectAttemptCount`
- Expose `retryReconnect()`
- Retry with exponential backoff at `1s`, `2s`, `4s`, `8s`, `16s`
- After 5 failed attempts, surface a failed banner state
- On manual `Try again`, reset the attempt count and retry immediately
- On successful reconnect:
  - reset attempt count to `0`
  - set banner status to `connected`
  - re-send the `hello` handshake
  - re-subscribe any active room watchers so state can resync

## Non-Goals

This feature explicitly does not include:

- changes to board rules, turn rules, or match mechanics
- server-authoritative gameplay recovery
- new gameplay protocol messages beyond reusing existing room subscription behavior
- replacing existing initial connection loading and error handling
- blocking modals or forced screen transitions during reconnecting

## Recommended Architecture

Keep the reconnect state machine inside `useOnlineSession` and keep `ConnectionBanner` purely presentational.

### Why this approach

- The hook already owns the socket lifecycle, watched room set, and connection state.
- It avoids duplicating reconnect logic inside `App.tsx`.
- It keeps the UI component simple: render based on status, attempt count, and callbacks.
- It lets the hook automatically restore protocol-level context after reconnect without touching match logic.

## Connection State Model

Extend `useOnlineSession` with four new public fields:

- `hasConnectedOnce: boolean`
- `connectionBannerStatus: "connected" | "reconnecting" | "failed"`
- `reconnectAttemptCount: number`
- `retryReconnect(): void`

Internal refs and timers should stay inside the hook:

- `reconnectTimerRef`
- `reconnectAttemptRef`
- `suppressReconnectRef`
- `queueStatusRef` and `watchedRoomsRef` continue to exist

### Connected-once-only rule

- When a socket first reaches `ready`, set `hasConnectedOnce = true`.
- If a socket closes before that first successful `ready`, do not show the banner.
- That first-connect failure remains an initial connection problem and is handled by the app’s existing loading and inline error states.

## Retry Semantics

Use a fixed backoff table:

- Attempt 1 -> `1000ms`
- Attempt 2 -> `2000ms`
- Attempt 3 -> `4000ms`
- Attempt 4 -> `8000ms`
- Attempt 5 -> `16000ms`

Behavior:

- On an unexpected close after `hasConnectedOnce = true`:
  - set banner status to `reconnecting`
  - schedule the next reconnect attempt using the next delay
  - increment `reconnectAttemptCount` to match the scheduled attempt number
- If all 5 attempts fail:
  - set banner status to `failed`
  - leave the attempt count at `5`
- `retryReconnect()`:
  - clears any pending reconnect timer
  - resets `reconnectAttemptCount` to `0`
  - immediately starts a fresh reconnect attempt
  - if the socket still cannot recover, the retry ladder begins again from attempt `1`

## Reconnect Lifecycle

### Hook-level orchestration

`useOnlineSession` should treat reconnecting as a socket concern, not a game concern.

On socket `ready`:

- mark the connection state as ready
- set `hasConnectedOnce = true`
- set banner status to `connected`
- reset `reconnectAttemptCount` to `0`
- clear any pending reconnect timer
- allow `OnlineSocketClient` to send the `hello` handshake automatically on open
- re-subscribe previously watched rooms by re-sending `room_watch` for each room in `watchedRoomsRef`

On socket `closed`:

- if the close was intentional because the session ended or the hook unmounted, do nothing
- if `hasConnectedOnce` is `false`, do not start reconnect banner behavior
- if `hasConnectedOnce` is `true`, begin the retry ladder

### Re-subscription scope

Current repo capabilities do not include a dedicated `match_watch` protocol message.

For this feature, “re-subscribe room or match” means:

- re-send `room_watch` for any watched room ids
- ensure the active online room assignment remains available so the existing room snapshot path can refresh

If a future `match_watch` message is added, it should plug into the same reconnect success path, but that is outside this scope.

## ConnectionBanner Component

Create `src/components/ConnectionBanner.tsx` with:

- props:
  - `status: "connected" | "reconnecting" | "failed"`
  - `attemptCount: number`
  - `onRetry?: () => void`
  - `onGoToLobby?: () => void`

### Rendering rules

When `status = "connected"`:

- render nothing

When `status = "reconnecting"`:

- render a thin full-width banner fixed to the top of the viewport
- background: `#BA7517`
- text: white
- copy: `Connection lost — reconnecting... (attempt {attemptCount} of 5)`
- no close button
- add a subtle pulsing animation to the background

When `status = "failed"`:

- background: `#A32D2D`
- text: white
- copy: `Unable to reconnect. Your match may still be saved.`
- render inline actions:
  - `Try again`
  - `Go to lobby`

## Root App Integration

Render `ConnectionBanner` once in `App.tsx` at the root layout level so it appears above every screen.

The root app remains responsible for app-level navigation callbacks:

- `Try again` -> call `onlineSession.retryReconnect()`
- `Go to lobby` -> navigate to `/lobby` and discard current route-bound match UI state

Discarding current match UI state should mean clearing:

- `activeMatch`
- `activeRoomId`
- `pendingAction`
- any local banner-related error that would keep the player on a stale route

This is a UI/session reset, not a gameplay rules change.

## Styling Notes

The banner should be visually distinct but non-blocking:

- fixed to the top edge
- high enough z-index to stay above routed content
- compact height so it reads as a system notice rather than a modal

Because the app already has a fixed back button and an optional sticky guest banner, use a shared top offset strategy so those controls remain visible when the connection banner is present.

## Testing Strategy

### Pure model tests

Create a small reconnect model helper to make retry behavior testable without mounting React hooks.

Test:

- delay table returns `1000`, `2000`, `4000`, `8000`, `16000`
- no reconnect banner before first successful connection
- reconnect success resets attempt count and returns banner status to `connected`
- 5 failed attempts end in `failed`
- manual retry resets the counter and starts again from attempt `1`

### Existing transport tests

Keep the existing socket client tests and extend only where it adds value, especially around reconnect-safe behavior such as repeated `connect()` calls leading to a fresh handshake after a close.

### Verification commands

At minimum, implementation should end with:

- targeted reconnect model tests
- existing online session and socket tests that still apply
- production build passing

## Delivery Notes

Implement this feature without changing turn flow, board state, or room/match rules.

The success bar is:

- players see clear reconnect feedback after a real mid-session disconnect
- the banner never appears for first-connect failures
- retry behavior is deterministic and capped
- reconnect success quietly clears the banner and resumes room subscriptions
