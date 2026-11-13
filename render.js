// Usage: node render.js <outDir> [start] [end] [step]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'frames';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => console.log('console:', m.text()));
  await page.goto('file://' + path.resolve(__dirname, process.env.PAGE || 'scene.html'));
  await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
  const total = await page.evaluate('window.NFRAMES');
  const start = +(process.argv[3] || 0), end = +(process.argv[4] || total), step = +(process.argv[5] || 1);
  const stage = await page.$('#stage');
  for (let f = start; f < end; f += step) {
    const t0 = Date.now();
    await page.evaluate(fr => window.renderFrame(fr), f);
    await page.screenshot({ path: path.join(out, `f${String(f).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: 720, height: 1280 }, timeout: 300000 });
    if (f % 30 === 0 || step > 1) console.log(`frame ${f} ${Date.now() - t0}ms`);
  }
  await browser.close();
})();
