import assert from "node:assert/strict";

import { OnlineSocketClient } from "../src/online/socketClient.ts";

class FakeSocket {
  readyState = 0;

  sent: string[] = [];

  onopen: ((event: unknown) => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: ((event: unknown) => void) | null = null;

  onerror: ((event: unknown) => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({});
  }

  fireOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  fireMessage(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const fakeSocket = new FakeSocket();
const messages: string[] = [];
const states: string[] = [];

const client = new OnlineSocketClient({
  url: "ws://example.test/socket",
  clientId: "11111111-1111-4111-8111-111111111111",
  profile: {
    username: "Sable Quill",
    level: 7,
  },
  createSocket: () => fakeSocket,
  onMessage: (message) => messages.push(message.type),
  onStateChange: (state) => states.push(state),
});

client.connect();
client.send({ type: "queue_join" });

assert.deepEqual(fakeSocket.sent, [], "messages should wait until the socket is open");

fakeSocket.fireOpen();

assert.deepEqual(
  fakeSocket.sent.map((message) => JSON.parse(message)),
  [
    {
      type: "hello",
      clientId: "11111111-1111-4111-8111-111111111111",
      profile: {
        username: "Sable Quill",
        level: 7,
      },
    },
    { type: "queue_join" },
  ],
  "the hello handshake should be sent before queued application messages",
);

fakeSocket.fireMessage({ type: "ping", ts: 99 });
fakeSocket.fireMessage({ type: "room_not_found", roomId: "ARC-1-2026" });
fakeSocket.fireMessage({ type: "queue_joined" });

assert.deepEqual(
  messages,
  ["room_not_found", "queue_joined"],
  "non-heartbeat messages should flow through to the session layer unchanged",
);
assert.deepEqual(
  JSON.parse(fakeSocket.sent[2] ?? "{}"),
  { type: "pong", ts: 99 },
  "server heartbeat pings should trigger a pong reply",
);
assert.deepEqual(states, ["connecting", "ready"], "socket lifecycle state should be surfaced to the app");

console.log("Socket client test suite passed.");
