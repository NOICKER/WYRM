import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AssemblyRoom, UserProfile } from "../ui/appModel.ts";
import { getDisplayName, isSupporter } from "../ui/supporterModel.ts";
import type {
  ClientMatchView,
  MatchActionPayload,
  OnlineProfile,
  RouteErrorMessage,
  ServerMessage,
} from "./protocol.ts";
import {
  getReconnectDelay,
  getReconnectStatusAfterClose,
  getReconnectStatusAfterFailure,
  getReconnectStatusAfterSuccess,
  type ConnectionBannerStatus,
} from "./reconnectModel.ts";
import { getMatchmakingSocketUrl } from "./socketConfig.ts";
import { OnlineSocketClient, type SocketClientState } from "./socketClient.ts";
import { getOrCreateStableClientId } from "./sessionModel.ts";

export type QueueStatus = "idle" | "searching" | "matched" | "timed_out";

export interface OnlineRoomAssignment {
  roomId: string;
  matchId: string;
  joined: boolean;
}

interface OnlineSessionState {
  clientId: string | null;
  connectionState: "idle" | SocketClientState;
  hasConnectedOnce: boolean;
  connectionBannerStatus: ConnectionBannerStatus;
  reconnectAttemptCount: number;
  queueStatus: QueueStatus;
  queueJoinedAt: number | null;
  roomAssignment: OnlineRoomAssignment | null;
  matchView: ClientMatchView | null;
  matchActionError: string | null;
  onlineRooms: Record<string, AssemblyRoom>;
  routeError: RouteErrorMessage | null;
  error: string | null;
}

interface OnlineSessionActions {
  queueJoin: () => boolean;
  queueLeave: () => void;
  watchRoom: (roomId: string) => boolean;
  joinRoom: (roomId: string) => boolean;
  sendMatchAction: (matchId: string, action: MatchActionPayload) => boolean;
  retryReconnect: () => void;
  clearActiveMatchContext: () => void;
  clearError: () => void;
  clearRouteError: () => void;
}

export type OnlineSession = OnlineSessionState & OnlineSessionActions;

