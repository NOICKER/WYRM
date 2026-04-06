import React, { useMemo, useState } from "react";

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
}

export function AuthScreen({
  quote,
  pendingAction,
  error,
  onSubmit,
  onOAuth,
}: AuthScreenProps): React.JSX.Element {
  const [form, setForm] = useState<AuthFormState>({ username: "", password: "" });
  const canSubmit = useMemo(
    () => form.username.trim().length > 1 && form.password.trim().length > 2,
    [form],
  );

  return (
    <main className="auth-screen">
      <div className="auth-screen__texture" aria-hidden="true" />
      <section className="auth-card">
        <Wordmark
          href="/"
          className="auth-card__wordmark"
          subtitle="The Archivist's Gateway"
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
            <span>Archivist Name</span>
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
            <span>Secret Sigil</span>
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
            {pendingAction === "auth" ? <LoadingPulse label="Opening Tome" /> : "Enter the Tome"}
          </button>

          <button type="button" className="text-link">
            Forgotten Sigil?
          </button>

          <div className="auth-divider">
            <span>External Lineage</span>
          </div>

          <div className="auth-oauth">
            <button
              type="button"
              className="button button--outline"
              disabled={Boolean(pendingAction)}
              onClick={() => onOAuth("google")}
            >
              {pendingAction === "google" ? <LoadingPulse label="Aetherial" /> : "Aetherial"}
            </button>
            <button
              type="button"
              className="button button--outline"
              disabled={Boolean(pendingAction)}
              onClick={() => onOAuth("discord")}
            >
              {pendingAction === "discord" ? <LoadingPulse label="Citadel" /> : "Citadel"}
            </button>
          </div>
        </form>
      </section>

      <p className="auth-screen__quote">{quote}</p>
    </main>
  );
}
