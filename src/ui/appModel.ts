import type { GameState, PlayerColor, PlayerId, RuneTileType } from "../state/types.ts";
import { PLAYER_ORDER_BY_COUNT, PLAYER_NAMES, TILE_HELP, TILE_LABELS } from "../state/gameLogic.ts";
import { getDisplayName, isSupporter, stripFounderBadge } from "./supporterModel.ts";

export type AppRoute =
  | { name: "landing" }
  | { name: "lobby" }
  | { name: "settings" }
  | { name: "matchmaking" }
  | { name: "assembly"; roomId: string }
  | { name: "match"; matchId: string }
  | { name: "local_setup" }
  | { name: "local_match" }
  | { name: "results"; matchId: string }
  | { name: "chronicle"; matchId: string };

export interface ProtectionState {
  authenticated: boolean;
  hasActiveMatch: boolean;
  hasCompletedMatch: boolean;
}

export interface RoomSeatStatus {
  occupied: boolean;
  ready: boolean;
}

export interface UserProfile {
  username: string;
  level: number;
  clientId: string;
}

export function getOrCreateAutoProfile(): UserProfile {
  let localStorage = (globalThis as any).localStorage;
  let username = localStorage?.getItem("wyrm_username");
  let clientId = localStorage?.getItem("wyrm_client_id");

  if (!username) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomSuffix = "";
    for (let i = 0; i < 4; i++) {
        randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    username = "Wyrm-" + randomSuffix;
    localStorage?.setItem("wyrm_username", username);
  }

  if (!clientId) {
    clientId = (globalThis as any).crypto?.randomUUID() ?? `wyrm-fallback-${Date.now()}`;
    localStorage?.setItem("wyrm_client_id", clientId);
  }
  
  return {
    username,
    level: 1,
    clientId,
  };
}

export interface AssemblySeat extends RoomSeatStatus {
  id: string;
  name: string;
  level: number;
  host: boolean;
  currentUser: boolean;
  avatarUrl?: string | null;
  playerId?: PlayerId;
  color?: PlayerColor;
}

export interface AssemblyRoom {
  id: string;
  code: string;
  seats: AssemblySeat[];
  timer: "30s" | "60s" | "∞";
  boardVariant: "sacred_grove" | "frozen_peaks";
  serverName: string;
  latencyMs: number;
  autoBeginWhenReady: boolean;
  /** "active" = normal play, "paused_disconnected" = opponent DC'd, "closed" = abandoned */
  matchStatus: "active" | "paused_disconnected" | "closed";
  /** Name of the player who disconnected, or null when matchStatus is "active" */
  disconnectedSeatName: string | null;
  /** How many minutes the room is held open while waiting for reconnect. Default 30. */
  reconnectDeadlineMinutes: number;
}

export interface ChronicleEvent {
  id: string;
  round: number;
  playerId: PlayerId;
  playerName: string;
  playerColor: PlayerColor;
  title: string;
  description: string;
  actionBadge: string;
  eventType: "standard" | "combat" | "grove" | "lair";
  regionTag?: string;
  artTitle?: string;
}

export interface MatchRecord {
  id: string;
  roomId: string;
  roomCode: string;
  winnerId: PlayerId;
  winnerName: string;
  winnerColor: PlayerColor;
  localPlayerId: PlayerId;
  localPlayerName: string;
  localPlayerColor: PlayerColor;
  result: "win" | "loss";
  rounds: number;
  opponents: string[];
  conquest: number;
  strategy: number;
  groveControl: number;
  sessionIndex: number;
  completedAt: number;
  flavorQuote: string;
  events: ChronicleEvent[];
  opponentStillConnected?: boolean;
}

export const AUTH_QUOTES = [
  "Every sigil remembers the hand that dared to draw it.",
  "The Grove listens longest to names spoken with intent.",
  "Ink binds the timid. Amber crowns the bold.",
  "A quiet archivist can still wake a sleeping wyrm.",
  "Some doors open with keys. The oldest answer to conviction.",
  "Between parchment and pine, every oath leaves a trail.",
];

