/* Living PCB background for the «ویترین» look.
   Three layers of a procedurally routed circuit board (inner layer, main layer, top copper) are drawn once into
   offscreen canvases and slide at different speeds when the page scrolls, so the board reads as having depth; on
   desktop the pointer adds a small eased tilt. Now and then a pulse of current runs along a trace, and once in a
   while it ends in a small spark at a pad. Redraws only while something moves; stops in hidden tabs; still under
   reduced motion; skipped on data-saver / very weak devices. Follows the light/dark theme.
   Seen, but never in the way:
   - a pulse only runs on a stretch of trace that is really visible: in the window, below the header, and not
     covered by cards or text (checked against the page itself just before each pulse);
   - the first one comes right after arrival (and after moving to another page), slightly larger;
   - it moves smoothly and fades in and out; nothing flashes faster than 3 times a second (WCAG 2.3.1);
   - the longer someone stays, the calmer it gets; it waits while they type or a dialog is open, slows down when
     they are inactive, stops after 5 idle minutes, and comes back soon when they return;
   - it can be switched off (footer button, remembered), as auto-moving content must be (WCAG 2.2.2). */
window.TTBoard = (() => {
"use strict";
const TILE_H = 1100, PAD = 24;                                         // layers repeat every TILE_H px; PAD keeps edges covered while tilting
const LAYERS = [{depth: .18, step: 44, buses: 5, singles: 8, w: 6, blur: 1.4, alpha: .55, parts: 0},
                {depth: .45, step: 22, buses: 7, singles: 16, w: 3.2, blur: 0, alpha: 1, parts: 9},
                {depth: .85, step: 36, buses: 1, singles: 4, w: 5, blur: 0, alpha: .9, parts: 0}];
const PAL = {
  light: {base: ["#E2EBE0", "#D5E1D3"], edge: "#B4C7B0", trace: "#F3F8F2", pad: "#C98238", padEdge: "#A86A2C", hole: "#3C4A41", silk: "rgba(255,255,255,.85)", far: "#CAD8C6",
          pulse: [255, 140, 30], glow: .8, wash: "rgba(255,255,255,.55)"},
  dark:  {base: ["#0C1F16", "#08150F"], edge: "#06120C", trace: "#143A27", pad: "#B7773A", padEdge: "#7E4F22", hole: "#030806", silk: "rgba(220,240,228,.28)", far: "#0F281C",
          pulse: [110, 255, 190], glow: 1, wash: "rgba(98,213,158,.07)"}};
let cv, ctx, W = 0, H = 0, dpr = 1, tiles = [], paths = [], pal, raf = 0, last = 0, alive = false, reduce = false, hidden = false;
let wake = 0, off = [0, 0, 0], px = 0, pxT = 0, pulses = [], sparks = [], nextPulse = 0;
let t0 = 0, lastAct = 0, lastEnd = 0, intro = true, fx = true, waiting = false;
const FX_KEY = "tt-fx";
try { fx = localStorage.getItem(FX_KEY) !== "off"; } catch (e) {}
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/* router: walks on a grid of `step`, mostly straight with occasional 45° bends, never crossing earlier traces */
function route(r, cols, rows, occ, minLen, maxLen) {
  for (let tries = 0; tries < 40; tries++) {
    let x = 1 + (r() * (cols - 2) | 0), y = 1 + (r() * (rows - 2) | 0); if (occ[y * cols + x]) continue;
    let d = (r() * 4 | 0) * 2, pts = [[x, y]], seen = new Set([y * cols + x]), len = maxLen * (.45 + r() * .55) | 0;
    for (let i = 0; i < len; i++) {
      if (r() < .16) d = (d + (r() < .5 ? 1 : 7)) % 8;                   // a 45° bend
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1], k = ny * cols + nx;
      if (nx < 1 || ny < 0 || nx >= cols - 1 || ny >= rows || occ[k] || seen.has(k)) break;
      x = nx; y = ny; seen.add(k); pts.push([x, y]);
    }
    if (pts.length < minLen) continue;
    seen.forEach(k => { occ[k] = 1; occ[k + 1] = 1; occ[k - 1] = 1; });
    return simplify(pts);
  }
  return null;
}
function simplify(p) { const o = [p[0]]; for (let i = 1; i < p.length - 1; i++) { const a = o[o.length - 1], b = p[i], c = p[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) o.push(b); } o.push(p[p.length - 1]); return o; }
/* a bus: the same route offset sideways (mitred corners), like data lines running together */
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const n1 = norm(i ? [p[0] - a[0], p[1] - a[1]] : [b[0] - p[0], b[1] - p[1]]), n2 = norm(i < pts.length - 1 ? [b[0] - p[0], b[1] - p[1]] : n1);
    let nx = -(n1[1] + n2[1]), ny = n1[0] + n2[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const m = 1 / Math.max(.5, (nx * -n1[1] + ny * n1[0]));       // mitre length
    return [p[0] + nx * d * m, p[1] + ny * d * m];
  });
}
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