export function useOnlineSession(profile: UserProfile | null): OnlineSession {
  const [connectionState, setConnectionState] = useState<OnlineSessionState["connectionState"]>("idle");
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const [connectionBannerStatus, setConnectionBannerStatus] = useState<ConnectionBannerStatus>("connected");
  const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("idle");
  const [queueJoinedAt, setQueueJoinedAt] = useState<number | null>(null);
  const [roomAssignment, setRoomAssignment] = useState<OnlineRoomAssignment | null>(null);
  const [matchView, setMatchView] = useState<ClientMatchView | null>(null);
  const [matchActionError, setMatchActionError] = useState<string | null>(null);
  const [onlineRooms, setOnlineRooms] = useState<Record<string, AssemblyRoom>>({});
  const [routeError, setRouteError] = useState<RouteErrorMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queueStatusRef = useRef<QueueStatus>("idle");
  const roomAssignmentRef = useRef<OnlineRoomAssignment | null>(null);
  const matchViewRef = useRef<ClientMatchView | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const socketRef = useRef<OnlineSocketClient | null>(null);
  const ensureConnectedRef = useRef<(() => OnlineSocketClient | null) | null>(null);
  const watchedRoomsRef = useRef(new Set<string>());
  const pendingJoinRoomIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const suppressReconnectRef = useRef(false);

  const onlineProfile = useMemo<OnlineProfile | null>(
    () =>
      profile
        ? {
            username: getDisplayName(profile.username, isSupporter()),
            level: profile.level,
          }
        : null,
    [profile],
  );

  const clientId = useMemo(
    () => (onlineProfile ? getOrCreateStableClientId(window.sessionStorage) : null),
    [onlineProfile],
  );

  useEffect(() => {
    queueStatusRef.current = queueStatus;
  }, [queueStatus]);

  useEffect(() => {
    roomAssignmentRef.current = roomAssignment;
  }, [roomAssignment]);

  useEffect(() => {
    matchViewRef.current = matchView;
  }, [matchView]);

  useEffect(() => {
    hasConnectedOnceRef.current = hasConnectedOnce;
  }, [hasConnectedOnce]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const resubscribeWatchedRooms = useCallback(() => {
    const roomIds = new Set(watchedRoomsRef.current);
    const assignedRoomId = roomAssignmentRef.current?.roomId;

    if (assignedRoomId) {
      roomIds.add(assignedRoomId);
    }

    for (const roomId of roomIds) {
      watchedRoomsRef.current.add(roomId);
      socketRef.current?.send({ type: "room_watch", roomId });
    }

    if (roomAssignmentRef.current?.joined) {
      socketRef.current?.send({
        type: "join_room",
        roomId: roomAssignmentRef.current.roomId,
      });
    }
  }, []);

  const scheduleReconnect = useCallback(
    (attemptCount: number) => {
      clearReconnectTimer();

      const delay = getReconnectDelay(attemptCount);
      if (delay === null) {
        setConnectionBannerStatus("failed");
        setReconnectAttemptCount(reconnectAttemptRef.current);
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        ensureConnectedRef.current?.();
      }, delay);
    },
    [clearReconnectTimer],
  );

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "queue_joined":
        setQueueStatus("searching");
        setQueueJoinedAt((current) => current ?? Date.now());
        setRouteError(null);
        setError(null);
        return;
      case "queue_left":
        setQueueStatus("idle");
        setQueueJoinedAt(null);
        setRoomAssignment(null);
        setMatchView(null);
        setMatchActionError(null);
        setRouteError(null);
        return;
      case "queue_matched":
        setQueueStatus("matched");
        setQueueJoinedAt(null);
        setRouteError(null);
        setRoomAssignment({
          roomId: message.roomId,
          matchId: message.matchId,
          joined: false,
        });
        return;
      case "room_joined":
        pendingJoinRoomIdRef.current = null;
        setRouteError(null);
        setMatchActionError(null);
        setRoomAssignment((current) =>
          current && current.roomId === message.roomId
            ? { ...current, joined: true }
            : {
                roomId: message.roomId,
                matchId: message.matchId,
                joined: true,
              },
        );
        return;
      case "state_sync":
        pendingJoinRoomIdRef.current = null;
        watchedRoomsRef.current.add(message.match.roomId);
        setError(null);
        setMatchActionError(null);
        setRouteError(null);
        setRoomAssignment({
          roomId: message.match.roomId,
          matchId: message.match.matchId,
          joined: true,
        });
        setMatchView(message.match);
        // Write reconnect token so the banner in App.tsx can fire on a hard refresh
        window.sessionStorage.setItem("wyrm_reconnect_token", message.match.matchId);
        return;
      case "queue_timeout":
        setQueueStatus("timed_out");
        setQueueJoinedAt(null);
        setRoomAssignment(null);
        setMatchView(null);
        setMatchActionError(null);
        setRouteError(null);
        return;
      case "room_snapshot":
        watchedRoomsRef.current.add(message.roomId);
        setRouteError((current) =>
          current && "roomId" in current && current.roomId === message.roomId ? null : current,
        );
        setOnlineRooms((current) => ({
          ...current,
          [message.roomId]: message.room,
        }));
        return;
      case "room_not_found":
      case "room_closed":
      case "room_full":
        if (pendingJoinRoomIdRef.current === message.roomId) {
          pendingJoinRoomIdRef.current = null;
        }
        watchedRoomsRef.current.delete(message.roomId);
        setRouteError(message);
        return;
      case "match_not_found":
        setMatchView(null);
        setRouteError(message);
        return;
      case "error":
        if (matchViewRef.current) {
          setMatchActionError(message.message);
        } else {
          setError(message.message);
        }
        return;
      default:
        return;
    }
  }, []);

  const handleStateChange = useCallback((state: SocketClientState) => {
    setConnectionState(state);
    if (state === "ready") {
      setHasConnectedOnce(true);
      hasConnectedOnceRef.current = true;

      const successState = getReconnectStatusAfterSuccess();
      clearReconnectTimer();
      setConnectionBannerStatus(successState.status);
      setReconnectAttemptCount(successState.attemptCount);
      reconnectAttemptRef.current = successState.attemptCount;
      resubscribeWatchedRooms();
      return;
    }

    if (state !== "closed") {
      return;
    }

    if (queueStatusRef.current === "searching") {
      setQueueStatus("idle");
      setQueueJoinedAt(null);
      setError("Connection lost while searching. Try again or return to the lobby.");
    }

    if (suppressReconnectRef.current) {
      return;
    }

    const reconnectState =
      reconnectAttemptRef.current === 0
        ? getReconnectStatusAfterClose(hasConnectedOnceRef.current)
        : getReconnectStatusAfterFailure(reconnectAttemptRef.current);

    setConnectionBannerStatus(reconnectState.status);
    setReconnectAttemptCount(reconnectState.attemptCount);
    reconnectAttemptRef.current = reconnectState.attemptCount;

    if (reconnectState.shouldRetry) {
      scheduleReconnect(reconnectState.attemptCount);
    }
  }, [clearReconnectTimer, resubscribeWatchedRooms, scheduleReconnect]);

  const ensureConnected = useCallback(() => {
    if (!onlineProfile || !clientId) {
      return null;
    }

    suppressReconnectRef.current = false;

    if (!socketRef.current) {
      socketRef.current = new OnlineSocketClient({
        url: getMatchmakingSocketUrl(),
        clientId,
        profile: onlineProfile,
        onMessage: handleServerMessage,
        onStateChange: handleStateChange,
      });
    }

    socketRef.current.connect();
    return socketRef.current;
  }, [clientId, handleServerMessage, handleStateChange, onlineProfile]);

  useEffect(() => {
    ensureConnectedRef.current = ensureConnected;
  }, [ensureConnected]);

  useEffect(() => {
    if (!onlineProfile || !clientId) {
      suppressReconnectRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close(1000, "session ended");
      socketRef.current = null;
      watchedRoomsRef.current.clear();
      roomAssignmentRef.current = null;
      hasConnectedOnceRef.current = false;
      reconnectAttemptRef.current = 0;
      const timeout = window.setTimeout(() => {
        setConnectionState("idle");
        setHasConnectedOnce(false);
        setConnectionBannerStatus("connected");
        setReconnectAttemptCount(0);
        setQueueStatus("idle");
        setQueueJoinedAt(null);
        setRoomAssignment(null);
        setMatchView(null);
        setMatchActionError(null);
        setOnlineRooms({});
        setRouteError(null);
        setError(null);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    suppressReconnectRef.current = false;
    const client = ensureConnected();
    return () => {
      if (socketRef.current === client) {
        suppressReconnectRef.current = true;
        clearReconnectTimer();
        socketRef.current?.close(1000, "session reset");
        socketRef.current = null;
      }
    };
  }, [clearReconnectTimer, clientId, ensureConnected, onlineProfile]);

  const queueJoin = useCallback(() => {
    const client = ensureConnected();
    if (!client) {
      setError("You need an active profile before entering matchmaking.");
      return false;
    }
    setError(null);
    setRouteError(null);
    setQueueStatus("searching");
    setQueueJoinedAt((current) => current ?? Date.now());
    client.send({ type: "queue_join" });
    return true;
  }, [ensureConnected]);

  const queueLeave = useCallback(() => {
    socketRef.current?.send({ type: "queue_leave" });
    setQueueStatus("idle");
    setQueueJoinedAt(null);
    setRoomAssignment(null);
    setMatchView(null);
    setMatchActionError(null);
    setRouteError(null);
    setError(null);
  }, []);

  const watchRoom = useCallback(
    (roomId: string) => {
      if (watchedRoomsRef.current.has(roomId)) {
        return true;
      }

      const client = ensureConnected();
      if (!client) {
        setError("The online session is not ready to watch that room yet.");
        return false;
      }

      setRouteError(null);
      watchedRoomsRef.current.add(roomId);
      client.send({ type: "room_watch", roomId });
      return true;
    },
    [ensureConnected],
  );

  const joinRoom = useCallback(
    (roomId: string) => {
      if (
        pendingJoinRoomIdRef.current === roomId
        && (roomAssignmentRef.current?.roomId !== roomId || !roomAssignmentRef.current?.joined)
      ) {
        return true;
      }

      const client = ensureConnected();
      if (!client) {
        setError("The online session is not ready to join that room yet.");
        return false;
      }

      setError(null);
      setMatchActionError(null);
      setRouteError(null);
      pendingJoinRoomIdRef.current = roomId;
      client.send({ type: "join_room", roomId });
      return true;
    },
    [ensureConnected],
  );

  const sendMatchAction = useCallback(
    (matchId: string, action: MatchActionPayload) => {
      const client = ensureConnected();
      if (!client) {
        setError("The online session is not ready to send match actions yet.");
        return false;
      }

      setError(null);
      setMatchActionError(null);
      client.send({
        type: "match_action",
        matchId,
        action,
      });
      return true;
    },
    [ensureConnected],
  );

  const retryReconnect = useCallback(() => {
    clearReconnectTimer();
    suppressReconnectRef.current = false;
    setConnectionBannerStatus("reconnecting");
    setReconnectAttemptCount(1);
    reconnectAttemptRef.current = 1;
    ensureConnectedRef.current?.();
  }, [clearReconnectTimer]);

  const clearActiveMatchContext = useCallback(() => {
    const activeRoomId = roomAssignmentRef.current?.roomId ?? matchViewRef.current?.roomId ?? null;
    if (activeRoomId) {
      watchedRoomsRef.current.delete(activeRoomId);
    }
    socketRef.current?.send({ type: "leave_room" });
    roomAssignmentRef.current = null;
    matchViewRef.current = null;
    pendingJoinRoomIdRef.current = null;
    setRoomAssignment(null);
    setMatchView(null);
    setMatchActionError(null);
    setRouteError(null);
    // Clear reconnect token on clean exit (match ended, abandoned, or disconnect)
    window.sessionStorage.removeItem("wyrm_reconnect_token");
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearRouteError = useCallback(() => setRouteError(null), []);

  return {
    clientId,
    connectionState,
    hasConnectedOnce,
    connectionBannerStatus,
    reconnectAttemptCount,
    queueStatus,
    queueJoinedAt,
    roomAssignment,
    matchView,
    matchActionError,
    onlineRooms,
    routeError,
    error,
    queueJoin,
    queueLeave,
    watchRoom,
    joinRoom,
    sendMatchAction,
    retryReconnect,
    clearActiveMatchContext,
    clearError,
    clearRouteError,
  };
}
