/* IC cabinet wall: one cabinet per group, built as stackable cabinet units like the plastic parts cabinets in
   an electronics shop: a box with real depth (roof, floor and side walls), drawer fronts with a label card,
   and drawers that slide out toward you. Each drawer is a real shop drawer (the "drawer" code from the
   inventory, e.g. 32 and 32-1 are the two bins of drawer 32); the chips lying in it are the stock.
   A unit is turned at an angle while it scrolls in and squares up to face you once it is in the middle of the
   screen; the eye point follows the screen centre, so you look down onto units below and up at units above.
   Pointing at a drawer pulls it out with a shadow and a catch of light (CSS 3D, no WebGL: 360+ parts stay light). */
window.TTCabinet = (() => {
"use strict";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fa = n => Number(n).toLocaleString("fa-IR");
const VIS = 4;
/* long cabinets are built as stacked modules of 12 drawers: each module is its own small 3D layer, and modules
   off screen are not rendered at all (content-visibility), so 300+ drawers never exhaust GPU memory */
const MOD = () => matchMedia("(max-width:640px)").matches ? 6 : 12, chunk = (a, n) => Array.from({length: Math.ceil(a.length / n)}, (_, i) => a.slice(i * n, i * n + n));                                                       // chips drawn per bin; the tag shows the real count
const imgCache = new Map();
function chipURL(p) {
  if (p.photo) return (p.thumbs && p.thumbs[0]) || p.photo;          // small copy: up to four lie in each bin
  const key = p.id + "|" + (p.pkg || "") + "|" + (p.pkgOk === false ? "?" : "");
  if (!imgCache.has(key)) imgCache.set(key, URL.createObjectURL(new Blob([window.TTChips.svg(p.name, p.pkg || window.TTChips.guessPkg(p.name, p.cat), p.pkgOk === false)], {type: "image/svg+xml"})));
  return imgCache.get(key);
}
const base = d => String(d || "").replace(/-\d+$/, "");
const num = d => parseInt(base(d), 10) || 99999;

/* the label card on the drawer front (the link), and what lies inside the drawer (seen when it is pulled out) */
function binHTML(p, avail) {
  if (!p) return `<span class="bin void" aria-hidden="true"></span>`;
  const n = avail(p);
  return `<a class="bin${n ? "" : " out"}" href="#/product/${p.id}" data-pid="${p.id}" data-q="${esc((p.name + " " + (p.drawer || "")).toUpperCase())}"
      aria-label="${esc(p.name)}، ${n ? fa(n) + " عدد" : "ناموجود"}">
      <span class="win"><img alt="" draggable="false" decoding="async"></span>
      <span class="bin-tag"><b dir="ltr">${esc(p.name)}</b><small>${n ? fa(n) + " عدد" : "ناموجود"}</small></span></a>`;   // full part number (CSS wraps it to 2 lines)
}
const lotHTML = (p, avail) => p ? `<span class="lot"><span class="chips" data-pid="${p.id}" data-n="${Math.min(avail(p), VIS)}"></span></span>` : `<span class="lot"></span>`;
function cabinetHTML(cat, items, avail, {limit} = {}) {
  const drawers = new Map();                                           // group bins by physical drawer
  items.slice().sort((a, b) => num(a.drawer) - num(b.drawer) || String(a.drawer).localeCompare(String(b.drawer))).forEach(p => {
    const k = p.drawer ? base(p.drawer) : "p" + p.id; if (!drawers.has(k)) drawers.set(k, []); drawers.get(k).push(p);
  });
  let list = [...drawers.entries()]; const more = limit && list.length > limit ? list.length - limit : 0; if (limit) list = list.slice(0, limit);
  return `<section class="cab" data-cab="${esc(cat.cab || "plain")}" id="cab-${esc(cat.id)}" aria-labelledby="cabh-${esc(cat.id)}">
    <header class="cab-head"><h3 id="cabh-${esc(cat.id)}">${esc(cat.name)}</h3><small>${esc(cat.note || "")} · ${fa(items.length)} قطعه</small></header>
    ${chunk(list, MOD()).map(mod => `<div class="cab-stage"><div class="cab-body">
      <i class="cab-sh cab-t" aria-hidden="true"></i><i class="cab-sh cab-b" aria-hidden="true"></i><i class="cab-sh cab-l" aria-hidden="true"></i><i class="cab-sh cab-r" aria-hidden="true"></i>
      <div class="cab-grid">
      ${mod.map(([k, bins], i) => `<div class="drawer${bins[1] ? "" : " one"}" style="--i:${i}" data-drawer="${esc(k)}">
        <div class="dr-box">
          <div class="dr-floor" aria-hidden="true">${lotHTML(bins[0], avail)}${bins[1] ? lotHTML(bins[1], avail) : ""}</div>
          <i class="dr-wall l" aria-hidden="true"></i><i class="dr-wall r" aria-hidden="true"></i>
          <div class="dr-face">${binHTML(bins[0], avail)}${bins[1] ? binHTML(bins[1], avail) : ""}<i class="dr-handle" aria-hidden="true"></i></div>
        </div>
      </div>`).join("")}
      </div>
    </div></div>`).join("")}
    ${more ? `<a class="cab-more" href="#/ic?cat=${esc(cat.id)}">${fa(more)} کشوی دیگر · دیدن همه</a>` : ""}
  </section>`;
}
/* fill chips only when a cabinet comes near the screen; tilt + open drawers with scroll */
function mount(root, byId, opts = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fill = cabEl => {
    cabEl.querySelectorAll(".bin[data-pid] .win img").forEach(im => { const p = byId[im.closest(".bin").dataset.pid]; if (p && !im.src) im.src = chipURL(p); });   // label card picture
    cabEl.querySelectorAll(".chips[data-pid]").forEach(box => {            // the chips lying in the drawer
      if (box.childElementCount) return;
      const p = byId[box.dataset.pid]; if (!p) return;
      const n = +box.dataset.n, url = chipURL(p);
      let h = ""; for (let k = n - 1; k >= 0; k--) { const r = ((p.id * 37 + k * 53) % 21) - 10;   // stable little scatter
        h += `<img src="${url}" alt="" draggable="false" decoding="async" style="--k:${k};--r:${r}deg">`; }
      box.innerHTML = h || `<img src="${url}" alt="" class="ghost" draggable="false">`;
    });
  };
  const cabs = [...root.querySelectorAll(".cab")], mods = [...root.querySelectorAll(".cab-stage")];
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fill(e.target); io.unobserve(e.target); } }), {rootMargin: "600px"});
  cabs.forEach(c => io.observe(c));
  // clicking a bin zooms into that drawer and opens the part's details inside it (the link still works with ctrl/middle click)
  const onClick = e => {
    let b = e.target.closest(".bin[data-pid]");
    if (!b) { const dr = e.target.closest(".drawer"); if (dr) {                // anywhere on a drawer counts: pick the bin under the pointer (or the nearest)
      const bins = [...dr.querySelectorAll(".bin[data-pid]")]; b = bins.sort((x, y) => Math.abs(x.getBoundingClientRect().left + x.offsetWidth / 2 - e.clientX) - Math.abs(y.getBoundingClientRect().left + y.offsetWidth / 2 - e.clientX))[0]; } }
    if (!b) { const body = e.target.closest(".cab-body"); if (body) b = [...body.querySelectorAll(".bin[data-pid]")].find(x => {   // the tilted frame can sit over part of a bin: use what is seen on screen
      const r = x.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }); }
    if (!b || !opts.detail || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    const p = byId[b.dataset.pid]; if (!p) return; e.preventDefault(); zoomIn(b, p, opts.detail, opts.view3d);
  };
  root.addEventListener("click", onClick);
  // the angle a unit has while it is away from the middle of the screen; it squares up to 0 in the middle
  const MAXA = () => reduce ? [0, 0] : innerWidth <= 640 ? [10, 0] : [15, 11];   // [rotateX, rotateY] in degrees; phones only nod
  const pose = (c, e) => { const [ax, ay] = MAXA(); c.style.setProperty("--rx", (-e * ax).toFixed(2) + "deg"); c.style.setProperty("--ry", (e * ay).toFixed(2) + "deg"); };
  // the perspective and the angle make a unit wider than the page; the scale that keeps it inside the screen is
  // worked out once (load / resize) for the widest pose it will reach and then held, so it never changes size
  // while scrolling (a running correction made it shrink and jump back).
  // a unit's last row is filled with empty drawers, as in a real cabinet (the column count depends on the width)
  const EMPTY = `<div class="drawer void" aria-hidden="true"><div class="dr-box"><div class="dr-face"><i class="dr-handle"></i></div></div></div>`;
  const padRows = cols => root.querySelectorAll(".cab-grid").forEach(g => { g.querySelectorAll(".drawer.void").forEach(x => x.remove());
    const n = g.children.length, add = cols > 1 ? (cols - n % cols) % cols : 0; if (add) g.insertAdjacentHTML("beforeend", EMPTY.repeat(add)); });
  const fitAll = () => { const m = 8; let fit = 1;                         // one shared scale: every unit the same size
    if (mods[0]) { const c = mods[0]; c.style.contentVisibility = "visible";
      padRows(getComputedStyle(c.querySelector(".cab-grid")).gridTemplateColumns.split(" ").filter(Boolean).length); c.style.contentVisibility = ""; }
    for (const c of mods.slice(0, 2)) { const body = c.firstElementChild, keep = [c.style.getPropertyValue("--rx"), c.style.getPropertyValue("--ry")];   // full units are all alike
      c.style.contentVisibility = "visible"; c.style.setProperty("--fit", "1");   // measure it rendered, even when off screen
      for (const e of [-1, 0, 1]) { pose(c, e); const r = body.getBoundingClientRect(), cx = r.left + r.width / 2;
        if (r.width) fit = Math.min(fit, Math.min(cx - m, innerWidth - m - cx) / (r.width / 2)); }
      c.style.contentVisibility = ""; c.style.setProperty("--rx", keep[0] || "0deg"); c.style.setProperty("--ry", keep[1] || "0deg"); }
    mods.forEach(c => c.style.setProperty("--fit", Math.max(.5, fit).toFixed(4))); };
  fitAll();
  if (reduce) { mods.forEach(c => pose(c, 0)); return () => { io.disconnect(); root.removeEventListener("click", onClick); }; }
  let raf = 0, lastW = innerWidth;
  const upd = () => { raf = 0; const vh = innerHeight;
    if (innerWidth !== lastW) { lastW = innerWidth; fitAll(); }               // width changed (rotate / resize): new scale, once
    for (const c of mods) { const r = c.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue;
      c.style.setProperty("--poy", (vh / 2 - r.top).toFixed(0) + "px");    // the eye sits at the screen centre: look down on units below it, up at those above
      const k = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh * .55)));   // -1 above, 0 centred, +1 below
      const t = Math.max(0, (Math.abs(k) - .14) / .86), e = Math.sign(k) * t * t * (3 - 2 * t);   // flat zone in the middle: there it faces you
      pose(c, e); } };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(upd); };
  addEventListener("scroll", onScroll, {passive: true}); addEventListener("resize", onScroll); upd();
  return () => { io.disconnect(); root.removeEventListener("click", onClick); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
}

