import React, { useMemo } from "react";

import type { ClientMatchView, MatchActionPayload } from "../online/protocol.ts";
import { GameContext, type GameContextProps } from "./useGameState.tsx";

interface OnlineGameProviderProps {
  children: React.ReactNode;
  match: ClientMatchView;
  actionError: string | null;
  sendMatchAction: (matchId: string, action: MatchActionPayload) => boolean;
}

export function OnlineGameProvider({
  children,
  match,
  actionError,
  sendMatchAction,
}: OnlineGameProviderProps): React.JSX.Element {
  const state = useMemo(
    () => (actionError ? { ...match.state, error: actionError } : match.state),
    [actionError, match.state],
  );

  const value = useMemo<GameContextProps>(
    () => ({
      state,
      startNewGame: () => {
        // Online matches are created and owned by the backend.
      },
      draw: () => {
        sendMatchAction(match.matchId, { type: "draw" });
      },
      discard: (tiles) => {
        sendMatchAction(match.matchId, { type: "discard", tiles });
      },
      roll: () => {
        sendMatchAction(match.matchId, { type: "roll" });
      },
      setCoilChoice: (choice) => {
        sendMatchAction(match.matchId, { type: "set_coil_choice", choice });
      },
      move: (wyrmId, path, moveMode) => {
        sendMatchAction(match.matchId, { type: "move", wyrmId, path, moveMode });
      },
      placeCoilTrail: (wyrmId, target) => {
        sendMatchAction(match.matchId, { type: "place_coil_trail", wyrmId, target });
      },
      deploy: (wyrmId, target) => {
        sendMatchAction(match.matchId, { type: "deploy", wyrmId, target });
      },
      playTile: (request) => {
        sendMatchAction(match.matchId, { type: "play_tile", request });
      },
      endTurn: () => {
        sendMatchAction(match.matchId, { type: "end_turn" });
      },
    }),
    [match.matchId, sendMatchAction, state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
