// Render a still of every style x template into one contact sheet PNG (for review and docs).
// Usage: node tools/contact_sheet.mjs out.png [t=2.4] [w=540] [h=480] [styles=comma,list]
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [out = 'sheet.png', T = '2.4', w = '540', h = '480', only = ''] = process.argv.slice(2);
const W = +w, H = +h;
const CUES = [
  { template: 'stat', value: '73%', title: 'of viewers watch without sound', icon: 'volume-x' },
  { template: 'compare', title: 'Which pays more?', left: { label: 'Salary', icon: 'briefcase' }, right: { label: 'Business', icon: 'rocket' }, winner: 'right' },
  { template: 'steps', title: 'The method', items: [{ label: 'Hook', icon: 'magnet' }, { label: 'Story', icon: 'book-open' }, { label: 'Offer', icon: 'gift' }] },
  { template: 'concept', title: 'Compound interest', subtitle: 'money that makes money', icon: 'piggy-bank' },
  { template: 'trend', direction: 'up', value: '10x', title: 'growth in 12 months' },
  { template: 'keyword', title: 'Consistency', icon: 'flame' },
];
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
page.on('console', m => m.type() === 'error' && console.error('console:', m.text()));
await page.goto('file://' + path.join(HERE, '..', 'broll.html'));
await page.waitForFunction('window.READY === true');
let styles = (await page.evaluate('window.styles()')).map(s => s.id);
if (only) styles = only.split(',');
const cells = [];
for (const st of styles) for (let i = 0; i < CUES.length; i++) {
  const url = await page.evaluate(([st, cue, W, H, t, i]) => { window.setup({ style: st, W, H, layout: 'split', cue: { ...cue, start: 0, end: 3.4 }, seed: i + 1 }); window.draw(t); return window.grab('image/png'); }, [st, CUES[i], W, H, +T, i]);
  cells.push(url);
}
// compose in the page
const sheet = await page.evaluate(async ([cells, cols, W, H, names]) => {
  const c = document.createElement('canvas'), s = 0.5, lab = 26; c.width = cols * W * s; c.height = Math.ceil(cells.length / cols) * (H * s + lab);
  const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cells.length; i++) {
    const im = new Image(); im.src = cells[i]; await im.decode();
    const x = (i % cols) * W * s, y = Math.floor(i / cols) * (H * s + lab);
    g.drawImage(im, x, y + lab, W * s, H * s);
    if (i % cols === 0) { g.fillStyle = '#fff'; g.font = 'bold 18px sans-serif'; g.fillText(names[i / cols], x + 6, y + 19); }
  }
  return c.toDataURL('image/png');
}, [cells, CUES.length, W, H, styles]);
(await import('fs')).writeFileSync(out, Buffer.from(sheet.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out, styles.length, 'styles');
