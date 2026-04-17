import { createServer } from "node:http";

import { WebSocketServer, WebSocket, type RawData } from "ws";

import { ClientRegistry } from "./clientRegistry.ts";
import type { QueueEntry } from "./matchmakingQueue.ts";
import { MatchmakingQueue } from "./matchmakingQueue.ts";
import { parseClientMessage, serializeServerMessage } from "./protocol.ts";
import { MatchmakingRoomStore } from "./roomStore.ts";

const PORT = Number(process.env.PORT ?? 8787);
const MATCHMAKING_TIMEOUT_MS = Number(process.env.MATCHMAKING_TIMEOUT_MS ?? 180_000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 15_000);
const HEARTBEAT_MISS_LIMIT = Number(process.env.HEARTBEAT_MISS_LIMIT ?? 2);

const registry = new ClientRegistry({
  allowedHeartbeatMisses: HEARTBEAT_MISS_LIMIT,
});
const roomStore = new MatchmakingRoomStore();

function send(socket: WebSocket, message: Parameters<typeof serializeServerMessage>[0]): boolean {
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  socket.send(serializeServerMessage(message));
  return true;
}

function sendStateSync(roomId: string, clientId: string, socket: WebSocket): boolean {
  const view = roomStore.joinMatch(roomId, clientId);
  if (!view) {
    return false;
  }

  return send(socket, {
    type: "state_sync",
    match: view,
  });
}

function broadcastStateSync(roomId: string): void {
  const record = roomStore.getMatch(roomId);
  if (!record) {
    return;
  }

  for (const [clientId, sockets] of record.playerSockets.entries()) {
    const view = roomStore.joinMatch(roomId, clientId);
    if (!view) {
      continue;
    }

    for (const socket of sockets) {
      send(socket as WebSocket, {
        type: "state_sync",
        match: view,
      });
    }
  }
}

function cleanupSocket(socket: WebSocket): void {
  const client = registry.getBySocket(socket);
  if (client?.clientId) {
    queue.removeByClientId(client.clientId);
  }
  roomStore.removeSocket(socket);
  registry.unregister(socket);
}

function handleMatchedEntries(entries: [QueueEntry, QueueEntry]): void {
  const record = roomStore.createMatch([
    {
      clientId: entries[0].clientId,
      profile: entries[0].profile,
    },
    {
      clientId: entries[1].clientId,
      profile: entries[1].profile,
    },
  ]);

  for (const entry of entries) {
    const socket = entry.socket as WebSocket;
    registry.clearQueue(socket);
    registry.markMatched(socket, record.roomId);
    send(socket, {
      type: "queue_matched",
      roomId: record.roomId,
      matchId: record.matchId,
    });
  }
}

const queue = new MatchmakingQueue({
  timeoutMs: MATCHMAKING_TIMEOUT_MS,
  onTimeout: (entry) => {
    const socket = entry.socket as WebSocket;
    registry.clearQueue(socket);
    send(socket, { type: "queue_timeout" });
  },
});

const server = createServer((_, response) => {
  response.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  response.end("WYRM matchmaking server is running.\n");
});

const websocketServer = new WebSocketServer({ server });

