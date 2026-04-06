import React, { useEffect, useMemo, useRef, useState } from "react";

import type { TooltipKey } from "../state/useTooltipState.ts";
import {
  CONTEXT_TOOLTIP_CONTENT,
  getContextTooltipPlacement,
  type ContextTooltipPlacement,
} from "./contextTooltipModel.ts";

const CARD_GAP = 14;
const VIEWPORT_MARGIN = 16;
const ARROW_PADDING = 18;

interface ContextTooltipProps {
  tooltipKey: TooltipKey;
  anchorRef: React.RefObject<Element | null>;
  onDismiss: () => void;
}

interface TooltipPositionState extends ContextTooltipPlacement {
  visible: boolean;
}

const HIDDEN_TOOLTIP_POSITION: TooltipPositionState = {
  top: VIEWPORT_MARGIN,
  left: VIEWPORT_MARGIN,
  arrowLeft: 28,
  placement: "below",
  visible: false,
};

export function ContextTooltip({
  tooltipKey,
  anchorRef,
  onDismiss,
}: ContextTooltipProps): React.JSX.Element {
  const content = CONTEXT_TOOLTIP_CONTENT[tooltipKey];
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<TooltipPositionState>(HIDDEN_TOOLTIP_POSITION);

  useEffect(() => {
    const updatePosition = () => {
      const anchorNode = anchorRef.current;
      const cardNode = cardRef.current;
      if (!anchorNode || !cardNode) {
        setPosition((current) => (current.visible ? HIDDEN_TOOLTIP_POSITION : current));
        return;
      }

      const anchorRect = anchorNode.getBoundingClientRect();
      const cardRect = cardNode.getBoundingClientRect();
      const nextPosition = getContextTooltipPlacement({
        anchorRect,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        gap: CARD_GAP,
        viewportMargin: VIEWPORT_MARGIN,
        arrowPadding: ARROW_PADDING,
      });

      setPosition({
        ...nextPosition,
        visible: true,
      });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(() => updatePosition());
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }
    if (anchorRef.current instanceof HTMLElement) {
      resizeObserver.observe(anchorRef.current);
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, tooltipKey]);

  const tooltipStyle = useMemo<React.CSSProperties>(
    () => ({
      top: position.top,
      left: position.left,
      opacity: position.visible ? 1 : 0,
      "--context-tooltip-arrow-left": `${position.arrowLeft}px`,
    } as React.CSSProperties),
    [position.arrowLeft, position.left, position.top, position.visible],
  );

  return (
    <div className="context-tooltip-layer">
      <article
        ref={cardRef}
        className={[
          "context-tooltip",
          position.placement === "above" ? "context-tooltip--above" : "context-tooltip--below",
        ].join(" ")}
        style={tooltipStyle}
        role="dialog"
        aria-modal="false"
        aria-label={content.title}
      >
        <span className="context-tooltip__eyebrow">Rules Note</span>
        <div className="context-tooltip__copy">
          <h2>{content.title}</h2>
          <p>{content.body}</p>
        </div>
        <div className="context-tooltip__actions">
          <button type="button" className="button button--amber" onClick={onDismiss}>
            Got it
          </button>
        </div>
        <span className="context-tooltip__arrow" aria-hidden="true" />
      </article>
    </div>
  );
}
