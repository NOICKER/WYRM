import type { AssemblyRoom } from "../ui/appModel.ts";
import type {
  Coord,
  GameState,
  MoveMode,
  PlayerId,
  RuneTileType,
  TilePlayRequest,
  WyrmId,
} from "../state/types.ts";

export interface OnlineProfile {
  username: string;
  level: number;
}

export interface HelloMessage {
  type: "hello";
  clientId: string;
  profile: OnlineProfile;
}

export interface PongMessage {
  type: "pong";
  ts: number;
}

export interface QueueJoinMessage {
  type: "queue_join";
}

export interface QueueLeaveMessage {
  type: "queue_leave";
}

export interface RoomWatchMessage {
  type: "room_watch";
  roomId: string;
}

export interface JoinRoomMessage {
  type: "join_room";
  roomId: string;
}

export interface LeaveRoomMessage {
  type: "leave_room";
}

export type MatchActionPayload =
  | { type: "draw" }
  | { type: "discard"; tiles: RuneTileType[] }
  | { type: "roll" }
  | { type: "set_coil_choice"; choice: 1 | 2 | 3 | "extra_trail" }
  | { type: "move"; wyrmId: WyrmId; path: Coord[]; moveMode?: MoveMode }
  | { type: "place_coil_trail"; wyrmId: WyrmId; target?: Coord }
  | { type: "deploy"; wyrmId: WyrmId; target: Coord }
  | { type: "play_tile"; request: TilePlayRequest }
  | { type: "end_turn" };

export interface MatchActionMessage {
  type: "match_action";
  matchId: string;
  action: MatchActionPayload;
}

export type ClientMessage =
  | HelloMessage
  | PongMessage
  | QueueJoinMessage
  | QueueLeaveMessage
  | RoomWatchMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | MatchActionMessage;

export interface QueueJoinedMessage {
  type: "queue_joined";
}

export interface QueueLeftMessage {
  type: "queue_left";
}

export interface QueueMatchedMessage {
  type: "queue_matched";
  roomId: string;
  matchId: string;
}

export interface RoomJoinedMessage {
  type: "room_joined";
  roomId: string;
  matchId: string;
}

export interface ClientMatchView {
  roomId: string;
  matchId: string;
  viewerPlayerId: PlayerId;
  state: GameState;
}

export interface StateSyncMessage {
  type: "state_sync";
  match: ClientMatchView;
}

export interface QueueTimeoutMessage {
  type: "queue_timeout";
}

export interface PingMessage {
  type: "ping";
  ts: number;
}

export interface RoomSnapshotMessage {
  type: "room_snapshot";
  roomId: string;
  room: AssemblyRoom;
}

export interface RoomNotFoundMessage {
  type: "room_not_found";
  roomId: string;
}

export interface RoomClosedMessage {
  type: "room_closed";
  roomId: string;
  reason: string;
}

export interface RoomFullMessage {
  type: "room_full";
  roomId: string;
  reconnectTokenValid: boolean;
}

export interface MatchNotFoundMessage {
  type: "match_not_found";
  matchId: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type RouteErrorMessage =
  | RoomNotFoundMessage
  | RoomClosedMessage
  | RoomFullMessage
  | MatchNotFoundMessage;

export type ServerMessage =
  | QueueJoinedMessage
  | QueueLeftMessage
  | QueueMatchedMessage
  | RoomJoinedMessage
  | StateSyncMessage
  | QueueTimeoutMessage
  | PingMessage
  | RoomSnapshotMessage
  | RouteErrorMessage
  | ErrorMessage;
