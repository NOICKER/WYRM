import React from "react";
import { Wordmark } from "../components/Wordmark.tsx";

interface LandingScreenProps {
  onNavigate: (href: string) => void;
  onEnter: (name: string, clientId: string) => void;
}

export function LandingScreen({ onNavigate, onEnter }: LandingScreenProps): React.JSX.Element {
  const [name, setName] = React.useState(() => window.localStorage.getItem("wyrm_username") ?? "");

  const handlePlay = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    window.localStorage.setItem("wyrm_username", trimmed);
    let clientId = window.localStorage.getItem("wyrm_client_id");
    if (!clientId) {
      clientId = crypto.randomUUID();
      window.localStorage.setItem("wyrm_client_id", clientId);
    }
    
    onEnter(trimmed, clientId);
    onNavigate("/lobby");
  };
  return (
    <main className="landing-screen">
      <section className="landing-hero">
        <div className="landing-hero__wordmark">
          <Wordmark href="/" onNavigate={onNavigate} />
        </div>
        <p className="landing-hero__description">
          A 2–4 player strategy board game of serpents, trails, and ancient runes.
        </p>
        <form className="landing-hero__actions" onSubmit={handlePlay} style={{ flexDirection: "column", alignItems: "stretch" }}>
          <input 
            type="text" 
            placeholder="Your name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "1px solid rgba(240, 234, 214, 0.25)",
              background: "rgba(255, 255, 255, 0.07)",
              color: "var(--parchment-100)",
            }} 
          />
          <p style={{ color: 'var(--parchment-100)' }}>placeholder text should read "Your name"</p>
          <button
            type="submit"
            className="button button--forest"
            disabled={!name.trim()}
          >
            Play WYRM
          </button>
        </form>
        <div className="landing-hero__preview">
          <svg viewBox="0 0 160 160" width="160" height="160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="landing-hero__board-glyph">
            <rect width="160" height="160" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            {[40, 80, 120].map((v) => (
              <g key={v}>
                <line x1={v} y1="8" x2={v} y2="152" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                <line x1="8" y1={v} x2="152" y2={v} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              </g>
            ))}
            <rect x="62" y="62" width="36" height="36" rx="4" fill="rgba(184,134,11,0.55)"/>
            <circle cx="20" cy="20" r="10" fill="#6b5aa8"/>
            <circle cx="140" cy="140" r="10" fill="#b8860b"/>
            <rect x="34" y="14" width="12" height="12" rx="2" fill="rgba(107,90,168,0.45)"/>
            <rect x="14" y="34" width="12" height="12" rx="2" fill="rgba(107,90,168,0.45)"/>
            <rect x="134" y="114" width="12" height="12" rx="2" fill="rgba(184,134,11,0.45)"/>
          </svg>
        </div>
      </section>

      <section className="landing-mechanics">
        <div className="landing-mechanics__scroll">
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
            </div>
            <h3>Trail System</h3>
            <p>Every move leaves a trail that blocks all pieces including yours.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M12 12h.01" /><path d="M8 8h.01" /><path d="M16 16h.01" /><path d="M8 16h.01" /><path d="M16 8h.01" /></svg>
            </div>
            <h3>Rune Die</h3>
            <p>Roll to move. Coil lets you choose. Surge sends you flying.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="3" rx="2" ry="2" /><rect width="16" height="10" x="4" y="11" rx="2" ry="2" /><path d="M10 15h4" /></svg>
            </div>
            <h3>Capture & Hoard</h3>
            <p>Land on enemies to capture them. Deploy captured pieces later.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <h3>Elder Promotion</h3>
            <p>Reach an enemy Den to unlock 8-directional free movement.</p>
          </div>
          <div className="mechanic-card">
            <div className="mechanic-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><rect width="10" height="10" x="7" y="7" rx="1" /></svg>
            </div>
            <h3>Rune Tiles</h3>
            <p>Draw tiles each turn. Collect 3 matching to trigger a Lair Power.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <Wordmark href="/" compact onNavigate={onNavigate} />
      </footer>
    </main>
  );
}
