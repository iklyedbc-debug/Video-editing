// The animation styles. Each one only changes HOW things are drawn; the templates decide WHAT.
(function () {
  const { E, clamp, seg, lerp, hash, strokeIcon, iconPaths, setFont, scratch, shade, roundRect, makeStyle, col, hexToRgb } = BR;

  // cached textures (built once per size)
  const TEX = {};
  function tex(key, w, h, build) {
    const k = key + w + 'x' + h;
    if (!TEX[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; build(c.getContext('2d'), w, h); TEX[k] = c; }
    return TEX[k];
  }
  function grain(ctx, w, h, amt, seed = 1, color = [255, 255, 255]) {
    const id = ctx.createImageData(w, h), d = id.data;
    for (let i = 0; i < w * h; i++) {
      const n = hash(i, seed) * amt;
      d[i * 4] = color[0]; d[i * 4 + 1] = color[1]; d[i * 4 + 2] = color[2]; d[i * 4 + 3] = n * 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const typed = (line, p) => line.slice(0, Math.ceil(line.length * clamp(p)));

  // ================================================================== 1. 9-BIT QUEST
  const QUEST_PAL = ['#0b0b23', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
    '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
  const QUEST_RGB = QUEST_PAL.map(hexToRgb);
  makeStyle({
    id: '9-bit-quest', name: '9-Bit Quest', pixel: 180, caps: true, lineHeight: 1.5,
    pal: { bg: '#1d2b53', ink: '#fff1e8', accent: '#ffec27', accent2: '#ff004d', muted: '#83769c', panel: '#0b0b23' },
    fonts: { title: '"Press Start 2P", "Cairo"', body: '"Press Start 2P", "Cairo"', number: '"Press Start 2P", "Cairo"' },
    weights: { title: '', body: '', number: '' },
    bg(ctx, S) {
      const { W, H } = S;
      // dithered sky bands
      const bands = ['#0b0b23', '#1d2b53', '#1d2b53', '#7e2553'];
      const bh = Math.ceil(H / bands.length);
      bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh + 1); });
      ctx.fillStyle = '#0b0b23';
      for (let i = 1; i < bands.length; i++) for (let x = 0; x < W; x += 2) ctx.fillRect(x + (i % 2), i * bh, 1, 1);
      // twinkling stars
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(hash(i, 3) * W), y = Math.floor(hash(i, 4) * H * 0.75);
        if (hash(i, S.frame >> 3) > 0.25) { ctx.fillStyle = hash(i, 9) > 0.8 ? '#ffec27' : '#c2c3c7'; ctx.fillRect(x, y, 1, 1); }
      }
      // RPG window border
      const m = Math.round(S.u * 3);
      ctx.strokeStyle = '#fff1e8'; ctx.lineWidth = 2; ctx.strokeRect(m + .5, m + .5, W - 2 * m - 1, H - 2 * m - 1);
      ctx.strokeStyle = '#29adff'; ctx.lineWidth = 1; ctx.strokeRect(m + 3.5, m + 3.5, W - 2 * m - 7, H - 2 * m - 7);
      // ground strip
      ctx.fillStyle = '#008751'; ctx.fillRect(m + 4, H - m - 10, W - 2 * m - 8, 6);
      ctx.fillStyle = '#ab5236'; for (let x = m + 4; x < W - m - 4; x += 4) ctx.fillRect(x + ((S.frame >> 2) % 4), H - m - 5, 2, 1);
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const s = typed(line, p * 1.15);
      ctx.fillStyle = '#0b0b23'; ctx.fillText(s, x + 1, y + 1);
      ctx.fillStyle = color; ctx.fillText(s, x, y);
    },
    text(ctx, S, str, x, y, size, p, o = {}) { // snap to the pixel grid
      return BR.Base.text.call(this, ctx, S, str, Math.round(x), Math.round(y), Math.max(6, Math.round(size / 4) * 4 || 8), p, o);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const hop = p < 1 ? -Math.abs(Math.sin(p * Math.PI * 2)) * s * 0.12 : (Math.floor(S.t * 4) % 2) * -1;
      ctx.strokeStyle = '#0b0b23'; strokeIcon(ctx, name, x + 1, y + 1 + hop, s, p, 3.4);
      ctx.strokeStyle = col(S, o.color || 'accent'); strokeIcon(ctx, name, x, y + hop, s, p, 2.4);
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2 + S.t * 0.6, rr = r * (0.55 + 0.45 * hash(i, 2)) * p;
        const sx = Math.round(x + Math.cos(a) * rr), sy = Math.round(y + Math.sin(a) * rr * 0.8);
        ctx.fillStyle = (i + (S.frame >> 2)) % 3 ? '#ffec27' : '#fff1e8';
        ctx.fillRect(sx, sy, 1, 1); ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
      }
    },
    bar(ctx, S, x, y, w, h, p, o) {
      const hh = Math.round(h * p), c = col(S, o.color);
      ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y - hh), Math.round(w), hh);
      ctx.fillStyle = '#fff1e8'; ctx.fillRect(Math.round(x), Math.round(y - hh), Math.round(w), 1);
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      const R = Math.round(r);
      ctx.fillStyle = '#ff004d'; ctx.fillRect(Math.round(x - R), Math.round(y - R), 2 * R, 2 * R);
      ctx.fillStyle = '#fff1e8'; setFont(ctx, 8, this.fonts.number); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, Math.round(x), Math.round(y) + 1);
    },
    wrap(ctx, S, v, phase, draw) { // ordered-dither dissolve
      draw();
      if (v >= 1) return;
      const id = ctx.getImageData(0, 0, S.W, S.H), d = id.data, k = phase === 'in' ? E.outCubic(v) : v;
      for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (BAYER[(y & 3) * 4 + (x & 3)] > k) d[(y * S.W + x) * 4 + 3] = 0;
      ctx.putImageData(id, 0, 0);
    },
    quantize(ctx, S) {
      const id = ctx.getImageData(0, 0, S.W, S.H), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
        let best = 0, bd = 1e9;
        for (let j = 0; j < 16; j++) { const c = QUEST_RGB[j], dd = (c[0] - d[i]) ** 2 + (c[1] - d[i + 1]) ** 2 + (c[2] - d[i + 2]) ** 2; if (dd < bd) { bd = dd; best = j; } }
        const c = QUEST_RGB[best]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
    },
  });

  // ================================================================== 2. CHALK DOODLE
  function chalkPattern(ctx, color) {
    const key = 'chalk' + color;
    const c = tex(key, 128, 128, (g, w, h) => {
      const [r, gg, b] = hexToRgb(color);
      const id = g.createImageData(w, h), d = id.data;
      for (let i = 0; i < w * h; i++) {
        const n = hash(i, 11), streak = hash(Math.floor(i / 3), 5);
        d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = n > 0.18 ? (150 + 105 * streak) : 20;
      }
      g.putImageData(id, 0, 0);
    });
    return ctx.createPattern(c, 'repeat');
  }
  makeStyle({
    id: 'chalk-doodle', name: 'Chalk Doodle', caps: false, stepFps: 15,
    pal: { bg: '#24382d', ink: '#f4f1e8', accent: '#f9e27d', accent2: '#f6a5c0', muted: '#a8c4b4' },
    fonts: { title: '"Cabin Sketch", "Cairo"', body: '"Cabin Sketch", "Cairo"', number: '"Cabin Sketch", "Cairo"' },
    weights: { title: '700', body: '700', number: '700' },
    bg(ctx, S) {
      const { W, H } = S;
      const g = ctx.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .5, Math.max(W, H) * .75);
      g.addColorStop(0, '#2c4437'); g.addColorStop(1, '#17261e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(tex('slate', 256, 256, (c, w, h) => grain(c, w, h, 0.07, 2)), 0, 0, W, H);
      // ghost of an old wiped lesson
      ctx.save(); ctx.globalAlpha = 0.05; ctx.strokeStyle = '#fff'; ctx.lineWidth = S.u * 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W * .1, H * .2); ctx.quadraticCurveTo(W * .5, H * .1, W * .9, H * .25); ctx.stroke(); ctx.restore();
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = chalkPattern(ctx, col(S, o.color || 'accent'));
      for (let k = 0; k < 2; k++) {
        const jx = (hash(S.frame, k, 1) - .5) * s * .012, jy = (hash(S.frame, k, 2) - .5) * s * .012;
        strokeIcon(ctx, name, x + jx + k * s * .006, y + jy, s, p, 1.9);
      }
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      ctx.fillStyle = chalkPattern(ctx, color);
      const w = ctx.measureText(line).width;
      ctx.save(); ctx.beginPath();
      const dir = ctx.direction === 'rtl' ? -1 : 1;
      const reveal = w * E.inOutCubic(p) + size;
      if (dir > 0) ctx.rect(x - w / 2 - size, y - size, reveal, size * 2); else ctx.rect(x + w / 2 + size - reveal, y - size, reveal, size * 2);
      ctx.clip();
      ctx.fillText(line, x, y);
      ctx.restore();
      if (role === 'title' && p > 0.6) { // doodled underline
        ctx.strokeStyle = chalkPattern(ctx, S.pal.accent); ctx.lineWidth = size * 0.07; ctx.lineCap = 'round';
        const k = seg(p, .6, 1);
        ctx.beginPath();
        for (let i = 0; i <= 20 * k; i++) { const xx = x - w / 2 + (w * i / 20), yy = y + size * .62 + Math.sin(i * 1.3) * size * .04; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      }
    },
    arrow(ctx, S, x1, y1, x2, y2, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = chalkPattern(ctx, S.pal.ink); ctx.lineWidth = S.u * .8; ctx.lineCap = 'round';
      const mx = (x1 + x2) / 2 + (y2 - y1) * .15, my = (y1 + y2) / 2 - (x2 - x1) * .15;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      const N = 16, n = Math.floor(N * p);
      let px = x1, py = y1;
      for (let i = 1; i <= n; i++) { const t = i / N; px = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2; py = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2; ctx.lineTo(px, py); }
      ctx.stroke();
      if (p > .9) { const a = Math.atan2(y2 - my, x2 - mx), h = S.u * 3; ctx.beginPath(); ctx.moveTo(x2 - Math.cos(a - .5) * h, y2 - Math.sin(a - .5) * h); ctx.lineTo(x2, y2); ctx.lineTo(x2 - Math.cos(a + .5) * h, y2 - Math.sin(a + .5) * h); ctx.stroke(); }
      ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o) {
      ctx.save(); ctx.strokeStyle = chalkPattern(ctx, col(S, o.color)); ctx.lineWidth = S.u * .6;
      ctx.strokeRect(x, y - h * p, w, h * p);
      ctx.beginPath(); for (let yy = y - S.u * 2; yy > y - h * p; yy -= S.u * 2) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy - S.u * 1.5); } ctx.stroke();
      ctx.restore();
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = chalkPattern(ctx, S.pal.accent2); ctx.lineWidth = S.u * .5;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2.1 * p); ctx.stroke();
      ctx.fillStyle = chalkPattern(ctx, S.pal.ink); setFont(ctx, r * 1.3, this.fonts.number, '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
      ctx.restore();
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = chalkPattern(ctx, S.pal.accent); ctx.lineWidth = S.u * .5; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2 + .2, k = clamp(p * 10 - i);
        if (k <= 0) continue;
        const r0 = r * .78, r1 = r * (.78 + .12 * k);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * .9); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * .9); ctx.stroke();
      }
      ctx.restore();
    },
    wrap(ctx, S, v, phase, draw) { // a soft wipe like a board being revealed
      if (v >= 1) return draw();
      ctx.save();
      const k = E.inOutCubic(v);
      ctx.beginPath(); if (phase === 'in') ctx.rect(0, 0, S.W * k * 1.15, S.H); else ctx.rect(S.W * (1 - k), 0, S.W, S.H);
      ctx.clip(); draw(); ctx.restore();
    },
  });

  // ================================================================== 3. GOLDEN NEON
  function neon(ctx, color, blur, fn) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = blur * 2.2; ctx.globalAlpha *= 0.55; fn(1.9); ctx.restore();
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(1.15); ctx.restore();
    ctx.save(); fn(0.45, '#fff8e1'); ctx.restore();
  }
  const flick = (S, p, i = 0) => (p >= 1 ? (hash(S.frame, i, 77) > 0.985 ? 0.55 : 1) : (hash(S.frame, i, 31) < p * 1.1 ? 1 : 0.12));
  makeStyle({
    id: 'golden-neon', name: 'Golden Neon', caps: true,
    pal: { bg: '#0a0705', ink: '#ffd36e', accent: '#ffc531', accent2: '#ff4fa3', muted: '#b88a3a' },
    fonts: { title: '"Tilt Neon", "Cairo"', body: '"Tilt Neon", "Cairo"', number: '"Tilt Neon", "Cairo"' },
    weights: { title: '', body: '', number: '' },
    bg(ctx, S) {
      const { W, H, u } = S;
      ctx.fillStyle = '#0a0705'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(tex('brick', 512, 512, (g, w, h) => {
        g.fillStyle = '#16100b'; g.fillRect(0, 0, w, h);
        for (let r = 0; r < 16; r++) for (let c = 0; c < 9; c++) {
          const bx = c * 64 - (r % 2) * 32, by = r * 32, sh = 18 + hash(r, c) * 10;
          g.fillStyle = `rgb(${sh + 8},${sh},${sh - 6})`; g.fillRect(bx + 2, by + 2, 60, 28);
        }
      }), 0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, S.cy, 0, W / 2, S.cy, Math.max(W, H) * 0.6);
      g.addColorStop(0, 'rgba(255,190,60,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const c = col(S, o.color || 'accent');
      ctx.save(); ctx.globalAlpha *= flick(S, p, 1);
      neon(ctx, c, S.u * 3, (w, core) => { ctx.strokeStyle = core || c; strokeIcon(ctx, name, x, y, s, 1, 1.5 * w); });
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      ctx.globalAlpha *= flick(S, p, line.length);
      ctx.lineJoin = 'round';
      neon(ctx, color, size * 0.35, (w, core) => {
        ctx.strokeStyle = core || color; ctx.lineWidth = size * 0.055 * w; ctx.strokeText(line, x, y);
      });
    },
    arrow(ctx, S, x1, y1, x2, y2, p, o = {}) {
      if (p <= 0) return;
      const c = col(S, o.color || 'accent2');
      neon(ctx, c, S.u * 2, (w, core) => { ctx.save(); const b = BR.Base; ctx.globalAlpha *= 1; b.arrow.call(this, ctx, { ...S, pal: { ...S.pal, muted: core || c } }, x1, y1, x2, y2, p, { color: core || c }); ctx.restore(); });
    },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      const c = col(S, o.color);
      neon(ctx, c, S.u * 2, (lw, core) => { ctx.strokeStyle = core || c; ctx.lineWidth = S.u * .5 * lw; roundRect(ctx, x, y - h * p, w, h * p, S.u); ctx.stroke(); });
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      ctx.globalAlpha *= flick(S, p, 5);
      neon(ctx, S.pal.accent2, S.u * 1.5, (w, core) => { ctx.strokeStyle = ctx.fillStyle = core || S.pal.accent2; ctx.lineWidth = S.u * .35 * w; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); setFont(ctx, r * 1.2, this.fonts.number); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = S.u * .25 * w; ctx.strokeText(label, x, y); });
      ctx.globalAlpha = 1;
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.globalAlpha *= 0.5 * p;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,200,80,.35)'); g.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
    },
    cross(ctx, S, x, y, r, p) { if (p > 0) neon(ctx, S.pal.accent2, S.u * 2, (w, core) => { ctx.strokeStyle = core || S.pal.accent2; ctx.lineWidth = S.u * .5 * w; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }); },
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1) return draw();
      ctx.save(); ctx.globalAlpha = phase === 'in' ? (hash(S.frame, 9) < v * 1.2 ? E.outCubic(v) : v * 0.3) : E.inCubic(v);
      draw(); ctx.restore();
    },
  });

  // ================================================================== 4. RETRO CONSOLE
  makeStyle({
    id: 'retro-console', name: 'Retro Console', caps: true, lineHeight: 1.0,
    pal: { bg: '#031207', ink: '#7dff9b', accent: '#39ff6a', accent2: '#ffb000', muted: '#2e9c4c' },
    fonts: { title: '"VT323", "Cairo"', body: '"VT323", "Cairo"', number: '"VT323", "Cairo"' },
    weights: { title: '', body: '', number: '' },
    bg(ctx, S) {
      const { W, H, u } = S;
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7);
      g.addColorStop(0, '#062a12'); g.addColorStop(1, '#010703');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); setFont(ctx, 4 * u, this.fonts.body); ctx.fillStyle = S.pal.muted; ctx.textBaseline = 'top';
      ctx.fillText('> RUN BROLL.EXE' + (Math.floor(S.t * 2) % 2 ? ' _' : ''), 7 * u, 6 * u);
      ctx.textAlign = 'right'; ctx.fillText('MEM 64K OK', W - 7 * u, 6 * u); ctx.restore();
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const c = col(S, o.color || 'accent');
      ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = S.u * 2; ctx.strokeStyle = c;
      strokeIcon(ctx, name, x, y, s, p, 1.8); ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const s = typed(line, p * 1.1);
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = size * .25; ctx.fillStyle = color;
      ctx.fillText(s, x, y);
      if ((p > 0 && p < 1) || (role === 'number' && Math.floor(S.t * 3) % 2)) { // block cursor while typing
        ctx.textAlign = 'left'; const w = ctx.measureText(line).width, sw = ctx.measureText(s).width;
        ctx.fillRect(x - w / 2 + sw + size * .05, y - size * .38, size * .45, size * .72);
      }
      ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o) { // stacked block cells
      const c = col(S, o.color), cell = S.u * 2.2, n = Math.floor(h * p / cell);
      ctx.save(); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = S.u * 1.5;
      for (let i = 0; i < n; i++) ctx.fillRect(x, y - (i + 1) * cell + S.u * .3, w, cell - S.u * .6);
      ctx.restore();
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      ctx.save(); ctx.fillStyle = S.pal.accent2; setFont(ctx, r * 1.6, this.fonts.number); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('[' + label + ']', x, y); ctx.restore();
    },
    burst() { },
    post(ctx, S) {
      const { W, H, u } = S;
      ctx.save();
      const pat = ctx.createPattern(tex('scan2', 4, 4, g => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, 4, 2); }), 'repeat');
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
      const ry = ((S.t * 0.35) % 1.4 - 0.2) * H; // rolling bar
      const g = ctx.createLinearGradient(0, ry - 8 * u, 0, ry + 8 * u); g.addColorStop(0, 'rgba(120,255,150,0)'); g.addColorStop(.5, 'rgba(120,255,150,0.06)'); g.addColorStop(1, 'rgba(120,255,150,0)');
      ctx.fillStyle = g; ctx.fillRect(0, ry - 8 * u, W, 16 * u);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .72);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
    wrap(ctx, S, v, phase, draw) { // CRT power on / off
      if (v >= 1) return draw();
      const { W, H } = S;
      ctx.save();
      const sy = phase === 'in' ? Math.max(0.006, E.outQuint(seg(v, 0.25, 1))) : Math.max(0.006, E.inCubic(seg(v, 0.3, 1)));
      const sx = phase === 'in' ? E.outCubic(seg(v, 0, 0.35)) : E.outCubic(seg(v, 0, 0.3));
      ctx.translate(W / 2, H / 2); ctx.scale(Math.max(0.01, sx), sy); ctx.translate(-W / 2, -H / 2);
      draw();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - v) * 0.8; ctx.fillStyle = '#bfffcf'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
  });

  // ================================================================== 5. POP COMIC
  makeStyle({
    id: 'pop-comic', name: 'Pop Comic', caps: true,
    pal: { bg: '#ffd60a', ink: '#ffffff', accent: '#ff2e2e', accent2: '#1f6bff', muted: '#111111' },
    fonts: { title: '"Bangers", "Cairo"', body: '"Bangers", "Cairo"', number: '"Bangers", "Cairo"' },
    weights: { title: '', body: '', number: '900' },
    bg(ctx, S) {
      const { W, H, u } = S, cx = W / 2, cy = S.cy;
      ctx.fillStyle = '#ffd60a'; ctx.fillRect(0, 0, W, H);
      // speed lines
      ctx.save(); ctx.fillStyle = '#ffe766';
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2 + S.t * .05, a2 = a + 0.06; const R = Math.max(W, H); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R); ctx.fill(); }
      ctx.restore();
      // halftone dots growing to the edges
      const step = 3.2 * u;
      ctx.fillStyle = '#ff8a00';
      for (let y = -step; y < H + step; y += step) for (let x = ((y / step) % 2) * step / 2 - step; x < W + step; x += step) {
        const d = Math.hypot(x - cx, y - cy) / Math.hypot(W, H) * 2;
        const r = step * 0.42 * clamp((d - 0.35) * 1.6);
        if (r > 0.4) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      }
      ctx.lineWidth = u * 1.6; ctx.strokeStyle = '#111'; ctx.strokeRect(u * 2, u * 2, W - u * 4, H - u * 4);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const k = E.outBack(p);
      ctx.save(); ctx.translate(x, y); ctx.rotate((1 - k) * -0.4); ctx.scale(k, k);
      ctx.strokeStyle = '#111'; strokeIcon(ctx, name, s * .03, s * .03, s, 1, 4.6);
      strokeIcon(ctx, name, 0, 0, s, 1, 4.6);
      ctx.strokeStyle = col(S, o.color || 'accent') === S.pal.muted ? '#ffffff' : col(S, o.color || 'accent'); strokeIcon(ctx, name, 0, 0, s, 1, 2.2);
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const k = E.outBack(p);
      ctx.translate(x, y); ctx.rotate(-0.04); ctx.scale(k, k);
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#111'; ctx.fillText(line, size * .06, size * .07);
      ctx.strokeStyle = '#111'; ctx.lineWidth = size * .14; ctx.strokeText(line, 0, 0);
      ctx.fillStyle = color === S.pal.muted ? '#ffffff' : color; ctx.fillText(line, 0, 0);
    },
    burst(ctx, S, x, y, r, p) { // jagged POW star
      if (p <= 0) return;
      const k = E.outBack(p), n = 14;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k * .85); ctx.rotate(Math.sin(S.t * 3) * .03);
      const path = () => { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = r * (i % 2 ? .62 : 1) * (0.92 + hash(i, 4) * .16); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
      path(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = S.u * 1.2; ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.restore();
    },
    arrow(ctx, S, x1, y1, x2, y2, p) {
      if (p <= 0) return;
      ctx.save(); BR.Base.arrow.call(this, ctx, { ...S, u: S.u * 1.5 }, x1, y1, x2, y2, p, { color: '#111' }); ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      ctx.fillStyle = col(S, o.color) === S.pal.muted ? '#fff' : col(S, o.color); ctx.fillRect(x, y - h * p, w, h * p);
      ctx.lineWidth = S.u * .9; ctx.strokeStyle = '#111'; ctx.strokeRect(x, y - h * p, w, h * p);
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      const k = E.outBack(p); ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.fillStyle = '#ff2e2e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.lineWidth = S.u * .8; ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.fillStyle = '#fff'; setFont(ctx, r * 1.4, this.fonts.number); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, r * .08);
      ctx.restore();
    },
    wrap(ctx, S, v, phase, draw) { // slam + shake
      if (v >= 1) {
        const sh = Math.max(0, 1 - (S.t - 0.38) * 5);
        if (sh <= 0) return draw();
        ctx.save(); ctx.translate((hash(S.frame, 1) - .5) * S.u * 2 * sh, (hash(S.frame, 2) - .5) * S.u * 2 * sh); draw(); ctx.restore(); return;
      }
      ctx.save();
      const k = phase === 'in' ? lerp(1.5, 1, E.outCubic(v)) : lerp(0.7, 1, v);
      ctx.translate(S.W / 2, S.H / 2); ctx.rotate((1 - v) * (phase === 'in' ? -0.12 : 0.1)); ctx.scale(k, k); ctx.translate(-S.W / 2, -S.H / 2);
      ctx.globalAlpha = phase === 'in' ? Math.min(1, v * 3) : v;
      draw(); ctx.restore();
    },
  });

  // ================================================================== 6. FLAT POSTER
  makeStyle({
    id: 'flat-poster', name: 'Flat Poster', caps: true,
    pal: { bg: '#f3ece0', ink: '#1d1c1a', accent: '#ff5a1f', accent2: '#1f7a8c', muted: '#c9bfae' },
    fonts: { title: '"Anton", "Cairo"', body: '"Bebas Neue", "Cairo"', number: '"Anton", "Cairo"' },
    weights: { title: '900', body: '700', number: '900' },
    bg(ctx, S) {
      const { W, H, u, t } = S;
      ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
      const k = E.outCubic(clamp(t / 0.8));
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(W * .86, H * .16, 26 * u * k, 0, 7); ctx.fill();
      ctx.fillStyle = S.pal.accent2; ctx.fillRect(-W + W * k, H - 9 * u, W * 0.62, 9 * u);
      ctx.fillStyle = S.pal.accent; ctx.fillRect(W - W * 0.3 * k, H - 9 * u, W * 0.3, 9 * u);
      ctx.fillStyle = S.pal.ink; ctx.fillRect(6 * u, 6 * u, 14 * u * k, 1.2 * u);
      ctx.drawImage(tex('paper', 256, 256, (c, w, h) => grain(c, w, h, 0.05, 7, [80, 60, 30])), 0, 0, W, H);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const k = E.outBack(p), c = col(S, o.color || 'accent');
      ctx.save(); ctx.fillStyle = c; ctx.globalAlpha *= 0.95;
      ctx.beginPath(); ctx.arc(x + s * .08, y + s * .06, s * .5 * k, 0, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.strokeStyle = S.pal.ink; ctx.translate(x, y); ctx.scale(k, k); strokeIcon(ctx, name, 0, 0, s * .82, 1, 2.6); ctx.restore();
    },
    burst() { },
    drawLine(ctx, S, line, x, y, size, role, color, p) { // slides up from behind a mask
      ctx.save(); const w = ctx.measureText(line).width;
      ctx.beginPath(); ctx.rect(x - w, y - size * .62, w * 2, size * 1.24); ctx.clip();
      ctx.fillStyle = color; ctx.fillText(line, x, y + (1 - E.outQuint(p)) * size * 1.2);
      ctx.restore();
    },
    wrap(ctx, S, v, phase, draw) { // a block of colour sweeps across
      if (v >= 1) return draw();
      const { W, H } = S;
      ctx.save();
      if (phase === 'in') {
        const a = E.inOutCubic(v), x = lerp(-W * .2, W * 1.2, a);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); draw(); ctx.restore();
        ctx.fillStyle = S.pal.accent; ctx.fillRect(x - W * .2, 0, W * .2, H);
      } else { ctx.globalAlpha = v; ctx.translate(0, (1 - v) * -S.u * 6); draw(); }
      ctx.restore();
    },
  });

  // ================================================================== 7. LINE DIAGRAM
  makeStyle({
    id: 'line-diagram', name: 'Line Diagram', caps: true,
    pal: { bg: '#f6f4ee', ink: '#14233f', accent: '#14233f', accent2: '#e2482b', muted: '#7d8aa3' },
    fonts: { title: '"IBM Plex Mono", "Cairo"', body: '"IBM Plex Mono", "Cairo"', number: '"IBM Plex Mono", "Cairo"' },
    weights: { title: '700', body: '400', number: '700' },
    bg(ctx, S) {
      const { W, H, u } = S;
      ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(20,35,63,0.18)';
      const g = 4 * u, a = clamp(S.t / 0.6);
      for (let y = g; y < H; y += g) for (let x = g; x < W; x += g) ctx.fillRect(x, y, u * .25 * a, u * .25 * a);
      ctx.strokeStyle = S.pal.ink; ctx.lineWidth = u * .2; ctx.strokeRect(3 * u, 3 * u, W - 6 * u, H - 6 * u);
      ctx.save(); setFont(ctx, 2.6 * u, this.fonts.body, '400'); ctx.fillStyle = S.pal.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('FIG. ' + String(S.seed).padStart(2, '0') + '  /  SCALE 1:1', W - 5 * u, H - 4.5 * u); ctx.restore();
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const { u } = S, h = s * .62;
      ctx.save(); ctx.strokeStyle = S.pal.ink; strokeIcon(ctx, name, x, y, s, p, 1.1);
      // corner brackets + dimension line
      const k = E.outCubic(seg(p, .2, .8)), b = s * .12 * k;
      ctx.lineWidth = u * .22; ctx.strokeStyle = S.pal.accent2;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + sx * h, y + sy * h - sy * b); ctx.lineTo(x + sx * h, y + sy * h); ctx.lineTo(x + sx * h - sx * b, y + sy * h); ctx.stroke(); });
      if (k > 0.5) {
        ctx.strokeStyle = S.pal.muted; ctx.setLineDash([u * .8, u * .6]);
        ctx.beginPath(); ctx.moveTo(x - h, y + h + 2.5 * u); ctx.lineTo(x - h + 2 * h * seg(k, .5, 1), y + h + 2.5 * u); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      ctx.letterSpacing = (size * 0.06) + 'px';
      const s = typed(line, p * 1.2);
      ctx.fillStyle = role === 'number' ? S.pal.accent2 : color; ctx.fillText(s, x, y);
      if (role === 'title' && p > .3) { const w = ctx.measureText(line).width; ctx.fillRect(x - w / 2, y + size * .62, w * seg(p, .3, 1), Math.max(1, size * .04)); }
    },
    text(ctx, S, str, x, y, size, p, o = {}) { return BR.Base.text.call(this, ctx, S, str, x, y, size * (o.role === 'number' ? 0.8 : 0.72), p, o); },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      const hh = h * p, c = col(S, o.color) === S.pal.muted ? S.pal.ink : col(S, o.color);
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = S.u * .25; ctx.strokeRect(x, y - hh, w, hh);
      ctx.beginPath(); ctx.rect(x, y - hh, w, hh); ctx.clip();
      ctx.lineWidth = S.u * .15; for (let i = -hh; i < w + hh; i += S.u * 1.4) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + hh, y - hh); } ctx.stroke(); ctx.restore();
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = S.pal.accent2; ctx.lineWidth = S.u * .25;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2 * p); ctx.stroke();
      setFont(ctx, r * 1.1, this.fonts.number, '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
      ctx.restore();
    },
    burst() { },
    arrow(ctx, S, x1, y1, x2, y2, p) { if (p > 0) { ctx.save(); BR.Base.arrow.call(this, ctx, { ...S, u: S.u * .35 }, x1, y1, x2, y2, p, { color: S.pal.ink }); ctx.restore(); } },
    wrap(ctx, S, v, phase, draw) { if (v >= 1) return draw(); ctx.save(); ctx.globalAlpha = E.outCubic(v); draw(); ctx.restore(); },
  });

  // ================================================================== 8. CINEMATIC 3D
  function extrude(ctx, S, depth, drawLayer, frontStyle) {
    const d = S.u * 0.16;
    for (let i = depth; i > 0; i--) { ctx.save(); ctx.translate(i * d * .6, i * d); drawLayer(shade('#3a2a14', -0.25 + i / depth * 0.25), i); ctx.restore(); }
    drawLayer(frontStyle, 0);
  }
  makeStyle({
    id: 'cinematic-3d', name: 'Cinematic 3D', caps: true,
    pal: { bg: '#05070b', ink: '#f3efe6', accent: '#f0c46a', accent2: '#5fd4ff', muted: '#5a6a80' },
    fonts: { title: '"Bebas Neue", "Cairo"', body: '"Bebas Neue", "Cairo"', number: '"Bebas Neue", "Cairo"' },
    weights: { title: '900', body: '700', number: '900' },
    bg(ctx, S) {
      const { W, H, u, t } = S;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c1824'); g.addColorStop(1, '#030405');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // volumetric light beams
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = W * (0.2 + i * 0.3) + Math.sin(t * .4 + i) * W * .05;
        const gr = ctx.createLinearGradient(x, 0, x, H); gr.addColorStop(0, 'rgba(255,214,150,0.16)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 2 * u, -1); ctx.lineTo(x + 2 * u, -1); ctx.lineTo(x + 22 * u, H); ctx.lineTo(x - 22 * u, H); ctx.fill();
      }
      // dust motes
      for (let i = 0; i < 60; i++) {
        const x = (hash(i, 1) * W + t * u * (2 + hash(i, 3) * 3)) % W, y = (hash(i, 2) * H - t * u * 1.5 + H) % H;
        ctx.fillStyle = `rgba(255,230,190,${0.15 + hash(i, 5) * 0.4})`; ctx.beginPath(); ctx.arc(x, y, u * (0.15 + hash(i, 6) * 0.35), 0, 7); ctx.fill();
      }
      ctx.restore();
      // reflective floor
      const f = ctx.createLinearGradient(0, H * .78, 0, H); f.addColorStop(0, 'rgba(240,196,106,0)'); f.addColorStop(1, 'rgba(240,196,106,0.08)');
      ctx.fillStyle = f; ctx.fillRect(0, H * .78, W, H * .22);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const k = E.outCubic(p), c = col(S, o.color || 'accent');
      ctx.save(); ctx.globalAlpha *= k; ctx.translate(x, y); ctx.scale(lerp(.7, 1, k), lerp(.7, 1, k)); ctx.rotate((1 - k) * 0.3);
      const gr = (() => { const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#fff6dc'); g.addColorStop(.45, c); g.addColorStop(1, shade(c, -0.45)); return g; })();
      extrude(ctx, S, 10, (st) => { ctx.strokeStyle = st; strokeIcon(ctx, name, 0, 0, s, 1, 2.6); }, gr);
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const k = E.outCubic(p);
      ctx.globalAlpha *= k;
      ctx.translate(x, y + (1 - k) * size * .3); ctx.scale(lerp(1.15, 1, k), lerp(1.15, 1, k));
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      if (color === S.pal.accent) { g.addColorStop(0, '#fff4d6'); g.addColorStop(.5, '#f0c46a'); g.addColorStop(1, '#9c6a22'); }
      else { g.addColorStop(0, '#ffffff'); g.addColorStop(.6, color); g.addColorStop(1, shade(color.startsWith('#') ? color : '#cccccc', -0.35)); }
      extrude(ctx, S, Math.round(size / S.u * 0.9), (st) => { ctx.fillStyle = st; ctx.fillText(line, 0, 0); }, g);
      // specular sweep
      const w = ctx.measureText(line).width, sx = lerp(-w, w, (S.t * 0.6) % 1.6);
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      const sg = ctx.createLinearGradient(sx - size, 0, sx + size, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillText(line, 0, 0); ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      const hh = h * E.outCubic(p), c = col(S, o.color), d = S.u * 2.2;
      ctx.fillStyle = shade(c.startsWith('#') ? c : '#888888', -0.5); ctx.beginPath(); ctx.moveTo(x + w, y - hh); ctx.lineTo(x + w + d, y - hh - d * .6); ctx.lineTo(x + w + d, y - d * .6); ctx.lineTo(x + w, y); ctx.fill();
      ctx.fillStyle = shade(c.startsWith('#') ? c : '#888888', 0.3); ctx.beginPath(); ctx.moveTo(x, y - hh); ctx.lineTo(x + d, y - hh - d * .6); ctx.lineTo(x + w + d, y - hh - d * .6); ctx.lineTo(x + w, y - hh); ctx.fill();
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, shade(c.startsWith('#') ? c : '#888888', -0.2)); g.addColorStop(1, c); ctx.fillStyle = g; ctx.fillRect(x, y - hh, w, hh);
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,200,120,${0.28 * p})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.fillStyle = `rgba(255,230,190,${0.35 * p})`; ctx.fillRect(x - r * 1.3, y - S.u * .15, r * 2.6, S.u * .3); // anamorphic streak
      ctx.restore();
    },
    post(ctx, S) {
      const { W, H, u } = S, lb = S.layout === 'full' ? 0 : 5 * u;
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      if (lb) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb); }
    },
    wrap(ctx, S, v, phase, draw) { // slow push-in, fade through black
      ctx.save();
      const k = 1 + 0.05 * (S.t / S.D);
      ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k); ctx.translate(-S.W / 2, -S.H / 2);
      ctx.globalAlpha = v >= 1 ? 1 : E.inOutCubic(v);
      draw(); ctx.restore();
    },
  });

  // ================================================================== 9. TOY BRICKS
  function brick(ctx, x, y, s, color) {
    ctx.fillStyle = shade(color, -0.35); ctx.fillRect(x, y, s, s);
    ctx.fillStyle = color; ctx.fillRect(x, y, s - s * .08, s - s * .1);
    ctx.fillStyle = shade(color, 0.25); ctx.fillRect(x, y, s - s * .08, s * .07);
    ctx.fillStyle = shade(color, -0.25); ctx.beginPath(); ctx.arc(x + s * .48, y + s * .5, s * .3, 0, 7); ctx.fill();
    ctx.fillStyle = shade(color, 0.12); ctx.beginPath(); ctx.arc(x + s * .44, y + s * .45, s * .28, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x + s * .37, y + s * .37, s * .08, 0, 7); ctx.fill();
  }
  // Rasterise any drawing into a grid of bricks that drop in row by row.
  function brickify(ctx, S, cell, color, p, drawMask) {
    const gw = Math.ceil(S.W / cell), gh = Math.ceil(S.H / cell);
    const [mc, mctx] = scratch('brickmask', gw, gh);
    mctx.scale(1 / cell, 1 / cell); mctx.fillStyle = mctx.strokeStyle = '#fff'; drawMask(mctx);
    const d = mctx.getImageData(0, 0, gw, gh).data;
    let top = gh, bot = 0;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (d[(j * gw + i) * 4 + 3] > 90) { top = Math.min(top, j); bot = Math.max(bot, j); }
    const rows = Math.max(1, bot - top + 1);
    for (let j = gh - 1; j >= 0; j--) for (let i = 0; i < gw; i++) {
      if (d[(j * gw + i) * 4 + 3] <= 90) continue;
      const rf = (bot - j) / rows, k = E.outCubic(clamp((p - rf * 0.65) / 0.35));
      if (k <= 0) continue;
      ctx.globalAlpha = Math.min(1, k * 2);
      brick(ctx, i * cell, j * cell - (1 - k) * cell * 8, cell, color);
    }
    ctx.globalAlpha = 1;
  }
  makeStyle({
    id: 'toy-bricks', name: 'Toy Bricks', caps: true, stepFps: 15,
    pal: { bg: '#2f8f46', ink: '#1b1b1b', accent: '#d8231b', accent2: '#1b5fc4', muted: '#f2c22e' },
    fonts: { title: '"Fredoka", "Cairo"', body: '"Fredoka", "Cairo"', number: '"Fredoka", "Cairo"' },
    weights: { title: '700', body: '700', number: '700' },
    bg(ctx, S) {
      const { W, H, u } = S, s = 3.2 * u;
      ctx.drawImage(tex('plate' + Math.round(s), Math.ceil(W), Math.ceil(H), (g, w, h) => {
        g.fillStyle = '#2f8f46'; g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
          g.fillStyle = '#26773a'; g.beginPath(); g.arc(x + s * .55, y + s * .55, s * .3, 0, 7); g.fill();
          g.fillStyle = '#3aa556'; g.beginPath(); g.arc(x + s * .48, y + s * .48, s * .28, 0, 7); g.fill();
        }
      }), 0, 0);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .8);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const c = col(S, o.color || 'accent');
      brickify(ctx, S, Math.max(S.u * 1.3, s / 20), c === S.pal.muted ? '#f2c22e' : c, p, m => { m.lineWidth = 3.2; m.strokeStyle = '#fff'; strokeIcon(m, name, x, y, s, 1, 3.4); });
    },
    text(ctx, S, str, x, y, size, p, o = {}) {
      if (p <= 0 || !str) return 0;
      if (o.role === 'number' && size > 9 * S.u && String(str).length <= 6) {
        const s = BR.isRTL(str) ? str : String(str).toUpperCase();
        brickify(ctx, S, Math.max(S.u * 1.1, size / 16), col(S, o.color || 'accent'), p, m => {
          const L = BR.layoutText(m, s, o.maxW || S.W * .84, size, this.fonts.number, '700', o.lines || 2, size * .35);
          setFont(m, L.size, this.fonts.number, '700'); m.textAlign = 'center'; m.textBaseline = 'middle';
          L.lines.forEach((ln, i) => m.fillText(ln, x, y + (i - (L.lines.length - 1) / 2) * L.size * 1.05));
        });
        return size;
      }
      return BR.Base.text.call(this, ctx, S, str, x, y, size, p, o);
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) { // printed on a white tile
      const k = E.outBack(p), w = ctx.measureText(line).width, pad = size * .35;
      ctx.translate(x, y - (1 - k) * size); ctx.globalAlpha *= Math.min(1, p * 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(ctx, -w / 2 - pad + size * .08, -size * .62 + size * .1, w + pad * 2, size * 1.24, size * .12); ctx.fill();
      ctx.fillStyle = '#f4f4f0'; roundRect(ctx, -w / 2 - pad, -size * .62, w + pad * 2, size * 1.24, size * .12); ctx.fill();
      ctx.fillStyle = '#dedcd5'; ctx.fillRect(-w / 2 - pad, size * .52, w + pad * 2, size * .1);
      ctx.fillStyle = color === S.pal.muted ? '#555' : (color === S.pal.ink ? '#1b1b1b' : color); ctx.fillText(line, 0, size * .02);
    },
    bar(ctx, S, x, y, w, h, p, o) {
      const cell = w / 3, n = Math.floor(h / cell), c = col(S, o.color) === S.pal.muted ? '#f2c22e' : col(S, o.color);
      for (let j = 0; j < n; j++) { const k = clamp(p * n - j); if (k <= 0) break; for (let i = 0; i < 3; i++) brick(ctx, x + i * cell, y - (j + 1) * cell - (1 - E.outCubic(k)) * cell * 4, cell, c); }
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      brick(ctx, x - r, y - r - (1 - E.outCubic(p)) * r * 3, r * 2, '#f2c22e');
      ctx.fillStyle = '#1b1b1b'; setFont(ctx, r * 1.1, this.fonts.number, '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x - r * .05, y - r * .02);
    },
    arrow(ctx, S, x1, y1, x2, y2, p) { // a row of studs
      const n = Math.floor(Math.hypot(x2 - x1, y2 - y1) / (S.u * 3)), s = S.u * 2.6;
      for (let i = 0; i <= n * p; i++) { const t = i / Math.max(1, n); brick(ctx, lerp(x1, x2, t) - s / 2, lerp(y1, y2, t) - s / 2, s, '#f4f4f0'); }
    },
    burst() { },
    cross(ctx, S, x, y, r, p) { if (p > 0) { ctx.save(); ctx.globalAlpha = .9; brickify(ctx, S, S.u * 2, '#1b1b1b', p, m => { m.lineWidth = S.u * 3; m.lineCap = 'square'; m.beginPath(); m.moveTo(x - r, y - r); m.lineTo(x + r, y + r); m.moveTo(x + r, y - r); m.lineTo(x - r, y + r); m.stroke(); }); ctx.restore(); } },
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1 || phase === 'in') return draw(); // bricks already drop in
      ctx.save(); ctx.globalAlpha = v; ctx.translate(0, (1 - v) * S.H * 0.15); draw(); ctx.restore();
    },
  });

  // ================================================================== 10. SOFT 3D (clay)
  makeStyle({
    id: 'soft-3d', name: 'Soft 3D', caps: false,
    pal: { bg: '#f1e6ff', ink: '#3b2a5c', accent: '#7c5cff', accent2: '#ff6f9f', muted: '#b4a6d6' },
    fonts: { title: '"Fredoka", "Cairo"', body: '"Fredoka", "Cairo"', number: '"Fredoka", "Cairo"' },
    weights: { title: '700', body: '400', number: '700' },
    bg(ctx, S) {
      const { W, H, u, t } = S;
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#efe4ff'); g.addColorStop(1, '#ffe4d6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const blobs = [['#e3d6ff', .02, .06, 13], ['#ffdbe8', 1.0, .12, 10], ['#d4f3ea', .03, .96, 11], ['#fff0cc', .98, .92, 9]];
      blobs.forEach(([c, bx, by, r], i) => {
        const x = W * bx + Math.sin(t * .8 + i) * 2 * u, y = H * by + Math.cos(t * .7 + i) * 2 * u, R = r * u;
        const rg = ctx.createRadialGradient(x - R * .3, y - R * .35, R * .1, x, y, R);
        rg.addColorStop(0, '#ffffff'); rg.addColorStop(.35, c); rg.addColorStop(1, shade(c, -0.12));
        ctx.save(); ctx.shadowColor = 'rgba(80,50,140,0.18)'; ctx.shadowBlur = 4 * u; ctx.shadowOffsetY = 2 * u;
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.restore();
      });
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const k = E.outElastic(Math.min(1, p * 1.1)), c = col(S, o.color || 'accent'), u = S.u;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      // soft pillow card
      ctx.save(); ctx.shadowColor = 'rgba(70,40,130,0.25)'; ctx.shadowBlur = 5 * u; ctx.shadowOffsetY = 2.5 * u;
      const cg = ctx.createLinearGradient(0, -s * .65, 0, s * .65); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#efe8fb');
      ctx.fillStyle = cg; roundRect(ctx, -s * .66, -s * .66, s * 1.32, s * 1.32, s * .32); ctx.fill(); ctx.restore();
      // puffy icon
      const ig = ctx.createLinearGradient(0, -12, 0, 12); ig.addColorStop(0, shade(c.startsWith('#') ? c : '#7c5cff', 0.35)); ig.addColorStop(1, shade(c.startsWith('#') ? c : '#7c5cff', -0.2));
      ctx.save(); ctx.shadowColor = 'rgba(70,40,130,0.35)'; ctx.shadowBlur = 1.5 * u; ctx.shadowOffsetY = 1 * u;
      ctx.strokeStyle = ig; strokeIcon(ctx, name, 0, 0, s * .82, 1, 3.4); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; strokeIcon(ctx, name, -s * .008, -s * .012, s * .82, 1, 0.9);
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const k = E.outElastic(Math.min(1, p * 1.05));
      ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha *= Math.min(1, p * 3);
      ctx.save(); ctx.shadowColor = 'rgba(70,40,130,0.3)'; ctx.shadowBlur = size * .18; ctx.shadowOffsetY = size * .08;
      const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      const base = color.startsWith('#') ? color : '#3b2a5c';
      g.addColorStop(0, shade(base, 0.3)); g.addColorStop(1, shade(base, -0.1));
      ctx.fillStyle = g; ctx.fillText(line, 0, 0); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(-size * 20, -size, size * 40, size * .62); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText(line, 0, 0); ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      const hh = Math.max(w, h * E.outElastic(p)), c = col(S, o.color), base = c.startsWith('#') ? c : '#b4a6d6';
      ctx.save(); ctx.shadowColor = 'rgba(70,40,130,0.25)'; ctx.shadowBlur = 2 * S.u; ctx.shadowOffsetY = S.u;
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, shade(base, 0.35)); g.addColorStop(1, shade(base, -0.1));
      ctx.fillStyle = g; roundRect(ctx, x, y - hh, w, hh, w / 2); ctx.fill(); ctx.restore();
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      const k = E.outElastic(p); ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r); g.addColorStop(0, '#ffc4d8'); g.addColorStop(1, '#ff5c8f');
      ctx.shadowColor = 'rgba(200,50,100,0.35)'; ctx.shadowBlur = r * .6; ctx.shadowOffsetY = r * .25;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fff'; setFont(ctx, r * 1.1, this.fonts.number, '700'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, r * .05);
      ctx.restore();
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      const R = r * .75 * E.outElastic(p);
      const g = ctx.createRadialGradient(x - R * .3, y - R * .3, R * .1, x, y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    },
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1) return draw();
      ctx.save(); ctx.globalAlpha = Math.min(1, v * 2);
      const k = phase === 'in' ? E.outElastic(v) : lerp(0.8, 1, E.outCubic(v));
      ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k); ctx.translate(-S.W / 2, -S.H / 2); draw(); ctx.restore();
    },
  });

  // ================================================================== 11. PAPER CUTOUT (bonus)
  function paperShadow(ctx, u) { ctx.shadowColor = 'rgba(40,25,5,0.45)'; ctx.shadowBlur = u * 1.2; ctx.shadowOffsetX = u * .5; ctx.shadowOffsetY = u * .9; }
  makeStyle({
    id: 'paper-cutout', name: 'Paper Cutout', caps: true, stepFps: 12,
    pal: { bg: '#e6d5b8', ink: '#222222', accent: '#e63946', accent2: '#2a9d8f', muted: '#f4a261' },
    fonts: { title: '"Permanent Marker", "Cairo"', body: '"Permanent Marker", "Cairo"', number: '"Anton", "Cairo"' },
    weights: { title: '', body: '', number: '900' },
    bg(ctx, S) {
      const { W, H, u } = S;
      ctx.fillStyle = '#e6d5b8'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(tex('kraft', 256, 256, (c, w, h) => grain(c, w, h, 0.12, 4, [120, 85, 40])), 0, 0, W, H);
      // torn paper corners
      ctx.save(); paperShadow(ctx, u);
      ctx.fillStyle = '#f7f1e3'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * .42, 0);
      for (let i = 0; i <= 12; i++) ctx.lineTo(W * .42 - i * W * .035, H * .02 + i * H * .012 + hash(i, 2) * u * 1.5);
      ctx.lineTo(0, H * .2); ctx.fill();
      ctx.fillStyle = '#2a9d8f'; ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W * .62, H);
      for (let i = 0; i <= 12; i++) ctx.lineTo(W * .62 + i * W * .032, H - H * .03 - i * H * .01 - hash(i, 3) * u * 1.5);
      ctx.lineTo(W, H * .8); ctx.fill(); ctx.restore();
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const k = E.outBack(p), j = (hash(S.frame, 3, name.length) - .5) * 0.05;
      ctx.save(); ctx.translate(x + (hash(S.frame, 1) - .5) * S.u * .4, y + (1 - k) * S.H * .3); ctx.rotate(j + (1 - k) * .3);
      ctx.save(); paperShadow(ctx, S.u); ctx.strokeStyle = '#fbf6ea'; strokeIcon(ctx, name, 0, 0, s, 1, 5.2); ctx.restore();
      ctx.strokeStyle = col(S, o.color || 'accent'); strokeIcon(ctx, name, 0, 0, s, 1, 2.8);
      ctx.restore();
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) { // each word on its own paper scrap
      const words = line.split(' '), sp = size * .25;
      const ws = words.map(w => ctx.measureText(w).width + size * .5);
      let cx = x - (ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2;
      const rtl = ctx.direction === 'rtl';
      const order = rtl ? words.map((_, i) => words.length - 1 - i) : words.map((_, i) => i);
      ctx.textAlign = 'center';
      order.forEach((wi, n) => {
        const w = ws[wi], k = E.outBack(clamp(p * words.length - n * 0.7));
        if (k > 0) {
          ctx.save(); ctx.translate(cx + w / 2, y - (1 - k) * size * 2); ctx.rotate((hash(wi, line.length) - .5) * 0.12 + (hash(S.frame, wi) - .5) * 0.02);
          ctx.save(); paperShadow(ctx, S.u);
          const pc = role === 'number' ? '#fbf6ea' : ['#fbf6ea', '#ffe8a3', '#ffffff', '#fbd3c4'][(wi + line.length) % 4];
          ctx.fillStyle = pc; ctx.beginPath();
          const hw = w / 2, hh = size * .62;
          ctx.moveTo(-hw, -hh); for (let i = 0; i <= 6; i++) ctx.lineTo(-hw + w * i / 6, -hh + (hash(i, wi) - .5) * size * .1);
          ctx.lineTo(hw, hh); for (let i = 6; i >= 0; i--) ctx.lineTo(-hw + w * i / 6, hh + (hash(i, wi + 9) - .5) * size * .1);
          ctx.fill(); ctx.restore();
          ctx.fillStyle = color === S.pal.muted ? '#555' : color; ctx.fillText(words[wi], 0, size * .04);
          ctx.restore();
        }
        cx += w + sp;
      });
    },
    bar(ctx, S, x, y, w, h, p, o) {
      if (p <= 0) return;
      const hh = h * E.outBack(p);
      ctx.save(); paperShadow(ctx, S.u); ctx.fillStyle = col(S, o.color); ctx.translate(x + w / 2, y - hh / 2); ctx.rotate((hash(o.i || 0, 4) - .5) * .06);
      ctx.fillRect(-w / 2, -hh / 2, w, hh); ctx.restore();
    },
    badge(ctx, S, x, y, r, label, p) {
      if (p <= 0) return;
      const k = E.outBack(p); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); paperShadow(ctx, S.u);
      ctx.fillStyle = '#e63946'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 7, rr = r * (0.9 + hash(i, 6) * .15); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.fillStyle = '#fff'; setFont(ctx, r * 1.2, this.fonts.number, '900'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, r * .05);
      ctx.restore();
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      const k = E.outBack(p); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(hash(S.frame, 2) * 0.02); paperShadow(ctx, S.u);
      ctx.fillStyle = '#ffe8a3'; ctx.beginPath(); for (let i = 0; i < 22; i++) { const a = i / 22 * 7, rr = r * .7 * (i % 2 ? .78 : 1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .85); } ctx.fill(); ctx.restore();
    },
    arrow(ctx, S, x1, y1, x2, y2, p) { if (p > 0) { ctx.save(); paperShadow(ctx, S.u); BR.Base.arrow.call(this, ctx, { ...S, u: S.u * 1.3 }, x1, y1, x2, y2, p, { color: '#222' }); ctx.restore(); } },
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1) return draw();
      ctx.save(); ctx.translate(0, (1 - E.outCubic(v)) * (phase === 'in' ? S.H * .25 : -S.H * .1)); ctx.globalAlpha = Math.min(1, v * 2.5); draw(); ctx.restore();
    },
  });

  // ================================================================== 12. GLITCH HYPE (bonus)
  makeStyle({
    id: 'glitch-hype', name: 'Glitch Hype', caps: true,
    pal: { bg: '#050508', ink: '#ffffff', accent: '#00f5d4', accent2: '#ff2a6d', muted: '#5b5b78' },
    fonts: { title: '"Space Mono", "Cairo"', body: '"Space Mono", "Cairo"', number: '"Anton", "Cairo"' },
    weights: { title: '700', body: '700', number: '900' },
    bg(ctx, S) {
      const { W, H, u } = S;
      ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,245,212,0.07)'; ctx.lineWidth = 1;
      const g = 6 * u, off = (S.t * 4 * u) % g;
      ctx.beginPath(); for (let x = 0; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = -g + off; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
    },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      const sh = (1 - p) * S.u * 3 + S.u * .35;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#ff2a6d'; strokeIcon(ctx, name, x - sh, y, s, p, 2.2);
      ctx.strokeStyle = '#00f5d4'; strokeIcon(ctx, name, x + sh, y, s, p, 2.2);
      ctx.restore();
      ctx.strokeStyle = '#fff'; strokeIcon(ctx, name, x, y, s, p, 1.4);
    },
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      const scramble = '!<>-_\\/[]{}=+*^?#01';
      let s = line;
      if (p < 1) s = line.split('').map((ch, i) => (i / line.length < p ? ch : (ch === ' ' ? ' ' : scramble[Math.floor(hash(i, S.frame) * scramble.length)]))).join('');
      const sh = size * 0.035 + (p < 1 ? size * 0.08 : 0);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff2a6d'; ctx.fillText(s, x - sh, y); ctx.fillStyle = '#00f5d4'; ctx.fillText(s, x + sh, y); ctx.restore();
      ctx.fillStyle = color === S.pal.ink ? '#fff' : color; ctx.globalAlpha *= 0.92; ctx.fillText(s, x, y);
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = `rgba(0,245,212,${0.5 * p})`; ctx.lineWidth = S.u * .3;
      for (let i = 0; i < 3; i++) { const rr = r * ((S.t * 0.5 + i / 3) % 1); ctx.globalAlpha = 1 - rr / r; ctx.beginPath(); ctx.rect(x - rr, y - rr * .6, rr * 2, rr * 1.2); ctx.stroke(); }
      ctx.restore();
    },
    post(ctx, S) {
      const { W, H, u } = S;
      // glitch bursts: at entry and briefly every ~0.8s
      const local = (S.t % 0.8);
      const hit = S.t < 0.5 || local < 0.1;
      if (hit) {
        const [c, cc] = scratch('glitch', W, H); cc.drawImage(ctx.canvas, 0, 0);
        const n = 6 + Math.floor(hash(S.frame, 1) * 6);
        for (let i = 0; i < n; i++) {
          const y = hash(S.frame, i, 2) * H, h = (0.5 + hash(S.frame, i, 3) * 4) * u, dx = (hash(S.frame, i, 4) - .5) * 12 * u;
          ctx.drawImage(c, 0, y, W, h, dx, y, W, h);
        }
      }
      const pat = ctx.createPattern(tex('gscan', 2, 4, g => { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 2, 1); }), 'repeat');
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    },
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1) return draw();
      ctx.save();
      const on = hash(S.frame, 42) < v * 1.3;
      ctx.globalAlpha = on ? 1 : 0.25;
      if (phase === 'out') ctx.translate((hash(S.frame, 5) - .5) * (1 - v) * S.u * 20, 0);
      draw(); ctx.restore();
      if (phase === 'in' && v < 0.35) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${(0.35 - v) * 1.2})`; ctx.fillRect(0, 0, S.W, S.H); ctx.restore(); }
    },
  });
})();
