interface RuneTooltipPlacementOptions {
  cardLeft: number;
  cardWidth: number;
  tooltipWidth: number;
  viewportWidth: number;
  gutter: number;
  arrowPadding: number;
}

interface RuneTooltipPlacement {
  left: number;
  arrowLeft: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getRuneTooltipPlacement({
  cardLeft,
  cardWidth,
  tooltipWidth,
  viewportWidth,
  gutter,
  arrowPadding,
}: RuneTooltipPlacementOptions): RuneTooltipPlacement {
  const centeredAbsoluteLeft = cardLeft + cardWidth / 2 - tooltipWidth / 2;
  const maxAbsoluteLeft = Math.max(gutter, viewportWidth - tooltipWidth - gutter);
  const absoluteLeft = clamp(centeredAbsoluteLeft, gutter, maxAbsoluteLeft);
  const cardCenter = cardLeft + cardWidth / 2;

  return {
    left: absoluteLeft - cardLeft,
    arrowLeft: clamp(cardCenter - absoluteLeft, arrowPadding, tooltipWidth - arrowPadding),
  };
}
