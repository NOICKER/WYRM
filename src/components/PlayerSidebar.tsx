import React from "react";

import {
  PLAYER_NAMES,
  TILE_HELP,
  TILE_LABELS,
  TILE_ORDER,
  getControlledActiveWyrms,
} from "../state/gameLogic.ts";
import type { GameState, PlayerId, RuneTileType, WyrmId } from "../state/types.ts";

interface PlayerSidebarProps {
  state: GameState;
  peekPlayerId: PlayerId | null;
  pendingDeployWyrmId: WyrmId | null;
  canDeployFromHoard: boolean;
  onPrepareDeploy: (wyrmId: WyrmId) => void;
  onClosePeek: () => void;
}

function countTile(hand: RuneTileType[], tile: RuneTileType): number {
  return hand.filter((entry) => entry === tile).length;
}

export function PlayerSidebar({
  state,
  peekPlayerId,
  pendingDeployWyrmId,
  canDeployFromHoard,
  onPrepareDeploy,
  onClosePeek,
}: PlayerSidebarProps): React.JSX.Element {
  const activePlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="sidebar-column">
      <section className="sidebar-panel hand-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Hand & Hoard</p>
            <h3>{PLAYER_NAMES[activePlayer.id]} player</h3>
          </div>
          <div className="deck-meters">
            <span>Deck {state.deck.length}</span>
            <span>Discard {state.discardPile.length}</span>
          </div>
        </div>

        <div className="tile-group-list">
          {TILE_ORDER.filter((tile) => countTile(activePlayer.hand, tile) > 0).map((tile) => {
            const copies = countTile(activePlayer.hand, tile);
            return (
              <div key={tile} className="tile-group-card">
                <div>
                  <strong>{TILE_LABELS[tile]}</strong>
                  <p>{TILE_HELP[tile]}</p>
                </div>
                <div className="tile-card-actions">
                  <span className="tile-count">x{copies}</span>
                </div>
              </div>
            );
          })}
          {activePlayer.hand.length === 0 && <p className="muted-line">No rune tiles in hand.</p>}
        </div>

        <div className="hoard-strip">
          <div>
            <p className="eyebrow">Captured Wyrms</p>
            <h4>Hoard</h4>
          </div>
          <div className="hoard-list">
            {activePlayer.hoard.map((wyrmId) => {
              const wyrm = state.wyrms[wyrmId];
              return (
                <button
                  key={wyrmId}
                  type="button"
                  className={pendingDeployWyrmId === wyrmId ? "ghost-button active" : "ghost-button"}
                  disabled={!canDeployFromHoard}
                  onClick={() => onPrepareDeploy(wyrmId)}
                >
                  {wyrm.label}
                  {wyrm.isElder ? " ★" : ""}
                </button>
              );
            })}
            {activePlayer.hoard.length === 0 && <span className="muted-line">Empty hoard</span>}
            {activePlayer.hoard.length > 0 && !canDeployFromHoard ? (
              <span className="muted-line">Deploy during the move step when your Den has an open cell.</span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="sidebar-panel players-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Table Read</p>
            <h3>All Players</h3>
          </div>
          {peekPlayerId && (
            <button type="button" className="ghost-button" onClick={onClosePeek}>
              Close Peek
            </button>
          )}
        </div>

        <div className="player-list">
          {state.players.map((player) => {
            const activeCount = getControlledActiveWyrms(state, player.id).length;
            const isTurn = player.id === activePlayer.id;
            const revealHand = peekPlayerId === player.id;

            return (
              <article
                key={player.id}
                className={[
                  "player-card",
                  `player-${player.color}`,
                  isTurn ? "active-turn" : "",
                  revealHand ? "revealed-hand" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="player-card-header">
                  <h4>{`Player ${player.id}`}</h4>
                  <span>{PLAYER_NAMES[player.id]}</span>
                </div>
                <dl>
                  <div>
                    <dt>Board</dt>
                    <dd>{activeCount}</dd>
                  </div>
                  <div>
                    <dt>Hand</dt>
                    <dd>{player.hand.length}</dd>
                  </div>
                  <div>
                    <dt>Hoard</dt>
                    <dd>{player.hoard.length}</dd>
                  </div>
                  <div>
                    <dt>Elder</dt>
                    <dd>{player.elderTokenAvailable ? "Ready" : "Used"}</dd>
                  </div>
                </dl>
                {player.floodPathTurnsRemaining > 0 && (
                  <p className="status-pill">Flood Path: {Math.max(player.floodPathTurnsRemaining - 1, 0)} turns after this one</p>
                )}
                {player.skipTurnsRemaining > 0 && (
                  <p className="status-pill warning">Skips queued: {player.skipTurnsRemaining}</p>
                )}
                {revealHand && (
                  <div className="revealed-hand-list">
                    {player.hand.map((tile, index) => (
                      <span key={`${tile}-${index}`} className="revealed-tile">
                        {TILE_LABELS[tile]}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="sidebar-panel log-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Turn Log</p>
            <h3>Recent Events</h3>
          </div>
        </div>
        <ul className="log-list">
          {state.log.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
