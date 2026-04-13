import React, { useMemo, useState } from "react";

import { Wordmark } from "../components/Wordmark.tsx";
import type { MatchRecord, UserProfile } from "../ui/appModel.ts";
import { formatMatchHistoryDate } from "../ui/settingsPreferences.ts";

interface SettingsScreenProps {
  profile: UserProfile;
  matchHistory: MatchRecord[];
  animationsEnabled: boolean;
  soundEnabled: boolean;
  onNavigate: (href: string) => void;
  onBack: () => void;
  onSaveDisplayName: (value: string) => void;
  onToggleAnimations: (enabled: boolean) => void;
  onToggleSound: (enabled: boolean) => void;
  onReplayChronicle: (matchId: string) => void;
  onClearMatchHistory: () => void;
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
    <button
      type="button"
      className={disabled ? "sidebar-nav__link sidebar-nav__link--disabled" : "sidebar-nav__link"}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
    </button>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <label className="settings-toggle">
      <div className="settings-toggle__copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

export function SettingsScreen({
  profile,
  matchHistory,
  animationsEnabled,
  soundEnabled,
  onNavigate,
  onBack,
  onSaveDisplayName,
  onToggleAnimations,
  onToggleSound,
  onReplayChronicle,
  onClearMatchHistory,
}: SettingsScreenProps): React.JSX.Element {
  const [displayName, setDisplayName] = useState(profile.username);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  const canSaveDisplayName = useMemo(() => {
    const trimmed = displayName.trim();
    return trimmed.length > 1 && trimmed !== profile.username;
  }, [displayName, profile.username]);

  const handleSaveDisplayName = () => {
    const trimmed = displayName.trim();
    if (trimmed.length <= 1) {
      return;
    }
    onSaveDisplayName(trimmed);
    setDisplayNameSaved(true);
  };

  const handleClearHistory = () => {
    if (matchHistory.length === 0) {
      return;
    }
    if (!window.confirm("Are you sure? This cannot be undone.")) {
      return;
    }
    onClearMatchHistory();
  };

  return (
    <main className="shell-page">
      <aside className="shell-sidebar">
        <Wordmark href="/lobby" onNavigate={onNavigate} />

        <nav className="sidebar-nav" aria-label="Primary">
          <NavEntry label="Lobby" onClick={() => onNavigate("/lobby")} />
          <NavEntry
            label="Replays"
            disabled={matchHistory.length === 0}
            onClick={() => {
              if (matchHistory.length > 0) {
                onReplayChronicle(matchHistory[0].id);
              }
            }}
          />
          <NavEntry label="Settings" onClick={() => onNavigate("/settings")} />
        </nav>

        <div className="sidebar-profile">
          <span>{profile.username}</span>
        </div>
      </aside>

      <section className="shell-main settings-main">
        <header className="section-header">
          <div>
            <p>Account & Preferences</p>
            <h1>Settings</h1>
          </div>
          <button type="button" className="text-link" onClick={onBack}>
            Back
          </button>
        </header>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="section-heading">
              <p>Section 1</p>
              <h2>Account</h2>
            </div>

            {profile.isGuest ? (
              <p style={{ margin: 0, color: "var(--ink-700)", lineHeight: 1.6 }}>
                Create an account to save settings and match history.{" "}
                <button type="button" className="text-link" onClick={() => onNavigate("/auth")}>
                  Sign in or create one
                </button>
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "0.75rem",
                    alignItems: "end",
                  }}
                >
                  <label className="field">
                    <span>Display name</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        setDisplayNameSaved(false);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--forest"
                    disabled={!canSaveDisplayName}
                    onClick={handleSaveDisplayName}
                  >
                    Save
                  </button>
                </div>

                {displayNameSaved ? (
                  <p style={{ margin: 0, color: "var(--success)", fontWeight: 700 }}>Display name saved</p>
                ) : null}
              </>
            )}
          </section>

          <hr className="settings-divider" />

          <section className="settings-card">
            <div className="section-heading">
              <p>Section 2</p>
              <h2>Preferences</h2>
            </div>

            <PreferenceToggle
              label="Board animations"
              description="Turn movement, banner, and UI transitions on or off."
              checked={animationsEnabled}
              onChange={onToggleAnimations}
            />
            <hr className="settings-divider" />
            <PreferenceToggle
              label="Sound effects"
              description="Coming soon — your preference is saved for when audio lands."
              checked={soundEnabled}
              onChange={onToggleSound}
            />
          </section>

          <hr className="settings-divider" />

          <section className="settings-card">
            <div className="section-heading">
              <p>Section 3</p>
              <h2>Match History</h2>
            </div>

            {matchHistory.length === 0 ? (
              <p style={{ margin: 0, color: "var(--ink-700)", lineHeight: 1.6 }}>
                No completed matches yet. Finish a game to see the full chronicle here.
              </p>
            ) : (
              <div className="chronicle-strip">
                {matchHistory.map((record) => (
                  <article
                    key={record.id}
                    className="chronicle-card"
                    style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto", alignItems: "center" }}
                  >
                    <span
                      className={`chronicle-card__badge chronicle-card__badge--${record.result}`}
                      style={{
                        backgroundColor:
                          record.result === "win" && record.winnerColor === "amber" ? "#b8860b" : undefined,
                      }}
                    >
                      {record.result.toUpperCase()}
                    </span>
                    <div>
                      <h3>{record.opponents.join(" • ")}</h3>
                      <p>
                        {record.rounds} rounds • {formatMatchHistoryDate(record.completedAt)}
                      </p>
                    </div>
                    <button type="button" className="text-link" onClick={() => onReplayChronicle(record.id)}>
                      View replay
                    </button>
                  </article>
                ))}
              </div>
            )}

            <div>
              <button
                type="button"
                className="button button--outline"
                disabled={matchHistory.length === 0}
                onClick={handleClearHistory}
              >
                Clear match history
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
