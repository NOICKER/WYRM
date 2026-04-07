import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve("src/App.tsx"), "utf8");
const resultsScreen = readFileSync(resolve("src/screens/ResultsScreen.tsx"), "utf8");
const authScreen = readFileSync(resolve("src/screens/AuthScreen.tsx"), "utf8");
const appModel = readFileSync(resolve("src/ui/appModel.ts"), "utf8");
const localSetup = readFileSync(resolve("src/screens/LocalSetupScreen.tsx"), "utf8");
const css = readFileSync(resolve("src/index.css"), "utf8");

assert.doesNotMatch(
  resultsScreen,
  /progress-card/,
  "results screen should remove the XP progress card block",
);

assert.doesNotMatch(
  resultsScreen,
  /record\.factionRep/,
  "results banner should no longer render faction reputation copy",
);

assert.doesNotMatch(
  appModel,
  /\b(factionRep|xpEarned|xpSources)\b/,
  "match records should no longer include XP or faction reputation fields",
);

assert.doesNotMatch(
  authScreen,
  /\bonOAuth\b|auth-divider|auth-oauth/,
  "auth screen should remove OAuth props and secondary auth actions",
);

assert.doesNotMatch(
  app,
  /onOAuth=\{|\bgoogle\b|\bdiscord\b/,
  "app auth flow should remove fake OAuth branches and props",
);

assert.match(
  app,
  /useEffect\(\(\) => \{\s*try\s*\{\s*const reconnectToken = window\.sessionStorage\.getItem\("wyrm_reconnect_token"\)/s,
  "app should read the reconnect token from sessionStorage on mount",
);

assert.match(
  app,
  /const \[reconnectBannerVisible, setReconnectBannerVisible\] = useState\(false\);/,
  "app should track reconnect banner visibility in component state",
);

assert.match(
  app,
  /reconnectBannerVisible && profile && route\.name === "lobby"/,
  "reconnect banner should render only for signed-in users on the lobby route",
);

assert.match(
  app,
  /sessionStorage\.removeItem\("wyrm_reconnect_token"\)[\s\S]*setReconnectBannerVisible\(false\)/,
  "dismissing the reconnect banner should clear sessionStorage and hide the notice",
);

assert.match(
  css,
  /\.reconnect-banner(?:\s*,\s*\.guest-banner|\s*\{)/,
  "the reconnect banner should be styled alongside the existing guest banner treatment",
);

assert.match(
  app,
  /else if \(route\.name === "local_match"\) \{\s*navigatePath\("\/local", true\);\s*return null;\s*\}/s,
  "app should redirect stray local match routes back to local setup when no local config exists",
);

assert.match(
  localSetup,
  /value=\{i === 0 \? "human" : playerTypes\[playerId\]\}/,
  "player one should always show Human in the player type select",
);

assert.match(
  localSetup,
  /disabled=\{i === 0\}/,
  "player one type select should stay disabled",
);

for (const filename of ["css_update.js", "css_update2.js", "find_blocks.js"]) {
  assert.equal(
    existsSync(resolve(filename)),
    false,
    `${filename} should be removed from the project root`,
  );
}

console.log("App cleanup regression test suite passed.");
