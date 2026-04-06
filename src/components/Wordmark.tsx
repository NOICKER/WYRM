import React from "react";

interface WordmarkProps {
  href: string;
  onNavigate?: (href: string) => void;
  className?: string;
  subtitle?: string;
  tagline?: string;
  compact?: boolean;
}

export function Wordmark({
  href,
  onNavigate,
  className,
  subtitle,
  tagline,
  compact = false,
}: WordmarkProps): React.JSX.Element {
  const classes = ["wyrm-wordmark", compact ? "wyrm-wordmark--compact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      href={href}
      className={classes}
      onClick={(event) => {
        if (!onNavigate) {
          return;
        }
        event.preventDefault();
        onNavigate(href);
      }}
    >
      <span className="wyrm-wordmark__title">WYRM</span>
      {subtitle ? <span className="wyrm-wordmark__subtitle">{subtitle}</span> : null}
      {tagline ? <span className="wyrm-wordmark__tagline">{tagline}</span> : null}
    </a>
  );
}