function drawTile(L, li, theme) {
  const TW = W + 2 * PAD, c = document.createElement("canvas"); c.width = Math.ceil(TW * dpr); c.height = Math.ceil(TILE_H * dpr);
  const g = c.getContext("2d"); g.scale(dpr, dpr);
  const r = rng(1013 + li * 7919 + (W | 0)), s = L.step, cols = Math.ceil(TW / s) + 1, rows = Math.ceil(TILE_H / s), occ = new Uint8Array(cols * rows + cols + 2);
  const lines = [];
  for (let b = 0; b < L.buses; b++) { const p = route(r, cols, rows, occ, 6, 26); if (!p) continue; const n = 2 + (r() * 4 | 0); for (let k = 0; k < n; k++) lines.push(offset(p, (k - (n - 1) / 2) * .42)); }
  for (let i = 0; i < L.singles; i++) { const p = route(r, cols, rows, occ, 4, 18); if (p) lines.push(p); }
  const px = q => [q[0] * s, q[1] * s];
  if (L.blur) g.filter = `blur(${L.blur}px)`;
  g.lineCap = g.lineJoin = "round"; g.globalAlpha = L.alpha;
  const stroke = (pts, w, col) => { g.beginPath(); pts.forEach((q, i) => { const [x, y] = px(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  lines.forEach(p => stroke(p, L.w + 2.2, li === 0 ? theme.far : theme.edge));
  lines.forEach(p => stroke(p, L.w, li === 0 ? theme.far : theme.trace));
  if (li === 0) return {c, lines: []};
  // ends: vias (ring + drilled hole) or SMD pads
  const ends = [];
  lines.forEach(p => [p[0], p[p.length - 1]].forEach(q => ends.push(px(q))));
  ends.forEach(([x, y], i) => {
    if (i % 3 === 0) { g.fillStyle = theme.pad; g.fillRect(x - 4.5, y - 3.5, 9, 7); return; }
    g.beginPath(); g.arc(x, y, L.w + 2.6, 0, 7); g.fillStyle = theme.pad; g.fill(); g.lineWidth = 1; g.strokeStyle = theme.padEdge; g.stroke();
    g.beginPath(); g.arc(x, y, Math.max(1.6, L.w * .55), 0, 7); g.fillStyle = theme.hole; g.fill();
  });
  // a few footprints with silkscreen, on the main layer
  const refs = ["U", "R", "C", "Q", "D", "L"];
  for (let i = 0; i < L.parts; i++) {
    const x = PAD + 30 + r() * (W - 120), y = 30 + r() * (TILE_H - 120), kind = r();
    g.strokeStyle = theme.silk; g.fillStyle = theme.pad; g.lineWidth = 1.2;
    if (kind < .25) {                                                  // QFP footprint
      const b = 46 + r() * 30, n = 8; g.strokeRect(x, y, b, b);
      for (let k = 0; k < n; k++) { const t = 6 + k * (b - 12) / (n - 1);
        g.fillRect(x + t - 1.5, y - 9, 3, 7); g.fillRect(x + t - 1.5, y + b + 2, 3, 7); g.fillRect(x - 9, y + t - 1.5, 7, 3); g.fillRect(x + b + 2, y + t - 1.5, 7, 3); }
      g.beginPath(); g.arc(x + 7, y + 7, 2.2, 0, 7); g.stroke();
    } else if (kind < .55) {                                           // SOIC footprint
      const n = 4 + (r() * 4 | 0), len = n * 9; g.strokeRect(x, y, len, 22);
      for (let k = 0; k < n; k++) { g.fillRect(x + 3 + k * 9, y - 8, 4, 7); g.fillRect(x + 3 + k * 9, y + 23, 4, 7); }
    } else {                                                           // 0805 resistor / capacitor
      g.fillRect(x, y, 7, 9); g.fillRect(x + 15, y, 7, 9); g.strokeRect(x - 3, y - 3, 28, 15);
    }
    g.font = "600 10px Consolas,monospace"; g.fillStyle = theme.silk;
    g.fillText(refs[r() * refs.length | 0] + (1 + (r() * 40 | 0)), x, y - 12);
  }
  return {c, lines: lines.map(p => p.map(px)).filter(p => p.length > 1)};
}

function build() {
  const dark = document.documentElement.dataset.scheme === "dark"; pal = PAL[dark ? "dark" : "light"];
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight; cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr);
  tiles = LAYERS.map((L, i) => drawTile(L, i, pal));
  paths = [1, 2].flatMap(li => tiles[li].lines.map(p => ({p, li, L: len(p)}))).filter(o => o.L > 100);
  kick();
}
const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
function pointAt(p, d) { for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const t = d / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } d -= l; } return p[p.length - 1]; }

/* is the board really visible at this point of the window? Walks up from what is drawn there: anything with a
   solid background, a picture or an image of its own (cards, header, photos) hides the board. Cached per cell. */
const CELL = 28;
function freeMap() {
  const cells = new Map(), solid = new Map();
  const opaque = el => {
    if (solid.has(el)) return solid.get(el);
    let v = false;
    if (/^(IMG|VIDEO|SVG|PICTURE|IFRAME|INPUT|TEXTAREA|SELECT|BUTTON|A|LABEL|H[1-6]|P|LI|DT|DD)$/i.test(el.tagName) || (el.tagName === "CANVAS" && el !== cv)) v = true;   // pictures, controls and text: never run behind them
    else if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) v = true;
    else { const s = getComputedStyle(el), m = /rgba?\(([^)]+)\)/.exec(s.backgroundColor), a = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : [0, 0, 0, 0];
      v = (a.length > 3 ? a[3] : 1) > .5 || s.backgroundImage !== "none"; }
    solid.set(el, v); return v; };
  const clear = (px, py) => {
    for (let el = document.elementFromPoint(px, py); el && el !== document.body && el !== document.documentElement; el = el.parentElement) { if (el === cv) return true; if (opaque(el)) return false; }
    return true; };
  return (x, y) => {                                                   // the cell's centre and corners must all be clear: a margin around text and cards
    const cx = x / CELL | 0, cy = y / CELL | 0, k = cx + "," + cy; if (cells.has(k)) return cells.get(k);
    const x0 = cx * CELL, y0 = cy * CELL, free = clear(x0 + CELL / 2, y0 + CELL / 2) && clear(x0 + 1, y0 + 1) && clear(x0 + CELL - 1, y0 + CELL - 1) && clear(x0 + CELL - 1, y0 + 1) && clear(x0 + 1, y0 + CELL - 1);
    cells.set(k, free); return free; };
}
/* start a pulse on the longest stretch of trace that is in the window, under the header and not covered */
function launch(now) {
  const ae = document.activeElement;
  if ((ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) || document.querySelector('[aria-modal="true"], dialog[open]')) { nextPulse = now + 2000; return; }   // reading / typing first
  const top = (() => { const hd = document.querySelector("header"); const r = hd && hd.getBoundingClientRect(); return r && r.bottom > 0 ? r.bottom + 6 : 6; })();
  const free = freeMap(), STEP = 14, MIN = W < 760 ? 90 : 170, runs = [];
  paths.forEach(({p, li, L}) => { const lx = px * LAYERS[li].depth * 14 - PAD, ly = off[li];   // main and top copper layers
    for (let rep = -1; rep <= 1; rep++) { let s0 = -1, best = null;
      for (let d = 0; d <= L + .1; d += STEP) { const [x, y] = pointAt(p, Math.min(d, L)), sx = x + lx, sy = y + ly + rep * TILE_H;
        const ok = sx > 10 && sx < W - 10 && sy > top && sy < H - 10 && free(sx, sy);
        if (ok && s0 < 0) s0 = d;
        if ((!ok || d + STEP > L + .1) && s0 >= 0) { const e = ok ? Math.min(d, L) : d - STEP; if (e - s0 >= MIN && (!best || e - s0 > best.d1 - best.d0)) best = {p, li, rep, d0: s0, d1: e, L}; s0 = -1; } }
      if (best) runs.push(best); } });
  if (!runs.length) { waiting = true; nextPulse = now + 1500; return; }   // board not in view (e.g. under the home hero): look again soon, or as soon as they scroll
  waiting = false;
  runs.forEach(r => { r.pad = r.L - r.d1 < STEP + 1; r.score = Math.min(r.d1 - r.d0, 520) + (r.pad ? 140 : 0); });
  runs.sort((a, b) => b.score - a.score);
  const r = intro ? runs[0] : runs[Math.random() * Math.min(4, runs.length) | 0];
  pulses.push({p: r.p, li: r.li, rep: r.rep, d0: r.d0, d1: r.d1, d: r.d0, hold: 0, v: 300 + Math.random() * 120, big: intro, spark: r.pad && (intro || Math.random() < .3)});
  intro = false; nextPulse = Infinity;                                 // the next one is booked when this one ends
}
/* calm gaps: short at first, longer the longer someone stays; slower when they are away, none after 5 idle minutes */
function gap(now) {
  const age = (now - t0) / 1000, idle = (now - lastAct) / 1000;
  if (idle > 300) return Infinity;
  const [a, b] = age < 40 ? [2600, 4200] : age < 180 ? [5500, 9000] : [9000, 15000];
  return (a + Math.random() * (b - a)) * (idle > 60 ? 2 : 1) * (W < 760 ? 1.25 : 1);
}
function act() {                                                       // any sign of the visitor: back after a quiet spell -> a pulse soon
  const now = performance.now(), quiet = now - Math.max(lastAct, lastEnd);
  lastAct = now;
  if (quiet > 20000 && !pulses.length && fx && !reduce) { nextPulse = Math.min(nextPulse, now + 900); clearTimeout(wake); wake = setTimeout(kick, 900); }
}
function frame(now) {
  raf = 0; if (!alive || hidden) return;
  const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
  const sy = scrollY; px += (pxT - px) * (1 - Math.exp(-dt * 4));      // eased pointer tilt
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, pal.base[0]); gr.addColorStop(1, pal.base[1]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  LAYERS.forEach((L, i) => {
    off[i] = -((sy * L.depth) % TILE_H); const x = px * L.depth * 14;
    for (let y = off[i] - TILE_H; y < H; y += TILE_H) if (y + TILE_H > 0) ctx.drawImage(tiles[i].c, x - PAD, y, W + 2 * PAD, TILE_H);
  });
  ctx.fillStyle = pal.wash; ctx.fillRect(0, 0, W, H);                  // a soft wash keeps text above it easy to read
  // current: a bright head running along a visible stretch of a copper trace, lighting the copper behind it
  if (!reduce && fx && now > nextPulse && !pulses.length && paths.length) launch(now);
  const lox = li => px * LAYERS[li].depth * 14 - PAD;                  // where a layer sits right now (scroll parallax + tilt)
  const [cr, cg, cb] = pal.pulse, dark = document.documentElement.dataset.scheme === "dark";
  ctx.globalCompositeOperation = dark ? "lighter" : "source-over"; ctx.lineCap = "butt"; ctx.lineJoin = "round";   // butt ends: the trail reads as one wire, not beads
  pulses = pulses.filter(u => {
    u.d = Math.min(u.d + u.v * dt, u.d1); if (u.d >= u.d1) u.hold += dt;
    const fade = Math.min(1, (u.d - u.d0) / 60) * (1 - Math.min(1, u.hold / .45)), g = pal.glow * fade, big = u.big ? 1.25 : 1;
    const ox = lox(u.li), y0 = off[u.li] + u.rep * TILE_H;
    // lit trace: the stretch just travelled glows and cools down behind the head
    const TR = 170 * big, segs = 14;
    for (let k = segs; k > 0; k--) { const da = Math.max(u.d0, u.d - TR * k / segs), db = Math.max(u.d0, u.d - TR * (k - 1) / segs); if (db <= da) continue;
      const [ax, ay] = pointAt(u.p, da), [bx, by] = pointAt(u.p, db), a = (1 - k / (segs + 1)) * g;
      ctx.beginPath(); ctx.moveTo(ax + ox, ay + y0); ctx.lineTo(bx + ox, by + y0);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${.22 * a})`; ctx.lineWidth = 9 * big; ctx.stroke();
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${.85 * a})`; ctx.lineWidth = 2.6 * big; ctx.stroke(); }
    // the head: coloured glow around a white-hot core
    const [hx, hy] = pointAt(u.p, u.d), x = hx + ox, y = hy + y0, R = 24 * big;
    const h = ctx.createRadialGradient(x, y, 0, x, y, R); h.addColorStop(0, `rgba(${cr},${cg},${cb},${.6 * g})`); h.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${g})`; ctx.beginPath(); ctx.arc(x, y, 4 * big, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,252,236,${fade})`; ctx.beginPath(); ctx.arc(x, y, 2.1 * big, 0, 7); ctx.fill();
    if (u.hold >= .45) { if (u.spark) sparks.push({li: u.li, at: [hx, hy + u.rep * TILE_H], t: 0, seed: Math.random() * 1e6});
      lastEnd = now; nextPulse = now + gap(now); return false; }
    return true;
  });
  // spark: a few short jagged arcs and a flash at the pad, gone in about a third of a second
  sparks = sparks.filter(s => {
    s.t += dt; const k = s.t / .34; if (k >= 1) return false;
    const r = rng(s.seed | 0), [sx, sy0] = s.at, a0 = 1 - k;
    for (let rep = -1; rep <= 1; rep++) { const x = sx + lox(s.li), y = sy0 + off[s.li] + rep * TILE_H; if (y < -30 || y > H + 30) continue;
      const fl = ctx.createRadialGradient(x, y, 0, x, y, 26); fl.addColorStop(0, `rgba(${cr},${cg},${cb},${.6 * a0 * pal.glow})`); fl.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,240,${a0})`; ctx.lineWidth = 1.3; ctx.lineCap = "round";
      for (let b = 0; b < 4; b++) { let ang = r() * 6.28, lx = x, ly = y; ctx.beginPath(); ctx.moveTo(lx, ly);
        for (let j = 0; j < 4; j++) { ang += (r() - .5) * 1.4; const st = (4 + r() * 6) * (.6 + k); lx += Math.cos(ang) * st; ly += Math.sin(ang) * st; ctx.lineTo(lx, ly); }
        ctx.stroke(); } }
    return true;
  });
  ctx.globalCompositeOperation = "source-over";
  const moving = Math.abs(pxT - px) > .002 || pulses.length || sparks.length;
  if (moving) raf = requestAnimationFrame(frame);
  else { last = 0; clearTimeout(wake); if (!reduce && fx && isFinite(nextPulse)) wake = setTimeout(kick, Math.max(60, nextPulse - performance.now())); }   // idle: sleep until the next pulse
}
function kick() { if (!raf && alive && !hidden) raf = requestAnimationFrame(frame); }
let rz = 0; const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 120) build(); else { H = innerHeight; cv.height = Math.ceil(H * dpr); kick(); } }, 150); };
let lastMove = 0;
const onScroll = () => { act(); if (waiting) nextPulse = Math.min(nextPulse, performance.now() + 250); kick(); };
const onPointer = e => { const t = performance.now(); if (t - lastMove > 400) { lastMove = t; act(); } if (e.pointerType !== "mouse") return; pxT = (e.clientX / W - .5) * 2; kick(); };
const onAct = () => act();
const onVis = () => { hidden = document.hidden; if (!hidden) { last = 0; act(); kick(); } };
const onTheme = () => { if (alive) build(); };
const onRoute = () => {                                                // a new page: one pulse to greet it, unless one ran just now
  const now = performance.now(); act();
  if (fx && !reduce && !pulses.length && now - lastEnd > 5000) { nextPulse = now + 800; clearTimeout(wake); wake = setTimeout(kick, 800); } };
/* footer switch: the visitor can stop the moving current (the board itself stays); remembered on this device */
function setFx(on) {
  fx = !!on; try { localStorage.setItem(FX_KEY, fx ? "on" : "off"); } catch (e) {}
  if (!fx) { pulses = []; sparks = []; clearTimeout(wake); } else { nextPulse = performance.now() + 500; }
  kick(); paintFx();
}
function paintFx() { document.querySelectorAll("[data-fx]").forEach(b => { b.setAttribute("aria-pressed", String(fx)); const s = b.querySelector("b"); if (s) s.textContent = fx ? "روشن" : "خاموش"; }); }
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-fx]"); if (b) setFx(!fx); });
document.addEventListener("DOMContentLoaded", paintFx);

function start() {
  if (alive) return;
  const weak = (navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory || 8) <= 2;
  if (weak) return;
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  cv = document.createElement("canvas"); cv.className = "boardfx"; cv.setAttribute("aria-hidden", "true");
  ctx = cv.getContext("2d"); if (!ctx) return;
  document.body.prepend(cv); document.documentElement.classList.add("has-boardfx");
  alive = true; t0 = lastAct = performance.now(); lastEnd = 0; intro = true;
  nextPulse = t0 + 900; build();                                       // the first pulse greets the visitor almost at once
  addEventListener("resize", onResize); addEventListener("scroll", onScroll, {passive: true}); addEventListener("pointermove", onPointer, {passive: true});
  addEventListener("pointerdown", onAct, {passive: true}); addEventListener("keydown", onAct); addEventListener("hashchange", onRoute);
  document.addEventListener("visibilitychange", onVis); addEventListener("themechange", onTheme);
  paintFx();
}
function stop() {
  if (!alive) return; alive = false; cancelAnimationFrame(raf); raf = 0; clearTimeout(wake);
  removeEventListener("resize", onResize); removeEventListener("scroll", onScroll); removeEventListener("pointermove", onPointer);
  removeEventListener("pointerdown", onAct); removeEventListener("keydown", onAct); removeEventListener("hashchange", onRoute);
  document.removeEventListener("visibilitychange", onVis); removeEventListener("themechange", onTheme);
  cv.remove(); tiles = []; paths = []; pulses = []; sparks = []; document.documentElement.classList.remove("has-boardfx");
}
return {start, stop, setFx, get fx() { return fx; }};
})();
