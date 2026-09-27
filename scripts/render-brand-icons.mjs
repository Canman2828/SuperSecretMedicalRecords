// Render the existing vector logo; no redraw or external image service is used.
// Run with: MEDIFY_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/render-brand-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = await readFile(path.join(root, 'apps/web/index.html'), 'utf8');
const match = html.match(/<symbol id="logo" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/);
if (!match) throw new Error('The website logo symbol was not found');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#e9e9ec"/><svg x="100" y="137" width="824" height="750" viewBox="${match[1]}" color="#736a86">${match[2]}</svg></svg>`;
await writeFile(path.join(root, 'apps/web/public/favicon.svg'), svg);
const { chromium } = await import(process.env.MEDIFY_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.MEDIFY_BROWSER_PATH || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true });
try {
  for (const [size, target] of [[1024, 'apps/mobile/assets/app-icon.png'], [180, 'apps/web/public/apple-touch-icon.png']]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.screenshot({ path: path.join(root, target) });
    await page.close();
  }
} finally {
  await browser.close();
}
