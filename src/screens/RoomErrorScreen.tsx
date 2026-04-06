import React from "react";

import { Wordmark } from "../components/Wordmark.tsx";
import type { RoomErrorScreenReason } from "../ui/roomRouteErrors.ts";

interface RoomErrorScreenProps {
  reason: RoomErrorScreenReason;
  onNavigate: (href: string, options?: { autoCreateRoom?: boolean }) => void;
}

const COPY: Record<
  RoomErrorScreenReason,
  {
    heading: string;
    body: string;
    button: string;
    autoCreateRoom: boolean;
  }
> = {
  not_found: {
    heading: "Room not found",
    body: "This room code does not exist. Check the code and try again.",
    button: "Back to lobby",
    autoCreateRoom: false,
  },
  expired: {
    heading: "This room has closed",
    body: "The room expired after 30 minutes of inactivity. Create a new room to play.",
    button: "Create a new room",
    autoCreateRoom: true,
  },
  full: {
    heading: "Room is full",
    body: "All seats are taken in this room. Ask for a new link or create your own room.",
    button: "Create a new room",
    autoCreateRoom: true,
  },
  match_not_found: {
    heading: "Match not found",
    body: "This match does not exist or has ended.",
    button: "Back to lobby",
    autoCreateRoom: false,
  },
};

export function RoomErrorScreen({ reason, onNavigate }: RoomErrorScreenProps): React.JSX.Element {
  const content = COPY[reason];

  return (
    <main className="room-error-screen">
      <section className="room-error-screen__card">
        <Wordmark href="/lobby" onNavigate={(href) => onNavigate(href)} className="room-error-screen__wordmark" />
        <p className="room-error-screen__eyebrow">Assembly Route</p>
        <h1>{content.heading}</h1>
        <p className="room-error-screen__body">{content.body}</p>
        <button
          type="button"
          className="button button--amber"
          onClick={() => onNavigate("/lobby", content.autoCreateRoom ? { autoCreateRoom: true } : undefined)}
        >
          {content.button}
        </button>
      </section>
    </main>
  );
}