export const LOBBY_QUOTES = [
  "The Tome favors the prepared, but it adores the daring.",
  "A chronicle is only a rumor until someone survives to write it.",
  "Even the stillest hall carries the sound of distant wings.",
];

export const RESULT_QUOTES = [
  "Victory rarely arrives in silence; it rustles like leaves before the storm.",
  "The Grove keeps score in roots, ash, and whispered names.",
  "A masterwork is only complete once the last ember cools.",
];

export const SCRIBE_NAMES = [
  "Caligo Wren",
  "Mira Oathkeeper",
  "Elden Briar",
  "Sable Quill",
  "Thorne Vesper",
  "Aurel Finch",
];

export const PLAYER_PALETTE: Record<PlayerColor, { base: string; soft: string; ink: string }> = {
  purple: { base: "#534AB7", soft: "rgba(83, 74, 183, 0.15)", ink: "#1e1a4a" },
  coral: { base: "#D85A30", soft: "rgba(216, 90, 48, 0.16)", ink: "#4b1a0c" },
  teal: { base: "#1D9E75", soft: "rgba(29, 158, 117, 0.16)", ink: "#0a3328" },
  amber: { base: "#BA7517", soft: "rgba(186, 117, 23, 0.16)", ink: "#4c3000" },
};

const ROOM_CODE_REGEX = /^[A-Z]{3}-[A-Z0-9]-[A-Z0-9]{4}$/;

export function parseAppRoute(pathname: string): AppRoute {
  const [path] = pathname.split(/[?#]/);
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { name: "landing" };
  }

  if (segments[0] === "lobby") {
    return { name: "lobby" };
  }

  if (segments[0] === "settings") {
    return { name: "settings" };
  }

  if (segments[0] === "matchmaking") {
    return { name: "matchmaking" };
  }

  if (segments[0] === "assembly" && segments[1]) {
    return { name: "assembly", roomId: segments[1] };
  }

  if (segments[0] === "match" && segments[1] && segments.length === 2) {
    return { name: "match", matchId: segments[1] };
  }

  if (segments[0] === "match" && segments[1] && segments[2] === "results") {
    return { name: "results", matchId: segments[1] };
  }

  if (segments[0] === "match" && segments[1] && segments[2] === "chronicle") {
    return { name: "chronicle", matchId: segments[1] };
  }

  if (segments[0] === "local") {
    if (segments.length === 1) {
      return { name: "local_setup" };
    }
    if (segments[1] === "match") {
      return { name: "local_match" };
    }
  }

  return { name: "lobby" };
}

export function toPath(route: AppRoute): string {
  switch (route.name) {
    case "landing":
      return "/";
    case "lobby":
      return "/lobby";
    case "settings":
      return "/settings";
    case "matchmaking":
      return "/matchmaking";
    case "assembly":
      return `/assembly/${route.roomId}`;
    case "match":
      return `/match/${route.matchId}`;
    case "local_setup":
      return "/local";
    case "local_match":
      return "/local/match";
    case "results":
      return `/match/${route.matchId}/results`;
    case "chronicle":
      return `/match/${route.matchId}/chronicle`;
  }
}

export function getProtectedRedirect(route: AppRoute, protection: ProtectionState): string | null {
  if (!protection.authenticated && route.name !== "landing") {
    return "/";
  }

  if ((route.name === "results" || route.name === "chronicle") && !protection.hasCompletedMatch) {
    return "/lobby";
  }

  return null;
}

export function validateAssemblyCode(value: string): boolean {
  return ROOM_CODE_REGEX.test(value.trim());
}

export function canHostCommence(seats: RoomSeatStatus[]): boolean {
  const occupied = seats.filter((seat) => seat.occupied);
  return occupied.length >= 2 && occupied.every((seat) => seat.ready);
}

export function generateAssemblyCode(seed = Date.now()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomFromSeed = (input: number) => alphabet[input % alphabet.length];
  const year = String(seed).slice(-4);
  return `${randomFromSeed(seed)}${randomFromSeed(seed + 3)}${randomFromSeed(seed + 7)}-${seed % 9}-${year}`;
}

export function pickRotating<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

export function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  let remainder = Math.max(1, value);
  let output = "";

  for (const [amount, symbol] of numerals) {
    while (remainder >= amount) {
      output += symbol;
      remainder -= amount;
    }
  }

  return output;
}

