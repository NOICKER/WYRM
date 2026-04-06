import React, { useEffect, useMemo, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { formatQueueElapsed, getMatchmakingSubtext } from "../online/sessionModel.ts";

type MatchmakingViewState = "searching" | "timed_out" | "offline";

interface MatchmakingScreenProps {
  status: MatchmakingViewState;
  queueJoinedAt: number | null;
  error: string | null;
  onNavigate: (href: string) => void;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function MatchmakingScreen({
  status,
  queueJoinedAt,
  error,
  onNavigate,
  onCancel,
  onRetry,
  onBack,
}: MatchmakingScreenProps): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "searching") {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const elapsedMs = Math.max(0, now - (queueJoinedAt ?? now));
  const subtext = useMemo(() => getMatchmakingSubtext(elapsedMs), [elapsedMs]);

  return (
    <main className="shell-page matchmaking-screen">
      <aside className="shell-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} />
      </aside>

      <section className="shell-main matchmaking-screen__main">
        <div className="matchmaking-screen__card">
          <p className="matchmaking-screen__eyebrow">Live Matchmaking</p>
          <h1>Finding an opponent</h1>

          {status === "searching" ? (
            <>
              <div className="matchmaking-screen__pulse">
                <LoadingPulse label="Searching" />
              </div>
              <p className="matchmaking-screen__subtext">{subtext}</p>
              <p className="matchmaking-screen__timer">{formatQueueElapsed(elapsedMs)}</p>
              {error ? <ScreenError message={error} /> : null}
              <div className="matchmaking-screen__actions">
                <button type="button" className="button button--forest" onClick={onCancel}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <article className="matchmaking-screen__notice">
                <strong>No opponent found.</strong>
                <p>{error ?? "Try again or create a private room."}</p>
              </article>
              <div className="matchmaking-screen__actions">
                <button type="button" className="button button--forest" onClick={onRetry}>
                  Retry
                </button>
                <button type="button" className="text-link" onClick={onBack}>
                  Back to lobby
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
