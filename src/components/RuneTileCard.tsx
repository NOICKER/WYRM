import React from "react";

import { getTileBadge, getTileIllustration, getTileName, getTileSummary } from "../ui/appModel.ts";
import type { RuneTileType } from "../state/types.ts";

interface RuneTileCardProps {
  tile: RuneTileType;
  copies?: number;
  active?: boolean;
  elevated?: boolean;
  lairReady?: boolean;
  disabled?: boolean;
  className?: string;
  onPlay?: () => void;
  onPlayLair?: () => void;
}

export function RuneTileCard({
  tile,
  copies,
  active = false,
  elevated = false,
  lairReady = false,
  disabled = false,
  className,
  onPlay,
  onPlayLair,
}: RuneTileCardProps): React.JSX.Element {
  const classes = [
    "rune-card",
    active ? "rune-card--active" : "",
    elevated ? "rune-card--elevated" : "",
    lairReady ? "rune-card--lair" : "",
    disabled ? "rune-card--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className={`rune-card__art rune-card__art--${tile}`}>
        <span className="rune-card__glyph" aria-hidden="true">
          {getTileBadge(tile)}
        </span>
        <p>{getTileIllustration(tile)}</p>
      </div>
      <div className="rune-card__body">
        <div className="rune-card__meta">
          <span className="rune-card__badge">{getTileBadge(tile)}</span>
          {typeof copies === "number" ? <span className="rune-card__count">x{copies}</span> : null}
        </div>
        <h3>{getTileName(tile)}</h3>
        <p>{getTileSummary(tile)}</p>
      </div>
      {(onPlay || onPlayLair) && (
        <div className="rune-card__actions">
          {onPlay ? (
            <button type="button" className="rune-card__button rune-card__button--primary" disabled={disabled} onClick={onPlay}>
              Invoke
            </button>
          ) : null}
          {onPlayLair ? (
            <button type="button" className="rune-card__button rune-card__button--ghost" disabled={disabled} onClick={onPlayLair}>
              Lair x3
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}
