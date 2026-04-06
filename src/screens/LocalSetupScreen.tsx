import React, { useState } from "react";
import { Wordmark } from "../components/Wordmark.tsx";
import type { PlayerCount } from "../state/types.ts";
import { PLAYER_PALETTE } from "../ui/appModel.ts";
import { createInitialState } from "../state/gameLogic.ts";
import type { GameState } from "../state/types.ts";
import type { BotDifficulty } from "../state/botEngine.ts";

interface LocalSetupScreenProps {
  onNavigate: (href: string) => void;
  onStartGame: (initialState: GameState, playerNames: Record<number, string>, playerBots: Record<number, BotDifficulty>) => void;
}

const PLAYER_COLORS = ["purple", "coral", "teal", "amber"] as const;

export function LocalSetupScreen({ onNavigate, onStartGame }: LocalSetupScreenProps): React.JSX.Element {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [playerNames, setPlayerNames] = useState<Record<number, string>>({
    1: "Player 1",
    2: "Player 2",
    3: "Player 3",
    4: "Player 4"
  });
  const [playerTypes, setPlayerTypes] = useState<Record<number, "human" | BotDifficulty>>({
    1: "human",
    2: "human",
    3: "human",
    4: "human"
  });

  const handleStart = () => {
    const initialState = createInitialState(playerCount);
    const playerBots = Object.entries(playerTypes).reduce((acc, [id, type]) => {
      if (type !== "human") {
        acc[Number(id)] = type as BotDifficulty;
      }
      return acc;
    }, {} as Record<number, BotDifficulty>);

    onStartGame(initialState, playerNames, playerBots);
  };

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

        <div className="local-setup-content" style={{ maxWidth: "600px", marginTop: "2rem" }}>
          <div className="field-group" style={{ marginBottom: "3rem" }}>
            <label className="field">
              <span style={{ fontSize: "0.875rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.5rem", display: "block" }}>Player Count</span>
              <select 
                value={playerCount} 
                onChange={(e) => setPlayerCount(Number(e.target.value) as PlayerCount)}
                style={{ 
                  padding: "0.75rem", 
                  backgroundColor: "var(--color-parchment-soft, #fdfbfa)", 
                  border: "1px solid var(--color-ink-muted, #888)", 
                  borderRadius: "4px", 
                  fontSize: "1rem",
                  width: "100%",
                  fontFamily: "var(--font-body)"
                }}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </select>
            </label>
          </div>

          <div className="player-slots" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {Array.from({ length: playerCount }).map((_, i) => {
              const id = i + 1;
              const colorName = PLAYER_COLORS[i];
              const colorHex = PLAYER_PALETTE[colorName].base;

              return (
                <div key={id} style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem", backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--color-ink-muted, #888)" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: colorHex, flexShrink: 0, marginTop: "0.5rem" }} />
                  <div style={{ flexGrow: 1, display: "flex", gap: "1rem" }}>
                    <label className="field" style={{ flexGrow: 1, margin: 0 }}>
                      <span style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Player {id} <span style={{ color: "var(--color-ink-muted, #888)", fontWeight: "normal" }}>({colorName})</span>
                      </span>
                      <input 
                        type="text" 
                        value={playerNames[id]} 
                        onChange={(e) => setPlayerNames(prev => ({ ...prev, [id]: e.target.value }))} 
                        disabled={playerTypes[id] !== "human"}
                        style={{ 
                          width: "100%", 
                          padding: "0.75rem", 
                          boxSizing: "border-box", 
                          border: "1px solid var(--color-ink-muted, #888)", 
                          borderRadius: "4px",
                          fontFamily: "var(--font-body)",
                          fontSize: "1rem",
                          opacity: playerTypes[id] !== "human" ? 0.6 : 1
                        }}
                      />
                    </label>
                    <label className="field" style={{ width: "140px", margin: 0 }}>
                      <span style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Type</span>
                      <select 
                        value={playerTypes[id]}
                        onChange={(e) => {
                          const type = e.target.value as "human" | BotDifficulty;
                          setPlayerTypes(prev => ({ ...prev, [id]: type }));
                          if (type !== "human") {
                            setPlayerNames(prev => ({ ...prev, [id]: `Bot (${type})` }));
                          } else {
                            setPlayerNames(prev => ({ ...prev, [id]: `Player ${id}` }));
                          }
                        }}
                        style={{ 
                          width: "100%", 
                          padding: "0.75rem", 
                          boxSizing: "border-box", 
                          border: "1px solid var(--color-ink-muted, #888)", 
                          borderRadius: "4px",
                          fontFamily: "var(--font-body)",
                          fontSize: "1rem"
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

          <div style={{ marginTop: "3rem" }}>
            <button 
              type="button" 
              className="button button--forest" 
              style={{ padding: "1rem 2rem", fontSize: "1.25rem" }}
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
