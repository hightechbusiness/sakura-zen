#!/usr/bin/env node
// sakura-zen v2 - Designed by Martin Yu (c) 2026 - MIT License
// Statusline con pixel-art (medio bloque ▀ + truecolor).
// Sin estado: cada frame se calcula desde el reloj. Cada paisaje se "construye" por capas.
const H = parseInt(process.env.SAKURA_H, 10) || 6; // filas de terminal (2 pixeles por fila)
const SCENE_SECS = 50;
const BUILD_SECS = 26;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const ease = (t) => t * t * (3 - 2 * t);
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function makeCanvas(W, PH) {
  const buf = Array.from({ length: PH }, () => Array.from({ length: W }, () => [0, 0, 0]));
  const cv = {
    W, PH, buf,
    px(x, y, c, a = 1) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= PH || a <= 0) return;
      const p = buf[y][x];
      p[0] = lerp(p[0], c[0], a); p[1] = lerp(p[1], c[1], a); p[2] = lerp(p[2], c[2], a);
    },
    rect(x0, y0, x1, y1, c, a = 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cv.px(x, y, c, a); },
    disc(cx, cy, r, c, a = 1) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy)); if (d <= r) cv.px(x, y, c, a);
      }
    },
    glow(cx, cy, r, c, a = 1) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy); if (d <= r) cv.px(x, y, c, a * (1 - d / r) ** 2);
      }
    },
    gradient(top, bot, a = 1) { for (let y = 0; y < PH; y++) { const c = mix(top, bot, y / (PH - 1)); for (let x = 0; x < W; x++) cv.px(x, y, c, a); } },
    ridge(base, amp, freq, ph, c, bottom, a = 1) {
      for (let x = 0; x < W; x++) {
        const h = base - (Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 + ph * 1.7) * amp * 0.45);
        for (let y = Math.round(h); y <= bottom; y++) cv.px(x, y, c, a);
      }
    },
  };
  return cv;
}

// ---------- elementos reutilizables ----------
function petalsLayer(cv, t, tint) {
  const { W, PH } = cv;
  const n = Math.max(10, Math.floor(W / 4));
  for (let i = 0; i < n; i++) {
    const vx = 0.9 + hash(i) * 1.8, vy = 0.7 + hash(i + 50) * 0.8;
    const x = ((hash(i + 9) * W + t * vx + Math.sin(t * 0.8 + i) * 3) % W + W) % W;
    const y = (hash(i + 21) * (PH + 3) + t * vy) % (PH + 3) - 1;
    const flip = Math.sin(t * 2 + i * 1.7) > 0;
    const c = tint ? mix([255, 205, 220], tint, 0.35) : (i % 3 ? [255, 214, 226] : [250, 170, 200]);
    cv.px(x, y, c, 0.95);
    if (i % 3 === 0) cv.px(x + (flip ? 1 : -1), y, mix(c, [255, 255, 255], 0.2), 0.8);
  }
}

function branch(cv, a, t) {
  const { W } = cv;
  const len = Math.floor(28 * a);
  for (let i = 0; i < len; i++) {
    cv.px(W - 1 - i, 1 + i * 0.09 + Math.sin(i * 0.45) * 0.6, [78, 48, 52]);
    if (i % 7 === 4) { cv.px(W - 1 - i, 2 + i * 0.09, [78, 48, 52]); cv.px(W - 2 - i, 3 + i * 0.09, [78, 48, 52]); }
  }
  const cols = [[255, 190, 210], [255, 216, 230], [243, 150, 186]];
  for (let k = 0; k < 11; k++) {
    if (k / 11 > a) break;
    const sw = Math.sin(t * 0.9 + k) * 0.5;
    const bx = W - 3 - k * 2.5 + sw, by = 1 + k * 0.1 + (k % 2 ? 1.8 : -0.4);
    cv.rect(Math.round(bx), Math.round(by), Math.round(bx) + 2, Math.round(by) + 1, cols[k % 3], 0.95);
    cv.px(bx + 1, by + 2 + (k % 3 === 0 ? 1 : 0), cols[(k + 1) % 3], 0.8);
  }
}

function torii(cv, cx, wy, reflect, t) {
  const draw = (my) => {
    const Y = (y) => (my ? wy + (wy - y) : y);
    const a = my ? 0.4 : 1;
    const wob = my ? Math.round(Math.sin(t * 1.4 + Y(wy - 2)) * 0.6) : 0;
    for (let x = cx - 5; x <= cx + 5; x++) cv.px(x + wob, Y(wy - 5), [36, 28, 38], a);
    for (let y = wy - 4; y <= wy - 1; y++) { cv.px(cx - 3 + wob, Y(y), [206, 44, 48], a); cv.px(cx + 3 + wob, Y(y), [206, 44, 48], a); }
    for (let x = cx - 3; x <= cx + 3; x++) cv.px(x + wob, Y(wy - 3), [206, 44, 48], a);
  };
  draw(false); if (reflect) draw(true);
}

