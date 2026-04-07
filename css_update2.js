import fs from 'fs';

let css = fs.readFileSync('src/index.css', 'utf8');

// Replace .match-board-grid
css = css.replace(/\.match-board-grid\s*\{[\s\S]*?box-shadow:[^\}]*\}/, `.match-board-grid {
  display: grid;
  grid-template-columns: repeat(12, var(--board-cell-size));
  grid-template-rows: repeat(12, var(--board-cell-size));
  border-radius: 1.25rem;
  overflow: hidden;
  background: rgba(17, 32, 20, 0.9);
  gap: 3px;
}`);

// Replace .match-board-cell
css = css.replace(/\.match-board-cell\s*\{[\s\S]*?border:[^\}]*\}/, `.match-board-cell {
  position: relative;
  width: var(--board-cell-size);
  height: var(--board-cell-size);
  padding: 0;
  background: var(--parchment-100);
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.1);
}`);

// Replace den colors
css = css.replace(/\.match-board-cell--den_p1\s*\{\s*background:\s*[^;]+;\s*\}/, `.match-board-cell--den_p1 {\n  background: rgba(138, 154, 134, 0.15);\n}`);
css = css.replace(/\.match-board-cell--den_p2\s*\{\s*background:\s*[^;]+;\s*\}/, `.match-board-cell--den_p2 {\n  background: rgba(196, 122, 93, 0.15);\n}`);
css = css.replace(/\.match-board-cell--den_p3\s*\{\s*background:\s*[^;]+;\s*\}/, `.match-board-cell--den_p3 {\n  background: rgba(212, 163, 92, 0.15);\n}`);
css = css.replace(/\.match-board-cell--den_p4\s*\{\s*background:\s*[^;]+;\s*\}/, `.match-board-cell--den_p4 {\n  background: rgba(45, 76, 59, 0.15);\n}`);

// Replace helper-card
css = css.replace(/\.helper-card\s*\{[\s\S]*?\}/, `.helper-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, var(--parchment-100), var(--parchment-200));
  color: var(--ink-900);
  box-shadow: 0 12px 36px rgba(17, 32, 20, 0.15);
}`);

// Replace hand-tray
css = css.replace(/\.hand-tray\s*\{[\s\S]*?\}/, `.hand-tray {
  display: grid;
  grid-template-columns: repeat(var(--tray-capacity), 1fr);
  gap: 0.95rem;
  height: 100%;
  padding: 1rem 1.15rem;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, var(--parchment-100), var(--parchment-200));
  box-shadow: 0 12px 36px rgba(17, 32, 20, 0.15);
}`);

// Replace rune-card
css = css.replace(/\.rune-card\s*\{[\s\S]*?box-shadow:[^\}]*\}/, `.rune-card {
  width: 138px;
  border-radius: 1.4rem;
  background: linear-gradient(135deg, var(--parchment-100), var(--parchment-200));
  color: var(--ink-900);
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(17, 32, 20, 0.15);
}`);

fs.writeFileSync('src/index.css', css);
console.log('Update Complete.');