export function getPlayerInitial(name: string): string {
  const [first] = stripFounderBadge(name).trim();
  return (first ?? "W").toUpperCase();
}

export function getPhaseLabel(phase: GameState["phase"]): string {
  switch (phase) {
    case "draw":
      return "DRAW";
    case "roll":
      return "ROLL";
    case "move":
      return "MOVE";
    case "play_tile":
      return "PLAY TILE";
    case "discard":
      return "DISCARD";
    case "game_over":
      return "RESULT";
  }
}

export function getTileBadge(tile: RuneTileType): string {
  switch (tile) {
    case "fire":
      return "EMBER";
    case "water":
      return "TIDE";
    case "earth":
      return "STONE";
    case "wind":
      return "GALE";
    case "shadow":
      return "ECLIPSE";
    case "light":
      return "RADIANCE";
    case "void":
      return "ERASURE";
    case "serpent":
      return "COIL";
  }
}

export function getTileIllustration(tile: RuneTileType): string {
  switch (tile) {
    case "fire":
      return "Concentric amber embers dancing through smoke.";
    case "water":
      return "Painterly river currents curling through pale reeds.";
    case "earth":
      return "Broken standing stones glowing beneath moss.";
    case "wind":
      return "A falcon-feather gust slicing through a cloudy sky.";
    case "shadow":
      return "Twin silhouettes trading places in eclipse light.";
    case "light":
      return "A gilded lens casting bright spokes across parchment.";
    case "void":
      return "Dark petals folding inward around a silver seam.";
    case "serpent":
      return "A coiled wyrm traced in gold over ancient ink.";
  }
}

export function getTileSummary(tile: RuneTileType): string {
  return TILE_HELP[tile];
}

export function getTileName(tile: RuneTileType): string {
  return TILE_LABELS[tile];
}

export function createSeat(
  partial: Partial<AssemblySeat> & Pick<AssemblySeat, "id" | "name">,
): AssemblySeat {
  return {
    id: partial.id,
    name: partial.name,
    level: partial.level ?? 1,
    occupied: partial.occupied ?? true,
    ready: partial.ready ?? false,
    host: partial.host ?? false,
    currentUser: partial.currentUser ?? false,
    avatarUrl: partial.avatarUrl ?? null,
    color: partial.color,
    playerId: partial.playerId,
  };
}

export function seedHostRoom(profile: UserProfile): AssemblyRoom {
  const roomId = generateAssemblyCode();
  const displayName = getDisplayName(profile.username, isSupporter());
  return {
    id: roomId,
    code: roomId,
    timer: "60s",
    boardVariant: "sacred_grove",
    serverName: "Sacred Grove Cluster",
    latencyMs: 38,
    autoBeginWhenReady: false,
    matchStatus: "active",
    disconnectedSeatName: null,
    reconnectDeadlineMinutes: 30,
    seats: [
      createSeat({
        id: "seat-1",
        name: displayName,
        level: profile.level,
        host: true,
        currentUser: true,
        playerId: 1,
        color: "purple",
        ready: false,
      }),
      createSeat({
        id: "seat-2",
        name: "Elden Vale",
        level: profile.level + 1,
        playerId: 4,
        color: "amber",
        ready: true,
      }),
      createSeat({
        id: "seat-3",
        name: "Scribe joining...",
        occupied: false,
      }),
      createSeat({
        id: "seat-4",
        name: "INVITE SIGIL",
        occupied: false,
      }),
    ],
  };
}