function water(cv, a, wy, t, deep) {
  const { W, PH } = cv;
  for (let y = wy; y < PH; y++) {
    const src = Math.max(0, wy - 1 - (y - wy));
    for (let x = 0; x < W; x++) {
      const sx = clamp(x + Math.round(Math.sin(y * 1.3 + t * 1.6 + x * 0.15) * 1), 0, W - 1);
      const s = cv.buf[src][sx];
      const c = mix(s, deep, 0.5);
      const glint = Math.sin(x * 0.7 + t * 2.2 + y) > 0.93 ? 0.35 : 0;
      cv.px(x, y, mix(c, [255, 240, 235], glint), a);
    }
  }
}

function clouds(cv, a, t) {
  for (let i = 0; i < 3; i++) {
    const len = 8 + Math.floor(hash(i + 3) * 8);
    const x0 = ((hash(i) * cv.W + t * (0.35 + i * 0.1)) % (cv.W + len)) - len;
    for (let k = 0; k < len; k++) cv.px(x0 + k, 2 + i, [255, 232, 228], 0.5 * a * (1 - Math.abs(k - len / 2) / (len / 2) * 0.5));
  }
}

// ---------- paisajes ----------
const SCENES = [
  {
    name: 'Fuji al amanecer',
    petalTint: null,
    items: [
      { at: -1, d: (cv, a, t, c) => cv.gradient([92, 96, 168], [255, 198, 164]) },
      { at: 0.04, d: (cv, a, t, c) => { const y = lerp(c.wy + 3, c.wy - 4, ease(clamp((t % 50) / 20))); cv.glow(c.W * 0.3, y, 9, [255, 170, 120], 0.5 * a); cv.disc(c.W * 0.3, y, 3, [255, 126, 86], a); } },
      { at: 0.12, d: (cv, a, t, c) => clouds(cv, a, t) },
      { at: 0.20, d: (cv, a, t, c) => cv.ridge(c.wy - 3.5, 1.6, 0.18, 1.2, [158, 138, 190], c.wy - 1, a) },
      { at: 0.30, d: (cv, a, t, c) => { // Fuji
        const cx = c.W * 0.58, top = 1, half0 = Math.min(26, c.W * 0.26);
        for (let y = top; y < c.wy; y++) {
          const tt = (y - top) / (c.wy - top), half = half0 * Math.pow(tt, 0.82) + 0.5;
          for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
            const side = (x - cx) / half;
            let col = mix([116, 124, 190], [76, 84, 148], tt); col = mix(col, [255, 255, 255], side < 0 ? 0.08 : -0.0);
            if (side > 0.1) col = mix(col, [50, 54, 110], 0.25 * side);
            if (tt < 0.34 + 0.07 * Math.sin(x * 1.2) + 0.05 * Math.sin(x * 2.9)) col = side > 0.25 ? [214, 206, 234] : [252, 244, 250];
            cv.px(x, y, col, a);
          }
        }
      } },
      { at: 0.45, d: (cv, a, t, c) => cv.ridge(c.wy - 1.5, 1.2, 0.3, 4, [62, 88, 120], c.wy - 1, a) },
      { at: 0.55, d: (cv, a, t, c) => water(cv, a, c.wy, t, [58, 76, 128]) },
      { at: 0.68, d: (cv, a, t, c) => { if (a > 0.5) torii(cv, Math.round(c.W * 0.16), c.wy, true, t); } },
      { at: 0.78, d: (cv, a, t, c) => branch(cv, a, t) },
    ],
  },
  {
    name: 'Pagoda bajo la luna',
    petalTint: [220, 220, 255],
    items: [
      { at: -1, d: (cv, a, t, c) => cv.gradient([6, 8, 34], [78, 48, 104]) },
      { at: 0.03, d: (cv, a, t, c) => { for (let i = 0; i < 34; i++) cv.px(hash(i) * c.W, hash(i + 70) * (c.PH * 0.6), [255, 255, 235], a * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i)))); } },
      { at: 0.08, d: (cv, a, t, c) => { cv.glow(c.W * 0.8, 3, 9, [200, 200, 255], 0.5 * a); cv.disc(c.W * 0.8, 3, 3, [250, 246, 220], a); cv.px(c.W * 0.8 + 1, 2, [226, 220, 190], a); } },
      { at: 0.18, d: (cv, a, t, c) => cv.ridge(c.PH - 4.5, 1.8, 0.16, 2, [34, 34, 82], c.PH - 1, a) },
      { at: 0.26, d: (cv, a, t, c) => cv.ridge(c.PH - 2.8, 1.2, 0.27, 5, [20, 24, 52], c.PH - 1, a) },
      ...[0, 1, 2, 3].map((k) => ({ at: 0.36 + k * 0.1, d: (cv, a, t, c) => {
        const cx = Math.round(c.W * 0.42), gy = c.PH - 2;
        const roofY = gy - 2 - 2 * k, bodyY = gy - 1 - 2 * k, rw = 7 - k, bw = 4 - Math.floor(k * 0.8);
        cv.rect(cx - rw, roofY, cx + rw, roofY, [124, 38, 50], a);
        cv.px(cx - rw - 1, roofY - 0, [124, 38, 50], a * 0.6); cv.px(cx + rw + 1, roofY, [124, 38, 50], a * 0.6);
        cv.rect(cx - bw, bodyY, cx + bw, bodyY, [66, 26, 38], a);
        cv.px(cx, bodyY, [255, 208, 104], a * (0.75 + 0.25 * Math.sin(t * 3 + k)));
        if (k === 3) { cv.px(cx, roofY - 1, [214, 172, 70], a); cv.px(cx, roofY - 2, [214, 172, 70], a); }
      } })),
      { at: 0.82, d: (cv, a, t, c) => { for (const k of [0.18, 0.72]) { const x = Math.round(c.W * k), y = c.PH - 4;
        cv.glow(x, y, 5, [255, 190, 90], 0.55 * a * (0.8 + 0.2 * Math.sin(t * 4 + k * 9))); cv.px(x, y, [255, 226, 150], a); cv.px(x, y + 1, [90, 60, 40], a); } } },
      { at: 0.90, d: (cv, a, t, c) => cv.rect(0, c.PH - 1, c.W - 1, c.PH - 1, [10, 14, 28], a) },
    ],
  },
  {
    name: 'Bosque de bambu',
    petalTint: [255, 235, 200],
    items: [
      { at: -1, d: (cv, a, t, c) => cv.gradient([255, 222, 168], [248, 156, 128]) },
      { at: 0.02, d: (cv, a, t, c) => cv.glow(c.W * 0.7, c.PH - 4, 14, [255, 240, 190], 0.6 * a) },
      { at: 0.06, d: (cv, a, t, c) => cv.rect(0, c.PH - 2, c.W - 1, c.PH - 1, [58, 92, 64], a) },
      ...Array.from({ length: 12 }, (_, i) => ({ at: 0.08 + i * 0.02, d: (cv, a, t, c) => stalk(cv, c, i, a, t, false) })),
      ...Array.from({ length: 8 }, (_, i) => ({ at: 0.40 + i * 0.04, d: (cv, a, t, c) => stalk(cv, c, i + 40, a, t, true) })),
      { at: 0.78, d: (cv, a, t, c) => { // farol de piedra
        const cx = Math.round(c.W * 0.62), gy = c.PH - 3, s = [128, 126, 138];
        cv.glow(cx, gy - 3, 5, [255, 210, 120], 0.5 * a * (0.85 + 0.15 * Math.sin(t * 3)));
        cv.rect(cx - 2, gy, cx + 2, gy, s, a); cv.rect(cx, gy - 1, cx, gy - 1, s, a);
        cv.rect(cx - 1, gy - 3, cx + 1, gy - 2, [255, 214, 128], a); cv.px(cx - 1, gy - 3, s, a); cv.px(cx + 1, gy - 3, s, a);
        cv.rect(cx - 2, gy - 4, cx + 2, gy - 4, [86, 84, 98], a); cv.px(cx, gy - 5, [86, 84, 98], a);
      } },
      { at: 0.90, d: (cv, a, t, c) => { for (let i = 0; i < 8; i++) { const x = hash(i + 5) * c.W + Math.sin(t * 0.6 + i) * 3, y = c.PH * 0.35 + hash(i + 9) * c.PH * 0.5 + Math.cos(t * 0.8 + i) * 1.5;
        cv.glow(x, y, 2, [255, 245, 150], a * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i)))); } } },
    ],
  },
];

