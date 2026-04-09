import React, { useEffect, useEffectEvent, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { toRoman, type MatchRecord } from "../ui/appModel.ts";

interface ResultsScreenProps {
  record: MatchRecord;
  onNavigate: (href: string) => void;
  onForgeAnew: () => void;
  onViewChronicle: () => void;
  pendingAction: string | null;
  onCheckOpponent: () => Promise<boolean>;
  forgeAnewLabel?: string;
  forgeAnewDisabled?: boolean;
  forgeAnewDisabledLabel?: string;
}

export function ResultsScreen({
  record,
  onNavigate,
  onForgeAnew,
  onViewChronicle,
  pendingAction,
  onCheckOpponent,
  forgeAnewLabel = "Play again",
  forgeAnewDisabled = false,
  forgeAnewDisabledLabel,
}: ResultsScreenProps): React.JSX.Element {
  const [opponentConnected, setOpponentConnected] = useState(record.opponentStillConnected ?? true);
  const runOpponentCheck = useEffectEvent(onCheckOpponent);

  useEffect(() => {
    const timer = setTimeout(() => {
      runOpponentCheck().then((stillConnected) => {
        if (!stillConnected) {
          setOpponentConnected(false);
        }
      }).catch(() => {});
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="results-screen">
      <div className="results-screen__top">
        <Wordmark href="/lobby" onNavigate={onNavigate} compact />
      </div>

      <section className="results-screen__content">
        <div className="results-screen__left">
          <p className="results-screen__eyebrow">Masterwork Edition</p>
          <h1>{record.winnerName}</h1>
          <p className="results-screen__quote">{record.flavorQuote}</p>
          <span className="results-screen__session">{toRoman(record.sessionIndex)}</span>
        </div>

        <div className="results-screen__right">
          <div className="results-stats">
            <article className="stat-card">
              <span>Conquest</span>
              <strong>{record.conquest}</strong>
              <p>Wyrms Captured</p>
            </article>
            <article className="stat-card">
              <span>Strategy</span>
              <strong>{record.strategy}</strong>
              <p>Tiles Played</p>
            </article>
          </div>

          <article className="results-banner">
            <div>
              <span>Sacred Grove Control</span>
              <strong>{record.groveControl}%</strong>
            </div>
            <div>
              <span>↑</span>
            </div>
          </article>


          <div className="results-actions">
            {forgeAnewDisabled ? (
              <button
                type="button"
                className="button button--forest"
                disabled
                title={forgeAnewDisabledLabel}
              >
                {forgeAnewDisabledLabel ?? forgeAnewLabel}
              </button>
            ) : opponentConnected ? (
              <button type="button" className="button button--forest" onClick={onForgeAnew} disabled={Boolean(pendingAction)}>
                {pendingAction === "forge-anew" ? <LoadingPulse label="Forging" /> : forgeAnewLabel}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="button button--forest"
                  disabled
                  title="Your opponent has left the match."
                >
                  {forgeAnewLabel}
                </button>
                <button type="button" className="text-link" onClick={() => onNavigate("/lobby")}>
                  Create a new room instead
                </button>
              </div>
            )}
            <button type="button" className="button button--outline" onClick={onViewChronicle}>
              View replay
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
