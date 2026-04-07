import {
  canCommitPath,
  canResolveBlockedMove,
  getAdjacentEmptyCells,
  getControlledActiveWyrms,
  getCurrentPlayer,
  getDeployTargets,
  getNextPathOptions,
  SACRED_GROVE_CELLS,
  sameCoord,
} from "./gameLogic.ts";
import { getMoveConsequenceSummary } from "./strategicAnalysis.ts";
import type {
  Coord,
  GameState,
  MoveMode,
  PlayerId,
  RuneTileType,
  TilePlayRequest,
  WyrmId,
} from "./types.ts";

export type BotDifficulty = "light" | "easy" | "hard" | "harder" | "hardest";

export type BotAction =
  | { type: "draw" }
  | { type: "discard"; tiles: RuneTileType[] }
  | { type: "roll" }
  | { type: "set_coil_choice"; choice: 1 | 2 | 3 | "extra_trail" }
  | { type: "move"; wyrmId: string; path: Coord[]; moveMode: MoveMode }
  | { type: "place_coil_trail"; wyrmId: string; target?: Coord }
  | { type: "deploy"; wyrmId: string; target: Coord }
  | (TilePlayRequest & { type: "play_tile" })
  | { type: "end_turn" };

// ─── Path Finding ────────────────────────────────────────────────────────────

function findAllPaths(
  state: GameState,
  wyrmId: WyrmId,
  moveMode: MoveMode,
): Coord[][] {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm || !wyrm.position) return [];
  const validPaths: Coord[][] = [];
  const search = (currentPath: Coord[]) => {
    if (currentPath.length > 1 && canCommitPath(state, wyrmId, currentPath, moveMode)) {
      validPaths.push([...currentPath]);
    }
    // Prune: stop branching if max depth exceeded (getNextPathOptions handles this)
    const options = getNextPathOptions(state, wyrmId, currentPath, moveMode);
    for (const option of options) {
      search([...currentPath, { row: option.row, col: option.col }]);
    }
  };
  search([wyrm.position]);
  return validPaths;
}

// ─── Scoring Heuristics ──────────────────────────────────────────────────────

const GROVE_CENTER: Coord = { row: 5, col: 5 };

/** Chebyshev distance to the nearest Sacred Grove cell */
function distanceToGrove(coord: Coord): number {
  return Math.min(
    ...SACRED_GROVE_CELLS.map((g) =>
      Math.max(Math.abs(coord.row - g.row), Math.abs(coord.col - g.col)),
    ),
  );
}

/** Count how many distinct board cells a player occupies (trails + wyrms) */
function countPlayerPresence(state: GameState, playerId: PlayerId): number {
  let count = 0;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.trail?.owner === playerId || (cell.occupant && state.wyrms[cell.occupant]?.currentOwner === playerId)) {
        count++;
      }
    }
  }
  return count;
}

/** Estimate how "free" a wyrm is by counting reachable moves from the end of a path */
function mobilityAt(state: GameState, wyrmId: WyrmId, endpoint: Coord): number {
  const wyrm = state.wyrms[wyrmId];
  if (!wyrm) return 0;
  const dirs = wyrm.isElder
    ? [
      { row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 },
      { row: -1, col: -1 }, { row: -1, col: 1 }, { row: 1, col: -1 }, { row: 1, col: 1 },
    ]
    : [
      { row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 },
    ];
  let free = 0;
  for (const dir of dirs) {
    const nb = { row: endpoint.row + dir.row, col: endpoint.col + dir.col };
    if (nb.row < 0 || nb.row >= 12 || nb.col < 0 || nb.col >= 12) continue;
    const cell = state.board[nb.row][nb.col];
    if (!cell.hasWall && !cell.trail) free++;
  }
  return free;
}

/**
 * Score a candidate path. Higher = better.
 * Used for hard / harder / hardest difficulties.
 */
