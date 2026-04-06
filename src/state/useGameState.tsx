/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState } from "react";

import type {
  Coord,
  DieResult,
  GameState,
  MoveMode,
  PlayerCount,
  RuneTileType,
  TilePlayRequest,
  WyrmId,
} from "./types.ts";
import { createInitialState } from "./gameLogic.ts";
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

export interface GameContextProps {
  state: GameState;
  startNewGame: (playerCount: PlayerCount) => void;
  draw: () => void;
  discard: (tiles: RuneTileType[]) => void;
  roll: (forced?: DieResult) => void;
  setCoilChoice: (choice: 1 | 2 | 3 | "extra_trail") => void;
  move: (wyrmId: WyrmId, path: Coord[], moveMode?: MoveMode) => void;
  placeCoilTrail: (wyrmId: WyrmId, target?: Coord) => void;
  deploy: (wyrmId: WyrmId, target: Coord) => void;
  playTile: (request: TilePlayRequest) => void;
  endTurn: () => void;
}

export const GameContext = createContext<GameContextProps | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<GameState>(() => createInitialState(2));

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

export function useGame(): GameContextProps {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used inside GameProvider");
  }
  return context;
}
