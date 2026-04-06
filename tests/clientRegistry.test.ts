import assert from "node:assert/strict";

import { ClientRegistry } from "../server/clientRegistry.ts";

const registry = new ClientRegistry({
  allowedHeartbeatMisses: 2,
  now: () => 42,
});

const socket = {
  readyState: 1,
  send() {},
  close() {},
};

registry.register(socket);
registry.bindHello(socket, {
  type: "hello",
  clientId: "client-heartbeat",
  profile: {
    username: "Thorne",
    level: 12,
  },
});

assert.equal(
  registry.getBySocket(socket)?.lastPongAt,
  42,
  "binding the hello handshake should record the initial heartbeat timestamp",
);

const firstSweep = registry.markHeartbeatSweep();
assert.deepEqual(firstSweep, [], "a single missed pong should not yet evict the socket");
assert.equal(registry.getBySocket(socket)?.heartbeatMissCount, 1, "miss count should increment on each ping cycle");

registry.acceptPong(socket, 99);
assert.equal(registry.getBySocket(socket)?.heartbeatMissCount, 0, "a pong should reset the missed-heartbeat counter");
assert.equal(registry.getBySocket(socket)?.lastPongAt, 99, "a pong should refresh the last pong timestamp");

registry.markHeartbeatSweep();
const staleClients = registry.markHeartbeatSweep();
assert.deepEqual(
  staleClients.map((client) => client.clientId),
  ["client-heartbeat"],
  "clients that miss too many heartbeats should be surfaced for cleanup",
);

console.log("Client registry test suite passed.");
