import fs from 'fs';
const lines = fs.readFileSync('src/index.css', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^(\.match-board-grid|\.match-board-cell|\.helper-card|\.hand-tray|\.rune-card)[\s\{]/)) {
    console.log(`${i+1}: ${line}`);
  }
}
