/* 3D soldering-tip lineup. Tips are turned on a lathe in code (no model files to download),
   lit by a small generated studio for metal reflections. Renders only while its section is on screen. */
window.TipLineup = (() => {
"use strict";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
// lathe profile per tip type: radius over length (1 unit = 10 mm)
const SPEC = {
  b: {end: 4.05, r: u => lerp(.22, .045, 1 - Math.pow(1 - u, 1.6)), cap: .045},
  i: {end: 4.4,  r: u => lerp(.22, .018, Math.pow(u, .75)), cap: .018},
  k: {end: 3.95, r: () => .215, cap: .215},
  d: {end: 3.95, r: u => lerp(.22, .17, u), cap: .17},
  c: {end: 3.9,  r: () => .205, cap: .205},
};
function tipGeometry(type, seg) {
  const s = SPEC[type] || SPEC.b, P = [], add = (r, y) => P.push(new THREE.Vector2(Math.max(0, r), y));
  add(0, 1.3); add(.22, 1.3); add(.22, .02); add(.24, 0); add(.305, 0); add(.325, .03);        // hollow sleeve back
  for (let y = .15; y < 2.5; y += .25) add(.325, y);
  add(.325, 2.5); add(.312, 2.56);
  for (let t = 0; t <= 1.001; t += .125) add(lerp(.312, .22, t), 2.56 + .2 * t);                 // shoulder
  const y0 = 2.76;
  for (let y = y0; y < s.end; y += .02) add(s.r((y - y0) / (s.end - y0)), y);
  for (let a = 0; a <= 90; a += 7.5) { const q = a * Math.PI / 180; add(s.cap * Math.cos(q), s.end + s.cap * Math.sin(q) * .85); }
  const g = new THREE.LatheGeometry(P, seg);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), tin = s.end - .55;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const yo = y;
    if (type === "d" && y > 3.1) { const t = lerp(.21, .035, clamp((y - 3.1) / .9, 0, 1)); x = clamp(x, -t, t); }
    if (type === "k" && y > 2.95) { const t = lerp(.22, .04, clamp((y - 2.95) / .3, 0, 1)); x = clamp(x, -t, t);
      const k = 1.15, c = 3.98, sv = y + k * z; if (sv > c) { const d = (sv - c) / (1 + k * k); y -= d; z -= d * k; } }
    if (type === "c") { const c = 3.72, sv = y + x; if (sv > c) { const d = (sv - c) / 2; x -= d; y -= d; } }
    pos.setXYZ(i, x, y, z);
    col.set(yo < 2.52 ? [.93, .94, .96] : yo < tin ? [.5, .51, .53] : [1, 1, 1], i * 3);   // chrome sleeve / iron body / tinned end
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); g.translate(0, -2.2, 0);
  return g;
}

function mount(sec, ids, onIndex) {
  const canvas = sec.querySelector("#tips3d");
  const narrowMQ = matchMedia("(max-width:860px)");
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrowMQ.matches ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, .1, 100);

  // studio: dark room, white softboxes, one copper strip that tints the metal toward the brand
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({color: 0x08140e, side: THREE.BackSide})));
  const box = (w, h, p, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: c, side: THREE.DoubleSide})); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m); };
  box(14, 3, [0, 10, 2], new THREE.Color(5, 5, 5));
  box(3, 16, [-10, 1, 4], new THREE.Color(3.2, 3.5, 3.3));
  box(3, 16, [10, 0, -3], new THREE.Color(2, 2.3, 2.1));
  box(18, 1.2, [0, -4, 10], new THREE.Color(1.4, 1.6, 1.5));
  box(10, 1, [0, -2, -10], new THREE.Color(2.4, 1.2, .35));
  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(env, .02).texture; scene.environment = envTex; pm.dispose();

  const mat = new THREE.MeshStandardMaterial({vertexColors: true, metalness: 1, roughness: .24, envMapIntensity: 1.25, side: THREE.DoubleSide});
  const GAP = narrowMQ.matches ? 6 : 7.5;
  const items = ids.map((id, i) => {
    const holder = new THREE.Group(), spin = new THREE.Group(), mesh = new THREE.Mesh(tipGeometry(id, narrowMQ.matches ? 56 : 84), mat);
    spin.add(mesh); holder.add(spin); holder.position.x = -i * GAP; holder.rotation.z = 2.25; holder.rotation.x = .18;
    scene.add(holder); return {holder, spin, mesh};
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "varying vec2 v;void main(){float d=length(v-.5)*2.;float a=.2*smoothstep(1.,0.,d);gl_FragColor=vec4(vec3(.79,.51,.22)*a,a);}"}));
  glow.position.z = -2; scene.add(glow);

  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = false, running = false, dead = false, f = 0, last = performance.now(), shown = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !running && !dead) { running = true; last = performance.now(); requestAnimationFrame(loop); } }, {rootMargin: "100px"});
  io.observe(sec);
  const progress = () => { const span = sec.offsetHeight - innerHeight; return span > 0 ? clamp((scrollY - sec.offsetTop) / span, 0, 1) : 0; };

  function loop(now) {
    if (!visible || dead) { running = false; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const fT = progress() * (ids.length - 1);
    f += (fT - f) * (reduce ? 1 : 1 - Math.exp(-dt * 6));
    const idx = clamp(Math.round(f), 0, ids.length - 1); if (idx !== shown) { shown = idx; onIndex(idx); }
    const x = -f * GAP, narrow = camera.aspect < 1;
    // frame the tip (bounding radius ~2.4) from the real screen shape: on phones the horizontal field is the
    // tight one, so the camera backs off until the whole tip fits; it sits in the free band above the info card
    const R = 2.4, tv = Math.tan(camera.fov * Math.PI / 360), th = tv * camera.aspect * (narrow ? 1 : .55);   // desktop: tip uses the left ~55%
    const dist = Math.max(narrow ? 0 : 10.5, R * 1.25 / Math.min(tv, th) * Math.cos(Math.atan(Math.min(tv, th))));
    const visH = 2 * dist * tv, off = narrow ? 0 : 2.2, lift = narrow ? -visH * .13 : 0;                   // phones: tip ~13% above centre
    camera.position.set(x + off, lift + 1.1, dist); camera.lookAt(x + off, lift, 0);
    const t = reduce ? 0 : now;
    items.forEach((it, i) => {
      const d = f - i, near = Math.max(0, 1 - Math.abs(d));
      it.spin.rotation.y = t * .00035 + d * 2.2;
      it.holder.rotation.z = 2.25 + d * .25;
      it.holder.scale.setScalar(.82 + .18 * near);
      it.holder.position.y = reduce ? 0 : Math.sin(now * .0009 + i) * .06;
    });
    glow.position.x = x;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  return {destroy() {
    dead = true; io.disconnect(); removeEventListener("resize", resize);
    items.forEach(it => it.mesh.geometry.dispose()); mat.dispose(); envTex.dispose(); renderer.dispose();
  }};
}
return {mount};
})();
