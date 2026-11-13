// Renders only the hook text of intro.html as a transparent 720x1280 PNG. Usage: node tools/hook_png.js out.png
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  await p.goto('file://' + path.resolve(__dirname, '..', 'intro.html'));
  await p.waitForFunction('document.fonts.status==="loaded"');
  await p.addStyleTag({ content: 'html,body,#stage{background:transparent!important} canvas{display:none}' });
  await p.screenshot({ path: process.argv[2], omitBackground: true, clip: { x: 0, y: 0, width: 720, height: 1280 } });
  await b.close();
})();