function stalk(cv, c, i, a, t, front) {
  const x = Math.round(hash(i * 3 + 1) * c.W), gy = c.PH - 2;
  const col = front ? [48, 116, 66] : [150, 192, 140];
  const top = gy - Math.floor((gy + 1) * clamp(a));
  const sw = front ? 2 : 1;
  for (let y = gy; y >= top; y--) {
    const node = (gy - y) % 4 === 3;
    for (let k = 0; k < sw; k++) cv.px(x + k, y, node ? mix(col, [20, 50, 30], 0.5) : col);
  }
  if (a > 0.85) {
    const wv = Math.sin(t * 1.1 + i);
    for (let k = 1; k <= 3; k++) {
      cv.px(x + k + (wv > 0 ? 0 : -k * 2 - 1) * 1, top + (k > 1 ? 1 : 0) + 1, front ? [74, 150, 84] : [170, 208, 156]);
      cv.px(x - k + (wv > 0 ? 2 : 0), top + k, front ? [64, 138, 76] : [165, 204, 150], 0.9);
    }
  }
}

// ---------- color: truecolor, o 256 colores (Terminal.app de macOS no soporta truecolor) ----------
// Forzar: SAKURA_COLOR=256 | truecolor
const TRUECOLOR = process.env.SAKURA_COLOR
  ? process.env.SAKURA_COLOR === 'truecolor'
  : process.env.TERM_PROGRAM !== 'Apple_Terminal';