export function seedGuestRoom(profile: UserProfile, code: string): AssemblyRoom {
  const displayName = getDisplayName(profile.username, isSupporter());
  return {
    id: code,
    code,
    timer: "60s",
    boardVariant: "sacred_grove",
    serverName: "West Archivum Relay",
    latencyMs: 54,
    autoBeginWhenReady: true,
    matchStatus: "active",
    disconnectedSeatName: null,
    reconnectDeadlineMinutes: 30,
    seats: [
      createSeat({
        id: "seat-1",
        name: "Mara Thorne",
        level: profile.level + 2,
        host: true,
        playerId: 1,
        color: "purple",
        ready: true,
      }),
      createSeat({
        id: "seat-2",
        name: displayName,
        level: profile.level,
        currentUser: true,
        playerId: 4,
        color: "amber",
        ready: false,
      }),
      createSeat({
        id: "seat-3",
        name: "Scribe joining...",
        occupied: false,
      }),
      createSeat({
        id: "seat-4",
        name: "INVITE SIGIL",
        occupied: false,
      }),
    ],
  };
}

export function mapSeatNamesByPlayerId(room: AssemblyRoom): Record<PlayerId, string> {
  const fallback = { ...PLAYER_NAMES };
  for (const seat of room.seats) {
    if (seat.occupied && seat.playerId) {
      fallback[seat.playerId] = seat.name;
    }
  }
  return fallback;
}

export function mapSeatColorsByPlayerId(room: AssemblyRoom): Record<PlayerId, PlayerColor> {
  const colors: Record<PlayerId, PlayerColor> = {
    1: "purple",
    2: "coral",
    3: "teal",
    4: "amber",
  };

  for (const seat of room.seats) {
    if (seat.occupied && seat.playerId && seat.color) {
      colors[seat.playerId] = seat.color;
    }
  }

  return colors;
}

export function buildChronicleEvent(
  message: string,
  round: number,
  room: AssemblyRoom,
  index: number,
): ChronicleEvent {
  const playerId = inferPlayerIdFromMessage(message, room);
  const palette = mapSeatColorsByPlayerId(room);
  const seatNames = mapSeatNamesByPlayerId(room);
  const actionBadge = inferActionBadge(message);
  const eventType = inferEventType(message);

  return {
    id: `chronicle-${round}-${index}`,
    round,
    playerId,
    playerName: seatNames[playerId],
    playerColor: palette[playerId],
    title: humanizeChronicleTitle(message, seatNames),
    description: humanizeChronicleDescription(message, seatNames),
    actionBadge,
    eventType,
    regionTag: inferRegionTag(message),
    artTitle: eventType === "standard" ? undefined : `${actionBadge.toLowerCase()} illustration`,
  };
}

export function buildMatchRecord(
  state: GameState,
  room: AssemblyRoom,
  localProfile: UserProfile,
  sessionIndex: number,
  events: ChronicleEvent[],
): MatchRecord {
  const winnerId = state.winner ?? room.seats.find((seat) => seat.host)?.playerId ?? 1;
  const seatNames = mapSeatNamesByPlayerId(room);
  const seatColors = mapSeatColorsByPlayerId(room);
  const localSeat = room.seats.find((seat) => seat.currentUser && seat.playerId) ?? room.seats[0];
  const activePlayerIds = PLAYER_ORDER_BY_COUNT[state.playerCount];
  const opponents = activePlayerIds
    .filter((playerId) => playerId !== localSeat.playerId)
    .map((playerId) => seatNames[playerId]);
  const conquest = room.seats
    .filter((seat) => seat.occupied && seat.playerId)
    .reduce(
      (total, seat) =>
        total + (state.players.find((player) => player.id === seat.playerId)?.hoard.length ?? 0),
      0,
    );
  const strategy = events.filter((event) => event.actionBadge.includes("TILE") || event.eventType === "lair").length;
  const groveOccupants = Object.values(state.wyrms).filter(
    (wyrm) => wyrm.position && (wyrm.position.row === 5 || wyrm.position.row === 6) && (wyrm.position.col === 5 || wyrm.position.col === 6),
  ).length;
  const groveControl = Math.min(100, 25 + groveOccupants * 18 + strategy * 4);

  return {
    id: `session-${sessionIndex}`,
    roomId: room.id,
    roomCode: room.code,
    winnerId,
    winnerName: seatNames[winnerId],
    winnerColor: seatColors[winnerId],
    localPlayerId: localSeat.playerId ?? 1,
    localPlayerName: getDisplayName(localProfile.username, isSupporter()),
    localPlayerColor: localSeat.color ?? "purple",
    result: winnerId === localSeat.playerId ? "win" : "loss",
    rounds: state.currentRound,
    opponents,
    conquest,
    strategy,
    groveControl,
    sessionIndex,
    completedAt: Date.now(),
    flavorQuote: pickRotating(RESULT_QUOTES, sessionIndex),
    events,
    opponentStillConnected: room.seats.some(seat => !seat.currentUser && seat.occupied),
  };
}

