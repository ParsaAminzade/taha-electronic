/* Home hero as a real 3D scene (three.js r128), built on the depth cues that matter most:
   motion parallax (camera follows the pointer), occlusion (packs and letters overlap),
   cast + contact shadows on the pegboard, one key light with falloff, relative size (packs at
   several depths) and atmospheric fog. The CSS hero stays underneath as the fallback and only
   hides once the first 3D frame is drawn. */
window.Hero3D = (() => {
"use strict";
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
const PACK_W = 3, PACK_H = 3 * 318 / 176, HOLE = 0.055;            // hole sits 5.5% from the top of the card

/* ---------- textures drawn in code (nothing extra to download) ---------- */
function boardTextures(maxAniso) {
  const N = 512, cell = 32;                                         // 16 holes per tile
  const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, N); grd.addColorStop(0, "#2c3d34"); grd.addColorStop(1, "#24332b");
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .025})`; g.fillRect(Math.random() * N, Math.random() * N, 1, 1); }   // powder-coat speckle
  const b = document.createElement("canvas"); b.width = b.height = N; const h = b.getContext("2d");
  h.fillStyle = "#fff"; h.fillRect(0, 0, N, N);
  for (let y = cell / 2; y < N; y += cell) for (let x = cell / 2; x < N; x += cell) {
    g.fillStyle = "#06100b"; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
    g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y + .8, 6.3, .2, Math.PI - .2); g.stroke();
    const rg = h.createRadialGradient(x, y, 3, x, y, 8); rg.addColorStop(0, "#000"); rg.addColorStop(1, "#fff");
    h.fillStyle = rg; h.beginPath(); h.arc(x, y, 8, 0, 7); h.fill();
  }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; return t; };
  const map = mk(c); map.encoding = THREE.sRGBEncoding;
  return {map, bump: mk(b)};
}
function cardTexture(p, maxAniso) {                                  // drawn blister card for products without a photo
  return new Promise(res => {
    const W = 352, H = Math.round(352 * 318 / 176), c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const r = 22; g.beginPath(); g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.closePath();
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#fbfcfa"); bg.addColorStop(1, "#e3e9e1"); g.fillStyle = bg; g.fill();
    g.fillStyle = "#18201b"; g.beginPath(); g.ellipse(W / 2, H * HOLE, 34, 11, 0, 0, 7); g.fill();
    g.fillStyle = p.color || "#0E7A4B"; g.fillRect(0, H * .13, W, 54);
    g.fillStyle = "#fff"; g.font = "800 30px Vazirmatn, Tahoma, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p.code || "", W / 2, H * .13 + 28);
    g.fillStyle = "#14231b"; g.direction = "rtl"; g.font = "700 26px Vazirmatn, Tahoma, sans-serif";
    const words = (p.name || "").split(" "); let line = "", y = H * .86; const lines = [];
    for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > W - 40) { lines.push(line); line = w; } else line = t; } lines.push(line);
    lines.slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, y + i * 34));
    const done = () => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso; res(t); };
    const svg = window.TTPacks && window.TTPacks.ICO[p.ico];
    if (!svg) return done();
    const img = new Image(); img.onload = () => { g.drawImage(img, W * .12, H * .3, W * .76, W * .76 * .7); done(); }; img.onerror = done;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" '));
  });
}
function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

function mount(hero, opts) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.createElement("canvas"); canvas.className = "hero-gl"; canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const narrowMQ = matchMedia("(max-width:860px)");
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: "high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrowMQ.matches ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0A2A1C);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0A2A1C, 22, 46);                       // atmospheric depth: far board fades into the brand green
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 120);

  /* light: studio reflections for metal/plastic + one warm key spot with soft shadow + cool rim */
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({color: 0x081a12, side: THREE.BackSide})));
  const box = (w, h, p, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: c, side: THREE.DoubleSide})); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m); };
  box(14, 3, [0, 10, 4], new THREE.Color(4, 4, 4)); box(3, 14, [-10, 2, 6], new THREE.Color(2.6, 2.8, 2.6)); box(3, 14, [10, 0, 2], new THREE.Color(1.4, 1.7, 1.5)); box(10, 1, [0, -3, 10], new THREE.Color(2.2, 1.2, .4));
  const pm = new THREE.PMREMGenerator(renderer); const envTex = pm.fromScene(env, .03).texture; pm.dispose(); scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0xcfe8da, 0x0a1f15, .35));
  const key = new THREE.SpotLight(0xfff1df, 2.2, 70, .62, .85, 1.2);
  key.castShadow = true; key.shadow.mapSize.set(narrowMQ.matches ? 1024 : 2048, narrowMQ.matches ? 1024 : 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 6;
  key.shadow.camera.near = 8; key.shadow.camera.far = 50;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9fe3bf, .55); rim.position.set(14, 6, -4); scene.add(rim);

  /* pegboard */
  const bt = boardTextures(aniso); const BW = 64, BH = 36; bt.map.repeat.set(BW / 16, BH / 16); bt.bump.repeat.set(BW / 16, BH / 16);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({map: bt.map, bumpMap: bt.bump, bumpScale: .06, roughness: .78, metalness: .25}));
  board.receiveShadow = true; scene.add(board);

  /* hooks: rods from a hole, angled up a little, with a ball tip */
  const metal = new THREE.MeshStandardMaterial({color: 0xd9dfdc, metalness: 1, roughness: .22});
  const rodGeo = new THREE.CylinderGeometry(.075, .075, 2.6, 16); rodGeo.rotateX(Math.PI / 2); rodGeo.translate(0, 0, 1.3);
  const tipGeo = new THREE.SphereGeometry(.12, 16, 12), plateGeo = new THREE.CylinderGeometry(.22, .22, .06, 24); plateGeo.rotateX(Math.PI / 2);
  function hook(x, y) {
    const g = new THREE.Group(); g.position.set(x, y, 0); g.rotation.x = -.1;
    const rod = new THREE.Mesh(rodGeo, metal), tip = new THREE.Mesh(tipGeo, metal), plate = new THREE.Mesh(plateGeo, metal);
    tip.position.z = 2.6; plate.position.z = .03; [rod, tip, plate].forEach(m => { m.castShadow = true; m.receiveShadow = true; }); g.add(rod, tip, plate); scene.add(g); return g;
  }

  /* blister pack: printed card + raised clear plastic bubble */
  const cardGeo = new THREE.BoxGeometry(PACK_W, PACK_H, .04);
  const plastic = new THREE.MeshPhysicalMaterial({color: 0xffffff, metalness: 0, roughness: .06, transparent: true, opacity: .16, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 2.2, depthWrite: false});
  const bubbleGeo = new THREE.ExtrudeGeometry(roundedRect(PACK_W * .34, PACK_H * .58, .35), {depth: .05, bevelEnabled: true, bevelThickness: .26, bevelSize: .2, bevelSegments: 6, curveSegments: 10});
  const backMat = new THREE.MeshStandardMaterial({color: 0xe9eee8, roughness: .7});
  function pack(tex, withBubble) {
    const pivot = new THREE.Group();                                 // pivot = the hole, so it swings on the hook
    const front = new THREE.MeshStandardMaterial({map: tex, roughness: .55, metalness: 0});
    const card = new THREE.Mesh(cardGeo, [backMat, backMat, backMat, backMat, front, backMat]);
    card.position.y = -PACK_H * (.5 - HOLE); card.castShadow = true; card.receiveShadow = true; pivot.add(card);
    if (withBubble) { const bub = new THREE.Mesh(bubbleGeo, plastic); bub.position.set(PACK_W * .04, -PACK_H * (.5 - HOLE) - PACK_H * .06, .02); bub.renderOrder = 2; pivot.add(bub); }
    pivot.userData.card = card;
    return pivot;
  }
  const photoTex = new THREE.TextureLoader().load(opts.photo || "assets/tip-pack.png", t => { t.needsUpdate = true; draw(); });
  photoTex.encoding = THREE.sRGBEncoding; photoTex.anisotropy = aniso;

  /* layout: the hero pack hangs left of the copy (RTL: text sits on the right); other hooks fill the board */
  const L = {desk: {main: [-6.2, 2.4], cam: [-1.2, .2, 27], look: [-1.2, -.6, 0], text: [-6.2, 1.2]}, mob: {main: [0, 4.2], cam: [0, 1.2, 33], look: [0, -3.4, 0], text: [0, 3.0]}};
  const H = [hook(...L.desk.main)];
  const mainStack = [pack(photoTex, true), pack(photoTex, true), pack(photoTex, true)];
  mainStack.forEach((p, i) => { p.position.set(0, 0, 1.95 - i * .3); p.rotation.x = .1; p.rotation.z = (i ? (i % 2 ? .02 : -.015) : 0); H[0].add(p); });
  const sides = [[-13.2, 6.4, 1], [-12.6, -3.6, 2], [.2, 7.2, 1], [4.4, -1.6, 2], [9.8, 6.0, 1], [11.6, -3.2, 1]];
  const sidePacks = [];
  (async () => {
    const pool = (opts.products || []).filter(p => !p.photo && p.stock > 0);
    for (let i = 0; i < sides.length; i++) {
      const [x, y, n] = sides[i], h = hook(x, y), p = pool[i % Math.max(1, pool.length)];
      const tex = p ? await cardTexture(p, aniso) : photoTex;
      for (let k = 0; k < n; k++) { const pk = pack(tex, !p); pk.position.set(0, 0, 1.95 - k * .3); pk.rotation.x = .1; pk.rotation.z = (Math.random() - .5) * .06; h.add(pk); sidePacks.push({pk, phase: Math.random() * 6, amp: .01 + Math.random() * .015}); }
      H.push(h);
    }
    resize();
  })();

  /* "900M" mounted on the wall behind the hero pack: occluded by the pack, casts its own shadow */
  const textGroup = new THREE.Group(); scene.add(textGroup);
  if (opts.font) {
    const font = new THREE.Font(opts.font);
    const tg = s => { const g = new THREE.TextGeometry(s, {font, size: 4.6, height: .7, curveSegments: 6, bevelEnabled: true, bevelThickness: .08, bevelSize: .05, bevelSegments: 3}); g.computeBoundingBox(); return g; };
    const g1 = tg("900"), g2 = tg("M");
    const w1 = g1.boundingBox.max.x - g1.boundingBox.min.x, w2 = g2.boundingBox.max.x - g2.boundingBox.min.x, gap = .35;
    const m1 = new THREE.Mesh(g1, new THREE.MeshStandardMaterial({color: 0x2f6a4c, metalness: .55, roughness: .38}));
    const m2 = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({color: 0xC98238, metalness: 1, roughness: .28}));
    m1.position.x = -(w1 + gap + w2) / 2; m2.position.x = m1.position.x + w1 + gap;
    [m1, m2].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.position.y = -2.3; textGroup.add(m); });
    textGroup.position.z = .45;                                      // stand-off from the board, so its shadow separates it
  }

  /* sizing + layout per breakpoint */
  let lay = L.desk, camBase = new THREE.Vector3(), look = new THREE.Vector3();
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    lay = narrowMQ.matches ? L.mob : L.desk;
    H[0].position.set(lay.main[0], lay.main[1], 0);
    textGroup.position.x = lay.text[0]; textGroup.position.y = lay.text[1]; textGroup.scale.setScalar(narrowMQ.matches ? .55 : 1);
    H.slice(1).forEach(h => h.visible = !narrowMQ.matches || Math.abs(h.position.x - lay.main[0]) > 5.5);   // phones: keep the hero pack clear
    const fit = narrowMQ.matches ? Math.max(1, .9 / camera.aspect) : Math.max(1, 1.55 / camera.aspect);
    camBase.set(lay.cam[0], lay.cam[1], lay.cam[2] * fit); look.set(...lay.look);
    scene.fog.near = camBase.z - 4; scene.fog.far = camBase.z + 22;                    // fog follows the camera, so only the far board fades
    key.position.set(H[0].position.x - 9, H[0].position.y + 13, 18); key.target.position.set(H[0].position.x + 1, H[0].position.y - 3, 0);
    draw();
  }
  addEventListener("resize", resize);

  /* pointer: camera parallax everywhere in the hero; brushing the hero pack pushes it */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ptr = {x: 0, y: 0, tx: 0, ty: 0, last: null};
  const sw = {a: 0, w: 0};
  function onMove(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ptr.tx = ndc.x; ptr.ty = ndc.y;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mainStack[0].userData.card, false)[0];
    if (hit && ptr.last !== null && !reduce) sw.w += clamp((ndc.x - ptr.last) * 26, -3, 3);
    ptr.last = hit ? ndc.x : null;
    hero.style.cursor = hit ? "grab" : "";
    wake();
  }
  function onLeave() { ptr.tx = 0; ptr.ty = 0; ptr.last = null; hero.style.cursor = ""; wake(); }
  if (!reduce) { hero.addEventListener("pointermove", onMove, {passive: true}); hero.addEventListener("pointerleave", onLeave); }

  /* loop: runs while the hero is on screen; idles down to nothing when still and reduced-motion is on */
  let visible = true, raf = 0, last = performance.now(), intro = reduce ? 1 : 0, first = true, sp = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) wake(); }, {threshold: 0}); io.observe(hero);
  function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function draw() { if (!raf) { raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0; const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
    intro = Math.min(1, intro + dt / 1.4); const ie = 1 - Math.pow(1 - intro, 3);
    const k = 1 - Math.exp(-dt * 3.2); ptr.x += (ptr.tx - ptr.x) * k; ptr.y += (ptr.ty - ptr.y) * k;
    // scroll = camera move through the scene (native scroll, smoothed): dolly toward the hero pack and
    // orbit to its side, so the board, the letters and the pack slide past each other at their own depths
    const raw = reduce ? 0 : clamp(scrollY / Math.max(1, hero.offsetHeight * .9), 0, 1);
    sp += (raw - sp) * (1 - Math.exp(-dt * 4));                        // soft follow: the camera glides, never jerks
    const e = sp * sp * (3 - 2 * sp), P = H[0].position;
    // never fly into the pack: the closest stop keeps it under ~42% of the frame height and ~60% of its
    // width (the photo also stays sharp), so the move is mostly an orbit to its side, not a dive
    const tanH = Math.tan(camera.fov * Math.PI / 360), minD = Math.max(PACK_H / (.84 * tanH), PACK_W / (1.2 * tanH * camera.aspect));
    const endZ = Math.max(2 + minD, camBase.z * .82);
    const cx = lerp(camBase.x, P.x + (narrowMQ.matches ? 2.5 : 5), e), cy = lerp(camBase.y, P.y - 1.2, e), cz = lerp(camBase.z, endZ, e);
    camera.position.set(cx + ptr.x * 1.6 * (1 - e * .5), cy + ptr.y * 1.0, cz + (1 - ie) * 6);
    camera.lookAt(lerp(look.x, P.x - .4, e) + ptr.x * .25, lerp(look.y, P.y - 2.6, e) + ptr.y * .15, look.z);
    canvas.style.transform = `translateY(${(scrollY * .45).toFixed(1)}px)`;   // scene lags the page: the hero window slides over it
    // hero pack: damped pendulum + a breath of air; the packs behind it follow late and smaller
    sw.w += (-38 * sw.a - 2.6 * sw.w) * dt; sw.a = clamp(sw.a + sw.w * dt, -.35, .35);
    const air = reduce ? 0 : Math.sin(t * .9) * .012;
    mainStack[0].rotation.z = sw.a + air;
    mainStack[0].rotation.y = (reduce ? 0 : Math.sin(t * .6) * .05) - e * .35;   // turns on scroll: its edge and the plastic bubble show
    mainStack[1].rotation.y = -e * .3; mainStack[2].rotation.y = -e * .15;
    mainStack[1].rotation.z = sw.a * .45 + air * .8 + .02; mainStack[2].rotation.z = sw.a * .2 + air * .6 - .015;
    if (!reduce) sidePacks.forEach(s => { s.pk.rotation.z = Math.sin(t * .8 + s.phase) * s.amp; });
    renderer.render(scene, camera);
    if (first) { first = false; hero.classList.add("hero-3d"); }
    const still = reduce && intro >= 1;                               // reduced motion: draw only when something changes
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  const onScroll = () => { if (visible) wake(); };
  addEventListener("scroll", onScroll, {passive: true});
  resize();

  return {destroy() {
    cancelAnimationFrame(raf); raf = 1; io.disconnect(); removeEventListener("resize", resize); removeEventListener("scroll", onScroll);
    hero.removeEventListener("pointermove", onMove); hero.removeEventListener("pointerleave", onLeave);
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    envTex.dispose(); renderer.dispose(); canvas.remove(); hero.classList.remove("hero-3d");
  }};
}
return {mount};
})();
