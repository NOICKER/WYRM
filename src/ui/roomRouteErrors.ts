import type { RouteErrorMessage } from "../online/protocol.ts";

export type RoomErrorScreenReason = "not_found" | "expired" | "full" | "match_not_found";

export type LobbyIntent = { type: "auto_create_room" } | null;

export function mapRouteErrorToScreenReason(error: RouteErrorMessage | null): RoomErrorScreenReason | null {
  if (!error) {
    return null;
  }

  if (error.type === "room_not_found") {
    return "not_found";
  }

  if (error.type === "room_closed" && error.reason === "disconnect_timeout") {
    return "expired";
  }

  if (error.type === "room_full" && !error.reconnectTokenValid) {
    return "full";
  }

  if (error.type === "match_not_found") {
    return "match_not_found";
  }

  return null;
}

export function consumeLobbyIntent(intent: LobbyIntent): {
  shouldAutoCreate: boolean;
  nextIntent: LobbyIntent;
} {
  if (intent?.type === "auto_create_room") {
    return {
      shouldAutoCreate: true,
      nextIntent: null,
    };
  }

  return {
    shouldAutoCreate: false,
    nextIntent: intent,
  };
}
