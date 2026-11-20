// Shared helpers for the B-roll engine: easing, timing, random, text, icons, numbers.
(function () {
  const E = {
    lin: x => x,
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: x => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1),
    outQuint: x => 1 - Math.pow(1 - x, 5),
  };
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / Math.max(1e-6, b - a));
  const lerp = (a, b, k) => a + (b - a) * k;

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Stable hash noise for (i, j, seed) without state.
  function hash(i, j = 0, k = 0) {
    let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  const isRTL = s => RTL_RE.test(s || '');

  // ---------- icons ----------
  const DATA = window.ICONDATA || { icons: {}, tags: {} };
  const cache = {};
  let measurer = null;
  function pathLen(d) {
    if (!measurer) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.position = 'absolute'; svg.style.width = svg.style.height = '0';
      measurer = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.appendChild(measurer); document.body.appendChild(svg);
    }
    measurer.setAttribute('d', d);
    try { return measurer.getTotalLength() || 10; } catch (e) { return 10; }
  }
  function resolveIcon(name) {
    if (!name) return null;
    const n = String(name).toLowerCase().trim().replace(/[\s_]+/g, '-');
    const ALIAS = { home: 'house', money: 'banknote', cash: 'banknote', chart: 'chart-line', growth: 'trending-up', idea: 'lightbulb', time: 'clock', phone: 'smartphone', people: 'users', person: 'user' };
    const n2 = ALIAS[n] || n;
    if (DATA.icons[n2]) return n2;
    // tag / partial match
    let best = null, bestScore = 0;
    const words = n.split('-').filter(Boolean);
    for (const key in DATA.icons) {
      const tags = DATA.tags[key] || [];
      let score = 0;
      for (const w of words) {
        if (key === w) score += 5;
        else if (key.split('-').includes(w)) score += 3;
        else if (tags.includes(w)) score += 2;
      }
      if (score > bestScore || (score === bestScore && score > 0 && key.length < best.length)) { best = key; bestScore = score; }
    }
    return best || 'sparkles';
  }
  // Returns [{p: Path2D, d, len}] in the 24x24 lucide space.
  function icon(name) {
    const key = resolveIcon(name);
    if (!key) return null;
    if (!cache[key]) cache[key] = DATA.icons[key].map(d => ({ d, p: new Path2D(d), len: pathLen(d) }));
    return cache[key];
  }
  // Stroke an icon (center x,y, box size s) revealing each sub-path progressively (p 0..1).
  function strokeIcon(ctx, name, x, y, s, p = 1, lw = 2) {
    const parts = icon(name); if (!parts) return;
    ctx.save();
    ctx.translate(x - s / 2, y - s / 2); ctx.scale(s / 24, s / 24);
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const n = parts.length;
    parts.forEach((pt, i) => {
      const k = clamp(p * n - i * 0.6, 0, 1);
      if (k <= 0) return;
      if (k < 1) { ctx.setLineDash([pt.len * k, pt.len + 1]); } else ctx.setLineDash([]);
      ctx.stroke(pt.p);
    });
    ctx.restore();
  }
  // Fill the icon's stroke shape (thick outline) — used by solid styles.
  function iconPaths(name) { return icon(name) || []; }

  // ---------- text ----------
  function setFont(ctx, size, family, weight = '') { ctx.font = `${weight} ${Math.round(size)}px ${family}`.trim(); }
  // Wrap str into at most maxLines that fit maxW, shrinking size if needed. Returns {lines, size}.
  function layoutText(ctx, str, maxW, size, family, weight = '', maxLines = 2, minSize = 10) {
    str = String(str || '').trim();
    let s = size;
    for (let iter = 0; iter < 30; iter++) {
      setFont(ctx, s, family, weight);
      const words = str.split(/\s+/);
      const lines = []; let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { lines.push(cur); cur = w; }
      }
      if (cur) lines.push(cur);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      if ((lines.length <= maxLines && widest <= maxW) || s <= minSize) return { lines, size: s };
      s *= 0.92;
    }
    return { lines: [str], size: s };
  }
  // Number count-up that keeps prefix/suffix/decimals ("$1.5M", "73%", "10,000+").
  function countUp(value, p) {
    const str = String(value ?? '');
    const m = str.match(/-?\d[\d,]*(\.\d+)?/);
    if (!m) return str;
    const raw = m[0];
    const num = parseFloat(raw.replace(/,/g, ''));
    const dec = m[1] ? m[1].length - 1 : 0;
    const cur = num * p;
    let out = cur.toFixed(dec);
    if (raw.includes(',')) out = Number(out).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return str.slice(0, m.index) + out + str.slice(m.index + raw.length);
  }

  // Offscreen canvas pool (reused between frames).
  const pool = {};
  function scratch(key, w, h) {
    let c = pool[key];
    if (!c) { c = pool[key] = document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    return [c, ctx];
  }
  function hexToRgb(h) {
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, k) { // k<0 darker, k>0 lighter
    const [r, g, b] = hexToRgb(hex);
    const f = c => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  window.BR = { E, clamp, seg, lerp, rng, hash, isRTL, resolveIcon, icon, iconPaths, strokeIcon, setFont, layoutText, countUp, scratch, hexToRgb, shade, roundRect, STYLES: {} };
})();
