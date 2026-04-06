import assert from "node:assert/strict";

import {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_STEPS,
  getAutoAdvancedTutorialIndex,
  shouldShowTutorial,
} from "../src/components/tutorialOverlayModel.ts";

{
  assert.equal(TUTORIAL_STORAGE_KEY, "wyrm_has_played", "tutorial progress should persist to the first-play flag");
  assert.equal(TUTORIAL_STEPS.length, 4, "the tutorial should expose four onboarding steps");
  assert.equal(TUTORIAL_STEPS[0]?.title, "Your Den", "step one should orient the player to their den");
  assert.equal(TUTORIAL_STEPS[1]?.phase, "draw", "drawing guidance should stay in the draw phase");
  assert.equal(TUTORIAL_STEPS[2]?.phase, "roll", "die guidance should stay in the roll phase");
  assert.equal(TUTORIAL_STEPS[3]?.phase, "move", "movement guidance should stay in the move phase");
}

{
  assert.equal(
    shouldShowTutorial({ hasPlayedFlag: null, localMode: false }),
    true,
    "remote first-time players should see the tutorial",
  );
  assert.equal(
    shouldShowTutorial({ hasPlayedFlag: "true", localMode: false }),
    false,
    "players who already completed the tutorial should not see it again",
  );
  assert.equal(
    shouldShowTutorial({ hasPlayedFlag: null, localMode: true }),
    false,
    "local pass-and-play matches should never show the tutorial overlay",
  );
}

{
  assert.equal(
    getAutoAdvancedTutorialIndex(0, { phase: "draw", selectedWyrmId: null }, { phase: "draw", selectedWyrmId: null }),
    0,
    "the den introduction should wait for manual acknowledgement",
  );
  assert.equal(
    getAutoAdvancedTutorialIndex(1, { phase: "draw", selectedWyrmId: null }, { phase: "roll", selectedWyrmId: null }),
    2,
    "the draw lesson should advance once drawing moves the turn forward",
  );
  assert.equal(
    getAutoAdvancedTutorialIndex(1, { phase: "draw", selectedWyrmId: null }, { phase: "discard", selectedWyrmId: null }),
    2,
    "the draw lesson should also advance when drawing forces an immediate discard",
  );
  assert.equal(
    getAutoAdvancedTutorialIndex(2, { phase: "roll", selectedWyrmId: null }, { phase: "move", selectedWyrmId: null }),
    3,
    "the die lesson should advance once the roll is resolved",
  );
  assert.equal(
    getAutoAdvancedTutorialIndex(3, { phase: "move", selectedWyrmId: null }, { phase: "move", selectedWyrmId: "wyrm-1" }),
    null,
    "the movement lesson should finish once a wyrm is selected",
  );
}

console.log("Tutorial overlay model test suite passed.");
