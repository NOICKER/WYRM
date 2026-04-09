import React, { useEffect, useMemo, useState } from "react";

import { Wordmark } from "../components/Wordmark.tsx";
import { toRoman, type MatchRecord } from "../ui/appModel.ts";

interface ChronicleScreenProps {
  record: MatchRecord;
  onNavigate: (href: string) => void;
}

export function ChronicleScreen({
  record,
  onNavigate,
}: ChronicleScreenProps): React.JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setIndex((current) => Math.min(record.events.length - 1, current + 1));
    }, 1200 / speed);
    return () => window.clearTimeout(timeout);
  }, [index, playing, record.events.length, speed]);

  const currentEvent = record.events[index] ?? record.events[0];
  const visibleEvents = useMemo(
    () => record.events.slice(0, Math.max(index + 1, 1)),
    [index, record.events],
  );
  const groupedRounds = useMemo(() => {
    const groups = new Map<number, typeof visibleEvents>();
    visibleEvents.forEach((event) => {
      const group = groups.get(event.round) ?? [];
      group.push(event);
      groups.set(event.round, group);
    });
    return Array.from(groups.entries());
  }, [visibleEvents]);

  return (
    <main className="shell-page chronicle-screen">
      <aside className="shell-sidebar chronicle-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} subtitle="The Tome" tagline="Masterwork Edition" />

        <nav className="sidebar-nav" aria-label="Primary">
          <button type="button" className="sidebar-nav__link">
            Replay
          </button>
        </nav>
      </aside>

      <section className="shell-main chronicle-main">
        <header className="chronicle-main__header">
          <div>
            <h1>The Chronicle</h1>
            <p>Scribe: {record.localPlayerName} | Session #{record.id}</p>
          </div>
          <div className="info-pills">
            <span>Current Round {toRoman(currentEvent?.round ?? 1)}</span>
            <span>Active Player {currentEvent?.playerName ?? record.winnerName}</span>
          </div>
        </header>

        <div className="chronicle-feed">
          {groupedRounds.length === 0 ? (
            <p className="chronicle-empty">No matches recorded yet. Play your first game to begin.</p>
          ) : null}
          {groupedRounds.map(([round, events]) => (
            <section key={round} className="chronicle-round">
              <div className="chronicle-round__separator">Round {toRoman(round)}</div>
              {events.map((event, eventIndex) => (
                <article
                  key={event.id}
                  className={[
                    "chronicle-event",
                    event.eventType === "combat" ? "chronicle-event--combat" : "",
                    eventIndex === events.length - 1 && round === currentEvent.round ? "chronicle-event--current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="chronicle-event__lead">
                    <span className="chronicle-event__avatar" style={{ backgroundColor: "var(--accent-amber)" }}>
                      {event.playerName[0]}
                    </span>
                    <div>
                      {event.eventType === "combat" ? <span className="chronicle-event__header">COMBAT ENCOUNTER</span> : null}
                      <h3>{event.title}</h3>
                      <p>{event.description}</p>
                    </div>
                  </div>
                  <div className="chronicle-event__meta">
                    <span>{event.actionBadge}</span>
                    {event.regionTag ? <span>{event.regionTag}</span> : null}
                  </div>
                  {event.artTitle ? <div className={`chronicle-event__art chronicle-event__art--${event.eventType}`}>{event.artTitle}</div> : null}
                </article>
              ))}
            </section>
          ))}
        </div>

        <footer className="playback-bar">
          <div className="playback-controls">
            <button type="button" className="icon-button" onClick={() => setIndex(0)}>
              ⏮
            </button>
            <button type="button" className="icon-button" onClick={() => setPlaying((current) => !current)}>
              {playing ? "⏸" : "▶"}
            </button>
            <button type="button" className="icon-button" onClick={() => setIndex(record.events.length - 1)}>
              ⏭
            </button>
          </div>

          <div className="playback-scrubber">
            <input
              type="range"
              min={0}
              max={Math.max(0, record.events.length - 1)}
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
            />
            <span>
              ROUND {toRoman(currentEvent?.round ?? 1)}: EVENT {String(index + 1).padStart(2, "0")} (CURRENT)
            </span>
          </div>

          <div className="speed-selector">
            {[1, 1.5, 2].map((option) => (
              <button
                key={option}
                type="button"
                className={speed === option ? "speed-selector__button speed-selector__button--active" : "speed-selector__button"}
                onClick={() => setSpeed(option)}
              >
                {option}x
              </button>
            ))}
          </div>

          <div className="victory-indicator">{record.winnerName} prevailed</div>
        </footer>
      </section>
    </main>
  );
}