function scorePath(
  state: GameState,
  wyrmId: WyrmId,
  path: Coord[],
  difficulty: BotDifficulty,
): number {
  const endpoint = path[path.length - 1];
  const cell = state.board[endpoint.row][endpoint.col];
  let score = 0;

  // Heavy bonus for captures
  if (cell.occupant && state.wyrms[cell.occupant]?.currentOwner !== state.wyrms[wyrmId]?.currentOwner) {
    score += 260;
  }

  // Grove proximity bonus
  const groveDist = distanceToGrove(endpoint);
  score += (10 - groveDist) * 10;

  // Check if this lands on a power rune
  if (cell.hasPowerRune) score += 50;

  // Checking if we're landing in a Sacred Grove cell for potential win condition
  if (SACRED_GROVE_CELLS.some((g) => sameCoord(g, endpoint))) {
    score += 80;
  }

  // Longer paths = more trail coverage (better board control)
  if (difficulty === "harder" || difficulty === "hardest") {
    score += (path.length - 1) * 5;
  }

  // Mobility: prefer endpoints with more future options
  if (difficulty === "hardest") {
    score += mobilityAt(state, wyrmId, endpoint) * 8;
  }

  const consequenceSummary = getMoveConsequenceSummary(state, wyrmId, path);
  if (consequenceSummary.immediateVictory) {
    score += 1200;
  }

  score += consequenceSummary.futureCaptureThreats * 90;
  score += consequenceSummary.groveReachableCount * 24;

  if (consequenceSummary.deadEndRisk === "blocked") {
    score -= 170;
  } else if (consequenceSummary.deadEndRisk === "tight") {
    score -= 48;
  }

  // Distance from own den center (prefer moving out)
  const ownCenter = GROVE_CENTER;
  const distFromCenter = Math.abs(endpoint.row - ownCenter.row) + Math.abs(endpoint.col - ownCenter.col);
  if (difficulty === "hard" || difficulty === "harder" || difficulty === "hardest") {
    score -= distFromCenter; // Closer to center = better
  }

  return score;
}

// ─── Tile Play Logic ─────────────────────────────────────────────────────────

/**
 * Try to find a useful tile play. Returns null if no good play is found.
 * Only used at hard+ difficulty.
 */
function chooseTilePlay(state: GameState, difficulty: BotDifficulty): BotAction | null {
  if (state.turnEffects.tileActionUsed) return null;

  const player = getCurrentPlayer(state);

  // Count tile frequencies in hand
  const tileCounts: Partial<Record<RuneTileType, number>> = {};
  for (const tile of player.hand) {
    tileCounts[tile] = (tileCounts[tile] ?? 0) + 1;
  }

  const hasTile = (t: RuneTileType) => (tileCounts[t] ?? 0) >= 1;
  const hasLair = (t: RuneTileType) => (tileCounts[t] ?? 0) >= 3;

  const activeWyrms = getControlledActiveWyrms(state, player.id);
  const opponents = state.players.filter((p) => p.id !== player.id);

  // ── Hardest: use Lair Powers when available ──────────────────────────────
  if (difficulty === "hardest" || difficulty === "harder") {
    // Wind Lair = Tempest Rush (free bonus moves for all)
    if (hasLair("wind") && activeWyrms.length >= 1) {
      return { type: "play_tile", mode: "lair", tile: "wind" };
    }

    // Fire Lair = clear all trails (good if you're very behind on coverage)
    if (hasLair("fire")) {
      const presenceBefore = countPlayerPresence(state, player.id);
      const trailDomination = presenceBefore < 10;
      if (trailDomination) {
        return { type: "play_tile", mode: "lair", tile: "fire" };
      }
    }

    // Void Lair = annihilate an opponent's trails (pick the one with most trails)
    if (hasLair("void") && opponents.length > 0) {
      const richestOpponent = opponents.reduce((best, opp) => {
        return countPlayerPresence(state, opp.id) > countPlayerPresence(state, best.id) ? opp : best;
      });
      if (countPlayerPresence(state, richestOpponent.id) > 8) {
        return { type: "play_tile", mode: "lair", tile: "void", opponentId: richestOpponent.id };
      }
    }

    // Water Lair = Flood Path (good if you need to escape or push through trails)
    if (hasLair("water") && player.floodPathTurnsRemaining === 0) {
      const blockedWyrms = activeWyrms.filter((w) => {
        const paths = findAllPaths(state, w.id, "main");
        return paths.length === 0;
      });
      if (blockedWyrms.length > 0) {
        return { type: "play_tile", mode: "lair", tile: "water" };
      }
    }
  }

  // ── Hard+: use single tiles situationally ───────────────────────────────
  if (difficulty === "hard" || difficulty === "harder" || difficulty === "hardest") {
    // Wind (Gust): give a wyrm +2 movement, especially useful if a capture/grove is close but out of range
    if (hasTile("wind") && activeWyrms.length > 0) {
      // Pick a wyrm that could reach Grove or a capture with +2
      for (const wyrm of activeWyrms) {
        const gd = distanceToGrove(wyrm.position!);
        if (gd <= 3) {
          return { type: "play_tile", mode: "single", tile: "wind", wyrmId: wyrm.id };
        }
      }
    }

    // Fire (Flame): clear own trails if very congested
    if (hasTile("fire")) {
      let ownTrails = 0;
      for (const row of state.board) {
        for (const cell of row) {
          if (cell.trail?.owner === player.id) ownTrails++;
        }
      }
      if (ownTrails > 12) {
        return { type: "play_tile", mode: "single", tile: "fire" };
      }
    }

    // Shadow (Eclipse): swap two wyrms to reposition
    if (hasTile("shadow") && activeWyrms.length >= 2) {
      // Swap a trapped wyrm with a better-positioned one
      const [a, b] = activeWyrms;
      if (a.position && b.position) {
        const aToGrove = distanceToGrove(a.position);
        const bToGrove = distanceToGrove(b.position);
        // Only worth swapping if it gains significant grove distance
        if (Math.abs(aToGrove - bToGrove) >= 3) {
          return { type: "play_tile", mode: "single", tile: "shadow", swapWyrmIds: [a.id, b.id] };
        }
      }
    }

    // Light (Radiance): reveal an opponent's hand — nearly always free info
    if (hasTile("light") && opponents.length > 0 && difficulty === "hardest") {
      return { type: "play_tile", mode: "single", tile: "light", opponentId: opponents[0].id };
    }
  }

  return null;
}

