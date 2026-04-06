# Matchmaking Backend Design

Date: 2026-04-06
Status: Proposed
Scope: Real backend scaffold for online matchmaking and server-created rooms. This does not yet make gameplay server-authoritative.

## Current State

The repo currently runs as a client-only application:

- Online room creation and joins are simulated inside `src/App.tsx`.
- Assembly rooms are seeded with `seedHostRoom` and `seedGuestRoom`.
- There is no backend process, no socket transport layer, and no shared room state between browsers.
- Local pass-and-play already exists and must remain untouched.

This means a solo player has no way to discover and enter a match with a real opponent.

## Goals

Implement a minimal real backend in this repo that supports:

- A WebSocket server
- FIFO 2-player matchmaking queue
- Queue join, leave, match found, and queue timeout events
- A 3-minute queue timeout
- Server-side room creation for matched players
- Server-side match record initialization
- A profile handshake that binds the connected player identity to a socket
- A stable `clientId` passed during handshake
- Application-level ping/pong heartbeats for dead-socket detection
- Client support for both:
  - existing local/private room flows
  - new backend-created matchmaking rooms

## Non-Goals

This phase explicitly does not include:

- server-authoritative move validation or gameplay synchronization
- ELO, MMR, or skill-based matchmaking
- persistence to a database
- reconnecting to an in-progress online match after a full page refresh
- replacing the current private-room create/join flow with backend rooms

## Recommended Architecture

Use a lightweight in-repo Node WebSocket backend plus a small client socket layer.

### Why this approach

- It satisfies the requirement for a real backend without turning this task into a full multiplayer rewrite.
- It lets us keep current client-only private/local flows working while adding real matchmaking beside them.
- It creates the server-side primitives we will need for the next phase, where actual match state will be synchronized between players.

## Backend Design

Create a new `server/` directory with focused modules.

### Modules

`server/index.ts`

- Starts the HTTP server and WebSocket server
- Accepts socket connections
- Parses incoming messages
- Delegates to queue and room services

`server/protocol.ts`

- Defines inbound and outbound message types
- Centralizes message validation and serialization helpers

`server/clientRegistry.ts`

- Tracks connected clients by socket
- Stores bound profile data after handshake
- Stores queue timer references and current queue state
- Stores stable `clientId` per connected socket
- Tracks heartbeat metadata such as last pong timestamp

`server/matchmakingQueue.ts`

- Owns the in-memory FIFO waiting list
- Supports enqueue, dequeue, removal by socket, timeout handling, and pair matching
- Emits queue lifecycle events through callbacks

`server/roomStore.ts`

- Creates and stores server-created matchmaking rooms
- Creates initial 2-seat room snapshots
- Creates an initial match record with `roomId`, `matchId`, and room metadata
- Returns room snapshots for assembly clients

`server/roomMappers.ts`

- Converts backend room records into the existing `AssemblyRoom` client shape
- Keeps the client assembly UI working without a full rewrite

### Backend Data Model

#### Connected client

- `socket`
- `clientId`
- `profile`
  - `username`
  - `level`
  - `isGuest`
- `queueJoinedAt`
- `queueTimeoutId`
- `matchedRoomId`
- `lastPongAt`
- `heartbeatMissCount`

#### Matchmaking room

- `roomId`
- `matchId`
- `createdAt`
- `seatCount = 2`
- `timer = "60s"`
- `boardVariant = "sacred_grove"`
- `matchStatus = "active"`
- `reconnectDeadlineMinutes = 30`
- `players`
  - seat 1
  - seat 2

The room snapshot sent to the client should match the existing `AssemblyRoom` / `AssemblySeat` shape closely enough that `AssemblyLobbyScreen` can render without a second UI path.

### Protocol

#### Client -> Server

`{ type: "hello", clientId, profile: { username, level, isGuest? } }`

- Required before matchmaking actions
- Binds the authenticated client profile to the socket
- `clientId` is a UUID generated client-side and reused for the browser session

`{ type: "pong", ts }`

- Sent in response to server heartbeat pings
- Allows the backend to detect dead sockets and clean up queue entries promptly

`{ type: "queue_join" }`

- Adds the socket to the FIFO queue if it has already completed handshake
- Ignored or rejected if the client is already queued

`{ type: "queue_leave" }`

- Removes the client from the queue
- Clears any queue timeout

`{ type: "room_watch", roomId }`

- Subscribes the socket to a specific server-created room
- Returns the current room snapshot for assembly rendering

#### Server -> Client

`{ type: "queue_joined" }`

- Confirms the queue request was accepted

`{ type: "queue_left" }`

- Confirms the queue leave request was processed

`{ type: "queue_matched", roomId, matchId }`

