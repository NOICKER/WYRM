import React, { useMemo, useState, useEffect } from "react";
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
import { chooseBotAction, type BotDifficulty } from "./botEngine.ts";

interface LocalGameProviderProps {
  children: React.ReactNode;
  initialState: GameState;
  playerBots?: Record<number, BotDifficulty>;
}

export function LocalGameProvider({ children, initialState, playerBots = {} }: LocalGameProviderProps): React.JSX.Element {
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

  useEffect(() => {
    if (state.winner || state.phase === "game_over") {
      return;
    }

    const currentPlayer = state.players[state.currentPlayerIndex];
    const difficulty = playerBots[currentPlayer.id];
    
    if (difficulty) {
      // Quick actions (draw / discard / roll / coil choice) feel instant;
      // move & tile decisions get a longer pause so humans can follow the play.
      const isQuickPhase =
        state.phase === "draw" ||
        state.phase === "discard" ||
        state.phase === "roll" ||
        (state.dieResult === "coil" && state.turnEffects.coilChoice == null);
      const delay = isQuickPhase ? 200 : 800;

      const timeout = setTimeout(() => {
        setState((current) => {
          // Double-check to prevent race conditions during rapid updates
          if (
            current.winner ||
            current.phase === "game_over" ||
            current.players[current.currentPlayerIndex].id !== currentPlayer.id
          ) {
            return current;
          }

          const action = chooseBotAction(current, difficulty);

          switch (action.type) {
            case "draw":
              return actionDraw(current);
            case "discard":
              return actionDiscard(current, action.tiles);
            case "roll":
              return actionRoll(current);
            case "set_coil_choice":
              return actionSetCoilChoice(current, action.choice);
            case "move":
              return actionMove(current, action.wyrmId, action.path, action.moveMode);
            case "deploy":
              return actionDeploy(current, action.wyrmId, action.target);
            case "place_coil_trail":
              return actionPlaceCoilTrail(current, action.wyrmId, action.target);
            case "play_tile":
              return actionPlayTile(current, action);
            case "end_turn":
            default:
              return actionEndTurn(current);
          }
        });
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [state, playerBots]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
