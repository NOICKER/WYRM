import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("src/index.css"), "utf8");
const localSetupScreen = readFileSync(resolve("src/screens/LocalSetupScreen.tsx"), "utf8");
const settingsScreen = readFileSync(resolve("src/screens/SettingsScreen.tsx"), "utf8");

assert.match(
  css,
  /\.shell-page\s*\{[^}]*grid-template-columns:\s*clamp\([^)]+\)\s+minmax\(0,\s*1fr\);/s,
  "non-match shell screens should use a compact responsive sidebar width instead of a fixed oversized desktop rail",
);

assert.match(
  css,
  /\.shell-main\s*\{[^}]*padding:\s*clamp\([^)]+\)\s+clamp\([^)]+\);/s,
  "non-match shell screens should use compact responsive main padding so 100% zoom feels closer to the preferred 80% composition",
);

assert.match(
  css,
  /\.section-header h1,[^}]*font-size:\s*clamp\(1\.9rem,\s*3\.6vw,\s*3\.4rem\);/s,
  "large non-match page headings should scale down from the current oversized desktop presentation",
);

assert.match(
  css,
  /\.lobby-cta\s*\{[^}]*min-height:\s*clamp\([^)]+\);[^}]*padding:\s*clamp\([^)]+\);/s,
  "lobby action panels should use a shorter compact card footprint instead of the current oversized hero-card feel",
);

assert.match(
  css,
  /\.landing-hero__wordmark \.wyrm-wordmark__title\s*\{[^}]*font-size:\s*clamp\(2\.6rem,\s*5\.4vw,\s*4rem\);/s,
  "the landing screen wordmark should scale down on desktop so it matches the tighter visual rhythm of the improved match screen",
);

assert.match(
  css,
  /\.landing-hero__preview\s*\{[^}]*max-width:\s*640px;/s,
  "the landing hero preview should stop ballooning so the first screen feels composed at 100% zoom",
);

assert.match(
  localSetupScreen,
  /className="local-setup-panel"/,
  "the local setup screen should move its sizing into CSS classes so the compact desktop scale can be controlled consistently",
);

assert.match(
  localSetupScreen,
  /className="local-player-card"/,
  "local player slots should use dedicated classes so their spacing and density can be tuned without inline one-off sizing",
);

assert.match(
  settingsScreen,
  /className="[^"]*settings-main[^"]*"/,
  "the settings screen should expose a dedicated main class so it can share the compact non-match scale treatment",
);

assert.match(
  settingsScreen,
  /className="[^"]*settings-grid[^"]*"/,
  "the settings screen should use a dedicated grid class so its cards can tighten up at desktop sizes",
);

assert.match(
  css,
  /\.results-screen__content\s*\{[^}]*width:\s*min\(100%,\s*76rem\);[^}]*margin:\s*0 auto;/s,
  "the results screen should keep its content inside a compact desktop column instead of stretching loosely across the entire canvas",
);

assert.match(
  css,
  /\.auth-card\s*\{[^}]*width:\s*min\(100%,\s*32rem\);/s,
  "the auth card should shrink slightly on desktop so it feels aligned with the new shared non-match scale",
);

assert.match(
  css,
  /\.matchmaking-screen__card\s*\{[^}]*width:\s*min\(100%,\s*32rem\);/s,
  "the matchmaking screen should inherit the same compact card width as the rest of the non-match flow",
);

assert.match(
  css,
  /\.room-error-screen__card\s*\{[^}]*width:\s*min\(100%,\s*32rem\);/s,
  "error recovery screens should use the same compact width so they do not feel zoomed-in beside the refined match screen",
);

console.log("Non-match screen scale regression test suite passed.");
