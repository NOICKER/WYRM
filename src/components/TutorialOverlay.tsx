import React, { useEffect, useMemo, useRef, useState } from "react";

import type { TurnPhase } from "../state/types.ts";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEY,
  getAutoAdvancedTutorialIndex,
  type TutorialHighlightTarget,
  type TutorialProgressSnapshot,
} from "./tutorialOverlayModel.ts";

export interface TutorialBoundingBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  currentPhase: TurnPhase;
  selectedWyrmId: string | null;
  highlightBoxes: Partial<Record<TutorialHighlightTarget, TutorialBoundingBox | null>>;
  onComplete: () => void;
}

interface FloatingCardPosition {
  top: number;
  left: number;
}

const CARD_GAP = 18;
const VIEWPORT_MARGIN = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildSnapshot(phase: TurnPhase, selectedWyrmId: string | null): TutorialProgressSnapshot {
  return { phase, selectedWyrmId };
}

function getFloatingCardPosition(
  highlightBox: TutorialBoundingBox | null | undefined,
  cardWidth: number,
  cardHeight: number,
): FloatingCardPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!highlightBox) {
    return {
      top: clamp((viewportHeight - cardHeight) / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN)),
      left: clamp((viewportWidth - cardWidth) / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN)),
    };
  }

  const centeredLeft = highlightBox.left + highlightBox.width / 2 - cardWidth / 2;
  const left = clamp(
    centeredLeft,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, viewportWidth - cardWidth - VIEWPORT_MARGIN),
  );
  const spaceAbove = highlightBox.top - VIEWPORT_MARGIN;
  const spaceBelow = viewportHeight - highlightBox.bottom - VIEWPORT_MARGIN;
  const prefersBelow = spaceBelow >= cardHeight + CARD_GAP || spaceBelow >= spaceAbove;
  const top = prefersBelow
    ? clamp(
        highlightBox.bottom + CARD_GAP,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN),
      )
    : clamp(
        highlightBox.top - cardHeight - CARD_GAP,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, viewportHeight - cardHeight - VIEWPORT_MARGIN),
      );

  return { top, left };
}

function writeTutorialCompletionFlag(): void {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // Ignore storage failures and still dismiss the overlay.
  }
}

export function TutorialOverlay({
  currentPhase,
  selectedWyrmId,
  highlightBoxes,
  onComplete,
}: TutorialOverlayProps): React.JSX.Element {
  const [stepIndex, setStepIndex] = useState(0);
  const [cardPosition, setCardPosition] = useState<FloatingCardPosition>({
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previousSnapshotRef = useRef<TutorialProgressSnapshot | null>(null);

  const currentStep = TUTORIAL_STEPS[stepIndex] ?? TUTORIAL_STEPS[0];
  const highlightBox = highlightBoxes[currentStep.highlight] ?? null;

  useEffect(() => {
    const snapshot = buildSnapshot(currentPhase, selectedWyrmId);
    const nextStepIndex = getAutoAdvancedTutorialIndex(stepIndex, previousSnapshotRef.current, snapshot);
    previousSnapshotRef.current = snapshot;

    if (nextStepIndex === stepIndex) {
      return;
    }

    if (nextStepIndex == null) {
      writeTutorialCompletionFlag();
      onComplete();
      return;
    }

    setStepIndex(nextStepIndex);
  }, [currentPhase, onComplete, selectedWyrmId, stepIndex]);

  useEffect(() => {
    const updateCardPosition = () => {
      const cardNode = cardRef.current;
      if (!cardNode) {
        return;
      }

      const rect = cardNode.getBoundingClientRect();
      setCardPosition(getFloatingCardPosition(highlightBox, rect.width, rect.height));
    };

    updateCardPosition();

    const resizeObserver = new ResizeObserver(() => updateCardPosition());
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    window.addEventListener("resize", updateCardPosition);
    window.addEventListener("scroll", updateCardPosition, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCardPosition);
      window.removeEventListener("scroll", updateCardPosition, true);
    };
  }, [highlightBox, stepIndex]);

  const spotlightStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!highlightBox) {
      return undefined;
    }

    return {
      top: highlightBox.top,
      left: highlightBox.left,
      width: highlightBox.width,
      height: highlightBox.height,
    };
  }, [highlightBox]);

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      top: cardPosition.top,
      left: cardPosition.left,
    }),
    [cardPosition.left, cardPosition.top],
  );

  const nextDisabled = stepIndex === 1 || stepIndex === 2;
  const hintCopy =
    stepIndex === 1 ? "Draw a tile to continue." : stepIndex === 2 ? "Roll the die to continue." : null;

  const handleComplete = () => {
    writeTutorialCompletionFlag();
    onComplete();
  };

  const handleNext = () => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      handleComplete();
      return;
    }

    if (nextDisabled) {
      return;
    }

    setStepIndex((current) => Math.min(current + 1, TUTORIAL_STEPS.length - 1));
  };

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="false" aria-label="First game tutorial">
      {spotlightStyle ? (
        <div className="tutorial-overlay__spotlight" style={spotlightStyle} aria-hidden="true" />
      ) : (
        <div className="tutorial-overlay__scrim" aria-hidden="true" />
      )}

      <div ref={cardRef} className="tutorial-overlay__card" style={cardStyle}>
        <div className="tutorial-overlay__header">
          <p className="tutorial-overlay__eyebrow">First Game Tutorial</p>
          <span className="tutorial-overlay__step">
            Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
          </span>
        </div>

        <div className="tutorial-overlay__copy">
          <h2>{currentStep.title}</h2>
          <p>{currentStep.body}</p>
          {hintCopy ? <p className="tutorial-overlay__hint">{hintCopy}</p> : null}
        </div>

        <div className="tutorial-overlay__actions">
          <button
            type="button"
            className="button button--amber"
            disabled={nextDisabled}
            onClick={handleNext}
          >
            Next
          </button>
          <button type="button" className="text-link tutorial-overlay__skip" onClick={handleComplete}>
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
