import React, { useCallback, useEffect, useMemo, useState } from "react";

import { ConnectionBanner } from "./components/ConnectionBanner.tsx";
import { RouteCrossfade } from "./components/RouteCrossfade.tsx";
import { PlayerGuide } from "./components/PlayerGuide.tsx";
import { ChronicleScreen } from "./screens/ChronicleScreen.tsx";
import { LandingScreen } from "./screens/LandingScreen.tsx";
import { AuthScreen } from "./screens/AuthScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { AssemblyLobbyScreen } from "./screens/AssemblyLobbyScreen.tsx";
import { LocalSetupScreen } from "./screens/LocalSetupScreen.tsx";
import { MatchScreen } from "./screens/MatchScreen.tsx";
import { MatchmakingScreen } from "./screens/MatchmakingScreen.tsx";
import { RoomErrorScreen } from "./screens/RoomErrorScreen.tsx";
import { ResultsScreen } from "./screens/ResultsScreen.tsx";
import { SettingsScreen } from "./screens/SettingsScreen.tsx";
import { GameProvider, useGame } from "./state/useGameState.tsx";
import { LocalGameProvider } from "./state/useLocalGameState.tsx";
import { OnlineGameProvider } from "./state/useOnlineGameState.tsx";
import { LoadingPulse } from "./components/LoadingPulse.tsx";
import { ScreenError } from "./components/ScreenError.tsx";
import { Wordmark } from "./components/Wordmark.tsx";
import type { GameState } from "./state/types.ts";
import type { BotDifficulty } from "./state/botEngine.ts";
import "./index.css";
import { useOnlineSession } from "./online/useOnlineSession.ts";
import {
  AUTH_QUOTES,
  LOBBY_QUOTES,
  buildChronicleEvent,
  buildMatchRecord,
  getProtectedRedirect,
  parseAppRoute,
  pickRotating,
  seedGuestRoom,
  seedHostRoom,
  toPath,
  validateAssemblyCode,
  createGuestProfile,
  type AppRoute,
  type AssemblyRoom,
  type MatchRecord,
  type UserProfile,
} from "./ui/appModel.ts";
import {
  consumeLobbyIntent,
  mapRouteErrorToScreenReason,
  type LobbyIntent,
} from "./ui/roomRouteErrors.ts";
import {
  ANIMATIONS_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  loadSettingsPreferences,
  persistSettingsToggle,
} from "./ui/settingsPreferences.ts";

interface ActiveMatchSession {
  id: string;
  roomId: string;
  room: AssemblyRoom;
  source: "local" | "online";
  events: ReturnType<typeof buildChronicleEvent>[];
  seenLogHead: string | null;
  completed: boolean;
}

function readInitialSettingsPreferences() {
  try {
    return loadSettingsPreferences(window.localStorage);
  } catch {
    return {
      animationsEnabled: true,
      soundEnabled: false,
    };
  }
}


