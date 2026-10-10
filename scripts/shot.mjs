// Quick look: renders a few timestamps to PNGs (used while tuning).
import { chromium } from 'playwright';
import { createServer } from 'http-server';
import { mkdirSync } from 'node:fs';
const [out = 'shots', ...times] = process.argv.slice(2);
const w = Number(process.env.W || 480), h = Number(process.env.H || 720);
const q = process.env.Q || 'high';
mkdirSync(out, { recursive: true });
const server = createServer({ root: process.cwd(), cache: -1, logFn: () => {} });
await new Promise((r) => server.listen(8123, r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.setDefaultTimeout(600000);
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:8123/robot.html?capture&w=${w}&h=${h}&quality=${q}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 600000 });
for (const t of (times.length ? times : ['0']).map(Number)) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__renderFrame(t), t);
  await page.locator('canvas').screenshot({ path: `${out}/t${t.toFixed(2)}.png` });
  console.log(`t=${t} ${Date.now() - t0}ms`);
}
await browser.close();
server.close();