const to256 = ([r, g, b]) => {
  const q = (v) => Math.round((v / 255) * 5);
  return 16 + 36 * q(r) + 6 * q(g) + q(b);
};

// ---------- render ----------
function buildBuffer(now, W) {
  const PH = H * 2;
  const t = now / 1000;
  const idx = Math.floor(t / SCENE_SECS) % SCENES.length;
  const local = t % SCENE_SECS;
  const prog = clamp(local / BUILD_SECS);
  const scene = SCENES[idx];
  const cv = makeCanvas(W, PH);
  const ctx = { W, PH, wy: Math.round(PH * 0.75) };
  for (const it of scene.items) {
    const a = ease(clamp((prog - it.at) / 0.1));
    if (a > 0) it.d(cv, a, t, ctx);
  }
  petalsLayer(cv, t, scene.petalTint);
  // transicion: velo de petalos entre paisajes
  const wipe = Math.max(clamp((1.6 - local) / 1.6), clamp((local - (SCENE_SECS - 1.6)) / 1.6));
  if (wipe > 0) for (let y = 0; y < PH; y++) for (let x = 0; x < W; x++) cv.px(x, y, [255, 226, 236], wipe * 0.85);
  return { cv, scene, prog };
}

function render(data, now) {
  const cols = parseInt(process.env.COLUMNS, 10) || 80;
  const W = Math.max(30, Math.min(cols - 4, 110));
  const { cv, scene, prog } = buildBuffer(now, W);
  const lines = [];
  for (let r = 0; r < H; r++) {
    let out = '  ', last = '';
    for (let x = 0; x < W; x++) {
      const t = cv.buf[r * 2][x].map(Math.round), b = cv.buf[r * 2 + 1][x].map(Math.round);
      const key = t.join() + '|' + b.join();
      if (key !== last) {
        out += TRUECOLOR ? `\x1b[38;2;${t[0]};${t[1]};${t[2]};48;2;${b[0]};${b[1]};${b[2]}m`
          : `\x1b[38;5;${to256(t)};48;5;${to256(b)}m`;
        last = key;
      }
      out += '▀';
    }
    lines.push(out + '\x1b[0m');
  }
  const model = data.model && data.model.display_name ? data.model.display_name : 'Claude';
  const pct = data.context_window && data.context_window.used_percentage != null ? Math.round(data.context_window.used_percentage) : null;
  const cost = data.cost && data.cost.total_cost_usd != null ? data.cost.total_cost_usd : null;
  const n = Math.round(prog * 10);
  let info = `  🌸 \x1b[38;2;255;183;205m${scene.name}\x1b[0m \x1b[38;2;255;183;205m${'█'.repeat(n)}\x1b[38;2;90;90;110m${'░'.repeat(10 - n)}\x1b[0m  ${model}`;
  if (pct != null) info += ` · ctx ${pct}%`;
  if (cost != null) info += ` · $${cost.toFixed(2)}`;
  if (!process.env.SAKURA_NO_SIGNATURE) info += ` \x1b[38;2;120;120;140m· designed by Martin Yu\x1b[0m`;
  lines.push(info);
  return lines.join('\n');
}

module.exports = { buildBuffer, render, SCENES, SCENE_SECS, BUILD_SECS };

if (require.main === module) {
  let raw = '', done = false;
  const run = () => {
    if (done) return; done = true;
    let data = {}; try { data = JSON.parse(raw || '{}'); } catch (_) {}
    process.stdout.write(render(data, Number(process.env.SAKURA_NOW) || Date.now()) + '\n');
  };
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', run);
  process.stdin.on('error', run);
  setTimeout(run, 400).unref();
}
