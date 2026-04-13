import React, { useState } from "react";
import { Wordmark } from "../components/Wordmark.tsx";
import type { PlayerCount } from "../state/types.ts";
import { PLAYER_PALETTE } from "../ui/appModel.ts";
import { createInitialState, PLAYER_ORDER_BY_COUNT } from "../state/gameLogic.ts";
import type { GameState } from "../state/types.ts";
import type { BotDifficulty } from "../state/botEngine.ts";

interface LocalSetupScreenProps {
  onNavigate: (href: string) => void;
  onStartGame: (initialState: GameState, playerNames: Record<number, string>, playerBots: Record<number, BotDifficulty>) => void;
}

const PLAYER_COLORS = ["purple", "coral", "teal", "amber"] as const;

export function LocalSetupScreen({ onNavigate, onStartGame }: LocalSetupScreenProps): React.JSX.Element {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);

  const [playerNames, setPlayerNames] = useState<Record<number, string>>(() => {
    const ids = PLAYER_ORDER_BY_COUNT[2];
    return Object.fromEntries(ids.map((id, i) => [id, `Player ${i + 1}`]));
  });
  const [playerTypes, setPlayerTypes] = useState<Record<number, "human" | BotDifficulty>>({
    1: "human",
    2: "human",
    3: "human",
    4: "human",
  });

  const handleStart = () => {
    const initialState = createInitialState(playerCount);
    // playerTypes is already keyed by real player IDs, so this is correct
    const playerBots = Object.entries(playerTypes).reduce((acc, [id, type]) => {
      if (Number(id) !== 1 && type !== "human") {
        acc[Number(id)] = type as BotDifficulty;
      }
      return acc;
    }, {} as Record<number, BotDifficulty>);

    onStartGame(initialState, playerNames, playerBots);
  };

  // The active slots for this player count use real game player IDs
  const activePlayerIds = PLAYER_ORDER_BY_COUNT[playerCount];

  return (
    <main className="shell-page local-setup-screen">
      <aside className="shell-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} />
        <nav className="sidebar-nav" aria-label="Primary">
          <button type="button" className="sidebar-nav__link" onClick={() => onNavigate("/lobby")}>
            <span>← Back to Lobby</span>
          </button>
        </nav>
      </aside>

      <section className="shell-main local-setup-main">
        <header className="section-header">
          <h1>Local Game</h1>
        </header>

        <div className="local-setup-panel">
          <div className="local-setup-panel__group">
            <label className="field">
              <span>Player Count</span>
              <select
                value={playerCount}
                onChange={(e) => {
                  const count = Number(e.target.value) as PlayerCount;
                  setPlayerCount(count);
                  const ids = PLAYER_ORDER_BY_COUNT[count];
                  setPlayerNames(Object.fromEntries(ids.map((id, i) => [id, `Player ${i + 1}`])));
                  setPlayerTypes(Object.fromEntries(ids.map((id, i) => [id, i === 0 ? "human" : "human"])));
                }}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </label>
          </div>

          <div className="local-player-list">
            {activePlayerIds.map((playerId, i) => {
              const colorName = PLAYER_COLORS[i];
              const colorHex = PLAYER_PALETTE[colorName].base;
              const selectedType = i === 0 ? "human" : playerTypes[playerId];

              return (
                <div key={playerId} className="local-player-card">
                  <div className="local-player-card__dot" style={{ backgroundColor: colorHex }} />
                  <div className="local-player-card__fields">
                    <label className="field">
                      <span>
                        Player {i + 1} <span style={{ color: "var(--color-ink-muted, #888)", fontWeight: "normal" }}>({colorName})</span>
                      </span>
                      <input
                        type="text"
                        value={playerNames[playerId]}
                        onChange={(e) => setPlayerNames(prev => ({ ...prev, [playerId]: e.target.value }))}
                        disabled={selectedType !== "human"}
                        style={{ opacity: selectedType !== "human" ? 0.6 : 1 }}
                      />
                    </label>
                    <label className="field">
                      <span>Type</span>
                      <select
                        value={i === 0 ? "human" : playerTypes[playerId]}
                        disabled={i === 0}
                        onChange={(e) => {
                          const type = e.target.value as "human" | BotDifficulty;
                          setPlayerTypes(prev => ({ ...prev, [playerId]: type }));
                          if (type !== "human") {
                            setPlayerNames(prev => ({ ...prev, [playerId]: `Bot (${type})` }));
                          } else {
                            setPlayerNames(prev => ({ ...prev, [playerId]: `Player ${i + 1}` }));
                          }
                        }}
                      >
                        <option value="human">Human</option>
                        <option value="light">Bot (Light)</option>
                        <option value="easy">Bot (Easy)</option>
                        <option value="hard">Bot (Hard)</option>
                        <option value="harder">Bot (Harder)</option>
                        <option value="hardest">Bot (Hardest)</option>
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="local-setup-actions">
            <button
              type="button"
              className="button button--forest"
              onClick={handleStart}
            >
              Start Game
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
