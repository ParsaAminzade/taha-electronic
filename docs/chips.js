/* IC packages: one table of real outlines (mm, from JEDEC and the makers' package drawings) that both the
   top-view drawings here and the 3D viewer (chip3d.js) are built from, so the picture, the 3D model and the
   size shown always agree. Plus the part number "laser-marked" on the body. Shared by the store and the admin. */
window.TTChips = (() => {
"use strict";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let uid = 0;
const PKGS = {SOP8: "SO-8", SO14: "SO-14", SOP16: "SO-16", SOP20: "SO-20 (عریض)", SOP24: "SO-24 (عریض)", SOP28: "SO-28 (عریض)", SO44: "SO-44",
  DSO8EP: "DSO-8 با پد حرارتی", DSO12: "DSO-12 قدرت (با پد)", SOIC32: "SOIC-32 (گام ۰٫۶۵)", SOIC32EP: "SOIC-32 با پد حرارتی",
  SSOP24: "SSOP-24", SSOP24EP: "SSOP-24 با پد حرارتی", TSSOP: "TSSOP", TSSOP8: "TSSOP-8", TSSOP20: "TSSOP-20", TSSOP20EP: "TSSOP-20 با پد حرارتی",
  TSSOP28: "TSSOP-28", TSSOP28EP: "HTSSOP-28 (با پد)", TSSOP38: "TSSOP-38", HTSSOP24: "HTSSOP-24", HTSSOP32: "HTSSOP-32", HTSSOP38: "HTSSOP-38",
  PSO10: "PowerSO-10", PSO20: "PowerSO-20 / DSO-20 قدرت", PSO36: "PowerSO-36 / DSO-36 قدرت", PSSO12: "PowerSSO-12", PSSO24: "PowerSSO-24", PSSO36: "PowerSSO-36",
  TSOP48: "TSOP-48", QFP: "QFP / TQFP", QFP32: "TQFP-32", QFP44: "TQFP-44", QFP48: "LQFP-48", QFP48EP: "HTQFP-48", ZIP8: "ZIP-8 (پایه‌دار)", SIP10: "SIP-10 (پایه‌دار)", TO220: "TO-220", SSOP28: "SSOP-28", TSDSO14: "TSDSO-14 (با پد حرارتی)", TVSCAN: "دیود TVS دکمه‌ای (Case 460)", MODULE: "ماژول / برد", QFP64S: "LQFP-64 (10×10)", QFP64: "QFP-64 (14×14)",
  QFP100: "LQFP-100", QFP112: "LQFP-112", QFP144: "LQFP-144 (20×20)", QFP144B: "PQFP-144 (28×28)", QFP176: "LQFP-176",
  PLCC: "PLCC", PLCC28: "PLCC-28", PLCC32: "PLCC-32", PLCC44: "PLCC-44", QFN32: "PQFN-32", BGA388: "PBGA-388",
  TO252: "TO-252 (DPAK)", "TO252-5": "TO-252-5 (DPAK-5)", TO263: "TO-263 (D2PAK)", "TO263-5": "TO-263-5 (D2PAK-5)", "TO263-7": "TO-263-7 (D2PAK-7)",
  SOT223: "SOT-223", SOT23: "SOT-23", SOT89: "SOT-89", SMA: "SMA (DO-214AC)", SMB: "SMB (DO-214AA)", DO218: "DO-218AB",
  MW15: "Multiwatt-15", FW25: "Flexiwatt-25", SIP9: "SIP-9 (TO220-9)", RELAY: "رله", CAP: "خازن SMD", VDR: "وریستور دیسکی", RES: "مقاومت قدرت SMD"};

/* ---- outlines. bw = body along the pin rows (x), bd = body across them (z), h = height of the top face above the board,
   so = standoff, pitch, lw/lt = lead width/thickness, out = body edge to lead tip, zs = height the leads leave the body,
   ep = exposed metal pad under the body [w, d] ---- */
const G = (pins, bw, bd, h, pitch, out, o) => Object.assign({kind: "sop", pins, bw, bd, h, so: .1, pitch, out,
  lw: pitch >= 1 ? .41 : pitch >= .8 ? .36 : pitch >= .635 ? .28 : .22, lt: h > 2 ? .25 : h > 1.2 ? .2 : .15, zs: h * .53}, o);
const Q = (pins, b, h, pitch, out, o) => Object.assign({kind: "qfp", pins, side: pins / 4, bw: b, bd: b, h, so: .1, pitch, out,
  lw: pitch >= .65 ? .32 : .22, lt: pitch >= .65 ? .18 : .15, zs: h * .5}, o);
const J = (nx, nz, bw, bd, o) => Object.assign({kind: "plcc", pins: 2 * (nx + nz), nx, nz, bw, bd, h: 4.2, so: .65, pitch: 1.27, lw: .43, lt: .25, out: .5, zs: 2.2}, o);
const DP = (n, big, pitch, lw) => ({kind: "dpak", pins: n, bw: big ? 10.1 : 6.6, bd: big ? 9.2 : 6.1, h: big ? 4.4 : 2.3, so: 0, pitch, lw, lt: .5,
  out: big ? 2.6 : 2.7, zs: big ? 1.2 : .9, tab: big ? [8, 1.3, 1.3] : [5.4, 1, .5], label: `${big ? "D2PAK" : "DPAK"}${n > 3 ? "-" + n : ""} (TO-${big ? 263 : 252}${n > 3 ? "-" + n : ""})`,
  leads: Array.from({length: n}, (_, i) => ({x: (i - (n - 1) / 2) * pitch, w: lw, cut: n === 3 && i === 1}))});
const PACK = {
  SOP8: G(8, 4.9, 3.9, 1.45, 1.27, 1.05, {so: .15, zs: .8, label: "SO-8"}),
  DSO8EP: G(8, 4.9, 3.9, 1.5, 1.27, 1.05, {so: .05, zs: .8, ep: [2.6, 2.4], label: "DSO-8 EP"}),
  SO14: G(14, 8.65, 3.9, 1.45, 1.27, 1.05, {so: .15, zs: .8, label: "SO-14"}),
  SOP16: G(16, 9.9, 3.9, 1.45, 1.27, 1.05, {so: .15, zs: .8, label: "SO-16"}),
  SOP20: G(20, 12.8, 7.5, 2.35, 1.27, 1.4, {so: .15, zs: 1.15, label: "SO-20 wide"}),
  SOP24: G(24, 15.4, 7.5, 2.35, 1.27, 1.4, {so: .15, zs: 1.15, label: "SO-24 wide"}),
  SOP28: G(28, 17.9, 7.5, 2.35, 1.27, 1.4, {so: .15, zs: 1.15, label: "SO-28 wide"}),
  SO44: G(44, 28.2, 13.3, 2.6, 1.27, 1.35, {so: .2, zs: 1.3, label: "SO-44"}),
  DSO12: G(12, 6.4, 7.5, 2.35, 1, 1.4, {so: .05, zs: 1.15, lt: .25, ep: [4.6, 5.4], label: "DSO-12 (heat slug)"}),
  SOIC32: G(32, 11, 7.5, 2.35, .65, 1.4, {so: .1, zs: 1.15, lt: .25, label: "SOIC-32 (0.65)"}),
  SOIC32EP: G(32, 11, 7.5, 2.33, .65, 1.4, {so: .05, zs: 1.15, lt: .25, ep: [7, 4.6], label: "SOIC-32 EP"}),
  SSOP24: G(24, 8.65, 3.9, 1.5, .635, 1.05, {zs: .8, label: "SSOP-24 (0.635)"}),
  SSOP24EP: G(24, 8.65, 3.9, 1.5, .635, 1.05, {so: .05, zs: .8, ep: [5.4, 2.4], label: "SSOP-24 EP"}),
  SSOP28: G(28, 10.2, 5.3, 1.75, .65, 1.25, {zs: .9, label: "SSOP-28"}),
  TSDSO14: G(14, 4.9, 3.9, 1.1, .65, 1.05, {so: .05, zs: .55, ep: [3.4, 2.4], label: "TSDSO-14"}),
  TSSOP8: G(8, 3, 4.4, 1, .65, 1, {zs: .55, label: "TSSOP-8"}),
  TSSOP20: G(20, 6.5, 4.4, 1, .65, 1, {zs: .55, label: "TSSOP-20"}),
  TSSOP20EP: G(20, 6.5, 4.4, 1, .65, 1, {so: .05, zs: .55, ep: [4, 2.6], label: "TSSOP-20 EP"}),
  TSSOP28: G(28, 9.7, 4.4, 1, .65, 1, {zs: .55, label: "TSSOP-28"}),
  TSSOP28EP: G(28, 9.7, 4.4, 1, .65, 1, {so: .05, zs: .55, ep: [5.6, 2.8], label: "HTSSOP-28"}),
  TSSOP38: G(38, 9.7, 4.4, 1, .5, 1, {zs: .55, label: "TSSOP-38"}),
  HTSSOP24: G(24, 7.8, 4.4, 1, .65, 1, {so: .05, zs: .55, ep: [4.8, 2.8], label: "HTSSOP-24"}),
  HTSSOP32: G(32, 11, 6.1, 1, .65, 1, {so: .05, zs: .55, ep: [6.6, 3.6], label: "HTSSOP-32"}),
  HTSSOP38: G(38, 9.7, 4.4, 1, .5, 1, {so: .05, zs: .55, ep: [6, 2.8], label: "HTSSOP-38"}),
  // ST PowerSO / Infineon power DSO: big body, copper heat slug under the chip
  PSO10: G(10, 9.5, 9.4, 3.5, 1.27, 2.35, {so: .05, zs: 1.6, lw: .47, ep: [7.4, 6], label: "PowerSO-10"}),
  PSO20: G(20, 15.9, 11, 3.5, 1.27, 1.6, {so: .05, zs: 1.6, lw: .42, ep: [12.4, 6.2], label: "PowerSO-20 / DSO-20"}),
  PSO36: G(36, 15.9, 11, 3.4, .65, 1.6, {so: .05, zs: 1.6, lw: .3, ep: [12.4, 6.2], label: "PowerSO-36 / DSO-36"}),
  PSSO12: G(12, 4.9, 3.9, 1.6, .8, 1.05, {so: .05, zs: .8, lw: .35, ep: [4.1, 2.4], label: "PowerSSO-12"}),
  PSSO24: G(24, 10.3, 7.5, 2.3, .8, 1.4, {so: .05, zs: 1.15, lw: .35, ep: [6.5, 4.1], label: "PowerSSO-24"}),
  PSSO36: G(36, 10.3, 7.5, 2.3, .5, 1.4, {so: .05, zs: 1.15, lw: .25, ep: [6.5, 4.1], label: "PowerSSO-36"}),
  // TSOP type I: the pins come out of the two short ends
  TSOP48: G(48, 12, 18.4, 1.05, .5, .8, {so: .05, zs: .5, lw: .22, lt: .15, markRot: true, label: "TSOP-48"}),
  QFP32: Q(32, 7, 1.2, .8, 1, {label: "TQFP-32"}),
  QFP44: Q(44, 10, 1.2, .8, 1, {label: "TQFP-44"}),
  QFP48: Q(48, 7, 1.5, .5, 1, {label: "LQFP-48"}),
  QFP48EP: Q(48, 7, 1.05, .5, 1, {ep: [4.6, 4.6], label: "HTQFP-48"}),
  QFP64S: Q(64, 10, 1.4, .5, 1, {label: "LQFP-64"}),
  QFP64: Q(64, 14, 2.3, .8, 1.6, {label: "MQFP-64"}),
  QFP100: Q(100, 14, 1.5, .5, 1, {label: "LQFP-100"}),
  QFP112: Q(112, 20, 1.5, .65, 1, {label: "LQFP-112"}),
  QFP144: Q(144, 20, 1.5, .5, 1, {label: "LQFP-144"}),
  QFP144B: Q(144, 28, 3.4, .65, 1.6, {label: "PQFP-144"}),
  QFP176: Q(176, 24, 1.5, .5, 1, {label: "LQFP-176"}),
  PLCC28: J(7, 7, 11.5, 11.5, {label: "PLCC-28"}),
  PLCC32: J(7, 9, 11.45, 13.97, {label: "PLCC-32"}),
  PLCC44: J(11, 11, 16.6, 16.6, {label: "PLCC-44"}),
  QFN32: {kind: "qfn", pins: 32, side: 8, bw: 8, bd: 8, h: .9, so: 0, pitch: .8, lw: .4, lt: .05, out: 0, zs: 0, pad: .6, ep: [5.2, 5.2], label: "PQFN-32 8×8"},
  BGA388: {kind: "bga", pins: 388, bw: 27, bd: 27, h: 2.33, so: .5, pitch: 1, lw: 0, lt: 0, out: 0, zs: 0, ball: .62, grid: 26, rings: 4, core: 6, label: "PBGA-388"},
  TO252: DP(3, false, 2.28, .76), "TO252-5": DP(5, false, 1.14, .55),
  TO263: DP(3, true, 2.54, .81), "TO263-5": DP(5, true, 1.7, .81), "TO263-7": DP(7, true, 1.27, .6),
  SOT223: {kind: "sot", pins: 4, bw: 6.5, bd: 3.5, h: 1.6, so: .05, lt: .28, out: 1.75, zs: .8, lw: .7, pitch: 2.3,
    leads: [{x: -2.3, w: .7}, {x: 0, w: .7}, {x: 2.3, w: .7}], back: [{x: 0, w: 3}], label: "SOT-223"},
  SOT23: {kind: "sot", pins: 3, bw: 2.9, bd: 1.3, h: 1, so: .05, lt: .13, out: .55, zs: .5, lw: .4, pitch: .95,
    leads: [{x: -.95, w: .4}, {x: .95, w: .4}], back: [{x: 0, w: .4}], label: "SOT-23"},
  SOT89: {kind: "sot", pins: 3, bw: 4.5, bd: 2.5, h: 1.5, so: 0, lt: .4, out: 1.6, zs: .2, lw: .44, pitch: 1.5, flat: true,
    leads: [{x: -1.5, w: .44}, {x: 0, w: .53}, {x: 1.5, w: .44}], back: [], label: "SOT-89"},
  SMA: {kind: "diode", pins: 2, bw: 4.3, bd: 2.6, h: 2.2, so: .1, lw: 1.4, lt: .2, out: .4, zs: 1, label: "SMA (DO-214AC)"},
  SMB: {kind: "diode", pins: 2, bw: 4.4, bd: 3.6, h: 2.3, so: .1, lw: 2, lt: .2, out: .4, zs: 1, label: "SMB (DO-214AA)"},
  // through-hole power packages (car-audio amplifiers etc.), lying flat in the drawer: metal tab behind, legs in front
  TO220: {kind: "sip", pins: 3, bw: 10.1, bd: 9.2, h: 4.5, so: 0, pitch: 2.54, lw: .8, lt: .5, out: 13, zs: 2.2, jog: 0, tab: [10.1, 6.5, 1.3], hole: 3.7, label: "TO-220"},
  MW15: {kind: "sip", pins: 15, bw: 19.9, bd: 10.7, h: 4.9, so: 0, pitch: 1.27, lw: .55, lt: .45, out: 9, zs: 2.6, jog: 2.5, tab: [19.9, 6.9, 1.6], hole: 3.65, label: "Multiwatt-15"},
  FW25: {kind: "sip", pins: 25, bw: 23.75, bd: 10.5, h: 4.5, so: 0, pitch: 1, lw: .5, lt: .4, out: 9, zs: 2.4, jog: 2.2, tab: [28.2, 6.5, 1.5], hole: 3.4, holes2: true, label: "Flexiwatt-25"}
};
/* pin count from the part name when it says so ("TQFP-100", "LQFP144", "20PIN") */
function pinsOf(name, pkg) {
  const n = String(name || "").toUpperCase();
  const m = n.match(/(?:QFP|SOP|SSOP|TSSOP|SO)[-\s]?(\d{1,3})\b/) || n.match(/\b(\d{2,3})[-\s]?PIN/);
  if (m && +m[1] >= 6 && +m[1] <= 208 && +m[1] % 2 === 0) return +m[1];
  if (pkg === "QFP") return /ST10F2|C167|TC17|MPC56|SPC56|TMS470/.test(n) ? 144 : /MC9S12|S912|S9S12/.test(n) ? 112 : 100;
  return {TSSOP: 8, PLCC: 44}[pkg] || 8;
}
/* the outline for a package code (and the part name, for the generic codes), or null when it is not an IC outline */
function spec(name, pkg) {
  if (pkg === "QFP144" && /BIG|PQFP|MQFP/i.test(String(name))) pkg = "QFP144B";
  if (pkg === "QFP") { const n = pinsOf(name, pkg); pkg = {32: "QFP32", 44: "QFP44", 48: "QFP48", 64: "QFP64S", 100: "QFP100", 112: "QFP112", 144: "QFP144", 176: "QFP176"}[n] || "QFP100"; }
  if (pkg === "TSSOP") { const n = pinsOf(name, pkg); pkg = {8: "TSSOP8", 20: "TSSOP20", 28: "TSSOP28", 38: "TSSOP38"}[n] || "TSSOP8"; }
  if (pkg === "PLCC") pkg = {28: "PLCC28", 32: "PLCC32"}[pinsOf(name, pkg)] || "PLCC44";
  const s = PACK[pkg];
  return s ? Object.assign({code: pkg}, s) : null;
}

/* package guess from the part name, then from the group (only used until a part has a checked package) */
function guessPkg(name, cat) {
  const n = String(name || "").toUpperCase();
  if (/TQFP|QFP|ST10F|SAK|TC17|MPC5|SPC5|MC9S12|S9S12|S912|TMS470|D76F|D78F/.test(n)) return "QFP";
  if (/PLCC/.test(n)) return "PLCC";
  if (/TSOP|AM29F.*48|AM29F800BB-48/.test(n)) return "TSOP48";
  if (/TSSOP/.test(n)) return "TSSOP";
  if (/TO-?263|D2PACK/.test(n)) return "TO263";
  if (/TO-?252|DPACK|TO252/.test(n)) return "TO252";
  if (/BCP|BSP|SOT-?223/.test(n)) return "SOT223";
  if (/BC8\d\d|BAV|SOT-?23/.test(n)) return "SOT23";
  if (/رله|V230|G8N|EX[12]-|51ND|512ND|P3CN/.test(n)) return "RELAY";
  if (/\dUF|UF /.test(n)) return "CAP";
  if (/^2[45]C|^24LC|^25LC|^93[CS]|^M?95\d|8PIN|TJA|SN65|VP23|PCA82C|LM29|ATA ?6560|HT75|TLE625|NCV8402AD/.test(n)) return "SOP8";
  if (/^74|HEF40|ULN|ULQ|MC1413|LM324|AM29F/.test(n)) return "SOP16";
  if (cat === "ic-mcu") return "QFP";
  if (cat === "ic-power" || cat === "ic-reg") return "TO252";
  if (cat === "ic-driver" || cat === "ic-asic") return "SOP20";
  if (cat === "ic-relay") return "RELAY";
  return "SOP8";
}
/* split a part number into up to 3 short marking lines */
function marking(name) {
  const code = /\bCODE\s+([A-Z0-9]{1,4})\b/i.exec(String(name || ""));       // tiny parts carry only their marking code ("BAV99 SMD CODE A7" -> A7)
  if (code) return [code[1].toUpperCase()];
  const clean = String(name || "").replace(/(اصلی|ORGINAL|ORIGINAL|SMD|BIG|SMALL|SMAll|\bQFP\b|\bTQFP\b|\bSOP\d*\b|\bTSSOP\b|\bTSOP\d*\b|TO-?\d{3}|\(?D2?PACK\)?|DPACK|\d-?PIN)/gi, " ").replace(/[^\x21-\x7E ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const w of clean) { if ((cur + " " + w).trim().length > 11 && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
const DEFS = `<defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#8d9499"/><stop offset=".5" stop-color="#eef2f3"/><stop offset="1" stop-color="#9aa1a6"/></linearGradient>
  <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2e31"/><stop offset="1" stop-color="#141618"/></linearGradient>
  <radialGradient id="sh" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
function text(lines, cx, cy, size, color) {
  const lh = size * 1.18, top = cy - (lines.length - 1) * lh / 2;
  return lines.map((l, i) => `<text x="${cx}" y="${(top + i * lh).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Consolas,'Courier New',monospace" font-weight="700" font-size="${size.toFixed(1)}" fill="${color}" letter-spacing=".2">${esc(l)}</text>`).join("");
}
const R = (x, y, w, h, fill, rx) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(.3, w).toFixed(2)}" height="${Math.max(.3, h).toFixed(2)}" rx="${(rx ?? .5).toFixed(2)}" fill="${fill}"/>`;
/* top view drawn to scale from the outline: lead count, pitch and proportions are the real ones */
function topView(s, m) {
  const lead = "url(#lg)", ext = s.kind === "sip" ? [s.bw, s.bd + s.out + s.tab[1]] : s.kind === "dpak" ? [s.bw, s.bd + s.out + s.tab[1]]
    : [s.bw + 2 * (["qfp", "plcc", "diode"].includes(s.kind) ? s.out : 0), s.bd + 2 * s.out];
  const k = Math.min(78 / Math.max(...ext), 11), W = s.bw * k, D = s.bd * k;          // tiny parts are not blown up past 11 px/mm
  let x0 = 50 - W / 2, y0 = 50 - D / 2, out = "";
  if (s.kind === "dpak" || s.kind === "sip") y0 = 50 - (s.bd + s.out - s.tab[1]) * k / 2;
  const lw = Math.max(.8, s.lw * k), o = s.out * k;
  const row = (n, pitch, y, h) => { for (let i = 0; i < n; i++) out += R(50 + (i - (n - 1) / 2) * pitch * k - lw / 2, y, lw, h, lead, .3); };
  const col = (n, pitch, x, w) => { for (let i = 0; i < n; i++) out += R(x, 50 + (i - (n - 1) / 2) * pitch * k - lw / 2, w, lw, lead, .3); };
  if (s.kind === "sop") { row(s.pins / 2, s.pitch, y0 - o, o + 1); row(s.pins / 2, s.pitch, y0 + D - 1, o + 1); }
  else if (s.kind === "qfp") { row(s.side, s.pitch, y0 - o, o + 1); row(s.side, s.pitch, y0 + D - 1, o + 1); col(s.side, s.pitch, x0 - o, o + 1); col(s.side, s.pitch, x0 + W - 1, o + 1); }
  else if (s.kind === "plcc") { row(s.nx, s.pitch, y0 - o, o + 1); row(s.nx, s.pitch, y0 + D - 1, o + 1); col(s.nz, s.pitch, x0 - o, o + 1); col(s.nz, s.pitch, x0 + W - 1, o + 1); }
  else if (s.kind === "dpak" || s.kind === "sot") {
    (s.leads || []).forEach(l => out += R(50 + l.x * k - l.w * k / 2, y0 + D - 1, l.w * k, (l.cut ? .5 : s.out) * k + 1, lead, .3));
    if (s.tab) out += R(50 - s.tab[0] * k / 2, y0 - s.tab[1] * k, s.tab[0] * k, s.tab[1] * k + 2, lead, .8);
    (s.back || []).forEach(l => out += R(50 + l.x * k - l.w * k / 2, y0 - o, l.w * k, o + 1, lead, .3)); }
  else if (s.kind === "diode") { out += R(x0 - o, 50 - lw / 2, o + 1.5, lw, lead, .3) + R(x0 + W - 1.5, 50 - lw / 2, o + 1.5, lw, lead, .3); }
  else if (s.kind === "sip") { for (let i = 0; i < s.pins; i++) out += R(50 + (i - (s.pins - 1) / 2) * s.pitch * k - lw / 2, y0 + D - 1, lw, o * (i % 2 ? .85 : 1) + 1, lead, .2);
    out += R(50 - s.tab[0] * k / 2, y0 - s.tab[1] * k, s.tab[0] * k, s.tab[1] * k + 2, lead, 1) + `<circle cx="50" cy="${(y0 - s.tab[1] * k * .45).toFixed(1)}" r="${(s.hole * k / 2).toFixed(1)}" fill="#1a1d1f"/>`; }
  const rx = s.kind === "plcc" ? 2.2 * k * .4 : s.kind === "bga" ? 1.2 : Math.min(2, .3 * k);
  out += R(x0, y0, W, D, s.kind === "bga" ? "#3a3a26" : "url(#bd)", rx);
  if (s.kind === "bga") out += R(x0 + W * .06, y0 + D * .06, W * .88, D * .88, "url(#bd)", 1);
  if (s.kind === "qfn") for (let i = 0; i < s.side; i++) { const t = (i - (s.side - 1) / 2) * s.pitch * k + 50, pw = s.lw * k, pl = s.pad * k;
    out += R(t - pw / 2, y0, pw, pl, lead, .2) + R(t - pw / 2, y0 + D - pl, pw, pl, lead, .2) + R(x0, t - pw / 2, pl, pw, lead, .2) + R(x0 + W - pl, t - pw / 2, pl, pw, lead, .2); }
  if (s.kind === "diode") out += R(x0 + W * .1, y0 + 1, W * .12, D - 2, "#8b9196", .3);   // cathode band
  else if (s.kind !== "sip") { const r = Math.max(.9, Math.min(2.6, Math.min(W, D) * .06)); out += `<circle cx="${(x0 + r * 2.2).toFixed(1)}" cy="${(y0 + D - r * 2.2).toFixed(1)}" r="${r.toFixed(1)}" fill="#0d0f10" stroke="#3a3e41" stroke-width=".5"/>`; }
  const lines = m.length ? m : [""], len = Math.max(...lines.map(l => l.length), 3), cy = s.kind === "dpak" ? y0 + D * .55 : y0 + D / 2;
  const fs = Math.max(2.4, Math.min(W * .84 / (len * .6), D * .62 / (lines.length * 1.2), 8.4));
  return out + text(lines.slice(0, Math.max(1, Math.floor(D / (fs * 1.2)))), 50 + (s.kind === "diode" ? W * .06 : 0), cy, fs, "#c9ced1");
}
/* returns an <svg> string; viewBox is 100 x 100, chip centred, soft shadow underneath.
   unsure = the package is not confirmed: a plain body with the number and a "?" instead of invented pins */
function svg(name, pkg, unsure) {
  pkg = PKGS[pkg] ? pkg : guessPkg(name);
  const m = marking(name), mk = "#c9ced1", s = unsure ? null : spec(name, pkg);
  let body = "";
  if (unsure) body = R(22, 30, 56, 40, "url(#bd)", 3) + `<rect x="22.5" y="30.5" width="55" height="39" rx="3" fill="none" stroke="#8d9499" stroke-width=".8" stroke-dasharray="2.4 2"/>`
    + text(m, 50, 50, Math.min(7, 50 / (Math.max(...m.map(l => l.length), 3) * .6)), mk) + `<circle cx="74" cy="34" r="6.5" fill="#d9a441"/><text x="74" y="34.6" text-anchor="middle" dominant-baseline="middle" font-family="Vazirmatn,Tahoma,sans-serif" font-weight="700" font-size="9" fill="#1d1a12">?</text>`;
  else if (s) body = topView(s, m);
  else if (pkg === "RELAY") {
    body = `<rect x="18" y="20" width="64" height="58" rx="5" fill="#123a5e"/><rect x="22" y="24" width="56" height="50" rx="3" fill="#174a77"/>`
      + text(m, 50, 49, 7, "#e7eef5") + `<rect x="24" y="66" width="52" height="4" rx="2" fill="#0f3150"/>`;
  } else if (pkg === "CAP") {
    body = `<rect x="30" y="26" width="40" height="48" rx="3" fill="#2a2d30"/><circle cx="50" cy="50" r="17" fill="url(#lg)"/><path d="M33 50 a17 17 0 0 1 17-17" stroke="#1d2a33" stroke-width="6" fill="none"/>` + text(m.slice(0, 1), 50, 82, 6, "#3c4a52");
  } else if (pkg === "VDR") {
    body = `<rect x="47" y="58" width="2" height="30" fill="url(#lg)"/><rect x="53" y="58" width="2" height="30" fill="url(#lg)"/><circle cx="51" cy="42" r="26" fill="#1f4f8a"/><circle cx="51" cy="42" r="22" fill="#2763a8"/>` + text(m.slice(0, 2), 51, 42, 6.4, "#e9f0f8");
  } else if (pkg === "MODULE") {
    body = R(16, 26, 68, 48, "#1d5c3f", 3) + R(22, 32, 24, 18, "url(#bd)", 1.5) + R(52, 36, 12, 8, "#c98238", 1) + R(68, 36, 10, 8, "#c98238", 1) + text(m.slice(0, 1), 50, 64, 6, "#e3efe7");
  } else if (pkg === "RES" || pkg === "DO218" || pkg === "SIP9" || pkg === "ZIP8" || pkg === "SIP10" || pkg === "TVSCAN") {
    const big = pkg !== "RES";
    body = R(14, 34, 72, 32, "url(#bd)", 2) + (big ? "" : R(10, 36, 10, 28, "url(#lg)", 1) + R(80, 36, 10, 28, "url(#lg)", 1)) + text(m.slice(0, 2), 50, 50, 7, mk);
  } else body = R(26, 33, 48, 34, "url(#bd)", 2) + text(m, 50, 50, 6.4, mk);
  const u = ++uid;                                                    // unique gradient ids per drawing (many chips on one page)
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)}">${DEFS}<ellipse cx="51" cy="64" rx="32" ry="9" fill="url(#sh)" opacity=".7"/>${body}</svg>`
    .replace(/id="(lg|bd|sh)"/g, `id="$1${u}"`).replace(/url\(#(lg|bd|sh)\)/g, `url(#$1${u})`);
}
return {svg, guessPkg, marking, PKGS, PACK, spec};
})();
