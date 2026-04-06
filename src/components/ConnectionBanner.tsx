import React from "react";

import type { ConnectionBannerStatus } from "../online/reconnectModel.ts";

interface ConnectionBannerProps {
  status: ConnectionBannerStatus;
  attemptCount: number;
  onRetry?: () => void;
  onGoToLobby?: () => void;
}

export function ConnectionBanner({
  status,
  attemptCount,
  onRetry,
  onGoToLobby,
}: ConnectionBannerProps): React.JSX.Element | null {
  if (status === "connected") {
    return null;
  }

  if (status === "reconnecting") {
    return (
      <div className="connection-banner connection-banner--reconnecting" role="status" aria-live="polite">
        <span>Connection lost — reconnecting... (attempt {Math.max(1, attemptCount)} of 5)</span>
      </div>
    );
  }

  return (
    <div className="connection-banner connection-banner--failed" role="status" aria-live="polite">
      <span>Unable to reconnect. Your match may still be saved.</span>
      <div className="connection-banner__actions">
        <button type="button" className="connection-banner__action" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="connection-banner__action" onClick={onGoToLobby}>
          Go to lobby
        </button>
      </div>
    </div>
  );
}
