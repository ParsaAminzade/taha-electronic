/* Hanging packs move like real cards on a peg: a damped pendulum, not a CSS animation.
   - Brushing the pointer across a pack pushes it in that direction; it keeps swinging after the
     pointer leaves and settles by itself (never snaps back).
   - While the pointer is over it, the pack tilts toward the pointer and lifts off the board (3D).
   - Packs behind it follow with a little lag. Product-card packs get the tilt + lift only.
   Shared by the store and the admin panel. Respects prefers-reduced-motion. */
(() => {
"use strict";
if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
const S = new WeakMap(), live = new Set();
const SEL = ".hook .pk.front, .pcard .media .pk, .gallery .pk";
const K = 55, C = 3.6, MAXA = 13;            // spring stiffness, damping, max angle (deg)
let raf = 0, last = 0;

function st(el) {
  let s = S.get(el);
  if (!s) { s = {a: 0, w: 0, tx: 0, ty: 0, lift: 0, T: {tx: 0, ty: 0, lift: 0}, over: false, px: null, hang: !!el.closest(".hook")}; S.set(el, s); }
  return s;
}
function wake(el) { live.add(el); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  const ease = 1 - Math.exp(-dt * 9);
  for (const el of live) {
    if (!el.isConnected) { live.delete(el); continue; }
    const s = S.get(el);
    if (s.hang) { s.w += (-K * s.a - C * s.w) * dt; s.a = Math.max(-MAXA, Math.min(MAXA, s.a + s.w * dt)); }
    s.tx += (s.T.tx - s.tx) * ease; s.ty += (s.T.ty - s.ty) * ease; s.lift += (s.T.lift - s.lift) * ease;
    el.style.transform = `perspective(700px) rotate(${s.a.toFixed(2)}deg) rotateY(${s.ty.toFixed(2)}deg) rotateX(${s.tx.toFixed(2)}deg) translateZ(${(s.lift * 14).toFixed(1)}px)`;
    el.style.setProperty("--lift", s.lift.toFixed(3));
    if (s.hang) {                                    // packs behind the front one follow, damped and lagged
      let k = 1; for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling, k++) sib.style.rotate = (s.a * Math.max(.15, .45 - k * .08)).toFixed(2) + "deg";
    }
    const still = Math.abs(s.a) < .02 && Math.abs(s.w) < .02 && Math.abs(s.lift - s.T.lift) < .002 && Math.abs(s.tx - s.T.tx) < .02 && Math.abs(s.ty - s.T.ty) < .02;
    if (still && !s.over) { live.delete(el); el.style.transform = ""; el.style.removeProperty("--lift"); }
  }
  raf = live.size ? requestAnimationFrame(tick) : 0;
}

document.addEventListener("pointermove", e => {
  const el = e.target.closest && e.target.closest(SEL); if (!el) return;
  const s = st(el), r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  if (s.hang && s.px !== null) s.w += Math.max(-60, Math.min(60, (px - s.px) * 210));   // brush -> push in that direction
  s.px = px; s.over = true;
  s.T.ty = (px - .5) * 16; s.T.tx = -(py - .5) * 10; s.T.lift = 1;
  wake(el);
}, {passive: true});
document.addEventListener("pointerout", e => {
  const el = e.target.closest && e.target.closest(SEL); if (!el || el.contains(e.relatedTarget)) return;
  const s = st(el); s.over = false; s.px = null; s.T = {tx: 0, ty: 0, lift: 0}; wake(el);
}, {passive: true});
document.addEventListener("pointerdown", e => {                 // touch: a tap gives a small nudge
  const el = e.target.closest && e.target.closest(".hook .pk.front"); if (!el || e.pointerType === "mouse") return;
  const s = st(el); s.w += 40; wake(el);
}, {passive: true});
document.addEventListener("focusin", e => {                     // keyboard focus: a gentle swing, so focus is visible in motion too
  const el = e.target.closest && e.target.closest(".hook .pk.front"); if (!el) return;
  const s = st(el); s.w += 28; s.T.lift = .6; wake(el);
});
document.addEventListener("focusout", e => {
  const el = e.target.closest && e.target.closest(".hook .pk.front"); if (!el) return;
  const s = st(el); if (!s.over) { s.T = {tx: 0, ty: 0, lift: 0}; wake(el); }
});
})();