// ─── Move Selection ───────────────────────────────────────────────────────────

type ScoredMove = { wyrmId: WyrmId; path: Coord[]; score: number };

function selectMove(
  state: GameState,
  wyrmId: WyrmId,
  paths: Coord[][],
  difficulty: BotDifficulty,
): Coord[] | null {
  if (paths.length === 0) return null;

  if (difficulty === "light") {
    // Completely random
    return paths[Math.floor(Math.random() * paths.length)];
  }

  if (difficulty === "easy") {
    // Prefer longer paths (more coverage) but still with some randomness
    const weighted = paths.flatMap((p) => Array(p.length).fill(p) as Coord[][]);
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  // hard / harder / hardest: score-based selection
  const scored: ScoredMove[] = paths.map((p) => ({
    wyrmId,
    path: p,
    score: scorePath(state, wyrmId, p, difficulty),
  }));

  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "hard") {
    // Pick among top 3 with some randomness
    const top = scored.slice(0, Math.min(3, scored.length));
    return top[Math.floor(Math.random() * top.length)].path;
  }

  if (difficulty === "harder") {
    // 80% top pick, 20% second-best
    if (scored.length > 1 && Math.random() < 0.2) return scored[1].path;
    return scored[0].path;
  }

  // hardest: deterministic best
  return scored[0].path;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export function chooseBotAction(state: GameState, difficulty: BotDifficulty): BotAction {
  // 1. Draw Step
  if (state.phase === "draw") {
    return { type: "draw" };
  }

  // 2. Discard Step — discard lowest-value tiles first at hard+
  if (state.phase === "discard") {
    const player = getCurrentPlayer(state);
    let tilesToDiscard: RuneTileType[];

    if (difficulty === "light" || difficulty === "easy") {
      // Discard from front (arbitrary)
      tilesToDiscard = player.hand.slice(0, state.mustDiscard);
    } else {
      // Prefer keeping tiles that form Lair sets (3+) or have synergy
      const tileCounts: Partial<Record<RuneTileType, number>> = {};
      for (const tile of player.hand) {
        tileCounts[tile] = (tileCounts[tile] ?? 0) + 1;
      }
      // Sort: low count first (singletons dispensable), high count last (keep sets)
      const handSorted = [...player.hand].sort(
        (a, b) => (tileCounts[a] ?? 0) - (tileCounts[b] ?? 0),
      );
      tilesToDiscard = handSorted.slice(0, state.mustDiscard);
    }

    return { type: "discard", tiles: tilesToDiscard };
  }

  // 3. Roll Step
  if (state.phase === "roll") {
    return { type: "roll" };
  }

  // 4. Move / Play Tile Step
  if (state.phase === "move" || state.phase === "play_tile") {
    const player = getCurrentPlayer(state);

    // Handle Coil Choice
    if (state.dieResult === "coil" && state.turnEffects.coilChoice == null) {
      // Light/easy: always pick 3; harder difficulties pick based on nearby targets
      if (difficulty === "light" || difficulty === "easy") {
        return { type: "set_coil_choice", choice: 3 };
      }
      // Hard+: pick the step count that leads to a capture or Grove cell
      const activeWyrms = getControlledActiveWyrms(state, player.id);
      let bestChoice: 1 | 2 | 3 = 3;
      let bestScore = -Infinity;
      for (const choice of [1, 2, 3] as const) {
        for (const wyrm of activeWyrms) {
          // Find any path with exactly `choice` steps
          const paths = findAllPaths(state, wyrm.id, "main").filter(
            (p) => p.length - 1 === choice,
          );
          for (const path of paths) {
            const s = scorePath(state, wyrm.id, path, difficulty);
            if (s > bestScore) {
              bestScore = s;
              bestChoice = choice;
            }
          }
        }
      }
      return { type: "set_coil_choice", choice: bestChoice };
    }

    const activeWyrms = getControlledActiveWyrms(state, player.id);

    // Try a Tile play first at hard+ if tile step is available
    if (
      state.phase === "play_tile" &&
      (difficulty === "hard" || difficulty === "harder" || difficulty === "hardest")
    ) {
      const tileAction = chooseTilePlay(state, difficulty);
      if (tileAction) return tileAction;
    }

    // Main move not yet completed
    if (!state.turnEffects.mainMoveCompleted) {
      // Build all candidate moves across all wyrms
      const allScoredMoves: ScoredMove[] = [];
      for (const wyrm of activeWyrms) {
        const paths = findAllPaths(state, wyrm.id, "main");
        for (const path of paths) {
          allScoredMoves.push({
            wyrmId: wyrm.id,
            path,
            score:
              difficulty === "light"
                ? Math.random()
                : scorePath(state, wyrm.id, path, difficulty),
          });
        }
      }

      if (allScoredMoves.length > 0) {
        let chosen: ScoredMove;

        if (difficulty === "light") {
          chosen = allScoredMoves[Math.floor(Math.random() * allScoredMoves.length)];
        } else if (difficulty === "easy") {
          // Prefer longer paths
          const sorted = [...allScoredMoves].sort((a, b) => b.path.length - a.path.length);
          const top5 = sorted.slice(0, Math.min(5, sorted.length));
          chosen = top5[Math.floor(Math.random() * top5.length)];
        } else if (difficulty === "hard") {
          allScoredMoves.sort((a, b) => b.score - a.score);
          const top = allScoredMoves.slice(0, Math.min(4, allScoredMoves.length));
          chosen = top[Math.floor(Math.random() * top.length)];
        } else if (difficulty === "harder") {
          allScoredMoves.sort((a, b) => b.score - a.score);
          chosen = Math.random() < 0.85 ? allScoredMoves[0] : allScoredMoves[Math.min(1, allScoredMoves.length - 1)];
        } else {
          // hardest: best score deterministically; tie-break by wyrmId for stability
          allScoredMoves.sort((a, b) => b.score - a.score || a.wyrmId.localeCompare(b.wyrmId));
          chosen = allScoredMoves[0];
        }

        return { type: "move", wyrmId: chosen.wyrmId, path: chosen.path, moveMode: "main" };
      }

      // No moves — try deploying from hoard
      if (player.hoard.length > 0) {
        const targets = getDeployTargets(state, player.id);
        if (targets.length > 0) {
          return { type: "deploy", wyrmId: player.hoard[0], target: targets[0] };
        }
      }

      // Resolve blocked move — place a coil trail instead
      if (canResolveBlockedMove(state)) {
        for (const wyrm of activeWyrms) {
          const adjs = getAdjacentEmptyCells(state, wyrm.id, true);
          if (adjs.length > 0) {
            return { type: "place_coil_trail", wyrmId: wyrm.id, target: adjs[0] };
          }
        }
        // Fully blocked with no adjacent empty cells
        return { type: "place_coil_trail", wyrmId: activeWyrms[0]?.id ?? "" };
      }
    }

    // Handle Tempest Rush bonus moves
    if (state.turnEffects.tempestRushRemaining.length > 0) {
      const wyrmId = state.turnEffects.tempestRushRemaining[0];
      const paths = findAllPaths(state, wyrmId, "tempest");
      if (paths.length > 0) {
        const chosen = selectMove(state, wyrmId, paths, difficulty);
        if (chosen) return { type: "move", wyrmId, path: chosen, moveMode: "tempest" };
      }
    }

    // Try tile play before ending turn at hard+
    if (difficulty === "hard" || difficulty === "harder" || difficulty === "hardest") {
      const tileAction = chooseTilePlay(state, difficulty);
      if (tileAction) return tileAction;
    }
  }

  // Fallback — end turn
  return { type: "end_turn" };
}