- Sent to both matched clients
- The payload matches the requested shape exactly

`{ type: "room_joined", roomId, matchId }`

- Sent after the server has successfully assigned the client to the newly created room
- Confirms room membership before the assembly client starts `room_watch`

`{ type: "queue_timeout" }`

- Sent after 3 minutes with no match
- Removes the player from queue first

`{ type: "ping", ts }`

- Sent by the server on a fixed interval
- Expects a `pong` response from the client

`{ type: "room_snapshot", roomId, room }`

- Sent in response to `room_watch`
- Provides the `AssemblyRoom` snapshot needed to render `/assembly/:roomId`

`{ type: "room_not_found", roomId }`

- Sent when a watched room ID does not exist
- Allows the client to render a dedicated room-not-found state instead of a generic inline error

`{ type: "room_closed", roomId, reason }`

- Sent when a room existed but can no longer be joined
- `reason` is structured so the client can distinguish timeout-driven expiry from future close reasons

`{ type: "room_full", roomId, reconnectTokenValid }`

- Sent when a room has no available seats
- `reconnectTokenValid` tells the client whether the viewer can reclaim a seat or should see the full-room recovery flow

`{ type: "match_not_found", matchId }`

- Sent when the backend cannot resolve a requested match ID
- Gives the client a typed match recovery state instead of a redirect with no context

`{ type: "error", message }`

- Sent for invalid actions such as queueing before handshake

### Matchmaking Flow

1. Client authenticates in the existing frontend and reaches the lobby.
2. Client socket connects and sends `hello`.
3. User clicks `Find opponent`.
4. Client sends `queue_join` then navigates to `/matchmaking`.
5. Backend enqueues the client and starts a 3-minute timeout.
6. When a second queued player is available:
   - backend removes both from queue
   - backend clears both timeout timers
   - backend creates a 2-seat room and `matchId`
   - backend emits `queue_matched` to both sockets
   - backend emits `room_joined` to both sockets once seat assignment is complete
7. Each client navigates to `/assembly/:roomId`.
8. On the assembly route, client sends `room_watch`.
9. Backend responds with `room_snapshot`.
10. Existing assembly screen renders the backend-created room.
11. Throughout the session, server heartbeat `ping` messages expect client `pong` replies.

### Queue Semantics

- Strict FIFO ordering
- One socket may only appear in the queue once
- No queue position is exposed to clients
- Client UI only knows:
  - searching
  - matched
  - timed out

### Disconnect Handling

If a queued client disconnects:

- remove them from the queue
- clear their timeout
- remove them from the client registry

If a client stops responding to heartbeat:

- treat the socket as dead
- remove them from the queue if still queued
- clear their timeout
- close the socket and remove them from the client registry

If a matched client disconnects after match creation but before gameplay sync is implemented:

- do not destroy the room automatically in this phase
- leave the room snapshot in memory for future phases
- no reconnect feature is promised yet

## Client Design

Add an online transport layer while preserving current local/private flows.

### Client Modules

`src/online/protocol.ts`

- Shared client-side message types matching the backend protocol

`src/online/socketClient.ts`

- Wraps the browser `WebSocket`
- Handles connect, send, event listeners, and cleanup
- Sends `hello` with stable `clientId`
- Replies to server `ping` with `pong`

`src/online/useOnlineSession.ts` or app-level socket state

- Stores:
  - socket connection state
  - stable `clientId`
  - last queue state
  - backend rooms by `roomId`
  - latest matched `matchId`
  - latest typed route error for room and match recovery surfaces
- Exposes methods:
  - `connect(profile)`
  - `queueJoin()`
  - `queueLeave()`
  - `watchRoom(roomId)`

The implementation can live at the `App.tsx` level initially if that reduces churn. The key requirement is keeping matchmaking state distinct from current local/private room simulation.

### Routing

Extend `AppRoute` with:

- `{ name: "matchmaking" }`

Update `parseAppRoute` / `toPath` for:

- `/matchmaking`

### Matchmaking Screen

Create `src/screens/MatchmakingScreen.tsx` with:

- heading: `Finding an opponent`
- `LoadingPulse`
- subtext rotation every 8 seconds across the provided three strings
- elapsed timer in `mm:ss`
- `Cancel` button
- timeout message state with retry and back controls

Behavior:

- on mount, if socket is not connected or handshake is not ready, redirect to `/lobby` with an error
- searching state is active after `queue_join`
- on `queue_matched`, navigate to `/assembly/:roomId`
- on `room_joined`, mark the matchmaking flow as assigned and ready for `room_watch`
- on `queue_timeout`, replace the searching state with the requested inline message
- retry sends `queue_join` again and returns to searching state

