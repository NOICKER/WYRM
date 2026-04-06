import React, { useMemo, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { canHostCommence, type AssemblyRoom } from "../ui/appModel.ts";

interface AssemblyLobbyScreenProps {
  room: AssemblyRoom;
  error: string | null;
  pendingAction: string | null;
  onNavigate: (href: string) => void;
  onToggleReady: () => void;
  onSetTimer: (timer: AssemblyRoom["timer"]) => void;
  onCommence: () => void;
  onCopyCode: (code: string) => Promise<boolean>;
}

export function AssemblyLobbyScreen({
  room,
  error,
  pendingAction,
  onNavigate,
  onToggleReady,
  onSetTimer,
  onCommence,
  onCopyCode,
}: AssemblyLobbyScreenProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const currentSeat = room.seats.find((seat) => seat.currentUser);
  const hostSeat = room.seats.find((seat) => seat.host);
  const isHost = currentSeat?.host ?? false;
  const canCommence = useMemo(() => canHostCommence(room.seats), [room.seats]);

  return (
    <main className="assembly-screen">
      <div className="assembly-screen__top">
        <Wordmark href="/lobby" onNavigate={onNavigate} compact />
      </div>

      <section className="assembly-stage">
        <div className="assembly-grid">
          {room.seats.map((seat, index) => (
            <button
              key={seat.id}
              type="button"
              className={[
                "seat-card",
                seat.occupied ? "seat-card--filled" : "seat-card--empty",
                seat.currentUser && seat.occupied ? "seat-card--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (seat.currentUser && seat.occupied) {
                  onToggleReady();
                }
              }}
            >
              {seat.occupied ? (
                <>
                  <div className="seat-card__avatar">{seat.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                  <div className="seat-card__body">
                    <strong>{seat.name}</strong>
                    <span className="level-badge">Lv. {seat.level}</span>
                  </div>
                  <span className={seat.ready ? "status-pill status-pill--ready" : "status-pill status-pill--pending"}>
                    {seat.ready ? "READY" : "PREPARING..."}
                  </span>
                </>
              ) : (
                <>
                  <div className="seat-card__hourglass">⌛</div>
                  <strong>{index === 2 ? "Waiting for player..." : "Invite player"}</strong>
                </>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="assembly-code"
          onClick={async () => {
            const didCopy = await onCopyCode(room.code);
            setCopied(didCopy);
            if (didCopy) {
              window.setTimeout(() => setCopied(false), 1400);
            }
          }}
        >
          <span>Room code: {room.code}</span>
          <span aria-hidden="true">⧉</span>
          {copied ? <em>Copied</em> : null}
        </button>
      </section>

      <aside className="assembly-panel">
        <h2>Settings</h2>

        <div className="variant-grid">
          <button type="button" className="variant-card variant-card--selected">
            <span className="variant-card__art variant-card__art--grove" />
            <div>
              <strong>The Sacred Grove</strong>
              <span>Standard</span>
            </div>
            <span className="variant-card__check">✓</span>
          </button>
          <button type="button" className="variant-card variant-card--locked" disabled>
            <span className="variant-card__art variant-card__art--peaks" />
            <div>
              <strong>The Frozen Peaks</strong>
              <span>Coming soon</span>
            </div>
          </button>
        </div>

        <div className="timer-row">
          {(["30s", "60s", "∞"] as const).map((timer) => (
            <button
              key={timer}
              type="button"
              className={room.timer === timer ? "timer-pill timer-pill--active" : "timer-pill"}
              onClick={() => onSetTimer(timer)}
            >
              {timer}
            </button>
          ))}
        </div>

        <article className="rules-card">
          <ul>
            <li>Guide two wyrms into the Sacred Grove to claim the match immediately.</li>
            <li>Capture all three original wyrms from one rival to force domination.</li>
            <li>Trails, walls, and rune powers reshape the board every turn.</li>
          </ul>
        </article>

        {error ? <ScreenError message={error} /> : null}

        <div className="assembly-panel__footer">
          {isHost ? (
            <button
              type="button"
              className="button button--forest button--wide button--italic"
              disabled={!canCommence || Boolean(pendingAction)}
              onClick={onCommence}
            >
              {pendingAction === "commence"
                ? <LoadingPulse label="Commencing" />
                : "Commence the Race"}
            </button>
          ) : (
            <p className="assembly-panel__waiting">
              {pendingAction === "auto-start" ? <LoadingPulse label="Waiting for the host to begin..." /> : "Waiting for the host to begin..."}
            </p>
          )}

          <div className="server-indicator">
            <span className="server-indicator__dot" />
            <span>{hostSeat?.name ?? room.serverName}</span>
            <strong>{room.latencyMs}ms</strong>
          </div>
        </div>
      </aside>
    </main>
  );
}
