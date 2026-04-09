import React, { useEffect, useMemo, useRef, useState } from "react";

import { LoadingPulse } from "../components/LoadingPulse.tsx";
import { ScreenError } from "../components/ScreenError.tsx";
import { Wordmark } from "../components/Wordmark.tsx";
import type { AuthFormState } from "../ui/appModel.ts";

interface AuthScreenProps {
  quote: string;
  pendingAction: string | null;
  error: string | null;
  onSubmit: (form: AuthFormState) => void;
  onGuestPlay: () => void;
}

export function AuthScreen({
  quote,
  pendingAction,
  error,
  onSubmit,
  onGuestPlay,
}: AuthScreenProps): React.JSX.Element {
  const [form, setForm] = useState<AuthFormState>({ username: "", password: "" }); // password kept in type for compat but not collected
  const autoGuest = useMemo(
    () => new URLSearchParams(window.location.search).get("guest") === "true",
    [],
  );
  const guestTriggeredRef = useRef(false);

  useEffect(() => {
    if (autoGuest && !guestTriggeredRef.current) {
      guestTriggeredRef.current = true;
      onGuestPlay();
    }
  }, [autoGuest, onGuestPlay]);

  const canSubmit = useMemo(
    () => form.username.trim().length > 1,
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
          tagline="Choose a display name to enter the Tome."
        />

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            onSubmit({ ...form, password: "" });
          }}
        >
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={form.username}
              placeholder="Sable Quill"
              autoComplete="off"
              onChange={(event) =>
                setForm((current) => ({ ...current, username: event.target.value }))
              }
            />
          </label>


          {error ? <ScreenError message={error} /> : null}

          <button type="submit" className="button button--forest" disabled={!canSubmit || pendingAction === "auth"}>
            {pendingAction === "auth" ? <LoadingPulse label="Opening Tome" /> : "Enter the Tome"}
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
        </form>
      </section>

      <p className="auth-screen__quote">{quote}</p>
    </main>
  );
}
