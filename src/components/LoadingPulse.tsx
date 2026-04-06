import React from "react";

interface LoadingPulseProps {
  label?: string;
}

export function LoadingPulse({ label = "Loading" }: LoadingPulseProps): React.JSX.Element {
  return (
    <span className="loading-pulse" aria-live="polite" aria-label={label}>
      <span className="loading-pulse__dot" />
      <span className="loading-pulse__label">{label}</span>
    </span>
  );
}
