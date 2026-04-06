import type { OnlineProfile } from "../src/online/protocol.ts";
import type { SocketLike } from "./clientRegistry.ts";

export interface QueueEntry {
  clientId: string;
  profile: OnlineProfile;
  socket: SocketLike | object;
  queueJoinedAt: number;
}

interface QueueNode extends QueueEntry {
  timeoutId: ReturnType<typeof setTimeout>;
}

interface MatchmakingQueueOptions {
  timeoutMs?: number;
  now?: () => number;
  onTimeout?: (entry: QueueEntry) => void;
}

type EnqueueResult =
  | { status: "duplicate" }
  | { status: "waiting" }
  | { status: "matched"; entries: [QueueEntry, QueueEntry] };

export class MatchmakingQueue {
  private readonly timeoutMs: number;

  private readonly now: () => number;

  private readonly onTimeout: (entry: QueueEntry) => void;

  private readonly entries: QueueNode[] = [];

  constructor(options: MatchmakingQueueOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 180_000;
    this.now = options.now ?? (() => Date.now());
    this.onTimeout = options.onTimeout ?? (() => {});
  }

  get size(): number {
    return this.entries.length;
  }

  enqueue(entry: Omit<QueueEntry, "queueJoinedAt">): EnqueueResult {
    if (this.entries.some((current) => current.clientId === entry.clientId)) {
      return { status: "duplicate" };
    }

    const queueEntry: QueueNode = {
      ...entry,
      queueJoinedAt: this.now(),
      timeoutId: setTimeout(() => {
        const removed = this.removeByClientId(entry.clientId);
        if (removed) {
          this.onTimeout(removed);
        }
      }, this.timeoutMs),
    };
    this.entries.push(queueEntry);

    if (this.entries.length < 2) {
      return { status: "waiting" };
    }

    const first = this.shift();
    const second = this.shift();
    if (!first || !second) {
      return { status: "waiting" };
    }
    return { status: "matched", entries: [first, second] };
  }

  removeByClientId(clientId: string): QueueEntry | null {
    const index = this.entries.findIndex((entry) => entry.clientId === clientId);
    if (index < 0) {
      return null;
    }
    const [removed] = this.entries.splice(index, 1);
    if (!removed) {
      return null;
    }
    clearTimeout(removed.timeoutId);
    return this.toEntry(removed);
  }

  private shift(): QueueEntry | null {
    const entry = this.entries.shift();
    if (!entry) {
      return null;
    }
    clearTimeout(entry.timeoutId);
    return this.toEntry(entry);
  }

  private toEntry(entry: QueueNode): QueueEntry {
    return {
      clientId: entry.clientId,
      profile: entry.profile,
      socket: entry.socket,
      queueJoinedAt: entry.queueJoinedAt,
    };
  }
}
