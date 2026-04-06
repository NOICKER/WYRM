import type { HelloMessage, OnlineProfile } from "../src/online/protocol.ts";

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface RegisteredClient {
  socket: SocketLike;
  clientId: string | null;
  profile: OnlineProfile | null;
  queueJoinedAt: number | null;
  matchedRoomId: string | null;
  lastPongAt: number | null;
  heartbeatMissCount: number;
}

interface ClientRegistryOptions {
  allowedHeartbeatMisses?: number;
  now?: () => number;
}

export class ClientRegistry {
  private readonly clients = new Map<SocketLike, RegisteredClient>();

  private readonly allowedHeartbeatMisses: number;

  private readonly now: () => number;

  constructor(options: ClientRegistryOptions = {}) {
    this.allowedHeartbeatMisses = options.allowedHeartbeatMisses ?? 2;
    this.now = options.now ?? (() => Date.now());
  }

  register(socket: SocketLike): RegisteredClient {
    const client: RegisteredClient = {
      socket,
      clientId: null,
      profile: null,
      queueJoinedAt: null,
      matchedRoomId: null,
      lastPongAt: null,
      heartbeatMissCount: 0,
    };
    this.clients.set(socket, client);
    return client;
  }

  unregister(socket: SocketLike): RegisteredClient | null {
    const existing = this.clients.get(socket) ?? null;
    if (existing) {
      this.clients.delete(socket);
    }
    return existing;
  }

  getBySocket(socket: SocketLike): RegisteredClient | null {
    return this.clients.get(socket) ?? null;
  }

  getByClientId(clientId: string): RegisteredClient | null {
    for (const client of this.clients.values()) {
      if (client.clientId === clientId) {
        return client;
      }
    }
    return null;
  }

  getAll(): RegisteredClient[] {
    return [...this.clients.values()];
  }

  bindHello(socket: SocketLike, message: HelloMessage): RegisteredClient | null {
    const client = this.clients.get(socket);
    if (!client) {
      return null;
    }
    client.clientId = message.clientId;
    client.profile = message.profile;
    client.lastPongAt = this.now();
    client.heartbeatMissCount = 0;
    return client;
  }

  markQueued(socket: SocketLike): RegisteredClient | null {
    const client = this.clients.get(socket);
    if (!client) {
      return null;
    }
    client.queueJoinedAt = this.now();
    return client;
  }

  clearQueue(socket: SocketLike): RegisteredClient | null {
    const client = this.clients.get(socket);
    if (!client) {
      return null;
    }
    client.queueJoinedAt = null;
    return client;
  }

  markMatched(socket: SocketLike, roomId: string): RegisteredClient | null {
    const client = this.clients.get(socket);
    if (!client) {
      return null;
    }
    client.matchedRoomId = roomId;
    client.queueJoinedAt = null;
    return client;
  }

  acceptPong(socket: SocketLike, ts: number): RegisteredClient | null {
    const client = this.clients.get(socket);
    if (!client) {
      return null;
    }
    client.lastPongAt = ts;
    client.heartbeatMissCount = 0;
    return client;
  }

  markHeartbeatSweep(): RegisteredClient[] {
    const stale: RegisteredClient[] = [];
    for (const client of this.clients.values()) {
      client.heartbeatMissCount += 1;
      if (client.heartbeatMissCount >= this.allowedHeartbeatMisses) {
        stale.push(client);
      }
    }
    return stale;
  }
}