function inferPlayerIdFromMessage(message: string, room: AssemblyRoom): PlayerId {
  const seatNames = mapSeatNamesByPlayerId(room);
  const match = (Object.keys(seatNames) as Array<`${PlayerId}`>).find((key) =>
    message.toLowerCase().includes(seatNames[Number(key) as PlayerId].split(" ")[0].toLowerCase()) ||
    message.toLowerCase().includes(PLAYER_NAMES[Number(key) as PlayerId].toLowerCase()),
  );
  return match ? (Number(match) as PlayerId) : 1;
}

function inferActionBadge(message: string): string {
  const lowered = message.toLowerCase();
  if (lowered.includes("drew")) return "ACTION: DRAW";
  if (lowered.includes("rolled")) return "ACTION: ROLL";
  if (lowered.includes("moved")) return "ACTION: MOVE";
  if (lowered.includes("promoted")) return "ACTION: ASCEND";
  if (lowered.includes("domination") || lowered.includes("captured")) return "ACTION: COMBAT";
  if (lowered.includes("trail")) return "ACTION: TRAIL";
  if (lowered.includes("flood") || lowered.includes("phoenix") || lowered.includes("void") || lowered.includes("ancient")) {
    return "ACTION: LAIR";
  }
  if (lowered.includes("rune") || lowered.includes("wall")) return "ACTION: TILE";
  return "ACTION: NOTE";
}

function inferEventType(message: string): ChronicleEvent["eventType"] {
  const lowered = message.toLowerCase();
  if (lowered.includes("domination") || lowered.includes("captured")) return "combat";
  if (lowered.includes("grove")) return "grove";
  if (lowered.includes("phoenix") || lowered.includes("flood") || lowered.includes("void") || lowered.includes("ancient")) {
    return "lair";
  }
  return "standard";
}

function inferRegionTag(message: string): string | undefined {
  const lowered = message.toLowerCase();
  if (lowered.includes("grove")) return "Sacred Grove";
  if (lowered.includes("wall")) return "Stone Verge";
  if (lowered.includes("trail")) return "Wake Trail";
  if (lowered.includes("void")) return "Hollow Span";
  if (lowered.includes("captured")) return "Outer Ring";
  return undefined;
}

function humanizeChronicleTitle(message: string, names: Record<PlayerId, string>): string {
  let title = message;
  for (const [playerId, name] of Object.entries(names)) {
    title = title.replaceAll(PLAYER_NAMES[Number(playerId) as PlayerId], name);
  }
  return title.endsWith(".") ? title.slice(0, -1) : title;
}

function humanizeChronicleDescription(message: string, names: Record<PlayerId, string>): string {
  const title = humanizeChronicleTitle(message, names);
  if (message.toLowerCase().includes("captured")) {
    return `${title} turned the lane into a sudden combat encounter.`;
  }
  if (message.toLowerCase().includes("grove")) {
    return `${title} shifted the center of the board and the entire table felt it.`;
  }
  if (message.toLowerCase().includes("rolled")) {
    return `${title}, and the next line of play narrowed at once.`;
  }
  if (message.toLowerCase().includes("drew")) {
    return `${title}, adding another whispered option to the hand.`;
  }
  return `${title}, recorded faithfully by the scribe for later study.`;
}
