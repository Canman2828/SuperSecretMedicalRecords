// Runs after `vite build`. Vite copies everything in public/ into dist/, including the ~260 MB of source
// PNGs for the intro animation and hero renders. The site only loads the .webp copies made by
// scripts/optimize-*.py, so drop any PNG that has a .webp twin. (The PNGs stay in public/ for local use.)
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../dist/', import.meta.url));
const staticDir = join(output, 'static');
const versions = readdirSync(staticDir);
if (versions.length !== 1) throw new Error('Expected one versioned static asset directory');
const dist = join(staticDir, versions[0]);
let removed = 0;
let bytes = 0;

// Intro frames: 0001.png → 0001.webp
const intro = join(dist, 'prescriptive-intro');
if (existsSync(intro)) {
  for (const f of readdirSync(intro)) {
    if (!f.endsWith('.png') || !existsSync(join(intro, f.replace(/\.png$/, '.webp')))) continue;
    bytes += statSync(join(intro, f)).size;
    unlinkSync(join(intro, f));
    removed++;
  }
}

// Hero renders: the page loads clipboard.webp / stethoscope.webp, never the source PNGs.
const hero = join(dist, 'hero-renders');
if (existsSync(hero) && existsSync(join(hero, 'clipboard.webp')) && existsSync(join(hero, 'stethoscope.webp'))) {
  for (const f of readdirSync(hero).filter((f) => f.endsWith('.png'))) {
    bytes += statSync(join(hero, f)).size;
    unlinkSync(join(hero, f));
    removed++;
  }
}

console.log(`prune-dist: removed ${removed} unused PNGs (${(bytes / 1e6).toFixed(0)} MB) from dist/`);
