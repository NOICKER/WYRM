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
import type { PlayerColor, PlayerId } from "./state/types.ts";
import type { GameState } from "./state/types.ts";
import type { BotDifficulty } from "./state/botEngine.ts";
import "./index.css";
import { useOnlineSession } from "./online/useOnlineSession.ts";
import {
  AUTH_QUOTES,
  LOBBY_QUOTES,
  RESULT_QUOTES,
  buildChronicleEvent,
  buildMatchRecord,
  generateAssemblyCode,
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

function createSeedRecord(
  id: string,
  sessionIndex: number,
  localPlayerName: string,
  winnerName: string,
  winnerColor: PlayerColor,
  result: "win" | "loss",
): MatchRecord {
  const playerId: PlayerId = result === "win" ? 1 : 4;
  return {
    id,
    roomId: `room-${sessionIndex}`,
    roomCode: generateAssemblyCode(2020 + sessionIndex),
    winnerId: playerId,
    winnerName,
    winnerColor,
    localPlayerId: 4,
    localPlayerName,
    localPlayerColor: "amber",
    result,
    rounds: 9 + sessionIndex,
    opponents: ["Mara Thorne", "Elden Vale"].slice(0, result === "win" ? 1 : 2),
    conquest: 2 + sessionIndex,
    strategy: 4 + sessionIndex,
    groveControl: 56 + sessionIndex * 7,
    factionRep: result === "win" ? "Ascendant" : "Watcher",
    sessionIndex,
    completedAt: Date.UTC(2026, 3, sessionIndex),
    flavorQuote: pickRotating(RESULT_QUOTES, sessionIndex),
    xpEarned: 180 + sessionIndex * 22,
    xpSources: ["Chronicle Logged", result === "win" ? "Sacred Grove Bonus" : "Field Notes"],
    events: [
      {
        id: `${id}-1`,
        round: 1,
        playerId: 1,
        playerName: "Mara Thorne",
        playerColor: "purple",
        title: "Mara Thorne drew a Fire Rune",
        description: "Mara Thorne drew a Fire Rune, adding another whispered option to the hand.",
        actionBadge: "ACTION: DRAW",
        eventType: "standard",
      },
      {
        id: `${id}-2`,
        round: 3,
        playerId: 4,
        playerName: localPlayerName,
        playerColor: "amber",
        title: `${localPlayerName} moved through the Sacred Grove`,
        description: `${localPlayerName} shifted the center of the board and the entire table felt it.`,
        actionBadge: "ACTION: MOVE",
        eventType: "grove",
        regionTag: "Sacred Grove",
        artTitle: "grove illustration",
      },
      {
        id: `${id}-3`,
        round: 5,
        playerId: playerId,
        playerName: winnerName,
        playerColor: winnerColor,
        title: `${winnerName} captured a rival wyrm`,
        description: `${winnerName} turned the lane into a sudden combat encounter.`,
        actionBadge: "ACTION: COMBAT",
        eventType: "combat",
        regionTag: "Outer Ring",
        artTitle: "combat illustration",
      },
    ],
  };
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
  const [activeMatch, setActiveMatch] = useState<ActiveMatchSession | null>(null);
  const [sessionCounter, setSessionCounter] = useState(4);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [lobbyIntent, setLobbyIntent] = useState<LobbyIntent>(null);
  const [preferences, setPreferences] = useState(() => readInitialSettingsPreferences());
  const [localPlayerConfig, setLocalPlayerConfig] = useState<{
    initialState: GameState;
    playerNames: Record<number, string>;
    playerBots: Record<number, BotDifficulty>;
  } | null>(null);
  const [completedMatches, setCompletedMatches] = useState<Record<string, MatchRecord>>(() => ({
    "seed-1": createSeedRecord("seed-1", 1, "Sable Quill", "Sable Quill", "amber", "win"),
    "seed-2": createSeedRecord("seed-2", 2, "Sable Quill", "Mara Thorne", "purple", "loss"),
    "seed-3": createSeedRecord("seed-3", 3, "Sable Quill", "Sable Quill", "amber", "win"),
  }));
  const onlineSession = useOnlineSession(profile);

  const completedList = useMemo(
    () => Object.values(completedMatches).sort((a, b) => b.sessionIndex - a.sessionIndex),
    [completedMatches],
  );

  const activeRoom = activeRoomId ? rooms[activeRoomId] ?? null : null;
  const activeMatchRoom = activeMatch
    ? rooms[activeMatch.roomId] ?? onlineSession.onlineRooms[activeMatch.roomId] ?? activeMatch.room
    : null;
  const activeMatchState = useMemo(() => {
    if (!activeMatch || activeMatch.completed) {
      return null;
    }

    if (activeMatch.source === "online") {
      return onlineSession.matchView?.matchId === activeMatch.id ? onlineSession.matchView.state : null;
    }

    return game.state;
  }, [activeMatch, game.state, onlineSession.matchView]);
  const activeAssemblyRouteError = useMemo(() => {
    if (route.name !== "assembly") {
      return null;
    }
    const routeError = onlineSession.routeError;
    if (!routeError || !("roomId" in routeError) || routeError.roomId !== route.roomId) {
      return null;
    }
    return routeError;
  }, [onlineSession.routeError, route]);
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
      onlineSession.clearRouteError();
      navigatePath(href);
    },
    [navigatePath, onlineSession.clearRouteError],
  );

  const handleConnectionBannerLobby = useCallback(() => {
    setActiveMatch(null);
    setActiveRoomId(null);
    setPendingAction(null);
    setError(null);
    setLobbyIntent(null);
    onlineSession.clearActiveMatchContext();
    onlineSession.clearError();
    onlineSession.clearRouteError();
    navigate({ name: "lobby" });
  }, [
    navigate,
    onlineSession.clearActiveMatchContext,
    onlineSession.clearError,
    onlineSession.clearRouteError,
  ]);

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
      setActiveMatch({
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
    if (!onlineSession.roomAssignment?.roomId || route.name !== "matchmaking") {
      return;
    }
    const timeout = window.setTimeout(() => {
      navigate({ name: "assembly", roomId: onlineSession.roomAssignment?.roomId ?? "" }, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [navigate, onlineSession.roomAssignment?.roomId, route.name]);

  useEffect(() => {
    if (route.name !== "assembly") {
      return;
    }
    if (rooms[route.roomId] || activeAssemblyErrorReason) {
      return;
    }
    onlineSession.watchRoom(route.roomId);
    if (
      onlineSession.roomAssignment?.roomId !== route.roomId
      || !onlineSession.roomAssignment.joined
      || onlineSession.matchView?.roomId !== route.roomId
    ) {
      onlineSession.joinRoom(route.roomId);
    }
  }, [
    activeAssemblyErrorReason,
    onlineSession.joinRoom,
    onlineSession.matchView?.roomId,
    onlineSession.roomAssignment?.joined,
    onlineSession.roomAssignment?.roomId,
    onlineSession.watchRoom,
    rooms,
    route,
  ]);

  useEffect(() => {
    const matchView = onlineSession.matchView;
    if (!matchView) {
      return;
    }

    const room =
      rooms[matchView.roomId]
      ?? onlineSession.onlineRooms[matchView.roomId]
      ?? (activeMatch?.id === matchView.matchId ? activeMatch.room : null);

    if (!room) {
      return;
    }

    setActiveMatch((current) => {
      if (current && current.source === "local" && !current.completed) {
        return current;
      }

      if (current && current.id === matchView.matchId) {
        return {
          ...current,
          roomId: matchView.roomId,
          room,
          source: "online",
          completed: false,
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
    });
  }, [activeMatch?.id, activeMatch?.room, onlineSession.matchView, onlineSession.onlineRooms, rooms]);

  useEffect(() => {
    const matchView = onlineSession.matchView;
    if (!matchView) {
      return;
    }

    const room = rooms[matchView.roomId] ?? onlineSession.onlineRooms[matchView.roomId] ?? null;
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
  }, [navigate, onlineSession.matchView, onlineSession.onlineRooms, rooms, route]);

  useEffect(() => {
    if (route.name !== "matchmaking") {
      return;
    }
    const hasQueueContext =
      onlineSession.queueStatus === "searching"
      || onlineSession.queueStatus === "timed_out"
      || Boolean(onlineSession.roomAssignment);
    if (hasQueueContext || onlineSession.connectionState !== "ready") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setError("Begin matchmaking from the lobby to search for a live opponent.");
      navigate({ name: "lobby" }, true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [
    navigate,
    onlineSession.connectionState,
    onlineSession.queueStatus,
    onlineSession.roomAssignment,
    route.name,
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
      setActiveMatch((current) => {
        if (!current || current.id !== activeMatch.id) {
          return current;
        }
        return {
          ...current,
          seenLogHead: newestLog,
          events: [
            ...current.events,
            buildChronicleEvent(newestLog, activeMatchState.currentRound, activeMatchRoom, current.events.length),
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
      setActiveMatch((current) => (current ? { ...current, completed: true } : current));
      if (activeMatch.source === "online") {
        onlineSession.clearActiveMatchContext();
      }
      setPendingAction(null);
      navigate({ name: "results", matchId: record.id });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [
    activeMatch,
    activeMatchRoom,
    activeMatchState,
    navigate,
    onlineSession.clearActiveMatchContext,
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

    setActiveMatch((current) =>
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
      onlineSession.clearActiveMatchContext();
    }
    navigate({ name: "lobby" });
  }, [activeMatch?.roomId, activeMatch?.source, navigate, onlineSession.clearActiveMatchContext]);

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
          onOAuth={(provider) => {
            setPendingAction(provider === "google" ? "google" : "discord");
            setError(null);
            window.setTimeout(() => {
              setProfile({ username: provider === "google" ? "Aether Archivist" : "Citadel Scribe", level: 9 });
              setPendingAction(null);
              navigate({ name: "lobby" }, true);
            }, 280);
          }}
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
            onlineSession.clearError();
            onlineSession.queueJoin();
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
        onlineSession.queueStatus === "timed_out"
          ? "timed_out"
          : onlineSession.error
            ? "offline"
            : "searching";

      return (
        <MatchmakingScreen
          status={status}
          queueJoinedAt={onlineSession.queueJoinedAt}
          error={
            onlineSession.queueStatus === "timed_out"
              ? "Try again or create a private room."
              : onlineSession.error
          }
          onNavigate={navigatePath}
          onCancel={() => {
            onlineSession.queueLeave();
            navigate({ name: "lobby" });
          }}
          onRetry={() => {
            onlineSession.clearError();
            onlineSession.queueJoin();
          }}
          onBack={() => {
            onlineSession.queueLeave();
            navigate({ name: "lobby" });
          }}
        />
      );
    }

    if (route.name === "assembly") {
      const localRoom = rooms[route.roomId];
      const onlineRoom = onlineSession.onlineRooms[route.roomId];
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
                {onlineSession.error ? <ScreenError message={onlineSession.error} /> : null}
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
      && onlineSession.matchView
      && onlineSession.matchView.matchId === route.matchId
    ) {
      return (
        <OnlineGameProvider
          match={onlineSession.matchView}
          actionError={onlineSession.matchActionError}
          sendMatchAction={onlineSession.sendMatchAction}
        >
          <MatchScreen
            room={activeMatchRoom ?? activeMatch.room}
            matchId={activeMatch.id}
            onNavigate={navigatePath}
            onAbandonMatch={handleAbandonMatch}
            onOpenGuide={() => setGuideOpen(true)}
          />
        </OnlineGameProvider>
      );
    }

    if (route.name === "match" && activeMatch && activeMatch.id === route.matchId) {
      return (
        <MatchScreen
          room={activeMatchRoom ?? activeMatch.room}
          matchId={activeMatch.id}
          onNavigate={navigatePath}
          onAbandonMatch={handleAbandonMatch}
          onOpenGuide={() => setGuideOpen(true)}
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
            onNavigate={navigatePath}
            onAbandonMatch={() => navigate({ name: "lobby" })}
            onOpenGuide={() => setGuideOpen(true)}
            localMode
            localPlayerNames={localPlayerConfig.playerNames}
            localPlayerBots={localPlayerConfig.playerBots}
          />
        </LocalGameProvider>
      );
    }

    if (route.name === "results" && currentRecord) {
      return (
        <ResultsScreen
          record={currentRecord}
          pendingAction={pendingAction}
          onNavigate={navigatePath}
          onCheckOpponent={async () => {
            const room = onlineSession.onlineRooms[currentRecord.roomId] ?? rooms[currentRecord.roomId];
            if (!room) return false;
            if (room.matchStatus === "closed" || room.matchStatus === "paused_disconnected") return false;
            return room.seats.some(s => !s.currentUser && s.occupied);
          }}
          onForgeAnew={() => {
            if (!profile) return;
            setPendingAction("forge-anew");
            const room = seedHostRoom(profile);
            const opponent = currentRecord.opponents[0] ?? "Elden Vale";
            room.seats[1] = {
              ...room.seats[1],
              name: opponent,
              ready: true,
            };
            setRooms((current) => ({ ...current, [room.id]: room }));
            setActiveRoomId(room.id);
            window.setTimeout(() => {
              setPendingAction(null);
              navigate({ name: "assembly", roomId: room.id });
            }, 260);
          }}
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

  const showGuestBanner = profile?.isGuest && !guestBannerDismissed && !["auth", "landing"].includes(route.name);
  const connectionBannerVisible = onlineSession.connectionBannerStatus !== "connected";

  return (
    <div
      className={connectionBannerVisible ? "app-root app-root--connection-offset" : "app-root"}
      data-wyrm-animations={preferences.animationsEnabled ? "on" : "off"}
    >
      <ConnectionBanner
        status={onlineSession.connectionBannerStatus}
        attemptCount={onlineSession.reconnectAttemptCount}
        onRetry={onlineSession.retryReconnect}
        onGoToLobby={handleConnectionBannerLobby}
      />
      <button
        className={showGuestBanner ? "global-back-btn global-back-btn--guest-offset" : "global-back-btn"}
        onClick={navigateBack}
        aria-label="Go back"
        title="Go back"
      >
        <svg fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
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
