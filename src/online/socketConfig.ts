const LOCAL_WS_URL = "ws://localhost:8787";
const PRODUCTION_WS_URL = "wss://wyrm.onrender.com";

interface SocketConfigEnv {
  VITE_WS_URL?: string;
  VITE_MATCHMAKING_WS_URL?: string;
}

interface MatchmakingSocketUrlOptions {
  env?: SocketConfigEnv;
  hostname?: string;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeSocketUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.startsWith("ws://")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (isLocalHostname(parsed.hostname)) {
      return trimmed;
    }

    return `wss://${trimmed.slice("ws://".length)}`;
  } catch {
    return trimmed;
  }
}

export function getMatchmakingSocketUrl(options: MatchmakingSocketUrlOptions = {}): string {
  const env = options.env ?? import.meta.env;
  const configured = env.VITE_WS_URL ?? env.VITE_MATCHMAKING_WS_URL;
  if (configured) {
    return normalizeSocketUrl(configured);
  }

  const hostname = options.hostname ?? window.location.hostname;
  return isLocalHostname(hostname) ? LOCAL_WS_URL : PRODUCTION_WS_URL;
}
