// Render B-roll cues to video files with alpha, frame by frame in headless Chromium.
// Usage: node render_cues.mjs job.json
// job = { style, layout: "split"|"full"|"pip", width, height, fps, outDir, concurrency, cues: [{ id, start, end, template, ... }] }
// Writes <outDir>/<id>.mov (QuickTime Animation, RGBA) per cue and prints a JSON manifest on stdout.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright'); // CJS resolution honours NODE_PATH / global installs
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fps = job.fps || 30;
const W = job.width, H = job.height;
fs.mkdirSync(job.outDir, { recursive: true });

function encoder(out) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'qtrle', '-pix_fmt', 'argb', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { ff, done };
}

async function renderCue(page, cue, i) {
  const id = cue.id || `cue${String(i).padStart(2, '0')}`;
  const out = path.join(job.outDir, id + '.mov');
  const dur = Math.max(0.5, cue.end - cue.start);
  const n = Math.round(dur * fps);
  await page.evaluate(o => window.setup(o), { style: job.style, W, H, layout: job.layout, cue, seed: i + 1 });
  const { ff, done } = encoder(out);
  for (let f = 0; f < n; f++) {
    const url = await page.evaluate(t => { window.draw(t); return window.grab('image/png'); }, f / fps);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  return { id, path: out, start: cue.start, end: cue.start + n / fps, frames: n };
}

const t0 = Date.now();
const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
const conc = Math.max(1, Math.min(job.concurrency || 3, job.cues.length));
const pages = await Promise.all(Array.from({ length: conc }, async () => {
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.goto('file://' + path.join(HERE, 'broll.html'));
  await p.waitForFunction('window.READY === true', null, { timeout: 60000 });
  return p;
}));
const results = [];
let next = 0;
await Promise.all(pages.map(async page => {
  while (next < job.cues.length) { const i = next++; results[i] = await renderCue(page, job.cues[i], i); }
}));
await browser.close();
process.stdout.write(JSON.stringify({ seconds: (Date.now() - t0) / 1000, clips: results }) + '\n');
