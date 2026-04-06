import React from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import { toRoman, type MatchRecord } from "../ui/appModel.ts";

interface ResultsScreenProps {
  record: MatchRecord;
  onNavigate: (href: string) => void;
  onForgeAnew: () => void;
  onViewChronicle: () => void;
  pendingAction: string | null;
}

export function ResultsScreen({
  record,
  onNavigate,
  onForgeAnew,
  onViewChronicle,
  pendingAction,
}: ResultsScreenProps): React.JSX.Element {
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
              <p>{record.factionRep}</p>
            </div>
          </article>

          <article className="progress-card">
            <div className="progress-card__header">
              <strong>Level {Math.max(1, Math.ceil(record.xpEarned / 120))}</strong>
              <span>{record.xpEarned} XP</span>
            </div>
            <div className="xp-bar">
              <span style={{ width: `${Math.min(100, (record.xpEarned / 300) * 100)}%` }} />
            </div>
            <div className="progress-card__sources">
              <span>{record.xpSources[0]}</span>
              <span>{record.xpSources[1]}</span>
            </div>
          </article>

          <div className="results-actions">
            <button type="button" className="button button--forest" onClick={onForgeAnew} disabled={Boolean(pendingAction)}>
              {pendingAction === "forge-anew" ? <LoadingPulse label="Forging" /> : "FORGE ANEW"}
            </button>
            <button type="button" className="button button--outline" onClick={onViewChronicle}>
              VIEW THE CHRONICLE
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
