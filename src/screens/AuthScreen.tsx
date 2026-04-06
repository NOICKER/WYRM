import React, { useEffect, useMemo, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import type { AuthFormState } from "../ui/appModel.ts";

interface AuthScreenProps {
  quote: string;
  pendingAction: string | null;
  error: string | null;
  onSubmit: (form: AuthFormState) => void;
  onOAuth: (provider: "google" | "discord") => void;
  onGuestPlay: () => void;
}

export function AuthScreen({
  quote,
  pendingAction,
  error,
  onSubmit,
  onOAuth,
  onGuestPlay,
}: AuthScreenProps): React.JSX.Element {
  const [form, setForm] = useState<AuthFormState>({ username: "", password: "" });
  const [autoGuest, setAutoGuest] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("guest") === "true") {
      setAutoGuest(true);
      onGuestPlay();
    }
  }, [onGuestPlay]);

  const canSubmit = useMemo(
    () => form.username.trim().length > 1 && form.password.trim().length > 2,
    [form],
  );

  if (autoGuest) {
    return (
      <main className="auth-screen">
        <div className="auth-screen__texture" aria-hidden="true" />
        <section className="auth-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <LoadingPulse label="Starting guest session..." />
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <div className="auth-screen__texture" aria-hidden="true" />
      <section className="auth-card">
        <Wordmark
          href="/"
          className="auth-card__wordmark"
          tagline="The Tome opens only to those who speak their name with conviction."
        />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            onSubmit(form);
          }}
        >
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={form.username}
              placeholder="Sable Quill"
              onChange={(event) =>
                setForm((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              placeholder="••••••••"
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
            />
          </label>

          {error ? <ScreenError message={error} /> : null}

          <button type="submit" className="button button--forest" disabled={!canSubmit || pendingAction === "auth"}>
            {pendingAction === "auth" ? <LoadingPulse label="Opening Tome" /> : "Sign in"}
          </button>

          <button type="button" className="text-link">
            Forgot password?
          </button>
          
          <button 
            type="button" 
            className="text-link" 
            style={{ marginTop: '0.25rem', alignSelf: 'center' }}
            disabled={Boolean(pendingAction)}
            onClick={onGuestPlay}
          >
            Play as guest
          </button>

          <div className="auth-divider">
            <span>Or continue with</span>
          </div>

          <div className="auth-oauth">
            <button
              type="button"
              className="button button--outline"
              disabled={Boolean(pendingAction)}
              onClick={() => onOAuth("google")}
            >
              {pendingAction === "google" ? <LoadingPulse label="Google" /> : "Google"}
            </button>
            <button
              type="button"
              className="button button--outline"
              disabled={Boolean(pendingAction)}
              onClick={() => onOAuth("discord")}
            >
              {pendingAction === "discord" ? <LoadingPulse label="Discord" /> : "Discord"}
            </button>
          </div>
        </form>
      </section>

      <p className="auth-screen__quote">{quote}</p>
    </main>
  );
}
