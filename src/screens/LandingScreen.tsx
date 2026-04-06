import React from "react";
import { Wordmark } from "../components/Wordmark.tsx";

interface LandingScreenProps {
  onNavigate: (href: string) => void;
}

export function LandingScreen({ onNavigate }: LandingScreenProps): React.JSX.Element {
  return (
    <main className="landing-screen">
      <section className="landing-hero">
        <div className="landing-hero__wordmark">
          <Wordmark href="/" onNavigate={onNavigate} />
        </div>
        <p className="landing-hero__description">
          A 2–4 player strategy board game of serpents, trails, and ancient runes.
        </p>
        <div className="landing-hero__actions">
          <button 
            type="button" 
            className="button button--forest" 
            onClick={() => onNavigate("/auth")}
          >
            Sign in
          </button>
          <button 
            type="button" 
            className="button button--outline" 
            onClick={() => onNavigate("/auth?guest=true")}
          >
            Play as guest
          </button>
        </div>
        <div className="landing-hero__preview">
          <div className="landing-hero__preview-placeholder">
            <span>Game board preview</span>
          </div>
        </div>
      </section>

      <section className="landing-mechanics">
        <div className="landing-mechanics__scroll">
          <div className="mechanic-card">
            <div className="mechanic-card__icon" />
            <h3>Trail System</h3>
            <p>Every move leaves a trail that blocks all pieces including yours.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon" />
            <h3>Rune Die</h3>
            <p>Roll to move. Coil lets you choose. Surge sends you flying.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon" />
            <h3>Capture & Hoard</h3>
            <p>Land on enemies to capture them. Deploy captured pieces later.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon" />
            <h3>Elder Promotion</h3>
            <p>Reach an enemy Den to unlock 8-directional free movement.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon" />
            <h3>Rune Tiles</h3>
            <p>Draw tiles each turn. Collect 3 matching to trigger a Lair Power.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <button type="button" className="text-link" onClick={() => onNavigate("/auth")}>
          Already have an account? Sign in
        </button>
        <Wordmark href="/" compact onNavigate={onNavigate} />
      </footer>
    </main>
  );
}
