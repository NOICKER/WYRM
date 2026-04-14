import React, { useLayoutEffect, useRef, useState } from "react";

import { getTileBadge, getTileIllustration, getTileName, getTileSummary } from "../ui/appModel.ts";
import { TILE_HELP, TILE_LAIR_HELP } from "../state/gameLogic.ts";
import type { RuneTileType } from "../state/types.ts";
import { getRuneTooltipPlacement } from "./runeTileTooltipModel.ts";

interface RuneTileCardProps {
  tile: RuneTileType;
  copies?: number;
  active?: boolean;
  elevated?: boolean;
  lairReady?: boolean;
  disabled?: boolean;
  className?: string;
  playable?: boolean;
  unplayableReason?: string;
  onActivate?: () => void;
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
  playable,
  unplayableReason,
  onActivate,
  onPlay,
  onPlayLair,
}: RuneTileCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [tooltipPlacement, setTooltipPlacement] = useState({ left: 0, arrowLeft: 140 });
  const shellRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const expandTimeoutRef = useRef<number | null>(null);
  const copyCount = copies ?? 0;
  const unlockCount = Math.max(0, 3 - copyCount);
  const actuallyDisabled = disabled || playable === false;
  const isInteractive = !actuallyDisabled && Boolean(onActivate);

  const shellClasses = [
    "rune-card-shell",
    isInteractive ? "rune-card-shell--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const classes = [
    "rune-card",
    active ? "rune-card--active" : "",
    elevated ? "rune-card--elevated" : "",
    lairReady ? "rune-card--lair" : "",
    actuallyDisabled ? "rune-card--disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const clearExpandTimeout = () => {
    if (expandTimeoutRef.current != null) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }
  };

  const scheduleExpand = (delay: number) => {
    clearExpandTimeout();
    expandTimeoutRef.current = window.setTimeout(() => {
      setExpanded(true);
      expandTimeoutRef.current = null;
    }, delay);
  };

  const collapseTooltip = () => {
    clearExpandTimeout();
    setExpanded(false);
  };

  useLayoutEffect(() => {
    if (!expanded || !shellRef.current || !tooltipRef.current) {
      return;
    }

    const updatePlacement = () => {
      if (!shellRef.current || !tooltipRef.current) {
        return;
      }

      const cardRect = shellRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      setTooltipPlacement(
        getRuneTooltipPlacement({
          cardLeft: cardRect.left,
          cardWidth: cardRect.width,
          tooltipWidth: tooltipRect.width,
          viewportWidth: window.innerWidth,
          gutter: 12,
          arrowPadding: 18,
        }),
      );
    };

    updatePlacement();

    const resizeObserver = new ResizeObserver(() => updatePlacement());
    resizeObserver.observe(shellRef.current);
    resizeObserver.observe(tooltipRef.current);
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [copyCount, expanded, tile]);

  useLayoutEffect(
    () => () => {
      if (expandTimeoutRef.current != null) {
        window.clearTimeout(expandTimeoutRef.current);
      }
    },
    [],
  );

  const tooltipStyle = {
    left: `${tooltipPlacement.left}px`,
    "--rune-tooltip-arrow-left": `${tooltipPlacement.arrowLeft}px`,
  } as React.CSSProperties;

  const handleActivate = () => {
    if (!isInteractive) {
      return;
    }

    onActivate?.();
  };

  return (
    <article
      ref={shellRef}
      className={shellClasses}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-disabled={actuallyDisabled ? true : undefined}
      onMouseEnter={() => scheduleExpand(220)}
      onMouseLeave={collapseTooltip}
      onTouchStart={() => scheduleExpand(320)}
      onTouchEnd={collapseTooltip}
      onTouchCancel={collapseTooltip}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (!isInteractive || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onActivate?.();
      }}
    >
      {expanded ? (
        <div ref={tooltipRef} className="rune-card__tooltip" style={tooltipStyle}>
          {playable === false && unplayableReason && (
            <div className="rune-card__tooltip-error" style={{ color: 'var(--danger)', marginBottom: '8px', fontWeight: 'bold' }}>
              Cannot play: {unplayableReason}
            </div>
          )}
          <span className="rune-card__tooltip-badge">{getTileBadge(tile)}</span>
          <strong className="rune-card__tooltip-title">{getTileName(tile)} Rune</strong>
          <p>
            <span className="rune-card__tooltip-label">Single use:</span> {TILE_HELP[tile]}
          </p>
          {copyCount >= 3 ? (
            <>
              <div className="rune-card__tooltip-divider" />
              <p className="rune-card__tooltip-lair">
                <span className="rune-card__tooltip-label">Lair Power (×3):</span> {TILE_LAIR_HELP[tile]}
              </p>
            </>
          ) : (
            <p className="rune-card__tooltip-muted">Hold {unlockCount} more to unlock Lair Power.</p>
          )}
        </div>
      ) : null}

      <div className={classes}>
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
          <h3>{getTileName(tile)} Rune</h3>
          <p>{getTileSummary(tile)}</p>
        </div>
        {(onPlay || onPlayLair) && (
          <div className="rune-card__actions">
            {onPlay ? (
              <button
                type="button"
                className="rune-card__button rune-card__button--primary"
                disabled={actuallyDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlay();
                }}
              >
                Invoke
              </button>
            ) : null}
            {onPlayLair ? (
              <button
                type="button"
                className="rune-card__button rune-card__button--ghost"
                disabled={actuallyDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlayLair();
                }}
              >
                Lair x3
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
