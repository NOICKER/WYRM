import fs from 'fs';
let css = fs.readFileSync('src/index.css', 'utf8');

if (!css.includes('@import url')) {
  css = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Outfit:wght@400;500;700&display=swap');\n` + css;
}

css = css.replace(/Georgia,\s*["']?Times New Roman["']?,\s*serif/g, "'Cormorant Garamond', serif");
css = css.replace(/["']?Segoe UI Variable["']?,\s*["']?Segoe UI["']?,\s*["']?Trebuchet MS["']?,\s*sans-serif/g, "'Outfit', sans-serif");
css = css.replace(/["']?Segoe UI Variable["']?,\s*["']?Segoe UI["']?,\s*sans-serif/g, "'Outfit', sans-serif");

// replace root colors
css = css.replace(/--ink-900:\s*#1b1812;/g, '--ink-900: #162118;');
css = css.replace(/--danger:\s*#ad5c59;/g, '--danger: #B85D4B;'); // Burnt Sienna/Rust
css = css.replace(/--success:\s*#3f8b5a;/g, '--success: #5C8A4A;'); // Moss Green
css = css.replace(/--purple:\s*#[0-9a-fA-F]+;/g, '--purple: #8A9A86;'); // Sage
css = css.replace(/--coral:\s*#[0-9a-fA-F]+;/g, '--coral: #C47A5D;'); // Terracotta
css = css.replace(/--teal:\s*#[0-9a-fA-F]+;/g, '--teal: #D4A35C;'); // Ochre
css = css.replace(/--amber-player:\s*#[0-9a-fA-F]+;/g, '--amber-player: #2D4C3B;'); // Pine
css = css.replace(/--danger-soft:\s*rgba\([^)]+\);/g, '--danger-soft: rgba(184, 93, 75, 0.14);');
css = css.replace(/--success-soft:\s*rgba\([^)]+\);/g, '--success-soft: rgba(92, 138, 74, 0.14);');

fs.writeFileSync('src/index.css', css);
console.log('Done replacing global fonts and vars.');
