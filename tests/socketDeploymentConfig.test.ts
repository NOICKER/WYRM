import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getMatchmakingSocketUrl } from "../src/online/socketConfig.ts";

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {
        VITE_WS_URL: "wss://custom.example/socket",
      },
      hostname: "wyrm.vercel.app",
    }),
    "wss://custom.example/socket",
    "the explicit Vite websocket env var should win over hostname fallbacks",
  );
}

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {
        VITE_MATCHMAKING_WS_URL: "wss://legacy.example/socket",
      },
      hostname: "wyrm.vercel.app",
    }),
    "wss://legacy.example/socket",
    "the legacy matchmaking env var should still work during the migration",
  );
}

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {},
      hostname: "localhost",
    }),
    "ws://localhost:8787",
    "localhost should keep using the local development websocket server",
  );
}

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {},
      hostname: "127.0.0.1",
    }),
    "ws://localhost:8787",
    "127.0.0.1 should map to the local development websocket server",
  );
}

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {},
      hostname: "wyrm.vercel.app",
    }),
    "wss://wyrm.onrender.com",
    "non-local hosts should fall back to the Render websocket endpoint in production",
  );
}

{
  assert.equal(
    getMatchmakingSocketUrl({
      env: {
        VITE_WS_URL: "ws://wyrm.onrender.com",
      },
      hostname: "wyrm.vercel.app",
    }),
    "wss://wyrm.onrender.com",
    "production websocket env values should be upgraded to wss when they point at a remote host",
  );
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const sessionSource = fs.readFileSync(path.join(projectRoot, "src/online/useOnlineSession.ts"), "utf8");
const serverSource = fs.readFileSync(path.join(projectRoot, "server/index.ts"), "utf8");
const envSource = fs.readFileSync(path.join(projectRoot, ".env"), "utf8");

assert.match(
  sessionSource,
  /import\s+\{\s*getMatchmakingSocketUrl\s*\}\s+from "\.\/socketConfig\.ts";/,
  "the online session should centralize websocket URL resolution through the shared socket config helper",
);

assert.match(
  serverSource,
  /const server = createServer\(/,
  "the backend should keep the HTTP server and websocket server on the same Node server instance",
);

assert.match(
  serverSource,
  /new WebSocketServer\(\{ server \}\)/,
  "the websocket server should attach to the shared HTTP server for Render compatibility",
);

assert.match(
  serverSource,
  /console\.log\("WYRM matchmaking server is running"\);/,
  "the backend should emit a startup log that confirms the server booted",
);

assert.match(
  serverSource,
  /console\.log\(`WebSocket ready on port \$\{PORT\}`\);/,
  "the backend should log the websocket listener port clearly for production debugging",
);

assert.match(
  envSource,
  /^VITE_WS_URL=wss:\/\/wyrm\.onrender\.com$/m,
  "the frontend env file should point Vite at the Render websocket host",
);

console.log("Socket deployment config test suite passed.");