websocketServer.on("connection", (socket: WebSocket) => {
  registry.register(socket);

  socket.on("message", (data: RawData) => {
    const raw = typeof data === "string" ? data : data.toString();
    const message = parseClientMessage(raw);
    if (!message) {
      send(socket, { type: "error", message: "Malformed socket message." });
      return;
    }

    if (message.type === "hello") {
      registry.bindHello(socket, message);
      return;
    }

    const client = registry.getBySocket(socket);
    if (!client?.clientId || !client.profile) {
      send(socket, { type: "error", message: "Complete the hello handshake before matchmaking actions." });
      return;
    }

    switch (message.type) {
      case "pong":
        registry.acceptPong(socket, message.ts);
        return;
      case "queue_join": {
        const result = queue.enqueue({
          clientId: client.clientId,
          profile: client.profile,
          socket,
        });
        if (result.status === "duplicate") {
          send(socket, { type: "queue_joined" });
          return;
        }
        registry.markQueued(socket);
        if (result.status === "waiting") {
          send(socket, { type: "queue_joined" });
          return;
        }
        handleMatchedEntries(result.entries);
        return;
      }
      case "queue_leave":
        queue.removeByClientId(client.clientId);
        registry.clearQueue(socket);
        send(socket, { type: "queue_left" });
        return;
      case "leave_room":
        roomStore.removeSocket(socket);
        return;
      case "room_watch": {
        const record = roomStore.getMatch(message.roomId);
        if (!record) {
          send(socket, { type: "room_not_found", roomId: message.roomId });
          return;
        }
        if (record.matchStatus !== "active") {
          send(socket, {
            type: "room_closed",
            roomId: message.roomId,
            reason: "disconnect_timeout",
          });
          return;
        }
        const isSeatedViewer = record.players.some((seat) => seat.clientId === client.clientId);
        if (!isSeatedViewer) {
          send(socket, {
            type: "room_full",
            roomId: message.roomId,
            reconnectTokenValid: false,
          });
          return;
        }
        const room = roomStore.getAssemblyRoom(message.roomId, client.clientId);
        if (!room) {
          send(socket, { type: "room_not_found", roomId: message.roomId });
          return;
        }
        send(socket, {
          type: "room_snapshot",
          roomId: message.roomId,
          room,
        });
        return;
      }
      case "join_room": {
        const record = roomStore.getMatch(message.roomId);
        if (!record) {
          send(socket, { type: "room_not_found", roomId: message.roomId });
          return;
        }
        if (record.matchStatus !== "active") {
          send(socket, {
            type: "room_closed",
            roomId: message.roomId,
            reason: "disconnect_timeout",
          });
          return;
        }

        const view = roomStore.joinMatch(message.roomId, client.clientId);
        if (!view) {
          send(socket, {
            type: "room_full",
            roomId: message.roomId,
            reconnectTokenValid: false,
          });
          return;
        }

        roomStore.attachPlayerSocket(message.roomId, client.clientId, socket);
        registry.markMatched(socket, message.roomId);
        send(socket, {
          type: "room_joined",
          roomId: message.roomId,
          matchId: view.matchId,
        });
        sendStateSync(message.roomId, client.clientId, socket);
        return;
      }
      case "match_action": {
        const result = roomStore.applyMatchAction(message.matchId, client.clientId, message.action);

        switch (result.status) {
          case "not_found":
            send(socket, {
              type: "match_not_found",
              matchId: message.matchId,
            });
            return;
          case "not_seated":
            send(socket, {
              type: "error",
              message: "Join the room before sending match actions.",
            });
            return;
          case "not_turn":
            send(socket, {
              type: "error",
              message: "Wait for your turn before acting.",
            });
            return;
          case "invalid":
            send(socket, {
              type: "error",
              message: result.error ?? "That action is not valid right now.",
            });
            return;
          case "accepted":
            if (result.roomId) {
              broadcastStateSync(result.roomId);
            }
            return;
          default:
            return;
        }
      }
      default:
        return;
    }
  });

  socket.on("close", () => {
    cleanupSocket(socket);
  });
});

const heartbeat = setInterval(() => {
  const staleClients = new Set(registry.markHeartbeatSweep().map((client) => client.socket));

  for (const client of registry.getAll()) {
    const socket = client.socket as WebSocket;
    if (staleClients.has(socket)) {
      if (client.clientId) {
        queue.removeByClientId(client.clientId);
      }
      registry.unregister(socket);
      socket.close(4000, "heartbeat timeout");
      continue;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      cleanupSocket(socket);
      continue;
    }

    send(socket, { type: "ping", ts: Date.now() });
  }
}, HEARTBEAT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log("WYRM matchmaking server is running");
  console.log(`WebSocket ready on port ${PORT}`);
});

function shutdown(): void {
  clearInterval(heartbeat);
  websocketServer.close();
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
