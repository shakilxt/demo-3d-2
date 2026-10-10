// Deterministic offline render: drives robot.html in headless Chromium,
// captures every frame of one loop, then encodes MP4 (H.264) + WebM (VP9)
// and a poster frame with ffmpeg.
//
//   node scripts/render.mjs [--w 1440] [--h 2160] [--fps 30] [--workers 2]
//                           [--quality high|low] [--out media] [--name robot-loop]
import { chromium } from 'playwright';
import { createServer } from 'http-server';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const W = Number(arg('w', 1440));
const H = Number(arg('h', 2160));
const FPS = Number(arg('fps', 30));
const WORKERS = Number(arg('workers', 2));
const QUALITY = arg('quality', 'high');
const OUT = resolve(arg('out', 'media'));
const NAME = arg('name', 'robot-loop');
const FRAMES = resolve(arg('frames', join(OUT, `.frames-${W}x${H}`)));
const PORT = 8124;

mkdirSync(OUT, { recursive: true });
mkdirSync(FRAMES, { recursive: true });

const server = createServer({ root: process.cwd(), cache: -1, logFn: () => {} });
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(0);
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/robot.html?capture&w=${W}&h=${H}&quality=${QUALITY}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 0 });
  return page;
}

const first = await openPage();
const duration = await first.evaluate(() => window.__duration);
const total = Math.round(duration * FPS);
console.log(`${total} frames @ ${FPS}fps, ${W}x${H}, ${WORKERS} worker(s)`);

let next = 0;
let done = 0;
const t0 = Date.now();
async function work(page) {
  while (next < total) {
    const i = next++;
    // frame i shows t = i / FPS; t = duration wraps to frame 0, so the loop
    // point is seamless without a duplicated frame.
    const b64 = await page.evaluate((t) => {
      window.__renderFrame(t);
      return document.querySelector('canvas').toDataURL('image/png').split(',')[1];
    }, i / FPS);
    writeFileSync(join(FRAMES, `f${String(i).padStart(4, '0')}.png`), Buffer.from(b64, 'base64'));
    done++;
    if (done % 10 === 0 || done === total) {
      const s = (Date.now() - t0) / 1000;
      console.log(`${done}/${total}  ${(s / done).toFixed(1)}s/frame  eta ${Math.round((s / done) * (total - done))}s`);
    }
  }
}
const pages = [first];
for (let i = 1; i < WORKERS; i++) pages.push(await openPage());
await Promise.all(pages.map(work));
await browser.close();
server.close();

const input = ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%04d.png')];
const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
run([...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
  '-profile:v', 'high', '-movflags', '+faststart', '-an', join(OUT, `${NAME}.mp4`)]);
run([...input, '-c:v', 'libvpx-vp9', '-crf', '26', '-b:v', '0', '-row-mt', '1',
  '-pix_fmt', 'yuv420p', '-an', join(OUT, `${NAME}.webm`)]);
run(['-y', '-i', join(FRAMES, 'f0000.png'), '-q:v', '2', join(OUT, `${NAME}-poster.jpg`)]);
if (!process.argv.includes('--keep-frames')) rmSync(FRAMES, { recursive: true, force: true });
console.log(`wrote ${NAME}.mp4 / .webm / -poster.jpg to ${OUT}`);
