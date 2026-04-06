import assert from "node:assert/strict";

import { MatchmakingQueue } from "../server/matchmakingQueue.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

{
  const timedOut: string[] = [];
  const queue = new MatchmakingQueue({
    timeoutMs: 50,
    onTimeout: (entry) => timedOut.push(entry.clientId),
  });

  const firstJoin = queue.enqueue({
    clientId: "client-a",
    profile: { username: "Aurel", level: 7 },
    socket: { label: "socket-a" },
  });
  const secondJoin = queue.enqueue({
    clientId: "client-b",
    profile: { username: "Briar", level: 9 },
    socket: { label: "socket-b" },
  });

  assert.equal(firstJoin.status, "waiting", "the first queued player should wait for an opponent");
  assert.equal(secondJoin.status, "matched", "the second queued player should trigger a match");
  assert.deepEqual(
    secondJoin.entries.map((entry) => entry.clientId),
    ["client-a", "client-b"],
    "matchmaking should pair players in FIFO order",
  );
  assert.equal(queue.size, 0, "matched players should be removed from the queue");
  assert.deepEqual(timedOut, [], "matched players should not later emit timeout callbacks");
}

{
  const timedOut: string[] = [];
  const queue = new MatchmakingQueue({
    timeoutMs: 15,
    onTimeout: (entry) => timedOut.push(entry.clientId),
  });

  queue.enqueue({
    clientId: "client-timeout",
    profile: { username: "Caligo", level: 4 },
    socket: { label: "socket-timeout" },
  });

  await delay(30);

  assert.deepEqual(
    timedOut,
    ["client-timeout"],
    "players who wait too long should be removed and reported as timed out",
  );
  assert.equal(queue.size, 0, "timed-out players should no longer remain in the queue");
}

{
  const timedOut: string[] = [];
  const queue = new MatchmakingQueue({
    timeoutMs: 15,
    onTimeout: (entry) => timedOut.push(entry.clientId),
  });

  queue.enqueue({
    clientId: "client-leave",
    profile: { username: "Dawn", level: 5 },
    socket: { label: "socket-leave" },
  });
  queue.removeByClientId("client-leave");

  await delay(30);

  assert.deepEqual(timedOut, [], "explicitly leaving the queue should cancel timeout callbacks");
  assert.equal(queue.size, 0, "queue leave should remove the player immediately");
}

console.log("Matchmaking queue test suite passed.");
