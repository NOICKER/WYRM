import React, { useMemo, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import type { MatchRecord, UserProfile } from "../ui/appModel.ts";

interface LobbyScreenProps {
  profile: UserProfile;
  quote: string;
  recentChronicles: MatchRecord[];
  pendingAction: string | null;
  error: string | null;
  onNavigate: (href: string) => void;
  onCreateAssembly: () => void;
  onJoinAssembly: (code: string) => void;
  onReplayChronicle: (matchId: string) => void;
}

function NavEntry({
  label,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button type="button" className={disabled ? "sidebar-nav__link sidebar-nav__link--disabled" : "sidebar-nav__link"}>
      <span>{label}</span>
      {disabled ? <span className="sidebar-nav__pill">v1</span> : null}
    </button>
  );
}

export function LobbyScreen({
  profile,
  quote,
  recentChronicles,
  pendingAction,
  error,
  onNavigate,
  onCreateAssembly,
  onJoinAssembly,
  onReplayChronicle,
}: LobbyScreenProps): React.JSX.Element {
  const [roomCode, setRoomCode] = useState("");
  const canJoin = useMemo(() => roomCode.trim().length > 0, [roomCode]);

  return (
    <main className="shell-page lobby-screen">
      <aside className="shell-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} subtitle="The Tome" tagline="Masterwork Edition" />

        <nav className="sidebar-nav" aria-label="Primary">
          <NavEntry label="Chronicle" />
          <NavEntry label="Vault" disabled />
          <NavEntry label="Armory" disabled />
          <NavEntry label="Map" disabled />
        </nav>

        <div className="sidebar-profile">
          <span>{profile.username}</span>
          <span className="level-badge">Lv. {profile.level}</span>
        </div>
      </aside>

      <section className="shell-main lobby-main">
        <header className="section-header">
          <p>Venture Forth</p>
          <h1>Command Center</h1>
        </header>

        <div className="lobby-actions">
          <button type="button" className="lobby-cta lobby-cta--create" onClick={onCreateAssembly} disabled={Boolean(pendingAction)}>
            <span className="lobby-cta__icon">+</span>
            <div>
              <strong>CREATE A NEW ASSEMBLY</strong>
              <p>Forge a new path and lead your allies</p>
            </div>
            {pendingAction === "create-room" ? <LoadingPulse label="Forging" /> : null}
          </button>

          <div className="lobby-cta lobby-cta--join">
            <label className="field">
              <span>ASSEMBLY CODE</span>
              <input
                type="text"
                placeholder="Enter the sigil code..."
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              />
            </label>
            <button
              type="button"
              className="button button--forest"
              disabled={!canJoin || Boolean(pendingAction)}
              onClick={() => onJoinAssembly(roomCode)}
            >
              {pendingAction === "join-room" ? <LoadingPulse label="Joining" /> : "JOIN AN ASSEMBLY"}
            </button>
          </div>
        </div>

        {error ? <ScreenError message={error} /> : null}

        <section className="chronicle-section">
          <div className="section-heading">
            <h2>Recent Chronicles</h2>
          </div>

          <div className="chronicle-strip">
            {recentChronicles.slice(0, 3).map((record) => (
              <article key={record.id} className="chronicle-card">
                <span
                  className={`chronicle-card__badge chronicle-card__badge--${record.result}`}
                  style={{ backgroundColor: record.result === "win" ? record.winnerColor === "amber" ? "#b8860b" : undefined : undefined }}
                >
                  {record.result.toUpperCase()}
                </span>
                <div>
                  <h3>{record.opponents.join(" • ")}</h3>
                  <p>{record.rounds} rounds recorded</p>
                </div>
                <button type="button" className="text-link" onClick={() => onReplayChronicle(record.id)}>
                  Replay
                </button>
              </article>
            ))}
          </div>
        </section>

        <p className="page-quote">{quote}</p>
      </section>
    </main>
  );
}
