/**
 * @file share-card.mjs
 * @description Renders `public/opengraph-image.png` (1200×630) from the running site's front page.
 *
 * Tier 1 (what): Opens `/` in a headless Chromium browser at 1200×630, hides everything but the
 * header wordmark, the decor band and the hero (eyebrow, headline, lead, example mission file), and
 * saves a PNG screenshot.
 * Tier 2 (why): The share card follows the visual refresh (owner decision 2026-11-19: the front page
 * hero in the default winter theme). Capturing the real page keeps fonts, colours and art identical
 * to the site; `next/og` cannot read the woff2 fonts `next/font` serves.
 * Tier 3 (how): Run on demand with the app up (`docker compose up -d`, port 2425), then commit the
 * PNG: `node scripts/share-card.mjs [baseUrl]`. Uses the Chrome DevTools Protocol over Node's
 * built-in WebSocket; set `KK_BROWSER` to a Chrome, Chromium or Edge binary (defaults per OS). The
 * season is forced to winter and the mode to light, whatever the server is set to.
 */
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:2425';
const OUT = join(process.cwd(), 'public', 'opengraph-image.png');
const WIDTH = 1200;
const HEIGHT = 630;

const CANDIDATES = [
  process.env.KK_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error('No Chromium browser found; set KK_BROWSER.');

/** Leaves the wordmark, decor band and hero text + mission file; nothing else. */
const CARD_CSS = `
  .kk-header nav, .kk-header > div:last-child, [role="status"], #main > main > section:not(:first-child),
  footer, .kk-feedback, [data-feedback-button], #home-h ~ div, #home-h ~ p:last-child { display: none !important; }
  #main > main { padding: 24px 64px 0 !important; max-width: ${WIDTH}px !important; }
  #main > main > section:first-child { flex-wrap: nowrap !important; gap: 40px !important; }
  html, body { overflow: hidden !important; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9400 + randomInt(400);
const profile = mkdtempSync(join(tmpdir(), 'kk-share-'));
const proc = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, 'about:blank']);

try {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      await sleep(200);
    }
  }
  if (!ws) throw new Error('Browser did not start.');
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const run = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(4000);
  await run(`localStorage.setItem('kovertklaus_theme_mode', 'light')`);
  await send('Page.reload');
  await sleep(4000);
  await run(`(() => {
    document.documentElement.dataset.season = 'winter';
    document.documentElement.classList.remove('dark');
    const s = document.createElement('style');
    s.textContent = ${JSON.stringify(CARD_CSS)};
    document.head.appendChild(s);
    window.scrollTo(0, 0);
    return document.fonts.ready.then(() => true);
  })()`);
  await sleep(800);
  const overflow = await run(`document.documentElement.scrollHeight`);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
  writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  console.log(`wrote ${OUT} (page height ${overflow}px; content below ${HEIGHT}px is cut)`);
  ws.close();
} finally {
  proc.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
