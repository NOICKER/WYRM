import React from "react";
import type { PlayerColor } from "../state/types.ts";
import { PLAYER_PALETTE } from "../ui/appModel.ts";

interface PassTheScreenOverlayProps {
  playerName: string;
  playerColor: PlayerColor;
  onReady: () => void;
}

export function PassTheScreenOverlay({
  playerName,
  playerColor,
  onReady,
}: PassTheScreenOverlayProps): React.JSX.Element {
  const colorHex = PLAYER_PALETTE[playerColor].base;

  return (
    <div className="pass-screen-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 9999,
      backgroundColor: "var(--color-ink-base, #1c1917)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      textAlign: "center",
      backdropFilter: "blur(12px)"
    }}>
      <h2 style={{ fontSize: "2.5rem", color: "var(--color-parchment-base, #f4ecd8)", marginBottom: "1rem", fontFamily: "var(--font-heading)", lineHeight: 1.2 }}>
        Pass the device to <br/>
        <span style={{ color: colorHex }}>{playerName}</span>
      </h2>
      <p style={{ color: "var(--color-parchment-dim, #d0c8b6)", marginBottom: "3rem", fontSize: "1.125rem" }}>
        Do not look at their hand or strategies when passing.
      </p>
      <button 
        type="button" 
        className="button" 
        style={{ 
          padding: "1rem 2.5rem", 
          fontSize: "1.25rem",
          backgroundColor: colorHex,
          color: "#fff",
          borderColor: colorHex
        }}
        onClick={onReady}
      >
        I am ready to play
      </button>
    </div>
  );
}
