// Scene templates (what a B-roll shows) + the base theme every style extends (how it looks).
// A template only lays things out and times them; every pixel goes through the theme.
(function () {
  const { E, clamp, seg, lerp, layoutText, setFont, strokeIcon, countUp, isRTL } = BR;

  const col = (S, c) => (c && S.pal[c]) || c || S.pal.ink;

  // ------------------------------------------------------------------ base theme
  const Base = {
    name: 'Base', fps: 30, pixel: 0,
    pal: { bg: '#101014', ink: '#ffffff', accent: '#ffcc33', accent2: '#ff4d6d', muted: '#9a9aa6', panel: '#1b1b22' },
    fonts: { title: '"Anton", "Cairo"', body: '"Cairo"', number: '"Anton", "Cairo"' },
    weights: { title: '900', body: '700', number: '900' },
    caps: true,
    bg(ctx, S) { ctx.fillStyle = S.pal.bg; ctx.fillRect(0, 0, S.W, S.H); },
    icon(ctx, S, name, x, y, s, p, o = {}) {
      if (p <= 0) return;
      ctx.strokeStyle = col(S, o.color || 'accent');
      strokeIcon(ctx, name, x, y, s, p, o.lw || 2.2);
    },
    // Draw one already-laid-out line of text, centered at x, baseline middle at y.
    drawLine(ctx, S, line, x, y, size, role, color, p) {
      ctx.globalAlpha *= E.outCubic(p);
      ctx.fillStyle = color;
      ctx.fillText(line, x, y + (1 - E.outCubic(p)) * size * 0.4);
    },
    text(ctx, S, str, x, y, size, p, o = {}) {
      if (p <= 0 || !str) return 0;
      const role = o.role || 'title';
      let s = String(str);
      if (this.caps && role !== 'body' && !isRTL(s)) s = s.toUpperCase();
      const fam = this.fonts[role] || this.fonts.title;
      const wt = this.weights[role] || '';
      const L = layoutText(ctx, s, o.maxW || S.W * 0.84, size, fam, wt, o.lines || 2, size * 0.35);
      ctx.save();
      setFont(ctx, L.size, fam, wt);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.direction = isRTL(s) ? 'rtl' : 'ltr';
      const lh = L.size * (this.lineHeight || 1.12);
      const y0 = y - (L.lines.length - 1) * lh / 2;
      L.lines.forEach((ln, i) => {
        ctx.save();
        const pk = clamp(p * (1 + 0.3 * (L.lines.length - 1)) - i * 0.3);
        this.drawLine(ctx, S, ln, x, y0 + i * lh, L.size, role, col(S, o.color || (role === 'body' ? 'muted' : 'ink')), pk);
        ctx.restore();
      });
      ctx.restore();
      return L.lines.length * lh;
    },
    arrow(ctx, S, x1, y1, x2, y2, p, o = {}) {
      if (p <= 0) return;
      const x = lerp(x1, x2, p), y = lerp(y1, y2, p);
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = col(S, o.color || 'muted');
      ctx.lineWidth = S.u * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x, y); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1), h = S.u * 2.6;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * h * .3, y + Math.sin(a) * h * .3);
      ctx.lineTo(x - Math.cos(a - .5) * h, y - Math.sin(a - .5) * h);
      ctx.lineTo(x - Math.cos(a + .5) * h, y - Math.sin(a + .5) * h); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
    bar(ctx, S, x, y, w, h, p, o = {}) {
      if (p <= 0) return;
      ctx.fillStyle = col(S, o.color || 'accent');
      ctx.fillRect(x, y - h * p, w, h * p);
    },
    badge(ctx, S, x, y, r, label, p, o = {}) {
      if (p <= 0) return;
      const k = E.outBack(p);
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.fillStyle = col(S, o.color || 'accent');
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.pal.bg; setFont(ctx, r * 1.1, this.fonts.number, this.weights.number);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, r * 0.06);
      ctx.restore();
    },
    burst(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(S.t * 0.25);
      ctx.globalAlpha = 0.18 * p; ctx.fillStyle = S.pal.accent;
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * E.outCubic(p), -r * 0.12); ctx.lineTo(r * E.outCubic(p), r * 0.12); ctx.fill();
      }
      ctx.restore();
    },
    cross(ctx, S, x, y, r, p) {
      if (p <= 0) return;
      ctx.save(); ctx.strokeStyle = S.pal.accent2; ctx.lineWidth = S.u * 1.4; ctx.lineCap = 'round';
      const k = r * p;
      ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x - r + 2 * k, y - r + 2 * k);
      if (p > .5) { const k2 = r * 2 * (p - .5) * 2; ctx.moveTo(x + r, y - r); ctx.lineTo(x + r - k2, y - r + k2); }
      ctx.stroke(); ctx.restore();
    },
    post(ctx, S) { },
    // v: visibility 0..1; phase: 'in' | 'hold' | 'out'. Default: pop + fade.
    wrap(ctx, S, v, phase, draw) {
      if (v >= 1) return draw();
      ctx.save();
      ctx.globalAlpha = E.outCubic(v);
      const k = phase === 'in' ? lerp(0.86, 1, E.outBack(v)) : lerp(1.06, 1, v);
      ctx.translate(S.W / 2, S.H / 2); ctx.scale(k, k); ctx.translate(-S.W / 2, -S.H / 2);
      draw();
      ctx.restore();
    },
  };

  // ------------------------------------------------------------------ templates
  // Each gets (T theme, ctx, S state, c cue) and a local build clock b(a, z) in 0..1.
  const T_ = {};

  T_.concept = (T, ctx, S, c, b) => {
    const { W, u } = S, cx = W / 2, cy = S.cy;
    const ip = b(0.05, 0.5);
    const bob = Math.sin(S.t * 2.2) * u * 0.8 * ip;
    T.burst(ctx, S, cx, cy - 10 * u, 34 * u, b(0, 0.4));
    T.icon(ctx, S, c.icon || 'sparkles', cx, cy - 11 * u + bob, 38 * u * lerp(0.6, 1, E.outBack(ip)), ip, { color: 'accent' });
    const h = T.text(ctx, S, c.title, cx, cy + 20 * u, 10 * u, b(0.35, 0.75), { role: 'title', maxW: 86 * u });
    if (c.subtitle) T.text(ctx, S, c.subtitle, cx, cy + 22 * u + h * 0.5 + 6 * u, 5.2 * u, b(0.55, 0.95), { role: 'body', maxW: 80 * u, lines: 1 });
  };

  T_.stat = (T, ctx, S, c, b) => {
    const { W, u } = S, cx = W / 2, cy = S.cy;
    T.burst(ctx, S, cx, cy - 4 * u, 42 * u, b(0, 0.35));
    let ny = cy - 4 * u;
    if (c.icon) { T.icon(ctx, S, c.icon, cx, cy - 30 * u, 15 * u, b(0, 0.35), { color: 'accent2' }); ny = cy - 2 * u; }
    const pn = b(0.1, 0.75);
    T.text(ctx, S, countUp(c.value, E.outCubic(pn)), cx, ny, 27 * u, Math.min(1, pn * 3), { role: 'number', color: 'accent', maxW: 88 * u, lines: 1 });
    T.text(ctx, S, c.title, cx, ny + 22 * u, 7.5 * u, b(0.5, 0.9), { role: 'title', maxW: 84 * u });
  };

  T_.compare = (T, ctx, S, c, b) => {
    const { W, u } = S, cx = W / 2, cy = S.cy;
    const L = c.left || {}, R = c.right || {};
    const dx = 24 * u;
    if (c.title) T.text(ctx, S, c.title, cx, cy - 36 * u, 6.5 * u, b(0, 0.25), { role: 'title', maxW: 88 * u, lines: 1 });
    const lose = side => (c.winner && c.winner !== side) ? 0.45 : 1;
    const lp = b(0.08, 0.4), rp = b(0.42, 0.74), wp = b(0.8, 1);
    ctx.save(); ctx.globalAlpha *= lerp(1, lose('left'), wp);
    T.icon(ctx, S, L.icon || 'circle', cx - dx, cy - 6 * u, 24 * u, lp, { color: c.winner === 'left' ? 'accent' : (c.winner ? 'muted' : 'accent') });
    T.text(ctx, S, L.label, cx - dx, cy + 15 * u, 6 * u, b(0.25, 0.5), { role: 'title', maxW: 40 * u });
    ctx.restore();
    ctx.save(); ctx.globalAlpha *= lerp(1, lose('right'), wp);
    T.icon(ctx, S, R.icon || 'circle', cx + dx, cy - 6 * u, 24 * u, rp, { color: c.winner === 'right' ? 'accent' : (c.winner ? 'muted' : 'accent2') });
    T.text(ctx, S, R.label, cx + dx, cy + 15 * u, 6 * u, b(0.58, 0.82), { role: 'title', maxW: 40 * u });
    ctx.restore();
    T.text(ctx, S, c.vs || 'VS', cx, cy - 6 * u, 9 * u, b(0.36, 0.5), { role: 'number', color: 'accent2', lines: 1 });
    if (c.winner === 'left' || c.winner === 'right') {
      const sx = c.winner === 'left' ? cx - dx : cx + dx, ox = c.winner === 'left' ? cx + dx : cx - dx;
      T.icon(ctx, S, 'crown', sx, cy - 24 * u, 10 * u, wp, { color: 'accent' });
      T.cross(ctx, S, ox, cy - 6 * u, 9 * u, wp);
    }
  };

  T_.steps = (T, ctx, S, c, b) => {
    const { W, H, u } = S, cx = W / 2, cy = S.cy;
    const items = (c.items || []).slice(0, 4);
    const n = Math.max(1, items.length);
    const vertical = H > W * 1.3 && n > 2;
    let top = cy;
    if (c.title) { T.text(ctx, S, c.title, cx, cy - (vertical ? 52 : 34) * u, 6.5 * u, b(0, 0.2), { role: 'title', maxW: 88 * u, lines: 1 }); }
    const span = 0.85 / n;
    const pos = i => vertical
      ? [cx - 14 * u, top - 30 * u + i * (66 * u / Math.max(1, n - 1))]
      : [cx + (i - (n - 1) / 2) * (n > 3 ? 23 : 30) * u, top - 4 * u];
    items.forEach((it, i) => {
      const [x, y] = pos(i);
      const p = b(0.1 + i * span, 0.1 + (i + 0.8) * span);
      const isz = (n > 3 ? 14 : 17) * u;
      if (i > 0) {
        const [px, py] = pos(i - 1);
        const ap = b(0.1 + (i - 0.25) * span, 0.1 + (i + 0.05) * span);
        if (vertical) T.arrow(ctx, S, px, py + 9 * u, x, y - 9 * u, ap);
        else T.arrow(ctx, S, px + isz * 0.62, py, x - isz * 0.62, y, ap);
      }
      if (vertical) {
        T.icon(ctx, S, it.icon || 'circle-dot', x, y, isz, p, { color: i === n - 1 ? 'accent2' : 'accent' });
        T.badge(ctx, S, x - 12 * u, y - 7 * u, 3.4 * u, String(i + 1), p);
        ctx.save(); const lx = x + 26 * u;
        T.text(ctx, S, it.label, lx, y, 5.2 * u, b(0.1 + (i + .3) * span, 0.1 + (i + 1) * span), { role: 'title', maxW: 42 * u });
        ctx.restore();
      } else {
        T.icon(ctx, S, it.icon || 'circle-dot', x, y, isz, p, { color: i === n - 1 ? 'accent2' : 'accent' });
        T.badge(ctx, S, x - isz * 0.55, y - isz * 0.55, 3.4 * u, String(i + 1), p);
        T.text(ctx, S, it.label, x, y + 17 * u, (n > 3 ? 4.2 : 5) * u, b(0.1 + (i + .3) * span, 0.1 + (i + 1) * span), { role: 'title', maxW: (n > 3 ? 21 : 27) * u });
      }
    });
  };

  T_.trend = (T, ctx, S, c, b) => {
    const { W, u } = S, cx = W / 2, cy = S.cy;
    const up = c.direction !== 'down';
    const n = 5, bw = 9 * u, gap = 4.5 * u, total = n * bw + (n - 1) * gap;
    const x0 = cx - total / 2, base = cy + 14 * u, maxH = 38 * u;
    const hs = up ? [0.25, 0.4, 0.5, 0.72, 1] : [1, 0.78, 0.55, 0.42, 0.22];
    T.arrow(ctx, S, x0 - 4 * u, base, x0 + total + 6 * u, base, b(0, 0.2), { color: 'muted' });
    hs.forEach((h, i) => T.bar(ctx, S, x0 + i * (bw + gap), base - u * 0.6, bw, maxH * h, E.outCubic(b(0.12 + i * 0.08, 0.4 + i * 0.08)), { color: i === n - 1 ? (up ? 'accent' : 'accent2') : 'muted', i }));
    const ap = b(0.55, 0.85);
    const ax1 = x0 + bw / 2, ay1 = base - maxH * hs[0] - 6 * u, ax2 = x0 + total - bw / 2, ay2 = base - maxH * hs[n - 1] - 6 * u;
    T.arrow(ctx, S, ax1, ay1, ax2, ay2, ap, { color: up ? 'accent' : 'accent2' });
    if (c.value) T.text(ctx, S, c.value, cx, cy - 36 * u, 12 * u, b(0.6, 0.9), { role: 'number', color: up ? 'accent' : 'accent2', lines: 1 });
    T.text(ctx, S, c.title, cx, base + 12 * u, 6.5 * u, b(0.45, 0.85), { role: 'title', maxW: 86 * u });
  };

  T_.keyword = (T, ctx, S, c, b) => {
    const { W, u } = S, cx = W / 2, cy = S.cy;
    T.burst(ctx, S, cx, cy, 48 * u, b(0, 0.3));
    if (c.icon) T.icon(ctx, S, c.icon, cx, cy - 24 * u, 18 * u, b(0.3, 0.65), { color: 'accent2' });
    const p = b(0, 0.32);
    ctx.save();
    const k = lerp(1.7, 1, E.outBack(p));
    ctx.translate(cx, cy + (c.icon ? 6 : 0) * u); ctx.scale(k, k); ctx.translate(-cx, -cy - (c.icon ? 6 : 0) * u);
    T.text(ctx, S, c.title, cx, cy + (c.icon ? 6 : 0) * u, 17 * u, Math.min(1, p * 2), { role: 'number', color: 'accent', maxW: 88 * u, lines: 2 });
    ctx.restore();
    if (c.subtitle) T.text(ctx, S, c.subtitle, cx, cy + 26 * u, 5.4 * u, b(0.45, 0.85), { role: 'body', maxW: 80 * u });
  };

  // ------------------------------------------------------------------ frame driver
  const IN = 0.38, OUT = 0.32;
  function frame(T, ctx, S, cue) {
    const { t, D } = S;
    const build = Math.min(D * 0.62, 2.1);
    const b = (a, z) => seg(t, IN * 0.4 + a * build, IN * 0.4 + z * build);
    const vin = seg(t, 0, IN), vout = 1 - seg(t, D - OUT, D);
    const v = Math.min(vin, vout);
    const phase = vin < 1 ? 'in' : (vout < 1 ? 'out' : 'hold');
    const tpl = T_[cue.template] || T_.concept;
    T.wrap(ctx, S, v, phase, () => {
      T.bg(ctx, S);
      tpl(T, ctx, S, cue, b);
      T.post(ctx, S);
    });
  }

  function makeStyle(def) {
    const s = Object.assign(Object.create(Base), def);
    s.pal = Object.assign({}, Base.pal, def.pal || {});
    s.fonts = Object.assign({}, Base.fonts, def.fonts || {});
    s.weights = Object.assign({}, Base.weights, def.weights || {});
    BR.STYLES[def.id] = s;
    return s;
  }

  Object.assign(BR, { Base, TEMPLATES: T_, frame, makeStyle, col });
})();
