import type { ClientMessage, OnlineProfile, ServerMessage } from "./protocol.ts";

export type SocketClientState = "connecting" | "ready" | "closed";

export interface WebSocketLike {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface OnlineSocketClientOptions {
  url: string;
  clientId: string;
  profile: OnlineProfile;
  createSocket?: (url: string) => WebSocketLike;
  onMessage: (message: ServerMessage) => void;
  onStateChange: (state: SocketClientState) => void;
}

type OutboundMessage = Exclude<ClientMessage, { type: "hello" }>;

function isServerMessage(value: unknown): value is ServerMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const message = value as Record<string, unknown>;
  return typeof message.type === "string";
}

export class OnlineSocketClient {
  private readonly url: string;

  private readonly clientId: string;

  private readonly profile: OnlineProfile;

  private readonly createSocket: (url: string) => WebSocketLike;

  private readonly onMessage: (message: ServerMessage) => void;

  private readonly onStateChange: (state: SocketClientState) => void;

  private readonly pendingMessages: OutboundMessage[] = [];

  private socket: WebSocketLike | null = null;

  constructor(options: OnlineSocketClientOptions) {
    this.url = options.url;
    this.clientId = options.clientId;
    this.profile = options.profile;
    this.createSocket =
      options.createSocket
      ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.onMessage = options.onMessage;
    this.onStateChange = options.onStateChange;
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) {
      return;
    }

    const socket = this.createSocket(this.url);
    this.socket = socket;
    this.onStateChange("connecting");

    socket.onopen = () => {
      this.sendRaw({
        type: "hello",
        clientId: this.clientId,
        profile: this.profile,
      });
      this.flushPending();
      this.onStateChange("ready");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as unknown;
        if (!isServerMessage(message)) {
          return;
        }
        if (message.type === "ping") {
          this.send({ type: "pong", ts: message.ts });
          return;
        }
        this.onMessage(message);
      } catch {
        // Ignore malformed server messages and keep the socket alive.
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.onStateChange("closed");
    };

    socket.onerror = () => {
      // The close event is the state transition we care about.
    };
  }

  send(message: OutboundMessage): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) {
      this.pendingMessages.push(message);
      return;
    }
    this.sendRaw(message);
  }

  close(code?: number, reason?: string): void {
    this.socket?.close(code, reason);
  }

  private flushPending(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (!message) {
        continue;
      }
      this.sendRaw(message);
    }
  }

  private sendRaw(message: ClientMessage): void {
    this.socket?.send(JSON.stringify(message));
  }
}
