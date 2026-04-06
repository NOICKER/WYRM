import type {
  ClientMatchView,
  MatchActionPayload,
  OnlineProfile,
} from "../src/online/protocol.ts";
import {
  actionDeploy,
  actionDiscard,
  actionDraw,
  actionEndTurn,
  actionMove,
  actionPlaceCoilTrail,
  actionPlayTile,
  actionRoll,
  actionSetCoilChoice,
  actionStartNewGame,
} from "../src/state/gameEngine.ts";
import { cloneState } from "../src/state/gameLogic.ts";
import type { GameState } from "../src/state/types.ts";
import { createSeat, generateAssemblyCode, type AssemblyRoom } from "../src/ui/appModel.ts";
import type { SocketLike } from "./clientRegistry.ts";

type MatchPlayerId = 1 | 4;

interface MatchParticipant {
  clientId: string;
  profile: OnlineProfile;
}

interface StoredSeat {
  id: string;
  clientId: string;
  name: string;
  level: number;
  host: boolean;
  playerId: MatchPlayerId;
  color: "purple" | "amber";
}

export interface MatchRecord {
  roomId: string;
  matchId: string;
  createdAt: number;
  seatCount: 2;
  timer: "60s";
  boardVariant: "sacred_grove";
  matchStatus: "active" | "closed";
  reconnectDeadlineMinutes: number;
  players: [StoredSeat, StoredSeat];
  state: GameState;
  playerSockets: Map<string, Set<SocketLike>>;
}

export interface ApplyMatchActionResult {
  status: "accepted" | "invalid" | "not_found" | "not_seated" | "not_turn";
  roomId?: string;
  matchId?: string;
  error?: string;
}

interface MatchmakingRoomStoreOptions {
  createRoomId?: () => string;
  createMatchId?: () => string;
  now?: () => number;
}

export class MatchmakingRoomStore {
  private readonly createRoomId: () => string;

  private readonly createMatchId: () => string;

  private readonly now: () => number;

  private readonly matches = new Map<string, MatchRecord>();

  private readonly roomIdsByMatchId = new Map<string, string>();

  constructor(options: MatchmakingRoomStoreOptions = {}) {
    this.createRoomId = options.createRoomId ?? (() => generateAssemblyCode());
    this.createMatchId =
      options.createMatchId ?? (() => `match-${Math.random().toString(36).slice(2, 10)}`);
    this.now = options.now ?? (() => Date.now());
  }

  createMatch(participants: [MatchParticipant, MatchParticipant]): MatchRecord {
    const roomId = this.createRoomId();
    const matchId = this.createMatchId();
    const players: [StoredSeat, StoredSeat] = [
      {
        id: "seat-1",
        clientId: participants[0].clientId,
        name: participants[0].profile.username,
        level: participants[0].profile.level,
        host: true,
        playerId: 1,
        color: "purple",
      },
      {
        id: "seat-2",
        clientId: participants[1].clientId,
        name: participants[1].profile.username,
        level: participants[1].profile.level,
        host: false,
        playerId: 4,
        color: "amber",
      },
    ];
    const record: MatchRecord = {
      roomId,
      matchId,
      createdAt: this.now(),
      seatCount: 2,
      timer: "60s",
      boardVariant: "sacred_grove",
      matchStatus: "active",
      reconnectDeadlineMinutes: 30,
      players,
      state: actionStartNewGame(2),
      playerSockets: new Map(players.map((seat) => [seat.clientId, new Set<SocketLike>()])),
    };
    this.matches.set(roomId, record);
    this.roomIdsByMatchId.set(matchId, roomId);
    return record;
  }

  getMatch(roomId: string): MatchRecord | null {
    return this.matches.get(roomId) ?? null;
  }

  getMatchById(matchId: string): MatchRecord | null {
    const roomId = this.roomIdsByMatchId.get(matchId);
    if (!roomId) {
      return null;
    }
    return this.matches.get(roomId) ?? null;
  }

