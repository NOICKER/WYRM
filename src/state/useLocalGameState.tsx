import React, { useMemo, useState } from "react";
import type { GameState } from "./types.ts";
import { GameContext, type GameContextProps } from "./useGameState.tsx";
import {
  actionDiscard,
  actionDraw,
  actionEndTurn,
  actionMove,
  actionPlayTile,
  actionPlaceCoilTrail,
  actionRoll,
  actionSetCoilChoice,
  actionStartNewGame,
  actionDeploy,
} from "./gameEngine.ts";

interface LocalGameProviderProps {
  children: React.ReactNode;
  initialState: GameState;
}

export function LocalGameProvider({ children, initialState }: LocalGameProviderProps): React.JSX.Element {
  const [state, setState] = useState<GameState>(initialState);

  const value = useMemo<GameContextProps>(
    () => ({
      state,
      startNewGame: (playerCount) => setState(actionStartNewGame(playerCount)),
      draw: () => setState((current) => actionDraw(current)),
      discard: (tiles) => setState((current) => actionDiscard(current, tiles)),
      roll: (forced) => setState((current) => actionRoll(current, forced)),
      setCoilChoice: (choice) => setState((current) => actionSetCoilChoice(current, choice)),
      move: (wyrmId, path, moveMode) => setState((current) => actionMove(current, wyrmId, path, moveMode)),
      placeCoilTrail: (wyrmId, target) => setState((current) => actionPlaceCoilTrail(current, wyrmId, target)),
      deploy: (wyrmId, target) => setState((current) => actionDeploy(current, wyrmId, target)),
      playTile: (request) => setState((current) => actionPlayTile(current, request)),
      endTurn: () => setState((current) => actionEndTurn(current)),
    }),
    [state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
