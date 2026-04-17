import React, { useEffect, useMemo, useRef, useState } from "react";

import { ConnectionBanner } from "../components/ConnectionBanner.tsx";
import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { SupportModal } from "../components/SupportModal.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import type { ConnectionBannerStatus } from "../online/reconnectModel.ts";
import type { MatchRecord, UserProfile } from "../ui/appModel.ts";
import { getDisplayName, isSupporter } from "../ui/supporterModel.ts";

interface LobbyScreenProps {
  profile: UserProfile;
  quote: string;
  recentChronicles: MatchRecord[];
  pendingAction: string | null;
  error: string | null;
  onNavigate: (href: string) => void;
  connectionStatus?: ConnectionBannerStatus;
  connectionAttemptCount?: number;
  onRetryConnection?: () => void;
  autoCreateRoomOnMount?: boolean;
  onConsumeAutoCreateRoom?: () => void;
  onCreateAssembly: () => void;
  onFindOpponent: () => void;
  onJoinAssembly: (code: string) => void;
  onReplayChronicle: (matchId: string) => void;
}

function NavEntry({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <button type="button" className={disabled ? "sidebar-nav__link sidebar-nav__link--disabled" : "sidebar-nav__link"} onClick={onClick} disabled={disabled}>
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
  connectionStatus = "connected",
  connectionAttemptCount = 0,
  onRetryConnection,
  autoCreateRoomOnMount = false,
  onConsumeAutoCreateRoom,
  onCreateAssembly,
  onFindOpponent,
  onJoinAssembly,
  onReplayChronicle,
}: LobbyScreenProps): React.JSX.Element {
  const [roomCode, setRoomCode] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const canJoin = useMemo(() => roomCode.trim().length > 0, [roomCode]);
  const mountedWithAutoCreateRef = useRef(autoCreateRoomOnMount);
  const autoCreateTriggeredRef = useRef(false);

  useEffect(() => {
    if (!mountedWithAutoCreateRef.current || autoCreateTriggeredRef.current) {
      return;
    }

    if (pendingAction) {
      return;
    }

    autoCreateTriggeredRef.current = true;
    onConsumeAutoCreateRoom?.();
    onCreateAssembly();
  }, [pendingAction, onConsumeAutoCreateRoom, onCreateAssembly]);

  return (
    <main className="shell-page lobby-screen">
      <ConnectionBanner
        status={connectionStatus}
        attemptCount={connectionAttemptCount}
        onRetry={onRetryConnection}
        onGoToLobby={() => onNavigate("/lobby")}
      />
      <aside className="shell-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} />

        <nav className="sidebar-nav" aria-label="Primary">
          <NavEntry label="Settings" onClick={() => onNavigate("/settings")} />
          <NavEntry 
            label="Replays" 
            disabled={recentChronicles.length === 0}
            onClick={() => {
              if (recentChronicles.length > 0) {
                onReplayChronicle(recentChronicles[0].id);
              }
            }}
          />
        </nav>

        <button type="button" className="support-link support-link--sidebar" onClick={() => setSupportOpen(true)}>
          ☕ Support
        </button>

        <div className="sidebar-lore">
          <p>Serpents. Trails.<br/>Ancient runes.</p>
        </div>

        <div className="sidebar-profile">
          <span>{getDisplayName(profile.username, isSupporter())}</span>
        </div>
      </aside>

      <section className="shell-main lobby-main">
        <header className="section-header">
          <h1>Play WYRM</h1>
        </header>

        <div className="lobby-actions">
          <button type="button" className="lobby-cta lobby-cta--create lobby-cta--primary" onClick={onCreateAssembly} disabled={Boolean(pendingAction)}>
            <span className="lobby-cta__icon">+</span>
            <div>
              <strong>Create an online game</strong>
              <p>Start a new room and invite up to 3 players</p>
            </div>
            {pendingAction === "create-room" ? <LoadingPulse label="Forging" /> : null}
          </button>

          <button type="button" className="lobby-cta lobby-cta--create" onClick={() => onNavigate("/local")} disabled={Boolean(pendingAction)}>
            <span className="lobby-cta__icon">🤝</span>
            <div>
              <strong>Pass and Play</strong>
              <p>Start a local game on this device</p>
            </div>
          </button>

          <button type="button" className="lobby-cta lobby-cta--create" onClick={onFindOpponent} disabled={Boolean(pendingAction)}>
            <span className="lobby-cta__icon">VS</span>
            <div>
              <strong>Find opponent</strong>
              <p>Join the live queue for a random challenger</p>
            </div>
          </button>

          <div className="lobby-cta lobby-cta--join">
            <label className="field">
              <span>Room code</span>
              <input
                type="text"
                placeholder="e.g. WY-4829"
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
              {pendingAction === "join-room" ? <LoadingPulse label="Joining" /> : "Join game"}
            </button>
          </div>
        </div>

        {error ? <ScreenError message={error} /> : null}

        <section className="chronicle-section">
          <div className="section-heading">
            <h2>Recent games</h2>
          </div>

          {recentChronicles.length === 0 ? (
            <p style={{ color: "rgba(240, 234, 214, 0.45)", fontSize: "0.875rem" }}>
              No games played yet. Create a room to start your first match.
            </p>
          ) : (
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
          )}
        </section>

        <p className="page-quote">{quote}</p>
      </section>

      {supportOpen ? <SupportModal onClose={() => setSupportOpen(false)} /> : null}
    </main>
  );
}
