/* Packaging visuals shared by the storefront and the admin panel:
   a product photo, or a drawn blister card (colour + icon) until a photo is uploaded. */
window.TTPacks = (() => {
"use strict";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ICO = {
  tip:'<svg viewBox="0 0 100 70"><rect x="10" y="29" width="50" height="12" rx="6" fill="#c9ccd1"/><path d="M60 29 L92 35 L60 41z" fill="#8f949b"/></svg>',
  spool:'<svg viewBox="0 0 100 70"><ellipse cx="50" cy="35" rx="34" ry="28" fill="#c9cdd3"/><ellipse cx="50" cy="35" rx="26" ry="21" fill="#9aa0a8"/><ellipse cx="50" cy="35" rx="9" ry="7" fill="#2a2b2f"/></svg>',
  jar:'<svg viewBox="0 0 100 70"><rect x="30" y="16" width="40" height="44" rx="6" fill="#d8b56a"/><rect x="27" y="10" width="46" height="10" rx="3" fill="#3a3b40"/><rect x="36" y="30" width="28" height="14" rx="2" fill="#fff" opacity=".8"/></svg>',
  wick:'<svg viewBox="0 0 100 70"><circle cx="50" cy="35" r="24" fill="#245a8c"/><circle cx="50" cy="35" r="10" fill="#e9e3d6"/><path d="M74 35h18" stroke="#c98a3d" stroke-width="5"/></svg>',
  probe:'<svg viewBox="0 0 100 70"><path d="M10 52 L62 18" stroke="#1d1d1f" stroke-width="9" stroke-linecap="round"/><path d="M62 18 L84 6" stroke="#b9bdc4" stroke-width="3"/><path d="M18 62 L70 28" stroke="#c0392b" stroke-width="9" stroke-linecap="round"/><path d="M70 28 L92 16" stroke="#b9bdc4" stroke-width="3"/></svg>',
  bulb:'<svg viewBox="0 0 100 70"><circle cx="40" cy="30" r="16" fill="#f6e27a"/><rect x="33" y="44" width="14" height="10" fill="#8d9096"/><path d="M47 54 L90 62" stroke="#1d1d1f" stroke-width="4"/></svg>',
  cutter:'<svg viewBox="0 0 100 70"><path d="M30 8 L52 40 M70 8 L48 40" stroke="#5a5f66" stroke-width="7" stroke-linecap="round"/><path d="M52 40 L40 66 M48 40 L62 66" stroke="#0E7A4B" stroke-width="10" stroke-linecap="round"/></svg>',
  heater:'<svg viewBox="0 0 100 70"><rect x="14" y="28" width="62" height="14" rx="7" fill="#c9ccd1"/><rect x="74" y="31" width="14" height="8" rx="2" fill="#2b2b2b"/><path d="M14 35 H4" stroke="#b33" stroke-width="3"/></svg>',
  nozzle:'<svg viewBox="0 0 100 70"><path d="M30 10 h40 l-8 40 h-24z" fill="#9aa0a8"/><rect x="40" y="50" width="8" height="14" fill="#7a7f87"/><rect x="52" y="50" width="8" height="14" fill="#7a7f87"/></svg>',
  tube:'<svg viewBox="0 0 100 70"><path d="M20 22 h48 l12 10 v6 l-12 10 h-48z" fill="#e8c24a"/><rect x="80" y="31" width="12" height="8" fill="#333"/></svg>',
};
const NAMES = {tip:"نوک/میله", spool:"قرقره", jar:"قوطی", wick:"حلقه", probe:"پراب", bulb:"لامپ", cutter:"انبر/کف‌چین", heater:"هیتر", nozzle:"نازل", tube:"تیوب"};
function html(p) {
  if (p.photo && /^ic-/.test(p.cat || "")) return `<span class="chip-pk ph"><img src="${esc((p.thumbs && p.thumbs[0]) || p.photo)}" alt="" loading="lazy" decoding="async"></span>`;   // ICs: the shop's own photo of the part
  if (!p.photo && /^ic-/.test(p.cat || "") && window.TTChips) return `<span class="chip-pk">${window.TTChips.svg(p.name, p.pkg || window.TTChips.guessPkg(p.name, p.cat), p.pkgOk === false)}</span>`;   // ICs: drawn package with the part number
  if (p.photo) return `<img src="${esc(p.photo)}" alt="" width="176" height="318" loading="lazy" decoding="async">${p.tip ? `<span class="code">${esc(p.code)}</span>` : ""}`;
  return `<span class="card-pk" style="--c:${esc(p.color || "#0E7A4B")}"><span class="band">${esc(p.code)}</span><span class="ico">${ICO[p.ico] || ICO.tip}</span><span class="nm">${esc(p.name)}</span></span>`;
}
return {ICO, NAMES, html, esc};
})();