/* ---------- zoom into a drawer: the cabinet module zooms toward the bin, the bin grows into a close-up of the
   open drawer (same floor, walls and number plate) with the part lying in it, details beside it.
   Closing plays it backwards to the same bin. Back button, Escape, the close button and the dim area all close it. */
let Z = null;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const CAM_MS = 1000;
/* the camera move into a pulled drawer, as one transform on the cabinet unit about the centre of the drawer's floor:
   the unit turns 90 degrees (so we end up looking straight down into the drawer) while it comes toward us until the
   floor fills the screen. The drawers that would come between the camera and the floor fade away on the way.
   Returns what the close needs to play it back, and where the floor ends up on screen. */
function camIn(stage, drawer) {
  const body = stage.firstElementChild, grid = body.querySelector(".cab-grid"), cs = getComputedStyle(drawer);
  const pz = parseFloat(cs.getPropertyValue("--pz")) || 100, dd = parseFloat(cs.getPropertyValue("--dd")) || 118;
  const O = [grid.offsetLeft + drawer.offsetLeft + drawer.offsetWidth / 2, grid.offsetTop + drawer.offsetTop + drawer.offsetHeight - 7, pz - dd / 2];   // floor centre, unit coordinates
  const sr = stage.getBoundingClientRect(), C = [innerWidth / 2 - sr.left, innerHeight / 2 - sr.top];   // screen centre, stage coordinates
  const P = parseFloat(getComputedStyle(stage).perspective) || 1150, fit = parseFloat(stage.style.getPropertyValue("--fit")) || 1;
  const fw = (drawer.offsetWidth - 10) * fit, fd = dd * fit;
  const s = Math.max(1.2, Math.min(3.2, innerWidth * .84 / fw, innerHeight * .62 / fd)), Zc = P * (1 - 1 / s);   // how close the camera gets
  // the unit's current look, re-expressed about the new pivot so nothing jumps when the pivot moves
  const bs = getComputedStyle(body), M = new DOMMatrix(bs.transform === "none" ? undefined : bs.transform), O0 = bs.transformOrigin.split(" ").map(parseFloat);
  const T = (x, y, z) => new DOMMatrix().translate(x, y, z || 0);
  const K = T(-O[0], -O[1], -O[2]).multiply(T(O0[0], O0[1], O0[2] || 0)).multiply(M).multiply(T(-O0[0], -O0[1], -(O0[2] || 0))).multiply(T(O[0], O[1], O[2]));
  const F = `translate3d(${(C[0] - body.offsetLeft - O[0]).toFixed(1)}px,${(C[1] - body.offsetTop - O[1]).toFixed(1)}px,${(Zc - O[2]).toFixed(1)}px) rotateX(-90deg) scale(${fit})`;
  body.style.transformOrigin = `${O[0]}px ${O[1]}px ${O[2]}px`; stage.style.perspectiveOrigin = `${C[0]}px ${C[1]}px`;
  const others = [...stage.querySelectorAll(".drawer, .cab-sh")].filter(x => x !== drawer);
  const anims = [body.animate([{transform: K.toString()}, {transform: F}], {duration: CAM_MS, easing: SETTLE, fill: "forwards"})];
  others.forEach(x => anims.push(x.animate([{opacity: 1}, {opacity: 1, offset: .12}, {opacity: 0, offset: .6}, {opacity: 0}], {duration: CAM_MS, easing: "linear", fill: "forwards"})));
  const floor = {width: fw * s, height: fd * s}; floor.left = innerWidth / 2 - floor.width / 2; floor.top = innerHeight / 2 - floor.height / 2;
  return {stage, body, K: K.toString(), F, anims, floor};
}
/* the same move backwards; then the unit is handed back to its scroll-driven pose */
function camOut(cam, onDone) {
  const {stage, body, K, F, anims} = cam;
  const cur = anims[0].effect.getComputedTiming().progress ?? 1;               // closing halfway in: start back from where it is
  const now = getComputedStyle(body).transform;
  anims.forEach(a => a.cancel());
  const back = body.animate([{transform: now === "none" ? F : now}, {transform: K}], {duration: Math.max(380, CAM_MS * .9 * cur), easing: SETTLE, fill: "forwards"});
  [...stage.querySelectorAll(".drawer, .cab-sh")].forEach(x => { if (!x.classList.contains("pulled")) x.animate([{opacity: 0}, {opacity: 0, offset: .35}, {opacity: 1}], {duration: Math.max(380, CAM_MS * .9 * cur), easing: "linear"}); });
  back.onfinish = () => { back.cancel(); body.style.transformOrigin = ""; stage.style.perspectiveOrigin = ""; onDone && onDone(); };
}
function zoomIn(bin, p, detail, view3d) {
  if (Z) zoomOut(true);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cab = bin.closest(".cab"), stage = bin.closest(".cab-stage"), drawer = bin.closest(".drawer");
  const style = cab ? cab.dataset.cab : "plain", cabName = cab ? cab.querySelector(".cab-head h3").textContent : "";
  const el = document.createElement("div"); el.className = "icz"; el.dataset.cab = style;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "icz-t");
  el.innerHTML = `<div class="icz-dim" data-close></div>
    <div class="icz-card">
      <button class="icz-x" type="button" data-close aria-label="بستن و برگشت به قفسه">×</button>
      <nav class="icz-path" aria-label="جای قطعه در قفسه"><span>${esc(cabName)}</span></nav>
      <div class="icz-drawer" aria-hidden="true">
        <div class="icz-floor"><img src="${chipURL(p)}" alt="" class="icz-chip" draggable="false">${p.stock > 1 ? `<img src="${chipURL(p)}" alt="" class="icz-chip back" draggable="false">` : ""}</div>
        <div class="icz-front"><i class="dr-handle"></i></div>
      </div>
      <div class="icz-info">${detail(p)}</div>
    </div>`;
  document.body.appendChild(el); document.body.style.overflow = "hidden";
  Z = {el, pid: p.id, stage, drawer, back: document.activeElement, keyed: false};
  const z = Z, card = el.querySelector(".icz-card");
  // 1) the drawer comes out first (on a phone there is no hover, so this is the first thing the tap shows);
  // 2) once it is out, the camera moves into it: the cabinet grows past you and the drawer opens up into the
  //    close-up, which is the inside of that same drawer (its floor, walls and front), with the details in it.
  if (drawer) drawer.classList.add("pulled");
  const pullMs = reduce || !drawer ? 0 : drawer.matches(":hover") ? 200 : 460;    // already half out under the pointer: shorter wait
  if (pullMs) el.classList.add("icz-wait");                                  // laid out (so it can be measured) but not shown yet
  const enter = () => {
    if (Z !== z) return; el.classList.remove("icz-wait");
    let wait = 0;
    if (!reduce) {
      // 2a) the camera rises 90 degrees and moves in, looking straight down into the open drawer
      let from = (drawer || bin).getBoundingClientRect();
      if (stage && drawer) { z.cam = camIn(stage, drawer); from = z.cam.floor; wait = CAM_MS * .72; }
      // 2b) as it arrives, the floor it is looking at becomes the close-up (the same floor, now with the details in it)
      const to = card.getBoundingClientRect();
      const sx = from.width / to.width, sy = from.height / to.height, dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
      card.animate([{transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: 0, borderRadius: "6px"}, {opacity: 1, offset: .3}, {transform: "none", opacity: 1}], {duration: 620, delay: wait, easing: SETTLE, fill: "backwards"});
      el.querySelector(".icz-dim").animate([{opacity: 0}, {opacity: 1}], {duration: 520, delay: wait, easing: "ease-out", fill: "backwards"});
      el.querySelector(".icz-info").animate([{opacity: 0, transform: "translateY(12px)"}, {opacity: 0, offset: .5}, {opacity: 1, transform: "none"}], {duration: 760, delay: wait, easing: EASE, fill: "backwards"});
    }
    if (view3d) z.t3d = setTimeout(() => { if (Z === z) z.kill3d = view3d(el.querySelector(".icz-floor"), p); }, reduce ? 0 : wait + 480);   // 3D model once the camera is inside
    setTimeout(() => { if (Z === z) (el.querySelector(".icz-info .btn") || el.querySelector(".icz-x")).focus({preventScroll: true}); }, reduce ? 0 : wait + 420);
  };
  if (pullMs) z.tEnter = setTimeout(enter, pullMs); else enter();
  history.pushState({icz: p.id}, "", location.href); Z.keyed = true;          // Back closes the zoom instead of leaving the page
  el.addEventListener("click", e => {
    const a = e.target.closest("a[href^='#/']");                     // a link inside: leave the zoom and go there (replacing our history entry)
    if (a) { e.preventDefault(); zoomOut(true, true); location.replace(a.getAttribute("href")); return; }
    if (e.target.closest("[data-close]")) { e.preventDefault(); zoomOut(); } });
  el.addEventListener("keydown", trap);
}
function trap(e) {
  if (e.key === "Escape") { e.preventDefault(); zoomOut(); return; }
  if (e.key !== "Tab" || !Z) return;
  const f = [...Z.el.querySelectorAll("a[href],button:not([disabled]),input,select")].filter(x => x.offsetParent);
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function zoomOut(instant, fromPop) {
  if (!Z) return; const z = Z; Z = null; clearTimeout(z.t3d); clearTimeout(z.tEnter); if (z.kill3d) z.kill3d();
  const reduce = instant || z.el.classList.contains("icz-wait") || matchMedia("(prefers-reduced-motion: reduce)").matches;   // closed before the camera went in: nothing to play back
  const bin = document.querySelector(`.bin[data-pid="${CSS.escape(String(z.pid))}"]`);   // the page may have re-rendered meanwhile
  const stage = bin ? bin.closest(".cab-stage") : z.stage, card = z.el.querySelector(".icz-card");
  const done = () => { z.el.remove(); document.body.style.overflow = "";
    if (bin) { bin.closest(".drawer").classList.remove("pulled"); bin.focus({preventScroll: true}); } else if (z.back && z.back.isConnected) z.back.focus({preventScroll: true}); };
  if (z.keyed && !fromPop) history.back();                                   // drop the history entry we added
  if (z.cam) {
    // looking down into the drawer: the close-up sinks back into the floor it came from, then the camera rises back
    // out along the same path, the other drawers come back, and only then does the drawer slide in
    const cam = z.cam, finish = () => { if (bin) { bin.closest(".drawer").classList.remove("pulled"); bin.focus({preventScroll: true}); } else if (z.back && z.back.isConnected) z.back.focus({preventScroll: true}); };
    const gone = () => { z.el.remove(); document.body.style.overflow = ""; camOut(cam, finish); };
    if (reduce || !bin) { cam.anims.forEach(a => a.cancel()); cam.body.style.transformOrigin = ""; cam.stage.style.perspectiveOrigin = ""; done(); return; }
    const f = cam.floor, from = card.getBoundingClientRect();
    const sx = f.width / from.width, sy = f.height / from.height, dx = f.left + f.width / 2 - (from.left + from.width / 2), dy = f.top + f.height / 2 - (from.top + from.height / 2);
    z.el.querySelector(".icz-info").animate([{opacity: 1}, {opacity: 0}], {duration: 180, fill: "forwards"});
    z.el.querySelector(".icz-dim").animate([{opacity: 1}, {opacity: 0}], {duration: 480, easing: "ease-out", fill: "forwards"});
    card.animate([{transform: "none", opacity: 1}, {opacity: 1, offset: .55}, {transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: 0, borderRadius: "6px"}], {duration: 520, easing: SETTLE, fill: "forwards"}).onfinish = gone;
    return;
  }
  // the camera pulls back from wherever it is now, fast at first and then a long gentle settle (never a jump);
  // it runs to its own end even after the card is gone
  let s = 1, ox = 0, oy = 0;
  if (stage) {
    const cur = getComputedStyle(stage).transform, sr = stage.getBoundingClientRect();
    s = cur && cur !== "none" ? new DOMMatrix(cur).a || 1 : 1;
    const [lx, ly] = (stage.style.transformOrigin || "0px 0px").split(" ").map(parseFloat);
    ox = sr.left + (lx || 0) * s; oy = sr.top + (ly || 0) * s;            // the fixed point of the zoom, on screen
    stage.getAnimations().forEach(a => a.cancel());
    if (reduce || s === 1) stage.style.transformOrigin = "";
    else stage.animate([{transform: `scale(${s})`}, {transform: "none"}], {duration: 900, easing: SETTLE}).onfinish = () => { stage.style.transformOrigin = ""; };
  }
  if (reduce || !bin) { done(); return; }
  // the close-up shrinks back into the drawer, where the drawer will be once the camera has pulled back; then it slides in
  const b = (bin.closest(".drawer") || bin).getBoundingClientRect(), from = card.getBoundingClientRect();
  const to = {left: ox + (b.left - ox) / s, top: oy + (b.top - oy) / s, width: b.width / s, height: b.height / s};
  const sx = to.width / from.width, sy = to.height / from.height, dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
  z.el.querySelector(".icz-info").animate([{opacity: 1}, {opacity: 0}], {duration: 180, fill: "forwards"});
  z.el.querySelector(".icz-dim").animate([{opacity: 1}, {opacity: 0}], {duration: 600, easing: "ease-out", fill: "forwards"});
  card.animate([{transform: "none", opacity: 1}, {opacity: 1, offset: .6}, {transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity: 0, borderRadius: "6px"}], {duration: 700, easing: SETTLE, fill: "forwards"}).onfinish = done;
}
const SETTLE = "cubic-bezier(.33,0,.15,1)";                                     // gentle start, long slow arrival
addEventListener("popstate", () => { if (Z) zoomOut(false, true); });
const isOpen = () => !!Z;
/* find a part: open its drawer, light up its bin and focus it */
function reveal(root, pid) {
  const b = root.querySelector(`.bin[data-pid="${CSS.escape(String(pid))}"]`); if (!b) return false;
  root.querySelectorAll(".bin.hl").forEach(x => x.classList.remove("hl")); root.querySelectorAll(".drawer.pulled").forEach(x => x.classList.remove("pulled"));
  const d = b.closest(".drawer"); d.classList.add("pulled"); b.classList.add("hl");
  b.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"});
  setTimeout(() => b.focus({preventScroll: true}), 450);
  return true;
}
return {cabinetHTML, mount, reveal, chipURL, close: () => zoomOut(true), isOpen};
})();
