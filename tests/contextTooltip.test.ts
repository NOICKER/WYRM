import assert from "node:assert/strict";

import {
  CONTEXT_TOOLTIP_CONTENT,
  getContextTooltipPlacement,
} from "../src/components/contextTooltipModel.ts";
import {
  TOOLTIP_STORAGE_KEY,
  createInitialTooltipQueueState,
  enqueueTooltipKey,
  dismissTooltipKey,
} from "../src/state/useTooltipState.ts";

{
  assert.equal(
    TOOLTIP_STORAGE_KEY,
    "wyrm_seen_tooltips",
    "context tooltips should persist to the dedicated localStorage key",
  );
  assert.equal(
    CONTEXT_TOOLTIP_CONTENT.trail_created.title,
    "Trail created",
    "trail tooltips should expose the expected heading copy",
  );
  assert.equal(
    CONTEXT_TOOLTIP_CONTENT.hoard_deploy_available.body,
    "You have captured Wyrms. In the Move step, you can deploy one into your Den instead of moving.",
    "deploy tooltips should explain hoard redeployment",
  );
}

{
  const initial = createInitialTooltipQueueState('["trail_created"]');
  assert.deepEqual(
    [...initial.seenKeys],
    ["trail_created"],
    "stored tooltip keys should restore from localStorage JSON",
  );

  const withPending = enqueueTooltipKey(initial, "capture_available");
  assert.equal(
    withPending.pendingKeys[0],
    "capture_available",
    "unseen tooltip keys should enter the pending queue",
  );

  const deduped = enqueueTooltipKey(withPending, "capture_available");
  assert.equal(
    deduped.pendingKeys.length,
    1,
    "showing the same tooltip twice should not duplicate it in the queue",
  );

  const dismissed = dismissTooltipKey(deduped, "capture_available");
  assert.deepEqual(
    [...dismissed.seenKeys].sort(),
    ["capture_available", "trail_created"],
    "dismissing a tooltip should add it to the persisted seen set",
  );
  assert.deepEqual(
    dismissed.pendingKeys,
    [],
    "dismissed tooltips should be removed from the pending queue",
  );
}

{
  const below = getContextTooltipPlacement({
    anchorRect: { top: 180, left: 320, width: 120, height: 56, bottom: 236, right: 440 },
    cardWidth: 280,
    cardHeight: 160,
    viewportWidth: 1280,
    viewportHeight: 900,
    gap: 14,
    viewportMargin: 16,
    arrowPadding: 18,
  });

  assert.equal(below.placement, "below", "tooltips should prefer appearing below the anchor when there is room");
  assert.equal(below.left, 240, "tooltip cards should stay centered on the anchor when room allows");
  assert.equal(below.arrowLeft, 140, "the triangle should stay aligned with the anchor midpoint");

  const above = getContextTooltipPlacement({
    anchorRect: { top: 760, left: 18, width: 92, height: 44, bottom: 804, right: 110 },
    cardWidth: 280,
    cardHeight: 170,
    viewportWidth: 480,
    viewportHeight: 820,
    gap: 14,
    viewportMargin: 16,
    arrowPadding: 18,
  });

  assert.equal(above.placement, "above", "tooltips should flip above the anchor near the bottom of the viewport");
  assert.equal(above.left, 16, "tooltip cards should clamp onto the viewport when anchored near the left edge");
  assert.equal(above.arrowLeft, 48, "the triangle should still point toward the anchor after clamping");
}

console.log("Context tooltip test suite passed.");
