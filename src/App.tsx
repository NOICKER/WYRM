import React, { useCallback, useEffect, useMemo, useState } from "react";

import { RouteCrossfade } from "./components/RouteCrossfade.tsx";
import { PlayerGuide } from "./components/PlayerGuide.tsx";
import { ChronicleScreen } from "./screens/ChronicleScreen.tsx";
import { AuthScreen } from "./screens/AuthScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { AssemblyLobbyScreen } from "./screens/AssemblyLobbyScreen.tsx";
import { MatchScreen } from "./screens/MatchScreen.tsx";
import { ResultsScreen } from "./screens/ResultsScreen.tsx";
import { GameProvider, useGame } from "./state/useGameState.tsx";
import type { PlayerColor, PlayerId } from "./state/types.ts";
import "./index.css";
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
  type AppRoute,
  type AssemblyRoom,
  type MatchRecord,
  type UserProfile,
} from "./ui/appModel.ts";

interface ActiveMatchSession {
  id: string;
  roomId: string;
  room: AssemblyRoom;
  events: ReturnType<typeof buildChronicleEvent>[];
  seenLogHead: string | null;
  completed: boolean;
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
  const [completedMatches, setCompletedMatches] = useState<Record<string, MatchRecord>>(() => ({
    "seed-1": createSeedRecord("seed-1", 1, "Sable Quill", "Sable Quill", "amber", "win"),
    "seed-2": createSeedRecord("seed-2", 2, "Sable Quill", "Mara Thorne", "purple", "loss"),
    "seed-3": createSeedRecord("seed-3", 3, "Sable Quill", "Sable Quill", "amber", "win"),
  }));

  const completedList = useMemo(
    () => Object.values(completedMatches).sort((a, b) => b.sessionIndex - a.sessionIndex),
    [completedMatches],
  );

  const activeRoom = activeRoomId ? rooms[activeRoomId] ?? null : null;

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
    const routeRecord =
      route.name === "results" || route.name === "chronicle" ? completedMatches[route.matchId] : null;
    const redirect = getProtectedRedirect(route, {
      authenticated: Boolean(profile),
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
    if (!activeMatch) {
      return;
    }
    const newestLog = game.state.log[0];
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
            buildChronicleEvent(newestLog, game.state.currentRound, current.room, current.events.length),
          ],
        };
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeMatch, game.state.currentRound, game.state.log]);

  useEffect(() => {
    if (!activeMatch || activeMatch.completed || !profile || !game.state.winner) {
      return;
    }

    const record = {
      ...buildMatchRecord(game.state, activeMatch.room, profile, sessionCounter, activeMatch.events),
      id: activeMatch.id,
    };

    const timeout = window.setTimeout(() => {
      setCompletedMatches((current) => ({ ...current, [record.id]: record }));
      setSessionCounter((current) => current + 1);
      setActiveMatch((current) => (current ? { ...current, completed: true } : current));
      setPendingAction(null);
      navigate({ name: "results", matchId: record.id });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeMatch, game.state, navigate, profile, sessionCounter]);

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

  const currentRecord =
    route.name === "results" || route.name === "chronicle" ? completedMatches[route.matchId] : null;

  const page = (() => {
    if (!profile || route.name === "auth") {
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
          onCreateAssembly={() => {
            setPendingAction("create-room");
            setError(null);
            window.setTimeout(() => {
              const room = seedHostRoom(profile);
              setRooms((current) => ({ ...current, [room.id]: room }));
              setActiveRoomId(room.id);
              setPendingAction(null);
              navigate({ name: "assembly", roomId: room.id });
            }, 260);
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

    if (route.name === "assembly") {
      const room = rooms[route.roomId];
      if (!room) {
        return (
          <LobbyScreen
            profile={profile}
            quote={lobbyQuote}
            recentChronicles={completedList}
            pendingAction={pendingAction}
            error="That assembly dissolved before you arrived. Return to the lobby and try another sigil."
            onNavigate={navigatePath}
            onCreateAssembly={() => {}}
            onJoinAssembly={() => {}}
            onReplayChronicle={(matchId) => navigate({ name: "chronicle", matchId })}
          />
        );
      }
      return (
        <AssemblyLobbyScreen
          room={room}
          error={error}
          pendingAction={pendingAction}
          onNavigate={navigatePath}
          onToggleReady={() => {
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
            setRooms((current) => ({
              ...current,
              [room.id]: {
                ...room,
                timer,
              },
            }));
          }}
          onCommence={() => {
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

    if (route.name === "match" && activeMatch && activeMatch.id === route.matchId) {
      return <MatchScreen room={activeMatch.room} matchId={activeMatch.id} onNavigate={navigatePath} />;
    }

    if (route.name === "results" && currentRecord) {
      return (
        <ResultsScreen
          record={currentRecord}
          pendingAction={pendingAction}
          onNavigate={navigatePath}
          onForgeAnew={() => {
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
          onOpenTome={() => setGuideOpen(true)}
        />
      );
    }

    return (
      <LobbyScreen
        profile={profile}
        quote={lobbyQuote}
        recentChronicles={completedList}
        pendingAction={pendingAction}
        error="That page was not bound into the Tome. You have been returned to the lobby."
        onNavigate={navigatePath}
        onCreateAssembly={() => navigate({ name: "lobby" })}
        onJoinAssembly={() => navigate({ name: "lobby" })}
        onReplayChronicle={(matchId) => navigate({ name: "chronicle", matchId })}
      />
    );
  })();

  return (
    <>
      <button
        className="global-back-btn"
        onClick={() => window.history.back()}
        aria-label="Go back"
        title="Go back"
      >
        <svg fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <RouteCrossfade routeKey={toPath(route)}>{page}</RouteCrossfade>
      <PlayerGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
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