function AppShell(): React.JSX.Element {
  const game = useGame();
  const [quoteSeed] = useState(() => Date.now());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location.pathname));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [rooms, setRooms] = useState<Record<string, AssemblyRoom>>({});
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeMatchSession, setActiveMatchSession] = useState<ActiveMatchSession | null>(null);
  const [sessionCounter, setSessionCounter] = useState(4);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [reconnectBannerVisible, setReconnectBannerVisible] = useState(false);
  const [lobbyIntent, setLobbyIntent] = useState<LobbyIntent>(null);
  const [preferences, setPreferences] = useState(() => readInitialSettingsPreferences());
  const [localPlayerConfig, setLocalPlayerConfig] = useState<{
    initialState: GameState;
    playerNames: Record<number, string>;
    playerBots: Record<number, BotDifficulty>;
  } | null>(null);
  const [completedMatches, setCompletedMatches] = useState<Record<string, MatchRecord>>({}); // starts empty; populated by real games
  const onlineSession = useOnlineSession(profile);
  const {
    clearActiveMatchContext,
    clearError,
    clearRouteError,
    connectionBannerStatus,
    connectionState,
    error: onlineError,
    joinRoom,
    matchActionError,
    matchView,
    onlineRooms,
    queueJoin,
    queueJoinedAt,
    queueLeave,
    queueStatus,
    reconnectAttemptCount,
    retryReconnect,
    roomAssignment,
    routeError,
    sendMatchAction,
    watchRoom,
  } = onlineSession;

  const completedList = useMemo(
    () => Object.values(completedMatches).sort((a, b) => b.sessionIndex - a.sessionIndex),
    [completedMatches],
  );

  const activeRoom = activeRoomId ? rooms[activeRoomId] ?? null : null;
  const activeMatch = useMemo<ActiveMatchSession | null>(() => {
    if (activeMatchSession && activeMatchSession.source === "local" && !activeMatchSession.completed) {
      return activeMatchSession;
    }

    if (!matchView) {
      return activeMatchSession;
    }

    const room =
      rooms[matchView.roomId]
      ?? onlineRooms[matchView.roomId]
      ?? (activeMatchSession?.id === matchView.matchId ? activeMatchSession.room : null);

    if (!room) {
      return activeMatchSession;
    }

    if (activeMatchSession && activeMatchSession.id === matchView.matchId) {
      return {
        ...activeMatchSession,
        roomId: matchView.roomId,
        room,
        source: "online",
      };
    }

    return {
      id: matchView.matchId,
      roomId: matchView.roomId,
      room,
      source: "online",
      events: [],
      seenLogHead: null,
      completed: false,
    };
  }, [activeMatchSession, matchView, onlineRooms, rooms]);
  const activeMatchRoom = activeMatch
    ? rooms[activeMatch.roomId] ?? onlineRooms[activeMatch.roomId] ?? activeMatch.room
    : null;
  const activeMatchState = useMemo(() => {
    if (!activeMatch || activeMatch.completed) {
      return null;
    }

    if (activeMatch.source === "online") {
      return matchView?.matchId === activeMatch.id ? matchView.state : null;
    }

    return game.state;
  }, [activeMatch, game.state, matchView]);
  const activeAssemblyRouteError = useMemo(() => {
    if (route.name !== "assembly") {
      return null;
    }
    if (!routeError || !("roomId" in routeError) || routeError.roomId !== route.roomId) {
      return null;
    }
    return routeError;
  }, [route, routeError]);
  const activeAssemblyErrorReason = useMemo(
    () => mapRouteErrorToScreenReason(activeAssemblyRouteError),
    [activeAssemblyRouteError],
  );
  const lobbyIntentState = useMemo(
    () => (route.name === "lobby" ? consumeLobbyIntent(lobbyIntent) : { shouldAutoCreate: false, nextIntent: lobbyIntent }),
    [lobbyIntent, route.name],
  );

  const navigate = useCallback((nextRoute: AppRoute, replace = false) => {
    const nextPath = toPath(nextRoute);
    if (replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
    setRoute(nextRoute);
  }, []);

  const navigatePath = useCallback(
    (href: string, replace = false) => navigate(parseAppRoute(href), replace),
    [navigate],
  );

  const navigateBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate(profile ? { name: "lobby" } : { name: "landing" }, true);
  }, [navigate, profile]);

  const handleCreateAssembly = useCallback(() => {
    if (!profile) {
      return;
    }
    setPendingAction("create-room");
    setError(null);
    window.setTimeout(() => {
      const room = seedHostRoom(profile);
      setRooms((current) => ({ ...current, [room.id]: room }));
      setActiveRoomId(room.id);
      setPendingAction(null);
      navigate({ name: "assembly", roomId: room.id });
    }, 260);
  }, [navigate, profile]);

  const handleRoomErrorNavigate = useCallback(
    (href: string, options?: { autoCreateRoom?: boolean }) => {
      setLobbyIntent(options?.autoCreateRoom ? { type: "auto_create_room" } : null);
      clearRouteError();
      navigatePath(href);
    },
    [clearRouteError, navigatePath],
  );

  const handleConnectionBannerLobby = useCallback(() => {
    setActiveMatchSession(null);
    setActiveRoomId(null);
    setPendingAction(null);
    setError(null);
    setLobbyIntent(null);
    clearActiveMatchContext();
    clearError();
    clearRouteError();
    navigate({ name: "lobby" });
  }, [clearActiveMatchContext, clearError, clearRouteError, navigate]);

  const handleSaveDisplayName = useCallback((nextUsername: string) => {
    setProfile((current) => (current ? { ...current, username: nextUsername.trim() } : current));
  }, []);

  const handleTogglePreference = useCallback(
    (key: typeof ANIMATIONS_STORAGE_KEY | typeof SOUND_STORAGE_KEY, enabled: boolean) => {
      setPreferences((current) => ({
        ...current,
        animationsEnabled: key === ANIMATIONS_STORAGE_KEY ? enabled : current.animationsEnabled,
        soundEnabled: key === SOUND_STORAGE_KEY ? enabled : current.soundEnabled,
      }));

      try {
        persistSettingsToggle(window.localStorage, key, enabled);
      } catch {
        // Ignore storage failures and keep the in-memory preference applied for this session.
      }
    },
    [],
  );

  const beginMatch = useCallback(
    (room: AssemblyRoom) => {
      const occupiedSeats = room.seats.filter((seat) => seat.occupied && seat.playerId);
      const playerCount = Math.min(4, Math.max(2, occupiedSeats.length)) as 2 | 3 | 4;
      const matchId = `match-${Date.now().toString(36)}`;
      game.startNewGame(playerCount);
      setActiveMatchSession({
        id: matchId,
        roomId: room.id,
        room,
        source: "local",
        events: [],
        seenLogHead: null,
        completed: false,
      });
      navigate({ name: "match", matchId });
    },
    [game, navigate],
  );

  useEffect(() => {
    const handlePopState = () => setRoute(parseAppRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    try {
      const reconnectToken = window.sessionStorage.getItem("wyrm_reconnect_token");
      if (!reconnectToken) {
        return undefined;
      }

      const timeout = window.setTimeout(() => {
        setReconnectBannerVisible(true);
      }, 0);

      return () => window.clearTimeout(timeout);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!roomAssignment?.roomId || route.name !== "matchmaking") {
      return;
    }
    const timeout = window.setTimeout(() => {
      navigate({ name: "assembly", roomId: roomAssignment?.roomId ?? "" }, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [navigate, roomAssignment?.roomId, route.name]);

  useEffect(() => {
    if (route.name !== "assembly") {
      return;
    }
    if (rooms[route.roomId] || activeAssemblyErrorReason) {
      return;
    }
    watchRoom(route.roomId);
    if (
      roomAssignment?.roomId !== route.roomId
      || !roomAssignment?.joined
      || matchView?.roomId !== route.roomId
    ) {
      joinRoom(route.roomId);
    }
  }, [
    activeAssemblyErrorReason,
    joinRoom,
    matchView?.roomId,
    roomAssignment?.joined,
    roomAssignment?.roomId,
    rooms,
    route,
    watchRoom,
  ]);

  useEffect(() => {
    if (!matchView) {
      return;
    }

    const room = rooms[matchView.roomId] ?? onlineRooms[matchView.roomId] ?? null;
    if (!room) {
      return;
    }

    if (route.name === "assembly" && route.roomId === matchView.roomId) {
      const timeout = window.setTimeout(() => {
        navigate({ name: "match", matchId: matchView.matchId }, true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [matchView, navigate, onlineRooms, rooms, route]);

  useEffect(() => {
    if (route.name !== "matchmaking") {
      return;
    }
    const hasQueueContext =
      queueStatus === "searching"
      || queueStatus === "timed_out"
      || Boolean(roomAssignment);
    if (hasQueueContext || connectionState !== "ready") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setError("Begin matchmaking from the lobby to search for a live opponent.");
      navigate({ name: "lobby" }, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    connectionState,
    navigate,
    queueStatus,
    route.name,
    roomAssignment,
  ]);

  useEffect(() => {
    const routeRecord =
      route.name === "results" || route.name === "chronicle" ? completedMatches[route.matchId] : null;
    const redirect = getProtectedRedirect(route, {
      authenticated: Boolean(profile),
      isGuestSession: Boolean(profile?.isGuest),
      hasActiveMatch: route.name === "match" ? activeMatch?.id === route.matchId && !activeMatch.completed : Boolean(activeMatch && !activeMatch.completed),
      hasCompletedMatch: Boolean(routeRecord),
    });
    if (redirect && redirect !== toPath(route)) {
      const timeout = window.setTimeout(() => navigatePath(redirect, true), 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [activeMatch, completedMatches, navigatePath, profile, route]);

  useEffect(() => {
    if (!activeMatch || !activeMatchRoom || !activeMatchState) {
      return;
    }
    const newestLog = activeMatchState.log[0];
    if (!newestLog || newestLog === activeMatch.seenLogHead) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActiveMatchSession((current) => {
        const base = current && current.id === activeMatch.id ? current : activeMatch;
        if (!base || base.id !== activeMatch.id) {
          return current;
        }
        return {
          ...base,
          seenLogHead: newestLog,
          events: [
            ...base.events,
            buildChronicleEvent(newestLog, activeMatchState.currentRound, activeMatchRoom, base.events.length),
          ],
        };
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeMatch, activeMatchRoom, activeMatchState]);

  useEffect(() => {
    if (!activeMatch || !activeMatchRoom || !activeMatchState || activeMatch.completed || !profile || !activeMatchState.winner) {
      return;
    }

    const record = {
      ...buildMatchRecord(activeMatchState, activeMatchRoom, profile, sessionCounter, activeMatch.events),
      id: activeMatch.id,
    };

    const timeout = window.setTimeout(() => {
      setCompletedMatches((current) => ({ ...current, [record.id]: record }));
      setSessionCounter((current) => current + 1);
      setActiveMatchSession((current) =>
        current && current.id === activeMatch.id
          ? { ...current, completed: true }
          : { ...activeMatch, completed: true },
      );
      if (activeMatch.source === "online") {
        clearActiveMatchContext();
      }
      setPendingAction(null);
      navigate({ name: "results", matchId: record.id });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    activeMatch,
    activeMatchRoom,
    activeMatchState,
    clearActiveMatchContext,
    navigate,
    profile,
    sessionCounter,
  ]);

  useEffect(() => {
    if (!activeRoom || !profile || pendingAction || !activeRoom.autoBeginWhenReady) {
      return;
    }
    const currentSeat = activeRoom.seats.find((seat) => seat.currentUser);
    if (!currentSeat || currentSeat.host || !currentSeat.ready) {
      return;
    }
    const filledSeats = activeRoom.seats.filter((seat) => seat.occupied);
    if (filledSeats.length < 2 || !filledSeats.every((seat) => seat.ready)) {
      return;
    }

    const kickoff = window.setTimeout(() => setPendingAction("auto-start"), 0);
    const timeout = window.setTimeout(() => {
      beginMatch(activeRoom);
      setPendingAction(null);
    }, 900);
    return () => {
      window.clearTimeout(kickoff);
      window.clearTimeout(timeout);
    };
  }, [activeRoom, beginMatch, pendingAction, profile]);

  const handleAuth = (username: string) => {
    setPendingAction("auth");
    setError(null);
    window.setTimeout(() => {
      setProfile({
        username: username.trim(),
        level: 7,
      });
      setPendingAction(null);
      navigate({ name: "lobby" }, true);
    }, 320);
  };

  const authQuote = pickRotating(AUTH_QUOTES, quoteSeed);
  const lobbyQuote = pickRotating(LOBBY_QUOTES, quoteSeed + 1);
  const handleAbandonMatch = useCallback(() => {
    const roomId = activeMatch?.roomId ?? null;
    const activeSource = activeMatch?.source ?? null;

    setActiveMatchSession((current) =>
      current
        ? {
            ...current,
            completed: true,
            room: {
              ...current.room,
              matchStatus: "closed",
            },
          }
        : current,
    );

    if (roomId) {
      setRooms((current) => {
        const room = current[roomId];
        if (!room) {
          return current;
        }
        return {
          ...current,
          [roomId]: {
            ...room,
            matchStatus: "closed",
          },
        };
      });
      setActiveRoomId((current) => (current === roomId ? null : current));
    }

    setPendingAction(null);
    if (activeSource === "online") {
      clearActiveMatchContext();
    }
    navigate({ name: "lobby" });
  }, [activeMatch?.roomId, activeMatch?.source, clearActiveMatchContext, navigate]);

  const currentRecord =
    route.name === "results" || route.name === "chronicle" ? completedMatches[route.matchId] : null;

  const page = (() => {
    if (!profile || route.name === "landing" || route.name === "auth") {
      if (route.name === "landing") {
        return <LandingScreen onNavigate={navigatePath} />;
      }
      return (
        <AuthScreen
          quote={authQuote}
          pendingAction={pendingAction}
          error={error}
          onSubmit={(form) => handleAuth(form.username)}
          onGuestPlay={() => {
            setPendingAction("guest");
            setError(null);
            window.setTimeout(() => {
              setProfile(createGuestProfile());
              setPendingAction(null);
              navigate({ name: "lobby" }, true);
            }, 320);
          }}
        />
      );
    }

    if (route.name === "lobby") {
      return (
        <LobbyScreen
          profile={profile}
          quote={lobbyQuote}
          recentChronicles={completedList}
          pendingAction={pendingAction}
          error={error}
          onNavigate={navigatePath}
          autoCreateRoomOnMount={lobbyIntentState.shouldAutoCreate}
          onConsumeAutoCreateRoom={() => setLobbyIntent(lobbyIntentState.nextIntent)}
          onCreateAssembly={handleCreateAssembly}
          onFindOpponent={() => {
            setError(null);
            clearError();
            queueJoin();
            navigate({ name: "matchmaking" });
          }}
          onJoinAssembly={(code) => {
            setError(null);
            if (!validateAssemblyCode(code)) {
              setError("That sigil looks incomplete. Use the format XXX-X-XXXX.");
              return;
            }

            setPendingAction("join-room");
            window.setTimeout(() => {
              const room = rooms[code] ?? seedGuestRoom(profile, code);
              setRooms((current) => ({ ...current, [room.id]: room }));
              setActiveRoomId(room.id);
              setPendingAction(null);
              navigate({ name: "assembly", roomId: room.id });
            }, 260);
          }}
          onReplayChronicle={(matchId) => navigate({ name: "chronicle", matchId })}
        />
      );
    }

    if (route.name === "settings") {
      return (
        <SettingsScreen
          key={profile.username}
          profile={profile}
          matchHistory={completedList}
          animationsEnabled={preferences.animationsEnabled}
          soundEnabled={preferences.soundEnabled}
          onNavigate={navigatePath}
          onBack={navigateBack}
          onSaveDisplayName={handleSaveDisplayName}
          onToggleAnimations={(enabled) => handleTogglePreference(ANIMATIONS_STORAGE_KEY, enabled)}
          onToggleSound={(enabled) => handleTogglePreference(SOUND_STORAGE_KEY, enabled)}
          onReplayChronicle={(matchId) => navigate({ name: "chronicle", matchId })}
          onClearMatchHistory={() => setCompletedMatches({})}
        />
      );
    }

    if (route.name === "matchmaking") {
      const status =
        queueStatus === "timed_out"
          ? "timed_out"
          : onlineError
            ? "offline"
            : "searching";

      return (
        <MatchmakingScreen
          status={status}
          queueJoinedAt={queueJoinedAt}
          error={
            queueStatus === "timed_out"
              ? "Try again or create a private room."
              : onlineError
          }
          onNavigate={navigatePath}
          onCancel={() => {
            queueLeave();
            navigate({ name: "lobby" });
          }}
          onRetry={() => {
            clearError();
            queueJoin();
          }}
          onBack={() => {
            queueLeave();
            navigate({ name: "lobby" });
          }}
        />
      );
    }

    if (route.name === "assembly") {
      const localRoom = rooms[route.roomId];
      const onlineRoom = onlineRooms[route.roomId];
      const room = localRoom ?? onlineRoom;
      if (!room && activeAssemblyErrorReason) {
        return <RoomErrorScreen reason={activeAssemblyErrorReason} onNavigate={handleRoomErrorNavigate} />;
      }
      if (!room) {
        return (
          <main className="shell-page matchmaking-screen">
            <aside className="shell-sidebar">
              <Wordmark href="/lobby" onNavigate={navigatePath} />
            </aside>
            <section className="shell-main matchmaking-screen__main">
              <div className="matchmaking-screen__card">
                <p className="matchmaking-screen__eyebrow">Assembly Room</p>
                <h1>Joining the room</h1>
                <div className="matchmaking-screen__pulse">
                  <LoadingPulse label="Binding room snapshot" />
                </div>
                <p className="matchmaking-screen__subtext">
                  The relay is fetching the latest assembly state.
                </p>
                {onlineError ? <ScreenError message={onlineError} /> : null}
                <div className="matchmaking-screen__actions">
                  <button type="button" className="text-link" onClick={() => navigate({ name: "lobby" })}>
                    Back to lobby
                  </button>
                </div>
              </div>
            </section>
          </main>
        );
      }
      return (
        <AssemblyLobbyScreen
          room={room}
          error={
            localRoom
              ? error
              : error
                ?? "This live-matched room is connected to the backend. Shared ready checks and synchronized play arrive in the next phase."
          }
          pendingAction={localRoom ? pendingAction : null}
          onNavigate={navigatePath}
          onToggleReady={() => {
            if (!localRoom) {
              setError("Live-matched rooms are read-only until synchronized assembly actions land.");
              return;
            }
            setRooms((current) => {
              const nextRoom = current[room.id];
              if (!nextRoom) {
                return current;
              }
              return {
                ...current,
                [room.id]: {
                  ...nextRoom,
                  seats: nextRoom.seats.map((seat) =>
                    seat.currentUser && seat.occupied ? { ...seat, ready: !seat.ready } : seat,
                  ),
                },
              };
            });
          }}
          onSetTimer={(timer) => {
            if (!localRoom) {
              setError("Timer changes for live-matched rooms will arrive with synchronized assembly actions.");
              return;
            }
            setRooms((current) => ({
              ...current,
              [room.id]: {
                ...room,
                timer,
              },
            }));
          }}
          onCommence={() => {
            if (!localRoom) {
              setError("Live-matched rooms cannot commence yet. Match synchronization is the next phase.");
              return;
            }
            setPendingAction("commence");
            setError(null);
            window.setTimeout(() => {
              beginMatch(room);
              setPendingAction(null);
            }, 300);
          }}
          onCopyCode={async (code) => {
            try {
              await navigator.clipboard.writeText(code);
              return true;
            } catch {
              return false;
            }
          }}
        />
      );
    }

    if (
      route.name === "match"
      && activeMatch
      && activeMatch.id === route.matchId
      && activeMatch.source === "online"
      && matchView
      && matchView.matchId === route.matchId
    ) {
      return (
        <OnlineGameProvider
          match={matchView}
          actionError={matchActionError}
          sendMatchAction={sendMatchAction}
        >
          <MatchScreen
            room={activeMatchRoom ?? activeMatch.room}
            matchId={activeMatch.id}
            animationsEnabled={preferences.animationsEnabled}
            onNavigate={navigatePath}
            onAbandonMatch={handleAbandonMatch}
            onOpenGuide={() => setGuideOpen(true)}
            showGuestChip={Boolean(profile?.isGuest && !guestBannerDismissed)}
            onDismissGuestChip={() => setGuestBannerDismissed(true)}
          />
        </OnlineGameProvider>
      );
    }

    if (route.name === "match" && activeMatch && activeMatch.id === route.matchId) {
      return (
        <MatchScreen
          room={activeMatchRoom ?? activeMatch.room}
          matchId={activeMatch.id}
          animationsEnabled={preferences.animationsEnabled}
          onNavigate={navigatePath}
          onAbandonMatch={handleAbandonMatch}
          onOpenGuide={() => setGuideOpen(true)}
          showGuestChip={Boolean(profile?.isGuest && !guestBannerDismissed)}
          onDismissGuestChip={() => setGuestBannerDismissed(true)}
        />
      );
    }

    if (route.name === "match") {
      return <RoomErrorScreen reason="match_not_found" onNavigate={handleRoomErrorNavigate} />;
    }

    if (route.name === "local_setup") {
      return (
        <LocalSetupScreen
          onNavigate={navigatePath}
          onStartGame={(initialState, playerNames, playerBots) => {
            setLocalPlayerConfig({ initialState, playerNames, playerBots });
            navigate({ name: "local_match" });
          }}
        />
      );
    }

    if (route.name === "local_match" && localPlayerConfig) {
      const localMatchId = "local";
      // Build a minimal synthetic room just for colour/name lookups in MatchScreen
      // when localMode is true these won't be used anyway, but MatchScreen still needs a room prop
      const localRoom = localPlayerConfig.initialState.players.reduce(
        (acc, player) => {
          acc.seats.push({
            id: `seat-${player.id}`,
            name: localPlayerConfig.playerNames[player.id] ?? `Player ${player.id}`,
            level: 1,
            occupied: true,
            ready: true,
            host: player.id === 1,
            currentUser: player.id === 1,
            playerId: player.id,
            color: (["purple", "coral", "teal", "amber"] as const)[player.id - 1],
          });
          return acc;
        },
        {
          id: "local",
          code: "local",
          timer: "∞" as const,
          boardVariant: "sacred_grove" as const,
          serverName: "Local",
          latencyMs: 0,
          autoBeginWhenReady: false,
          matchStatus: "active" as const,
          disconnectedSeatName: null,
          reconnectDeadlineMinutes: 30,
          seats: [] as import("./ui/appModel.ts").AssemblySeat[],
        },
      );
      return (
        <LocalGameProvider initialState={localPlayerConfig.initialState} playerBots={localPlayerConfig.playerBots}>
          <MatchScreen
            room={localRoom}
            matchId={localMatchId}
            animationsEnabled={preferences.animationsEnabled}
            onNavigate={navigatePath}
            onAbandonMatch={() => navigate({ name: "lobby" })}
            onOpenGuide={() => setGuideOpen(true)}
            showGuestChip={Boolean(profile?.isGuest && !guestBannerDismissed)}
            onDismissGuestChip={() => setGuestBannerDismissed(true)}
            localMode
            localPlayerNames={localPlayerConfig.playerNames}
            localPlayerBots={localPlayerConfig.playerBots}
          />
        </LocalGameProvider>
      );
    } else if (route.name === "local_match") {
      navigatePath("/local", true);
      return null;
    }

    if (route.name === "results" && currentRecord) {
      return (
        <ResultsScreen
          record={currentRecord}
          pendingAction={pendingAction}
          onNavigate={navigatePath}
          onCheckOpponent={async () => {
            const room = onlineRooms[currentRecord.roomId] ?? rooms[currentRecord.roomId];
            if (!room) return false;
            if (room.matchStatus === "closed" || room.matchStatus === "paused_disconnected") return false;
            return room.seats.some(s => !s.currentUser && s.occupied);
          }}
          onForgeAnew={() => {
            if (!profile) return;
            // Local match: go back to the local setup screen for a fresh game
            if (currentRecord.id === "local") {
              navigate({ name: "local_setup" });
              return;
            }
            // Online match: rematch invite not yet implemented
          }}
          forgeAnewLabel={
            currentRecord.id === "local"
              ? "Play again"
              : undefined
          }
          forgeAnewDisabled={
            currentRecord.id !== "local"
          }
          forgeAnewDisabledLabel="Rematch invite — coming soon"
          onViewChronicle={() => navigate({ name: "chronicle", matchId: currentRecord.id })}
        />
      );
    }

    if (route.name === "chronicle" && currentRecord) {
      return (
        <ChronicleScreen
          record={currentRecord}
          onNavigate={navigatePath}
        />
      );
    }

    return (
      <LobbyScreen
        profile={profile!}
        quote={lobbyQuote}
        recentChronicles={completedList}
        pendingAction={pendingAction}
        error="That page was not bound into the Tome. You have been returned to the lobby."
        onNavigate={navigatePath}
        onCreateAssembly={handleCreateAssembly}
        onFindOpponent={() => navigate({ name: "lobby" })}
        onJoinAssembly={() => navigate({ name: "lobby" })}
        onReplayChronicle={(matchId) => navigate({ name: "chronicle", matchId })}
      />
    );
  })();

  const showGuestBanner = profile?.isGuest && !guestBannerDismissed && !["auth", "landing", "match", "local_match"].includes(route.name);
  const showReconnectBanner = reconnectBannerVisible && profile && route.name === "lobby";
  const showStickyNotice = showGuestBanner || showReconnectBanner;
  const connectionBannerVisible = connectionBannerStatus !== "connected";

  return (
    <div
      className={connectionBannerVisible ? "app-root app-root--connection-offset" : "app-root"}
      data-wyrm-animations={preferences.animationsEnabled ? "on" : "off"}
    >
      <ConnectionBanner
        status={connectionBannerStatus}
        attemptCount={reconnectAttemptCount}
        onRetry={retryReconnect}
        onGoToLobby={handleConnectionBannerLobby}
      />
      <button
        className={showStickyNotice ? "global-back-btn global-back-btn--guest-offset" : "global-back-btn"}
        onClick={navigateBack}
        aria-label="Go back"
        title="Go back"
      >
        <svg fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      {showReconnectBanner ? (
        <div className="reconnect-banner">
          <span>You have an active match in progress.</span>
          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.removeItem("wyrm_reconnect_token");
              } catch {
                // Ignore storage failures and still hide the banner for the current session.
              }
              setReconnectBannerVisible(false);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {showGuestBanner ? (
        <div className="guest-banner">
          <span>Playing as guest — match history will not be saved.</span>
          <button type="button" onClick={() => setGuestBannerDismissed(true)} aria-label="Dismiss guest notice">
            ✕
          </button>
        </div>
      ) : null}
      <RouteCrossfade routeKey={toPath(route)}>{page}</RouteCrossfade>
      <PlayerGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

function App(): React.JSX.Element {
  return (
    <GameProvider>
      <AppShell />
    </GameProvider>
  );
}

export default App;
