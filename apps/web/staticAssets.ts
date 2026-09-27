import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

// Only production URLs change; public/ remains convenient to edit and use in development.
export function staticAssets(): Plugin {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const folders = ['hero-renders', 'prescriptive-intro'];
  const icons = ['favicon.svg', 'apple-touch-icon.png'];
  const files = [...icons, ...folders.flatMap(folder =>
    readdirSync(resolve(root, 'public', folder)).filter(file => file.endsWith('.webp'))
      .map(file => `${folder}/${file}`),
  )].sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(resolve(root, 'public', file)));
  }
  const assetRoot = `/static/${hash.digest('hex').slice(0, 16)}`;
  let building = false;
  let outDir = '';
  return {
    name: 'version-static-assets',
    configResolved(config) {
      building = config.command === 'build';
      outDir = resolve(config.root, config.build.outDir);
    },
    config(_, { command }) {
      return { define: { 'import.meta.env.VITE_STATIC_ASSET_ROOT': JSON.stringify(command === 'build' ? assetRoot : '') } };
    },
    transformIndexHtml(html) {
      if (!building) return html;
      for (const icon of icons) html = html.replace(`href="/${icon}"`, `href="${assetRoot}/${icon}"`);
      return html;
    },
    closeBundle() {
      if (!building) return;
      const destination = resolve(outDir, assetRoot.slice(1));
      mkdirSync(destination, { recursive: true });
      for (const file of [...folders, ...icons]) {
        renameSync(resolve(outDir, file), resolve(destination, file));
      }
    },
  };
}