### Lobby Changes

Add a third CTA below the existing create/join actions:

- label: `Find opponent`
- click behavior:
  - send `queue_join`
  - navigate to `/matchmaking`

Private-room create/join continues to use the current client-only flow for now.

### App State Changes

`App.tsx` must support two sources of assembly rooms:

1. Local/client-seeded rooms
2. Server-created matchmaking rooms

Recommended shape:

- keep existing `rooms` for local/private flows
- add `onlineRooms` keyed by `roomId`
- on assembly route:
  - if `rooms[roomId]` exists, use the current path
  - else if `onlineRooms[roomId]` exists, render that room
  - else request `room_watch(roomId)` and render a loading state until snapshot arrives

This keeps the local/private feature set intact while making server-backed rooms first-class.

### Route Error UX

Add a dedicated `src/screens/RoomErrorScreen.tsx` for route-driven dead ends.

- `not_found`
  - heading: `Room not found`
  - body: `This room code does not exist. Check the code and try again.`
  - button: `Back to lobby`
- `expired`
  - heading: `This room has closed`
  - body: `The room expired after 30 minutes of inactivity. Create a new room to play.`
  - button: `Create a new room`
- `full`
  - heading: `Room is full`
  - body: `All seats are taken in this room. Ask for a new link or create your own room.`
  - button: `Create a new room`
- `match_not_found`
  - heading: `Match not found`
  - body: `This match does not exist or has ended.`
  - button: `Back to lobby`

Behavior:

- `/assembly/:roomId`
  - `room_not_found` -> render `RoomErrorScreen("not_found")`
  - `room_closed` with `reason = "disconnect_timeout"` -> render `RoomErrorScreen("expired")`
  - `room_full` with `reconnectTokenValid = false` -> render `RoomErrorScreen("full")`
- `/match/:matchId`
  - invalid or ended matches render `RoomErrorScreen("match_not_found")`

The screen should sit on the existing deep-green background, use the parchment card treatment, show the WYRM wordmark at the top, and reuse the amber button styling already established in the app.

### One-Shot Lobby Intent

The `Create a new room` recovery action must not use a query string or any persistent browser storage.

Recommended shape:

- keep a transient app-level lobby intent such as `{ type: "auto_create_room" } | null`
- when the user chooses `Create a new room` from an expired or full room error:
  - set the lobby intent
  - navigate to `/lobby`
- when the lobby screen mounts with that intent present:
  - trigger the existing create-room flow once
  - clear the intent immediately

This ensures `/lobby` refreshes do not create duplicate rooms. Only an explicit click or a fresh navigation that sets the in-memory intent should start room creation.

## Error Handling

### Backend

- Reject `queue_join` before `hello`
- Ignore duplicate queue joins from the same socket
- Ignore `queue_leave` if not queued
- Reply with `room_not_found` for unknown room IDs
- Reject malformed or missing `clientId` in `hello`
- Guard against sending to closed sockets
- Close sockets that miss heartbeat responses beyond the configured threshold

### Client

- If socket is unavailable when entering `/matchmaking`, return to `/lobby`
- If a room snapshot never arrives after `queue_matched`, prefer a typed room route error over a generic inline assembly error
- If the socket closes while searching, show an inline connection error and allow retry/back
- If the socket reconnects later, reuse the same generated `clientId` for the browser session
- If the user recovers from an expired or full room, carry the recovery through a one-shot in-memory lobby intent so refreshes do not recreate rooms

## Testing Strategy

### Backend unit tests

Add focused tests for:

- FIFO dequeue behavior
- timeout removal after 3 minutes
- explicit `queue_leave`
- disconnect removal
- heartbeat timeout removal
- room creation shape for two matched players

### Client tests

Add targeted tests for:

- route parsing for `/matchmaking`
- matchmaking subtext rotation helper
- elapsed timer formatting helper
- stable `clientId` generation / reuse helper
- lobby CTA presence and callback behavior
- structured room and match route error mapping
- one-shot lobby intent consumption

### Verification commands

At minimum, the implementation phase should end with:

- targeted backend tests
- existing frontend test suites that still apply
- production build passing

## Delivery Plan

Implement in this order:

1. Backend server scaffold and protocol
2. Matchmaking queue service with tests
3. Heartbeat handling and dead-socket cleanup
4. Room store and room snapshot flow
5. Client socket connection and handshake
6. `/matchmaking` route and screen
7. Lobby CTA and app-level room integration
8. End-to-end verification between two browser sessions

## Future Follow-Up

The next phase will build on this scaffold to synchronize real match state between players:

- server-authoritative turn actions
- room broadcasts during gameplay
- reconnect and resume behavior
- private-room backend parity
