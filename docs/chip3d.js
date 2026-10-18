/* 3D IC viewer for the drawer close-up. Every package is built in code from the real outline in TTChips.PACK
   (chips.js: JEDEC / maker drawings, mm), so there are no model files and the 3D model, the drawing and the size shown
   always agree: a molded epoxy body with draft angle and soft edges, tin-plated leads of the right kind (gull-wing,
   J-lead, flat, through-hole), exposed tabs and heat slugs, solder balls, the pin-1 dimple, and the part number
   laser-marked on top. The chip lies in the drawer; drag turns it in your hand, it keeps the angle you leave it at
   (with inertia), and it renders only while something moves. Needs three.js r128 and chips.js. */
window.TTChip3D = (() => {
"use strict";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();     // colours are picked in sRGB, lighting works in linear
const spec = (name, pkg) => window.TTChips.spec(name, pkg);
const supports = (name, pkg) => !!spec(name, pkg);
const TAU = Math.PI * 2, DRAFT = Math.tan(7 * Math.PI / 180);

/* molded body: rounded rectangle with soft edges, drafted 7 degrees from the parting line (as from a real mold) */
function bodyGeo(s) {
  const bev = Math.min(.06, (s.h - s.so) * .12), r = Math.min(.14, s.bw * .05), w = s.bw - 2 * bev, d = s.bd - 2 * bev, hh = s.h - s.so;
  const sh = new THREE.Shape(), x = -w / 2, y = -d / 2;
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + d - r);
  sh.quadraticCurveTo(x + w, y + d, x + w - r, y + d); sh.lineTo(x + r, y + d); sh.quadraticCurveTo(x, y + d, x, y + d - r);
  sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(sh, {depth: Math.max(.02, hh - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4});
  const p = g.attributes.position, zp = clamp(s.zs, s.so, s.h) - s.so, t = s.draft === 0 ? 0 : DRAFT;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) + bev, inset = t * Math.abs(z - zp);
    p.setXYZ(i, p.getX(i) * (1 - inset / (s.bw / 2)), p.getY(i) * (1 - inset / (s.bd / 2)), z + s.so);
  }
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}
/* one lead pointing +x from the body edge (x = 0), as a ribbon of thickness t along a centre line, lw wide (local z) */
function ribbon(c, t, lw) {
  const top = [], bot = [];
  c.forEach((q, i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l * t / 2, ny = dx / l * t / 2; top.push([q[0] + nx, q[1] + ny]); bot.push([q[0] - nx, q[1] - ny]); });
  const sh = new THREE.Shape(); sh.moveTo(...top[0]); top.slice(1).forEach(q => sh.lineTo(...q)); bot.reverse().forEach(q => sh.lineTo(...q));
  const g = new THREE.ExtrudeGeometry(sh, {depth: lw, bevelEnabled: false, curveSegments: 1});
  g.translate(0, 0, -lw / 2); g.computeVertexNormals();
  return g;
}
const bez = (c, a, b, d, e, n) => new THREE.CubicBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(...b), new THREE.Vector2(...d), new THREE.Vector2(...e)).getPoints(n).slice(1).forEach(v => c.push([v.x, v.y]));
/* centre lines of the lead kinds */
function gullLine(s, out) {                                          // out of the body, bent down, foot flat on the board
  const k1 = Math.min(.3, out * .25), foot = Math.min(.8, out * .45), k2 = out - foot, y0 = s.zs, y1 = s.lt / 2, c = [[-.3, y0], [k1, y0]];
  bez(c, [k1, y0], [k1 + (k2 - k1) * .7, y0], [k1 + (k2 - k1) * .3, y1], [k2, y1], 14); c.push([out, y1]); return c;
}
function jLine(s, under) {                                           // PLCC / SMA: out, down the side, curled back under the body
  const o = s.out, y0 = s.zs, r = Math.min(.45, y0 * .35), c = [[-.3, y0], [o - r, y0]];
  bez(c, [o - r, y0], [o, y0], [o, y0], [o, y0 - r], 4); c.push([o, s.lt / 2 + r]);
  bez(c, [o, s.lt / 2 + r], [o, s.lt / 2], [o, s.lt / 2], [o - r, s.lt / 2], 4); c.push([o - under, s.lt / 2]); return c;
}
const flatLine = (s, out) => [[-.3, s.zs], [out, s.zs]];
function sipLine(s, odd) {                                           // through-hole legs; every other one has the forming jog
  if (!odd) return [[-.3, s.zs], [s.out, s.zs]];
  const c = [[-.3, s.zs], [1.4, s.zs]]; bez(c, [1.4, s.zs], [2.2, s.zs], [2, s.zs + s.jog], [2.8, s.zs + s.jog], 8); c.push([s.out, s.zs + s.jog]); return c;
}
/* the laser marking: part number, pin-1 dimple and the round ejector-pin marks, drawn on a transparent texture */
function markTexture(s, lines, top) {
  const W = 1024, H = Math.max(160, Math.round(W * top[1] / top[0])), px = W / top[0];
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  const dimple = (cx, cy, r, a) => { const g = x.createRadialGradient(cx - r * .25, cy - r * .3, r * .1, cx, cy, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.75, `rgba(0,0,0,${a * .7})`); g.addColorStop(.92, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  if (s.kind === "qfp" || s.kind === "plcc" || s.kind === "bga") { const R = Math.min(1.2, top[0] * .06) * px; dimple(R * 1.6, H - R * 1.6, Math.min(.45, top[0] * .025) * px, .55);
    [[W - R * 1.9, R * 1.9], [R * 1.9, R * 1.9], [W - R * 1.9, H - R * 1.9]].forEach(([a, b]) => { x.fillStyle = "rgba(255,255,255,.035)"; x.beginPath(); x.arc(a, b, R, 0, 7); x.fill(); }); }
  else if (s.kind === "sop" || s.kind === "qfn" || (s.kind === "sot" && s.bd > 2)) { const m = Math.min(top[0], top[1]), r = Math.min(.3, m * .055);   // small parts: small dimple
    dimple(r * 2.4 * px, H - r * 2.4 * px, r * px, .6);
    x.fillStyle = "rgba(255,255,255,.018)"; x.beginPath(); x.arc(W - r * 3 * px, r * 3 * px, r * 1.8 * px, 0, 7); x.fill(); }
  else if (s.kind === "diode") { x.fillStyle = "rgba(170,176,180,.75)"; x.fillRect(W * .08, 0, W * .1, H); }   // cathode band
  const maxLen = Math.max(...lines.map(l => l.length), 4), area = s.kind === "dpak" ? .55 : s.kind === "diode" ? .5 : .64;   // real markings are small next to the body
  const fs = Math.min(W * area / (maxLen * .6), H * .5 / (lines.length * 1.25), H * .2, 1.25 * px);
  x.font = `700 ${fs}px Consolas,"Courier New",monospace`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = "rgba(150,156,160,.85)"; x.shadowColor = "rgba(150,156,160,.3)"; x.shadowBlur = fs * .04;
  const cy = s.kind === "dpak" ? H * .56 : H / 2, lh = fs * 1.22, cx = s.kind === "diode" ? W * .58 : W / 2;
  lines.forEach((l, i) => x.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
  x.globalCompositeOperation = "destination-out"; x.shadowBlur = 0;   // laser grain: tiny gaps in the etched strokes
  for (let i = 0; i < W * H / 260; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .5})`; x.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6); }
  const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 8;
  return tx;
}
function noiseTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d"), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 40; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
}

function build(name, pkg) {
  const s = spec(name, pkg), grp = new THREE.Group(), disposables = [];
  const keep = o => (disposables.push(o), o);
  const bump = keep(noiseTexture());
  const mBody = keep(new THREE.MeshStandardMaterial({color: lin(0x16181a), roughness: .58, metalness: 0, envMapIntensity: .22, bumpMap: bump, bumpScale: .006}));
  const mTin = keep(new THREE.MeshStandardMaterial({color: lin(0xd8dbde), roughness: .3, metalness: 1}));
  const mCu = keep(new THREE.MeshStandardMaterial({color: lin(0xc9ccce), roughness: .42, metalness: 1}));   // tinned copper tab / slug, a little duller
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(keep(geo), mat); m.position.set(x, y, z); m.castShadow = true; grp.add(m); return m; };
  const hx = s.bw / 2, hz = s.bd / 2;
  let ext = {x0: -hx, x1: hx, z0: -hz, z1: hz, y1: s.h}, top = null;   // footprint, for framing and for resting on the floor
  // body
  if (s.kind === "bga") {
    const sub = .36, cap = Object.assign({}, s, {bw: s.bw - 2.6, bd: s.bd - 2.6, so: s.so + sub, zs: s.so + sub});
    add(new THREE.BoxGeometry(s.bw, sub, s.bd), keep(new THREE.MeshStandardMaterial({color: lin(0x2e3a24), roughness: .65, metalness: 0, envMapIntensity: .3})), 0, s.so + sub / 2, 0);
    add(bodyGeo(cap), mBody); top = [cap.bw - .4, cap.bd - .4];
  } else if (s.kind === "sip") {
    const tb = s.tab, so = tb[2], body = Object.assign({}, s, {so, zs: s.zs});
    add(bodyGeo(body), mBody);
    const sh = new THREE.Shape(), w = tb[0] / 2, z0 = -hz - tb[1], z1 = hz - .6;   // the tab under the body, reaching out behind with its screw hole
    sh.moveTo(-w, z0 + .8); sh.quadraticCurveTo(-w, z0, -w + .8, z0); sh.lineTo(w - .8, z0); sh.quadraticCurveTo(w, z0, w, z0 + .8); sh.lineTo(w, z1); sh.lineTo(-w, z1); sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, z0 + tb[1] * .5, s.hole / 2, 0, TAU, true); sh.holes.push(hole);
    const tg = new THREE.ExtrudeGeometry(sh, {depth: so, bevelEnabled: false, curveSegments: 18}); tg.rotateX(Math.PI / 2); tg.translate(0, so, 0);
    add(tg, mCu); ext.z0 = z0; ext.x0 = Math.min(ext.x0, -w); ext.x1 = Math.max(ext.x1, w);
  } else add(bodyGeo(s), mBody);
  // leads: [x, z, rotationY, geometry key, width]; one instanced mesh per lead shape
  const L = [], geos = {};
  const lead = (key, line, lw) => { if (!geos[key]) geos[key] = {geo: ribbon(line, s.lt, lw), lw, list: []}; return geos[key]; };
  const push = (g, x, z, ry, w) => g.list.push([x, z, ry, w || g.lw]);
  if (s.kind === "sop" || s.kind === "qfp") {
    const g = lead("gull", gullLine(s, s.out), s.lw), per = s.kind === "sop" ? s.pins / 2 : s.side;
    for (let i = 0; i < per; i++) { const o = (i - (per - 1) / 2) * s.pitch; push(g, o, hz, -Math.PI / 2); push(g, o, -hz, Math.PI / 2);
      if (s.kind === "qfp") { push(g, hx, o, 0); push(g, -hx, o, Math.PI); } }
    ext.z0 -= s.out; ext.z1 += s.out; if (s.kind === "qfp") { ext.x0 -= s.out; ext.x1 += s.out; }
  } else if (s.kind === "plcc") {
    const g = lead("j", jLine(s, .9), s.lw);
    for (let i = 0; i < s.nx; i++) { const o = (i - (s.nx - 1) / 2) * s.pitch; push(g, o, hz, -Math.PI / 2); push(g, o, -hz, Math.PI / 2); }
    for (let i = 0; i < s.nz; i++) { const o = (i - (s.nz - 1) / 2) * s.pitch; push(g, hx, o, 0); push(g, -hx, o, Math.PI); }
    ext.x0 -= s.out; ext.x1 += s.out; ext.z0 -= s.out; ext.z1 += s.out;
  } else if (s.kind === "dpak" || s.kind === "sot") {
    const g = lead("main", s.flat ? flatLine(s, s.out) : gullLine(s, s.out), s.lw), stub = s.kind === "dpak" ? lead("stub", flatLine(s, .6), s.lw) : null;
    s.leads.forEach(l => push(l.cut ? stub : g, l.x, hz, -Math.PI / 2, l.w));
    (s.back || []).forEach(l => push(g, l.x, -hz, Math.PI / 2, l.w));
    ext.z1 += s.out; if ((s.back || []).length) ext.z0 -= s.out;
    if (s.tab) { const [tw, td, th] = s.tab;                           // exposed metal tab of DPAK / D2PAK at the back, flush with the board
      add(new THREE.BoxGeometry(tw, th, s.bd * .82 + td), mCu, 0, th / 2 - .003, -hz - td + (s.bd * .82 + td) / 2); ext.z0 -= td; }
  } else if (s.kind === "diode") {
    const g = lead("j", jLine(s, 1.2), s.lw); push(g, hx, 0, 0); push(g, -hx, 0, Math.PI); ext.x0 -= s.out; ext.x1 += s.out;
  } else if (s.kind === "sip") {
    const ge = lead("even", sipLine(s, false), s.lw), go = lead("odd", sipLine(s, true), s.lw);
    for (let i = 0; i < s.pins; i++) push(i % 2 ? go : ge, (i - (s.pins - 1) / 2) * s.pitch, hz, -Math.PI / 2);
    ext.z1 += s.out; ext.y1 = Math.max(ext.y1, s.zs + s.jog);
  } else if (s.kind === "qfn") {                                       // pads on the bottom edge, flush with the sides
    const pg = keep(new THREE.BoxGeometry(s.pad, .06, s.lw)), list = [];
    for (let i = 0; i < s.side; i++) { const o = (i - (s.side - 1) / 2) * s.pitch;
      list.push([o, hz - s.pad / 2 + .01, Math.PI / 2], [o, -hz + s.pad / 2 - .01, Math.PI / 2], [hx - s.pad / 2 + .01, o, 0], [-hx + s.pad / 2 - .01, o, 0]); }
    const im = new THREE.InstancedMesh(pg, mTin, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    list.forEach(([x, z, ry], i) => { q.setFromAxisAngle(up, ry); m.compose(new THREE.Vector3(x, .028, z), q, one); im.setMatrixAt(i, m); }); grp.add(im);
  } else if (s.kind === "bga") {                                       // solder balls: perimeter rings plus the centre block
    const n = s.grid, c0 = (n - s.core) / 2, pos = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const ring = Math.min(i, j, n - 1 - i, n - 1 - j) < s.rings, core = i >= c0 && i < c0 + s.core && j >= c0 && j < c0 + s.core;
      if (ring || core) pos.push([(i - (n - 1) / 2) * s.pitch, (j - (n - 1) / 2) * s.pitch]); }
    const bg = keep(new THREE.SphereGeometry(s.ball / 2, 10, 7)), im = new THREE.InstancedMesh(bg, mTin, pos.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, .82, 1);
    pos.forEach(([x, z], i) => { m.compose(new THREE.Vector3(x, s.ball * .41, z), q, sc); im.setMatrixAt(i, m); }); im.castShadow = true; grp.add(im);
  }
  Object.values(geos).forEach(({geo, lw, list}) => { if (!list.length) return;
    const im = new THREE.InstancedMesh(keep(geo), mTin, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach(([x, z, ry, w], i) => { q.setFromAxisAngle(up, ry); m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, w / lw)); im.setMatrixAt(i, m); });
    im.castShadow = true; grp.add(im); });
  if (s.ep) add(new THREE.BoxGeometry(s.ep[0], .05, s.ep[1]), mCu, 0, s.so > .04 ? s.so - .02 : .02, 0);   // exposed pad / heat slug, seen when you flip it
  // marking sits on the (drafted, so slightly smaller) top face; on TSOP it reads along the long side
  if (!top) { const ti = DRAFT * Math.max(0, s.h - s.zs); top = [s.bw - 2 * ti - .12, s.bd - 2 * ti - .12]; }
  const rot = !!s.markRot, tt = rot ? [top[1], top[0]] : top;
  const lines = window.TTChips.marking(name);
  const mk = new THREE.Mesh(keep(new THREE.PlaneGeometry(...tt)), keep(new THREE.MeshStandardMaterial({map: keep(markTexture(s, lines.length ? lines : [String(name)], tt)), transparent: true, roughness: .9, metalness: 0, envMapIntensity: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2})));
  mk.rotation.set(-Math.PI / 2, 0, rot ? Math.PI / 2 : 0); mk.position.y = s.h + .004; grp.add(mk);
  // centre the whole footprint (tabs and leads included)
  const cx = (ext.x0 + ext.x1) / 2, cz = (ext.z0 + ext.z1) / 2; grp.position.set(-cx, 0, -cz);
  const box = {x0: ext.x0 - cx, x1: ext.x1 - cx, z0: ext.z0 - cz, z1: ext.z1 - cz, y1: ext.y1};
  return {grp, s, box, R: Math.hypot(Math.max(-box.x0, box.x1), Math.max(-box.z0, box.z1)), disposables};
}

/* mount into the drawer floor; returns destroy(). onReady fires after the first frame (the svg can fade out then) */
function mount(floor, p, pkg, onReady) {
  if (!supports(p.name, pkg)) return null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div"); wrap.className = "c3d";
  wrap.innerHTML = `<canvas tabindex="0" role="img" aria-label="مدل سه‌بعدی ${String(p.name).replace(/[<>&"]/g, "")}. با کشیدن یا کلیدهای جهت بچرخانید."></canvas>
    <span class="c3d-hint" aria-hidden="true">${matchMedia("(pointer:coarse)").matches ? "بکشید تا بچرخد · با دو انگشت زوم" : "بکشید تا بچرخد · اسکرول برای زوم"}</span><button class="c3d-reset" type="button" aria-label="برگرداندن به حالت اول" hidden>↺</button><span class="c3d-dim" aria-hidden="true"></span>`;
  floor.appendChild(wrap);
  const canvas = wrap.querySelector("canvas");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: "low-power"}); } catch (e) { wrap.remove(); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 400);
  // small studio for the tin reflections: soft boxes above and to the sides, dark room
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({color: 0x101412, side: THREE.BackSide})));
  [[16, 3, [0, 14, 3], 5], [3, 18, [-14, 3, 4], 3.2], [3, 18, [14, 2, -4], 2.2], [20, 1.4, [0, -2, 14], 1.6]].forEach(([w, h, pos, k]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(k, k, k * 1.02), side: THREE.DoubleSide})); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); });
  const pm = new THREE.PMREMGenerator(renderer), envTex = pm.fromScene(env, .03).texture; pm.dispose(); scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3a30, .35));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -.0004; scene.add(key, key.target);
  const {grp, s, box, R, disposables} = build(p.name, pkg);
  const holder = new THREE.Group(), spin = new THREE.Group(); spin.add(grp); holder.add(spin); scene.add(holder);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(R * 8, R * 8), new THREE.ShadowMaterial({opacity: .42})); shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; scene.add(shadowFloor);
  key.position.set(-R * 1.2, R * 3.2, R * 1.6); const sc = key.shadow.camera; sc.left = sc.bottom = -R * 1.6; sc.right = sc.top = R * 1.6; sc.near = .1; sc.far = R * 8; sc.updateProjectionMatrix();
  const fmt = v => (Math.round(v * 100) / 100).toString();
  wrap.querySelector(".c3d-dim").textContent = `${s.label} · ${fmt(s.bw)} × ${fmt(s.bd)} mm · ${s.pins} پایه`;

  // turning works like a trackball in screen space: wherever you drag, the chip follows the finger in that direction.
  // The release speed carries on and fades; the lowest corner is kept on the drawer floor (it lands, never sinks);
  // wheel / trackpad pinch / two-finger pinch zoom the camera, eased.
  const Q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.42);
  spin.quaternion.copy(Q0);
  const corners = []; for (const x of [box.x0, box.x1]) for (const y of [0, box.y1]) for (const z of [box.z0, box.z1]) corners.push(new THREE.Vector3(x, y, z));
  const tmp = new THREE.Vector3(), lowest = () => Math.min(...corners.map(c => tmp.copy(c).applyQuaternion(spin.quaternion).y));
  const st = {av: new THREE.Vector3(), lift: reduce ? 0 : R * 1.4, vl: 0, zoom: 1, zoomT: 1, drag: false, pinch: false, ret: false};
  let raf = 0, last = 0, ready = false, dead = false;
  const size = () => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); kick(); };
  const ro = new ResizeObserver(size); ro.observe(wrap);
  const qd = new THREE.Quaternion(), axis = new THREE.Vector3();
  const turn = (dx, dy, k) => {                                         // screen drag (px) -> rotation about the axis at right angles to it
    const a = Math.hypot(dx, dy) * k; if (a < 1e-6) return 0;
    axis.set(dy, dx, 0).normalize().applyQuaternion(camera.quaternion);
    spin.quaternion.premultiply(qd.setFromAxisAngle(axis, a)); return a;
  };
  function frame(now) {
    raf = 0; if (dead) return;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (st.ret) { spin.quaternion.slerp(Q0, 1 - Math.exp(-dt * 7)); st.av.set(0, 0, 0);   // eases home, no jump
      if (spin.quaternion.angleTo(Q0) < .002) { spin.quaternion.copy(Q0); st.ret = false; } }
    else if (!st.drag && !st.pinch) { const w = st.av.length();
      if (w > .01) { spin.quaternion.premultiply(qd.setFromAxisAngle(tmp.copy(st.av).divideScalar(w), w * dt)); st.av.multiplyScalar(Math.exp(-dt * (reduce ? 30 : 3.2))); } else st.av.set(0, 0, 0); }
    st.zoom += (st.zoomT - st.zoom) * (1 - Math.exp(-dt * 12));
    const want = -lowest() + (st.drag ? R * .12 : 0);                    // lift so the lowest corner rests on the floor
    st.vl += (want - st.lift) * 90 * dt - st.vl * 13 * dt; st.lift += st.vl * dt;
    if (st.lift < want && !st.drag) { st.lift = want; st.vl = Math.max(0, st.vl); }   // never through the floor
    holder.position.y = st.lift;
    const d = R / Math.tan(camera.fov * Math.PI / 360) * .9 / Math.min(1, camera.aspect * .95) * st.zoom, el = .92;
    const cy = st.lift * .85 + R * .08;                                   // the camera follows the chip up when it is turned on edge
    camera.position.set(Math.sin(.18) * d * Math.cos(el), d * Math.sin(el) + cy, Math.cos(.18) * d * Math.cos(el)); camera.lookAt(0, cy, 0);
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady && onReady(); }
    const moving = st.drag || st.pinch || st.ret || st.av.lengthSq() > 1e-4 || Math.abs(st.lift - want) > .0008 || Math.abs(st.vl) > .002 || Math.abs(st.zoom - st.zoomT) > .001;
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  const resetBtn = wrap.querySelector(".c3d-reset");
  const touched = () => { wrap.classList.add("used"); resetBtn.hidden = false; };
  const zoomBy = f => { st.zoomT = clamp(st.zoomT * f, .45, 1.8); touched(); kick(); };
  // pointers: one drags (turns), two pinch (zoom). Captured on the canvas, so a drag that leaves it keeps going.
  const pts = new Map(); let px = 0, py = 0, pt = 0, pinch0 = 0, zoom0 = 1;
  const gap = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  canvas.addEventListener("pointerdown", e => { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); st.ret = false; st.av.set(0, 0, 0); touched();
    if (pts.size === 2) { st.drag = false; st.pinch = true; pinch0 = gap(); zoom0 = st.zoomT; }
    else if (pts.size === 1) { st.drag = true; px = e.clientX; py = e.clientY; pt = performance.now(); }
    kick(); });
  canvas.addEventListener("pointermove", e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (st.pinch && pts.size >= 2) { st.zoomT = clamp(zoom0 * pinch0 / gap(), .45, 1.8); kick(); return; }
    if (!st.drag) return;
    const now = performance.now(), dt = Math.max(8, now - pt) / 1000, k = 5.2 / Math.max(160, wrap.clientWidth);
    const a = turn(e.clientX - px, e.clientY - py, k);
    if (a) st.av.lerp(tmp.copy(axis).multiplyScalar(a / dt), .5);
    px = e.clientX; py = e.clientY; pt = now; kick(); });
  const up = e => { if (!pts.delete(e.pointerId)) return;
    if (st.pinch) { st.pinch = false; if (pts.size === 1) { const [p] = pts.values(); st.drag = true; px = p.x; py = p.y; pt = performance.now(); } }   // one finger left: keep turning with it
    else if (!pts.size) { st.drag = false; if (performance.now() - pt > 90) st.av.set(0, 0, 0); if (st.av.length() > 14) st.av.setLength(14); }
    kick(); };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0015))); }, {passive: false});   // ctrl+wheel = trackpad pinch
  canvas.addEventListener("keydown", e => { const a = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
    if (a) { e.preventDefault(); st.ret = false; axis.set(a[1], a[0], 0).normalize().applyQuaternion(camera.quaternion); st.av.addScaledVector(axis, 2.2); touched(); kick(); }
    else if (e.key === "+" || e.key === "=") zoomBy(.85); else if (e.key === "-") zoomBy(1 / .85);
    else if (e.key === "0" || e.key === "Home") { st.ret = true; st.zoomT = 1; kick(); } });
  canvas.addEventListener("dblclick", () => { st.ret = true; st.zoomT = 1; kick(); });
  resetBtn.addEventListener("click", () => { st.ret = true; st.zoomT = 1; kick(); });
  size(); kick();
  return () => {
    dead = true; cancelAnimationFrame(raf); ro.disconnect();
    disposables.forEach(o => o.dispose && o.dispose()); shadowFloor.geometry.dispose(); shadowFloor.material.dispose(); envTex.dispose();
    env.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
    renderer.dispose(); renderer.forceContextLoss(); wrap.remove();
  };
}
return {mount, supports, spec, build};
})();
