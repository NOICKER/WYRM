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
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <h3>Trail System</h3>
            <p>Every move leaves a trail that blocks all pieces including yours.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M12 12h.01"/><path d="M8 8h.01"/><path d="M16 16h.01"/><path d="M8 16h.01"/><path d="M16 8h.01"/></svg>
            </div>
            <h3>Rune Die</h3>
            <p>Roll to move. Coil lets you choose. Surge sends you flying.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="3" rx="2" ry="2"/><rect width="16" height="10" x="4" y="11" rx="2" ry="2"/><path d="M10 15h4"/></svg>
            </div>
            <h3>Capture & Hoard</h3>
            <p>Land on enemies to capture them. Deploy captured pieces later.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <h3>Elder Promotion</h3>
            <p>Reach an enemy Den to unlock 8-directional free movement.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="10" x="7" y="7" rx="1"/></svg>
            </div>
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
