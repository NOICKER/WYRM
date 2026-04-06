import type {
  ClientMessage,
  MatchActionPayload,
  OnlineProfile,
  ServerMessage,
} from "../src/online/protocol.ts";
import type { Coord, MoveMode, RuneTileType, TilePlayRequest, WyrmId } from "../src/state/types.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProfile(value: unknown): value is OnlineProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.username === "string"
    && profile.username.trim().length > 0
    && typeof profile.level === "number"
    && Number.isFinite(profile.level)
    && (profile.isGuest === undefined || typeof profile.isGuest === "boolean")
  );
}

function isCoord(value: unknown): value is Coord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const coord = value as Record<string, unknown>;
  return typeof coord.row === "number" && typeof coord.col === "number";
}

function isCoordList(value: unknown): value is Coord[] {
  return Array.isArray(value) && value.every((entry) => isCoord(entry));
}

function isMoveMode(value: unknown): value is MoveMode {
  return value === "main" || value === "tempest";
}

function isRuneTileType(value: unknown): value is RuneTileType {
  return (
    value === "fire"
    || value === "water"
    || value === "earth"
    || value === "wind"
    || value === "shadow"
    || value === "light"
    || value === "void"
    || value === "serpent"
  );
}

function isRuneTileList(value: unknown): value is RuneTileType[] {
  return Array.isArray(value) && value.every((entry) => isRuneTileType(entry));
}

function isWyrmId(value: unknown): value is WyrmId {
  return typeof value === "string" && value.trim().length > 0;
}

function isTilePlayRequest(value: unknown): value is TilePlayRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Record<string, unknown>;
  if ((request.mode !== "single" && request.mode !== "lair") || !isRuneTileType(request.tile)) {
    return false;
  }
  if (request.wyrmId !== undefined && !isWyrmId(request.wyrmId)) {
    return false;
  }
  if (request.opponentId !== undefined && typeof request.opponentId !== "number") {
    return false;
  }
  if (request.targetCoords !== undefined && !isCoordList(request.targetCoords)) {
    return false;
  }
  if (request.swapWyrmIds !== undefined) {
    if (
      !Array.isArray(request.swapWyrmIds)
      || request.swapWyrmIds.length !== 2
      || !request.swapWyrmIds.every((entry) => isWyrmId(entry))
    ) {
      return false;
    }
  }
  if (request.teleportWyrmId !== undefined && !isWyrmId(request.teleportWyrmId)) {
    return false;
  }
  return true;
}

function isMatchAction(value: unknown): value is MatchActionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Record<string, unknown>;
  if (typeof action.type !== "string") {
    return false;
  }

  switch (action.type) {
    case "draw":
    case "roll":
    case "end_turn":
      return true;
    case "discard":
      return isRuneTileList(action.tiles);
    case "set_coil_choice":
      return action.choice === 1 || action.choice === 2 || action.choice === 3 || action.choice === "extra_trail";
    case "move":
      return isWyrmId(action.wyrmId) && isCoordList(action.path) && (action.moveMode === undefined || isMoveMode(action.moveMode));
    case "place_coil_trail":
      return isWyrmId(action.wyrmId) && (action.target === undefined || isCoord(action.target));
    case "deploy":
      return isWyrmId(action.wyrmId) && isCoord(action.target);
    case "play_tile":
      return isTilePlayRequest(action.request);
    default:
      return false;
  }
}

export function isValidClientId(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || typeof value.type !== "string") {
      return null;
    }

    switch (value.type) {
      case "hello":
        if (!isValidClientId(value.clientId) || !isProfile(value.profile)) {
          return null;
        }
        return {
          type: "hello",
          clientId: value.clientId,
          profile: value.profile,
        };
      case "pong":
        if (typeof value.ts !== "number") {
          return null;
        }
        return { type: "pong", ts: value.ts };
      case "queue_join":
        return { type: "queue_join" };
      case "queue_leave":
        return { type: "queue_leave" };
      case "room_watch":
        if (typeof value.roomId !== "string" || value.roomId.trim().length === 0) {
          return null;
        }
        return { type: "room_watch", roomId: value.roomId };
      case "join_room":
        if (typeof value.roomId !== "string" || value.roomId.trim().length === 0) {
          return null;
        }
        return { type: "join_room", roomId: value.roomId };
      case "leave_room":
        return { type: "leave_room" };
      case "match_action":
        if (typeof value.matchId !== "string" || value.matchId.trim().length === 0 || !isMatchAction(value.action)) {
          return null;
        }
        return {
          type: "match_action",
          matchId: value.matchId,
          action: value.action,
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}