  getAssemblyRoom(roomId: string, viewerClientId: string): AssemblyRoom | null {
    const record = this.matches.get(roomId);
    if (!record) {
      return null;
    }

    return {
      id: record.roomId,
      code: record.roomId,
      timer: record.timer,
      boardVariant: record.boardVariant,
      serverName: "Matchmaking Queue",
      latencyMs: 42,
      autoBeginWhenReady: false,
      matchStatus: record.matchStatus,
      disconnectedSeatName: null,
      reconnectDeadlineMinutes: record.reconnectDeadlineMinutes,
      seats: record.players.map((seat) =>
        createSeat({
          id: seat.id,
          name: seat.name,
          level: seat.level,
          occupied: true,
          ready: false,
          host: seat.host,
          currentUser: seat.clientId === viewerClientId,
          playerId: seat.playerId,
          color: seat.color,
        }),
      ),
    };
  }

  joinMatch(roomId: string, clientId: string): ClientMatchView | null {
    const record = this.matches.get(roomId);
    if (!record) {
      return null;
    }

    return this.buildMatchView(record, clientId);
  }

  attachPlayerSocket(roomId: string, clientId: string, socket: SocketLike): boolean {
    const record = this.matches.get(roomId);
    if (!record) {
      return false;
    }

    const sockets = record.playerSockets.get(clientId);
    if (!sockets) {
      return false;
    }

    sockets.add(socket);
    return true;
  }

  removeSocket(socket: SocketLike): void {
    for (const record of this.matches.values()) {
      for (const sockets of record.playerSockets.values()) {
        sockets.delete(socket);
      }
    }
  }

  getConnectedPlayerSockets(roomId: string): SocketLike[] {
    const record = this.matches.get(roomId);
    if (!record) {
      return [];
    }

    return [...new Set([...record.playerSockets.values()].flatMap((sockets) => [...sockets]))];
  }

  getMatchViews(roomId: string): ClientMatchView[] {
    const record = this.matches.get(roomId);
    if (!record) {
      return [];
    }

    return record.players
      .map((seat) => this.buildMatchView(record, seat.clientId))
      .filter((view): view is ClientMatchView => view !== null);
  }

  applyMatchAction(matchId: string, clientId: string, action: MatchActionPayload): ApplyMatchActionResult {
    const record = this.getMatchById(matchId);
    if (!record) {
      return { status: "not_found" };
    }

    const seat = record.players.find((entry) => entry.clientId === clientId);
    if (!seat) {
      return {
        status: "not_seated",
        roomId: record.roomId,
        matchId: record.matchId,
      };
    }

    const currentPlayer = record.state.players[record.state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== seat.playerId) {
      return {
        status: "not_turn",
        roomId: record.roomId,
        matchId: record.matchId,
      };
    }

    const nextState = applyMatchAction(record.state, action);
    if (nextState.error) {
      return {
        status: "invalid",
        roomId: record.roomId,
        matchId: record.matchId,
        error: nextState.error,
      };
    }

    record.state = nextState;
    return {
      status: "accepted",
      roomId: record.roomId,
      matchId: record.matchId,
    };
  }

  private buildMatchView(record: MatchRecord, clientId: string): ClientMatchView | null {
    const seat = record.players.find((entry) => entry.clientId === clientId);
    if (!seat) {
      return null;
    }

    return {
      roomId: record.roomId,
      matchId: record.matchId,
      viewerPlayerId: seat.playerId,
      state: cloneState(record.state),
    };
  }
}

function applyMatchAction(state: GameState, action: MatchActionPayload): GameState {
  switch (action.type) {
    case "draw":
      return actionDraw(state);
    case "discard":
      return actionDiscard(state, action.tiles);
    case "roll":
      return actionRoll(state);
    case "set_coil_choice":
      return actionSetCoilChoice(state, action.choice);
    case "move":
      return actionMove(state, action.wyrmId, action.path, action.moveMode);
    case "place_coil_trail":
      return actionPlaceCoilTrail(state, action.wyrmId, action.target);
    case "deploy":
      return actionDeploy(state, action.wyrmId, action.target);
    case "play_tile":
      return actionPlayTile(state, action.request);
    case "end_turn":
      return actionEndTurn(state);
  }
}
