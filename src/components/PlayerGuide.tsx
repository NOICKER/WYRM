import React from "react";

interface GuideSection {
  title: string;
  intro: string;
  bullets?: string[];
}

interface PlayerGuideProps {
  open: boolean;
  onClose: () => void;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "1. What This Game Is",
    intro:
      "WYRM is a strategy board game about moving snake-like pieces across a 12×12 board. In the game, those snake pieces are called Wyrms. You are trying to either race two of your Wyrms into the center of the board or capture all three original Wyrms from one opponent.",
  },
  {
    title: "2. What The Game Words Mean",
    intro:
      "The rulebook uses a few special words. Once you know these, the rest of the game becomes much easier to follow.",
    bullets: [
      "Wyrm: one of your playing pieces. Think 'my snake piece.'",
      "Den: your home corner. Your Wyrms start there, and captured Wyrms you control can be deployed there later.",
      "Sacred Grove: the 2×2 square in the center of the board. This is one way to win.",
      "Trail: a temporary marker left behind when a Wyrm moves away from a square. Trails block movement.",
      "Hoard: your captured-piece area. If you capture an enemy Wyrm, it goes here under your control.",
      "Elder Wyrm: an upgraded Wyrm. It moves more freely and leaves shorter trails.",
      "Rune Tile: a power card you draw and may play on your turn.",
      "Lair Power: a stronger power you get by discarding 3 matching Rune Tiles.",
      "Power Rune spot: a special board square that gives you an extra tile on your next Draw step.",
      "Wall: a permanent blocked square created by Earth effects.",
    ],
  },
  {
    title: "3. What You Set Up Before The Game Starts",
    intro:
      "Before anyone takes a turn, the board and players are prepared in a very specific order.",
    bullets: [
      "Place the Sacred Grove in the exact center of the board.",
      "Place Power Rune tokens on the marked Power Rune spots.",
      "Shuffle the Rune Tile deck.",
      "Each player chooses a color and takes 3 regular Wyrms, 1 Elder token, trail markers, and a Hoard tray.",
      "Each player places all 3 regular Wyrms in their own corner Den.",
      "Each player draws 4 Rune Tiles.",
      "Pick the first player. Then turns go clockwise.",
    ],
  },
  {
    title: "4. What Happens On Every Turn",
    intro:
      "Every turn always happens in the same order. This is the spine of the whole game: Draw, Roll, Move, then Play a Tile.",
    bullets: [
      "Draw: take 1 Rune Tile. If you earned a Power Rune bonus earlier, draw 2 instead. If you go above 5 tiles, discard back down to 5 immediately.",
      "Roll: roll the Rune Die to find out how much movement you must use this turn. Elders still roll, but they may ignore the distance result when they move.",
      "Move: choose one of your Wyrms and move it, or deploy one Wyrm from your Hoard into your Den instead of moving.",
      "Play a Tile: you may use one Rune Tile, or discard 3 matching tiles to use one Lair Power. This step is optional.",
    ],
  },
  {
    title: "5. How Moving Actually Works",
    intro:
      "Movement is the part most new players need explained carefully. The important idea is this: you are choosing a path, not just a destination.",
    bullets: [
      "Regular Wyrms move orthogonally only: up, down, left, or right.",
      "Regular Wyrms must use the full rolled distance unless the die showed Coil.",
      "You cannot reverse into the square you were just in on your previous turn.",
      "You cannot move through your own Wyrms.",
      "You cannot move through walls.",
      "You cannot move through or end on trail squares unless a power specifically lets you do that.",
      "If you land exactly on an enemy Wyrm as your final space, you capture it.",
      "Elder Wyrms are different: they can move diagonally, and instead of obeying the die distance they may move 1, 2, or 3 spaces freely.",
    ],
  },
  {
    title: "6. Why Trails Matter So Much",
    intro:
      "Trails are the central idea of WYRM. Every time a Wyrm moves, each square it leaves behind becomes trail. That trail blocks everybody, including the player who made it.",
    bullets: [
      "A trail is placed on every square the Wyrm left during that move.",
      "The final destination square does not get a trail because your Wyrm is still there.",
      "Your own Den does not keep your own trail markers, so leaving your Den is safer than moving elsewhere.",
      "Regular Wyrm trails last 3 full rounds.",
      "Elder Wyrm trails last only 1 round.",
      "Serpent effects can make one Wyrm's trail last 5 rounds.",
      "Trails are why WYRM feels strategic: every move creates both progress and future danger.",
    ],
  },
  {
    title: "7. What Happens When You Capture",
    intro:
      "Capturing is simple to trigger but important to understand because captured Wyrms do not leave the game forever.",
    bullets: [
      "If your final movement space contains an enemy Wyrm, that enemy is captured.",
      "The captured Wyrm goes into your Hoard.",
      "Your Wyrm takes that square.",
      "A captured Elder loses its Elder status when captured.",
      "Later, on a future Move step, you may deploy a Wyrm from your Hoard into your own Den instead of moving normally.",
      "A deployed Hoard Wyrm is now under your control.",
      "This matters because a captured enemy piece can become part of your own army later.",
    ],
  },
  {
    title: "8. How A Wyrm Becomes An Elder",
    intro:
      "A regular Wyrm becomes an Elder when it ends movement inside an enemy Den.",
    bullets: [
      "Only regular Wyrms can promote.",
      "Any of the 4 squares in an enemy Den counts for promotion.",
      "The regular Wyrm is replaced by your Elder token.",
      "An Elder can move more flexibly and leaves much shorter trails.",
      "Each player normally has only one Elder token available at a time.",
    ],
  },
  {
    title: "9. What The Rune Die Faces Mean",
    intro:
      "The die does not just say 'move something.' Each face has a very specific meaning.",
    bullets: [
      "1, 2, 3, 4: move exactly that many spaces.",
      "Surge: move exactly 5 spaces.",
      "Coil: choose to move 1, 2, or 3 spaces, or choose not to move and place an extra trail marker on an empty adjacent square.",
      "If a Wyrm is completely trapped and has no legal move, it may become Coiled by force and place a trail on an empty adjacent square if possible.",
    ],
  },
  {
    title: "10. What Rune Tiles Do",
    intro:
      "Rune Tiles are one-turn powers. You draw them over time and decide whether to spend them now or save them.",
    bullets: [
      "Flame: remove all of your own trails. Use this when your own path is trapping you.",
      "Flow: let one chosen Wyrm pass through one trail this turn. It still cannot end on that trail unless Flood Path is active.",
      "Stone: place one permanent wall on an empty square.",
      "Gust: give one chosen Wyrm +2 movement this turn.",
      "Eclipse: swap the positions of two of your Wyrms that are already on the board.",
      "Radiance: look at one opponent's hand.",
      "Erasure: remove up to 3 trail markers belonging to one opponent.",
      "Coil: extend one chosen Wyrm's trail to 5 rounds and refresh that longer duration for its existing trail.",
    ],
  },
  {
    title: "11. What Lair Powers Do",
    intro:
      "If you hold 3 identical Rune Tiles at once, you may discard all 3 instead of playing one normal tile. This creates a much stronger effect.",
    bullets: [
      "Phoenix Molt: remove every trail from the board.",
      "Flood Path: for your next 3 turns, your Wyrms ignore trails.",
      "Fortress: place 3 walls.",
      "Tempest Rush: your Wyrms each get a bonus move up to 3 spaces this turn.",
      "Void Walk: teleport one of your controlled Wyrms, even one from your Hoard, onto any empty square.",
      "Blinding Flash: make one opponent skip their next 2 turns.",
      "Annihilation: remove all trails of one chosen color.",
      "Ancient Wyrm: instantly promote one of your Wyrms to Elder.",
    ],
  },
  {
    title: "12. How You Win And When The Game Checks For It",
    intro:
      "The game checks for victory immediately when the important event happens. You do not wait until the end of the round.",
    bullets: [
      "Sacred Grove Victory: the moment you have 2 of your Wyrms in the Sacred Grove at the same time, you win.",
      "Domination Victory: the moment your Hoard contains all 3 original Wyrms from one opponent, you win.",
      "The reason the game checks immediately is so a winning move matters right away, even in the middle of a turn.",
    ],
  },
  {
    title: "13. How To Read A Full Game From Start To Finish",
    intro:
      "A full game usually unfolds in this order. First players spread out from their Dens. Then the board fills with trails. Then someone captures or promotes. Then tiles and Lair Powers start changing the shape of the board. Finally, one player either creates a clean lane into the Sacred Grove or turns captures into a Domination win.",
  },
];

export function PlayerGuide({ open, onClose }: PlayerGuideProps): React.JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-label="New player guide">
      <div className="guide-card">
        <div className="guide-header">
          <div>
            <p className="eyebrow">Zero-Jargon Guide</p>
            <h2>Learn WYRM In The Order It Actually Happens</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="guide-grid guide-grid-long">
          {GUIDE_SECTIONS.map((section) => (
            <article key={section.title} className="guide-step">
              <h3>{section.title}</h3>
              <p>{section.intro}</p>
              {section.bullets && (
                <ul className="guide-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        <div className="guide-footer">
          <p>
            Best first-game habit: after every move, ask yourself two questions. “What square did I
            just block with trail?” and “Did this move bring me closer to the center or closer to a
            capture?”
          </p>
        </div>
      </div>
    </div>
  );
}
