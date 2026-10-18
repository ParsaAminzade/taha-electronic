/* Taha Electronic storefront. Hash routes so every page has its own link:
   #/  #/shop?cat=&q=&view=&stock=&sort=  #/product/:id  #/cart  #/checkout  #/done/:code
   #/track  #/account  #/guide  #/contact  #/help
   Catalog, stock, orders and login come from the store API (api.js). The cart lives in this browser. */
(() => {
"use strict";
const API = window.ShopAPI;

/* ---------- state from the API ---------- */
let CATS = [], P = [], byId = {}, SET = {}, SHIP = [], PAY_ONLINE = false, user = null;
const TIP_COMPAT = "ایستگاه‌های لحیم‌کاری سری ۹۳۶ / ۹۳۷ و سازگار با 900M";
const PROVINCES = ["فارس","تهران","اصفهان","خراسان رضوی","خوزستان","بوشهر","کرمان","یزد","هرمزگان","کهگیلویه و بویراحمد","آذربایجان شرقی","آذربایجان غربی","البرز","گیلان","مازندران","کرمانشاه","سایر استان‌ها"];
function applyBoot(b) {
  CATS = b.cats || []; SET = b.settings || {}; SHIP = b.ship || []; PAY_ONLINE = !!b.pay_online; user = b.user || null;
  P = (b.products || []).map((p, i) => ({...p, order: i}));
  byId = Object.fromEntries(P.map(p => [String(p.id), p]));
  Object.keys(cart).forEach(id => { if (!byId[id]) delete cart[id]; });      // drop items that are no longer sold
  saveCart();
}
const catName = id => (CATS.find(c => c.id === id) || {}).name || "";
/* ECU parts (categories with a cabinet style) live in the IC cabinet wall, not on the pegboard */
const isIC = p => /^ic-/.test(p.cat || "");
const SHOPCATS = () => CATS.filter(c => !c.cab), ICCATS = () => CATS.filter(c => c.cab && P.some(p => p.cat === c.id));
const spec = (p, k) => ((p.specs || []).find(r => r[0] === k) || [])[1] || "";
const tipBits = p => p.code.includes("-T-") ? p.code.split("-T-") : [p.code, ""];

/* ---------- local storage (cart and last address only) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("tt-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("tt-" + k, JSON.stringify(v)); } catch (e) {} },
};
let cart = store.get("cart", {});
const saveCart = () => store.set("cart", cart);

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fa = n => Number(n).toLocaleString("fa-IR");
/* names mix Persian and English part numbers: keep each part number in one piece, isolated for RTL */
const nameHTML = s => esc(s).replace(/[A-Za-z0-9][A-Za-z0-9.\-\/()]*[A-Za-z0-9)]/g, m => `<bdi class="pn-keep">${m}</bdi>`);
const faD = s => String(s ?? "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);            // digits only, for codes like 32-1
const toman = n => `${fa(n)} <small>تومان</small>`;
const tomanTxt = n => `${fa(n)} تومان`;
const enDigits = s => String(s || "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const icon = (id, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const avail = p => Math.max(0, p.stock - (cart[p.id] || 0));
const cartQty = () => Object.values(cart).reduce((a, b) => a + b, 0);
const cartItems = () => Object.keys(cart).filter(id => byId[id] && cart[id] > 0).map(id => ({p: byId[id], q: cart[id]}));
const subtotal = () => cartItems().reduce((s, x) => s + x.p.price * x.q, 0);
const FREE = () => +SET.free_ship || 0;
function stockBadge(p) {
  const n = avail(p);
  if (n <= 0) return p.stock > 0 ? `<span class="stock low">همه‌اش در سبد شماست</span>` : `<span class="stock out">ناموجود</span>`;
  if (n <= Math.max(1, p.low_at)) return `<span class="stock low">فقط ${fa(n)} عدد باقی مانده</span>`;
  return `<span class="stock">موجود</span>`;
}
/* delivery estimate: "to day X" instead of just a speed (Fridays skipped) */
function addWorkdays(d, n) { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 5) n--; } return x; }
const faDay = d => d.toLocaleDateString("fa-IR", {weekday: "long", day: "numeric", month: "long"});
function eta(m) {
  const now = new Date(), late = now.getHours() >= (+SET.cutoff_hour || 14) || now.getDay() === 5;
  const a = addWorkdays(now, m.days[0] + (late ? 1 : 0)), b = addWorkdays(now, m.days[1] + (late ? 1 : 0));
  if (m.id === "pickup") return late ? `آماده‌ی تحویل از ${faDay(a)}` : "آماده‌ی تحویل از امروز";
  return m.days[0] === m.days[1] ? `تحویل ${faDay(a)}` : `تحویل ${faDay(a)} تا ${faDay(b)}`;
}
function cutoffNote() {
  const now = new Date(), cut = +SET.cutoff_hour || 14;
  if (now.getDay() === 5 || now.getHours() >= cut) return "";
  const mins = (cut - now.getHours()) * 60 - now.getMinutes(), h = Math.floor(mins / 60), m = mins % 60;
  return `تا ${h ? fa(h) + " ساعت و " : ""}${fa(m)} دقیقه‌ی دیگر سفارش دهید، امروز ارسال می‌شود.`;
}

/* ---------- packaging visuals (packs.js) ---------- */
const packHTML = p => window.TTPacks.html(p);

/* ---------- rack (pegboard) ---------- */
const VIS_MAX = 6;
function hookHTML(p) {
  const n = avail(p), out = n <= 0;
  const tag = `<div class="tag${out ? " out" : ""}"><b class="num">${tomanTxt(p.price)}</b><small>${out ? "ناموجود" : fa(n) + " عدد"}</small></div><i class="rod" aria-hidden="true"></i>`;
  if (out) return `<li class="hook">${tag}<div class="empty-hook"><span>${esc(p.short || p.name)}</span><button class="btn sm outline" type="button" data-notify="${p.id}" aria-label="وقتی ${esc(p.short || p.name)} موجود شد خبرم کن">${icon("i-bell")}<span class="lbl-long">موجود شد خبرم کن</span><span class="lbl-short">خبرم کن</span></button></div></li>`;
  let packs = "";
  for (let k = Math.min(n, VIS_MAX) - 1; k >= 0; k--) {
    const style = `transform:translate(${-k * 3}px,${-k * 7}px) scale(${(1 - k * .025).toFixed(3)});filter:brightness(${(1 - k * .13).toFixed(2)});z-index:${10 - k}`;
    packs += k === 0
      ? `<a class="pk front" href="#/product/${p.id}" style="${style}" aria-label="${esc(p.name)}، ${tomanTxt(p.price)}، ${fa(n)} عدد">${packHTML(p)}</a>`
      : `<span class="pk" style="${style}" aria-hidden="true">${packHTML(p)}</span>`;
  }
  return `<li class="hook">${tag}<div class="stack">${packs}</div><button class="quick" type="button" data-add="${p.id}" aria-label="افزودن ${esc(p.name)} به سبد">${icon("i-plus")}افزودن</button></li>`;
}
function rackHTML(list, {grouped = true} = {}) {
  if (!list.length) return "";
  if (!grouped) return `<div class="rack"><ul class="hooks">${list.map(hookHTML).join("")}</ul></div>`;
  let h = "";
  for (const c of SHOPCATS()) {
    const items = list.filter(p => p.cat === c.id);
    if (items.length) h += `<h3 class="rail">${esc(c.name)}<a href="#/shop?cat=${c.id}">همه‌ی ${esc(c.name)}</a></h3><ul class="hooks">${items.map(hookHTML).join("")}</ul>`;
  }
  return `<div class="rack">${h}</div>`;
}
function cardHTML(p) {
  const n = avail(p);
  return `<article class="pcard">
    <a class="media" href="#/product/${p.id}" aria-label="${esc(p.name)}"><span class="pk">${packHTML(p)}</span>${p.tip ? `<span class="pill">سه‌بعدی</span>` : ""}</a>
    <div class="body"><a class="t" href="#/product/${p.id}">${nameHTML(p.name)}</a><span class="c">${esc(p.code)}</span>${stockBadge(p)}
      <div class="pc-foot"><span class="price num">${toman(p.price)}</span>
        ${n > 0 ? `<button class="btn sm" type="button" data-add="${p.id}" aria-label="افزودن ${esc(p.name)} به سبد">${icon("i-plus")}افزودن</button>`
                : `<button class="btn sm outline" type="button" data-notify="${p.id}">${icon("i-bell")}خبرم کن</button>`}</div></div></article>`;
}

/* ---------- cart ---------- */
function updateBadges() {
  const n = cartQty();
  $$("[data-cart-count]").forEach(b => { b.textContent = fa(n); b.dataset.n = n; b.classList.remove("bump"); void b.offsetWidth; if (n) b.classList.add("bump"); });
}
function flyToCart(fromEl) {
  const target = $$("[data-cart-count]").map(b => b.parentElement).find(a => a.offsetParent);
  if (!fromEl || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = fromEl.getBoundingClientRect(), t = target.getBoundingClientRect(); if (!r.width) return;
  const f = fromEl.cloneNode(true); f.className = "flyer pk"; f.removeAttribute("style"); f.removeAttribute("href");
  Object.assign(f.style, {left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px"});
  document.body.appendChild(f);
  const dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
  f.animate([{transform:"translate(0,0) scale(1)"},{transform:`translate(${dx * .35}px,${dy * .35 - 60}px) scale(.7) rotate(-8deg)`,offset:.45},{transform:`translate(${dx}px,${dy}px) scale(.12) rotate(-20deg)`,opacity:.3}],
    {duration:700, easing:"cubic-bezier(.5,0,.3,1)"}).onfinish = () => f.remove();
}
function addToCart(id, qty = 1, srcEl) {
  const p = byId[id]; if (!p) return;
  qty = Math.min(qty, avail(p));
  if (qty <= 0) { toast("از این کالا بیشتر موجود نیست."); return; }
  flyToCart(srcEl);
  cart[id] = (cart[id] || 0) + qty; saveCart(); updateBadges();
  toast(`${esc(p.short || p.name)} به سبد اضافه شد.`, {label: "دیدن سبد", go: "#/cart"});
  refresh();
}
function setQty(id, q) { const p = byId[id]; q = Math.max(0, Math.min(q, p.stock)); if (q === 0) delete cart[id]; else cart[id] = q; saveCart(); updateBadges(); refresh(); }
function removeItem(id) {
  const q = cart[id]; delete cart[id]; saveCart(); updateBadges(); refresh();
  toast(`${esc(byId[id].short || byId[id].name)} از سبد حذف شد.`, {label: "بازگرداندن", fn: () => { cart[id] = q; saveCart(); updateBadges(); refresh(); }});
}

/* ---------- "notify me": ask for a mobile number once if not signed in ---------- */
async function notifyMe(id) {
  const p = byId[id]; let phone = user ? user.phone : store.get("phone", "");
  if (!user) {
    const r = await ask(`وقتی «${esc(p.name)}» موجود شد پیامک می‌دهیم.`, {label: "شماره‌ی موبایل", type: "tel", value: phone, check: v => /^09\d{9}$/.test(enDigits(v)) || "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید."});
    if (r === null) return; phone = enDigits(r); store.set("phone", phone);
  }
  try { await API.call("notify.add", {id: p.id, phone}); toast("ثبت شد. وقتی موجود شد پیامک می‌گیرید."); } catch (e) { toast(esc(e.message || "ثبت نشد.")); }
}
/* small accessible dialog with one field */
function ask(text, f) {
  return new Promise(res => {
    const d = document.createElement("dialog"); d.className = "card"; d.setAttribute("aria-labelledby", "dlg-t");
    d.innerHTML = `<form method="dialog" class="form" novalidate><p id="dlg-t" style="color:var(--ink);font-weight:700;margin-bottom:12px">${text}</p>
      <div class="field"><label for="dlg-in">${f.label}</label><input id="dlg-in" type="${f.type || "text"}" ${f.type === "tel" ? 'inputmode="tel" autocomplete="tel" dir="ltr"' : ""} value="${esc(f.value || "")}" aria-describedby="dlg-err"><span class="err" id="dlg-err" role="alert"></span></div>
      <div class="form-actions"><button class="btn ghost" value="cancel" type="button" data-x>انصراف</button><button class="btn" type="submit">ثبت</button></div></form>`;
    document.body.appendChild(d); d.showModal(); $("#dlg-in", d).focus();
    const done = v => { d.close(); d.remove(); res(v); };
    $("[data-x]", d).onclick = () => done(null);
    d.addEventListener("cancel", e => { e.preventDefault(); done(null); });
    $("form", d).onsubmit = e => { e.preventDefault(); const v = $("#dlg-in", d).value.trim(), c = f.check ? f.check(v) : true;
      if (c !== true) { $("#dlg-in", d).closest(".field").classList.add("invalid"); $("#dlg-err", d).textContent = c; $("#dlg-in", d).focus(); return; } done(v); };
  });
}

/* ---------- toast ---------- */
function toast(msg, act) {
  const box = $("#toasts"), t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span>${msg}</span>`;
  if (act) { const b = document.createElement("button"); b.type = "button"; b.textContent = act.label; b.onclick = () => { t.remove(); if (act.fn) act.fn(); else location.hash = act.go; }; t.appendChild(b); }
  box.appendChild(t); while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => t.remove(), 4500);
}

/* ---------- router ---------- */
function parse() { const h = location.hash.replace(/^#/, "") || "/"; const [path, qs] = h.split("?"); const parts = path.split("/").filter(Boolean);
  return {name: parts[0] || "home", arg: parts[1] ? decodeURIComponent(parts[1]) : null, q: new URLSearchParams(qs || "")}; }
let route = parse(), cleanup = null, firstRender = true, renderSeq = 0;
const VIEWS = {};
async function render(keepScroll) {
  route = parse(); const seq = ++renderSeq;
  const v = route.q.get("view");                                       // an old link with ?view= picks the matching look once
  if (v && (route.name === "shop" || route.name === "ic")) {
    const m = v === "rack" || v === "cab" ? "bench" : "grid"; route.q.delete("view");
    history.replaceState(null, "", "#/" + route.name + (route.q.toString() ? "?" + route.q : ""));
    if (m !== UI.mode) { UI.mode = m; document.documentElement.dataset.ui = m; try { localStorage.setItem("tt-ui", m); } catch (e) {} paintSwitch(); }
  }
  if (cleanup) { cleanup(); cleanup = null; }
  const view = VIEWS[route.name] || VIEWS.notfound;
  const y = scrollY;
  let out = view(route); if (out instanceof Promise) { if (!keepScroll) $("#app").innerHTML = `<div class="wrap"><div class="empty">در حال بارگذاری…</div></div>`; out = await out; }
  if (seq !== renderSeq) return;                                     // a newer navigation won
  $("#app").innerHTML = out.html;
  document.title = (out.title ? out.title + " | " : "") + (SET.store_name || "طاها الکترونیک");
  const navKey = {home:"home", shop:"shop", product:"shop", ic:"shop", guide:"guide", contact:"contact", cart:"cart", checkout:"cart", account:"account"}[route.name];
  $$("[data-nav]").forEach(a => { if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (out.mount) cleanup = out.mount() || null;
  if (keepScroll) scrollTo(0, y);
  else if (!firstRender) { scrollTo({top: 0, behavior: "instant"}); $("#app").focus({preventScroll: true}); }
  firstRender = false;
}
const refresh = () => render(true);
addEventListener("hashchange", () => render(false));

/* ---------- two looks, one switch ----------
   "bench" (ویترین): the shop as a workbench: PCB background, tactile buttons, hanging packs, IC cabinet, 3D.
   "grid" (شبکه): light, flat and quick to scan: product cards and the IC table.
   The switch sits in the header on every page and is remembered for this visitor. */
const UI = {mode: document.documentElement.dataset.ui === "grid" ? "grid" : "bench"};
function paintSwitch() {
  if (window.TTBoard) UI.mode === "bench" ? window.TTBoard.start() : window.TTBoard.stop();   // the living PCB belongs to the bench look
  $$(".modesw").forEach(s => s.dataset.on = UI.mode);
  $$(".modesw [data-mode]").forEach(b => { const on = b.dataset.mode === UI.mode; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
}
function setMode(m, refocus) {
  if (m === UI.mode) return;
  UI.mode = m; document.documentElement.dataset.ui = m;
  try { localStorage.setItem("tt-ui", m); } catch (e) {}
  paintSwitch(); refresh();
  if (refocus) { const b = $(`.modesw [data-mode="${m}"]`); if (b) b.focus({preventScroll: true}); }
}
document.addEventListener("click", e => { const b = e.target.closest(".modesw [data-mode]"); if (b) setMode(b.dataset.mode); });
document.addEventListener("keydown", e => {                          // radio group: arrows move the choice
  if (!e.target.closest || !e.target.closest(".modesw") || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
  e.preventDefault(); setMode(UI.mode === "bench" ? "grid" : "bench", true);
});
paintSwitch();

/* ---------- views ---------- */
VIEWS.home = r => {
  const rackItems = P.filter(p => p.cat === "tips" || p.cat === "solder");
  return {
  title: "نوک هویه، لوازم لحیم‌کاری و ابزار اندازه‌گیری",
  html: `
  <section class="hero" aria-labelledby="hero-h">
    <div class="wrap hero-in">
      <div class="hero-copy" data-par="copy">
        <p class="kicker">${esc(SET.store_name || "طاها الکترونیک")} · شیراز</p>
        <h1 id="hero-h">نوک هویه‌ی درست،<br><em>لحیم تمیز.</em></h1>
        <p class="lead">نوک‌های سری 900M، سیم لحیم، فلکس و ابزار اندازه‌گیری؛ اصل، با ارسال سریع از شیراز به سراسر کشور.</p>
        <div class="hero-cta"><a class="btn on-deep" href="#/shop?cat=tips">خرید نوک هویه</a><a class="btn outline on-deep-sec" href="#/guide">کدام نوک را بخرم؟</a></div>
        <div class="hero-trust"><span>${icon("i-shield")}ضمانت اصالت کالا</span><span>${icon("i-truck")}ارسال به سراسر کشور</span></div>
      </div>
      <div class="hero-stage" aria-hidden="true">
        <div class="giant" data-par="giant">900<b>M</b></div>
        <div class="hang" data-par="hang"><i class="peg"></i><img src="assets/tip-pack.png" alt="" width="176" height="318"></div>
      </div>
    </div>
  </section>
  <div class="wrap"><div class="tbar">
    <div>${icon("i-truck")}<span><b>ارسال سریع</b><span>پیک شیراز، پست و تیپاکس</span></span></div>
    <div>${icon("i-shield")}<span><b>ضمانت اصالت</b><span>کالای اصل با فاکتور</span></span></div>
    <div>${icon("i-return")}<span><b>۷ روز بازگشت</b><span>طبق شرایط بازگشت کالا</span></span></div>
    <div>${icon("i-phone")}<span><b>مشاوره‌ی فنی</b><span>قبل از خرید بپرسید</span></span></div>
  </div></div>
  <section class="sec wrap" aria-labelledby="cats-h">
    <div class="sec-h"><h2 id="cats-h">دسته‌بندی‌ها</h2><a class="btn ghost" href="#/shop">همه‌ی محصولات</a></div>
    <div class="cats">${SHOPCATS().map(c => `<a class="cat" href="#/shop?cat=${c.id}"><span class="ci">${icon(c.icon)}</span><b>${esc(c.name)}</b><small>${esc(c.note)}</small></a>`).join("")}
      ${ICCATS().length ? `<a class="cat" href="#/ic"><span class="ci">${icon("i-chip")}</span><b>آی‌سی‌های ECU</b><small>${fa(P.filter(isIC).length)} قطعه در قفسه</small></a>` : ""}</div>
  </section>
  ${rackItems.length ? `<section class="sec wrap" aria-labelledby="rack-h" style="padding-top:0">
    <div class="sec-h"><div><p class="kicker">ویترین</p><h2 id="rack-h">نوک‌های هویه و لوازم لحیم‌کاری</h2></div><a class="btn ghost" href="#/shop?view=rack">نمای کامل</a></div>
    ${rackHTML(rackItems)}</section>` : ""}
  ${ICCATS().length ? `<section class="sec wrap" aria-labelledby="ich-h" style="padding-top:0">
    <div class="sec-h"><div><p class="kicker">قفسه‌ی آی‌سی</p><h2 id="ich-h">آی‌سی‌های ECU خودرو</h2><p>${fa(P.filter(isIC).length)} قطعه، هر کدام در کشوی خودش. شماره‌ی قطعه را جستجو کنید تا کشویش باز شود.</p></div><a class="btn" href="#/ic">ورود به قفسه</a></div>
    <div class="icwall" id="icwall">${ICCATS().slice(0, 2).map(c => window.TTCabinet.cabinetHTML(c, P.filter(p => p.cat === c.id), avail, {limit: 8})).join("")}</div></section>` : ""}
  ${TIPS3D().length ? lineupHTML() : ""}
  <section class="sec wrap" aria-labelledby="g-h">
    <div class="card guide" style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center">
      <div><p class="kicker">راهنمای انتخاب</p><h2 id="g-h" style="font-size:var(--fs-24)">نمی‌دانید کدام نوک مناسب کار شماست؟</h2><p>با یک سؤال ساده، نوک مناسب را پیشنهاد می‌دهیم.</p></div>
      <a class="btn" href="#/guide">شروع راهنما</a></div>
  </section>
  ${storeInfoHTML()}`,
  mount() {
    const par = () => { const y = scrollY; if (y > innerHeight * 1.2) return;
      const g = $("[data-par=giant]"), h = $("[data-par=hang]"), c = $("[data-par=copy]"); if (!g) return;
      g.style.transform = `translateY(calc(-50% + ${y * .3}px))`; h.style.transform = `translateY(${y * -.1}px)`; c.style.transform = `translateY(${y * .08}px)`; };
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) addEventListener("scroll", par, {passive: true});
    const stop3d = mountLineup(r.q.get("tip"));
    const stopHero = mountHero3D();
    const stopCab = $("#icwall") ? window.TTCabinet.mount($("#icwall"), byId, {detail: icDetail, view3d: icView3D}) : null;
    return () => { removeEventListener("scroll", par); stop3d && stop3d(); stopHero(); stopCab && stopCab(); };
  }};
};
function storeInfoHTML() {
  return `<section class="sec wrap" aria-labelledby="st-h" style="padding-top:0">
    <div class="sec-h"><h2 id="st-h">خرید حضوری</h2><a class="btn ghost" href="#/contact">نشانی و ساعت کاری</a></div>
    <div class="info">
      <div class="card">${icon("i-pin")}<b>نشانی فروشگاه</b><span>${esc(SET.address || "شیراز")}</span></div>
      <div class="card">${icon("i-clock")}<b>ساعت کاری</b><span>${esc(SET.hours || "با فروشگاه تماس بگیرید")}</span></div>
      <div class="card">${icon("i-phone")}<b>تلفن</b><a href="tel:${esc(enDigits(SET.phone).replace(/\D/g, ""))}" class="num"><span class="ltr">${esc(SET.phone)}</span></a></div>
    </div></section>`;
}

/* 3D tip lineup (WebGL loads only when the section comes near) */
const TIPS3D = () => P.filter(p => p.tip);
function tipPanelHTML(p) {
  const [a, b] = tipBits(p), n = avail(p);
  return `<div class="tcode">${esc(a)}${b ? `-T-<span>${esc(b)}</span>` : ""}</div><h3>${esc(p.short || p.name)}</h3><p>${esc(p.why)}</p>
    <table><tr><th scope="row">شکل</th><td>${esc(spec(p, "شکل"))}</td></tr><tr><th scope="row">مناسب برای</th><td>${esc(spec(p, "مناسب برای"))}</td></tr><tr><th scope="row">سازگاری</th><td>${TIP_COMPAT}</td></tr></table>
    <div class="tip-buy"><div><span class="price num">${tomanTxt(p.price)}</span><br>${n <= 0 ? `<span class="stock out">ناموجود</span>` : n <= p.low_at ? `<span class="stock low">فقط ${fa(n)} عدد</span>` : `<span class="stock">موجود</span>`}</div>
      ${n > 0 ? `<button class="btn on-deep" type="button" data-add="${p.id}">${icon("i-plus")}افزودن به سبد</button>` : `<a class="btn outline on-deep-sec" href="#/product/${p.id}">جزئیات</a>`}</div>`;
}
function lineupHTML() {
  const T = TIPS3D();
  return `<section class="lineup" id="tips" aria-labelledby="tips-h" style="height:${Math.max(2, T.length) * 110}vh">
    <div class="pin">
      <canvas id="tips3d" aria-hidden="true"></canvas>
      <div class="head"><h2 id="tips-h">نوک مناسب کار شما</h2><p>اسکرول کنید؛ نوک‌ها یکی‌یکی معرفی می‌شوند.</p></div>
      <div class="tip-panel" id="tipPanel" aria-live="polite">${tipPanelHTML(T[0])}</div>
      <div class="tdots" role="group" aria-label="انتخاب نوک">${T.map((p, i) => `<button type="button" data-tip="${i}" aria-label="${esc(p.short || p.name)}" aria-current="${i === 0}"><i></i>${esc(tipBits(p)[1] || p.code)}</button>`).join("")}</div>
      <a class="skip3d" href="#after-tips">رد شدن از معرفی</a>
    </div></section><span id="after-tips"></span>`;
}
function mountLineup(startTip) {
  const sec = $("#tips"); if (!sec) return null;
  const T = TIPS3D(); let cur = 0, api3d = null, dead = false;
  const show = i => { if (i === cur) return; cur = i; const panel = $("#tipPanel"); panel.classList.add("swap");
    setTimeout(() => { if (dead) return; panel.innerHTML = tipPanelHTML(T[i]); panel.classList.remove("swap"); }, 160);
    $$(".tdots button").forEach((b, k) => b.setAttribute("aria-current", k === i)); };
  const go = i => { const span = sec.offsetHeight - innerHeight; scrollTo({top: sec.offsetTop + span * (T.length > 1 ? i / (T.length - 1) : 0), behavior: "smooth"}); };
  sec.addEventListener("click", e => { const b = e.target.closest("[data-tip]"); if (b) go(+b.dataset.tip); });
  if (startTip) { const i = T.findIndex(p => String(p.id) === startTip); if (i >= 0) setTimeout(() => go(i), 300); }
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting || api3d) return; io.disconnect();
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js").then(() => loadScript("tips3d.js"))
      .then(() => { if (!dead && window.TipLineup) api3d = window.TipLineup.mount(sec, T.map(p => p.tip), show); })
      .catch(() => document.documentElement.classList.add("nogl"));
  }, {rootMargin: "600px"});
  io.observe(sec);
  return () => { dead = true; io.disconnect(); if (api3d) api3d.destroy(); };
}
/* 3D hero: progressive enhancement over the CSS hero. Skipped on data-saver / very weak devices
   and without WebGL, so those visitors keep the light CSS version. */
const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json";
let fontJSON = null;
function mountHero3D() {
  const hero = $(".hero"); let api3d = null, dead = false;
  const weak = (navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory || 8) <= 2;
  let gl = false; try { const c = document.createElement("canvas"); gl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) {}
  if (!hero || weak || !gl || UI.mode === "grid" || /[?&]flat\b/.test(location.search)) return () => {};   // the grid look stays light: CSS hero
  Promise.all([loadScript(THREE_URL), fontJSON ? fontJSON : fetch(FONT_URL).then(r => r.ok ? r.json() : null).catch(() => null)])
    .then(([, font]) => { fontJSON = font; return loadScript("hero3d.js").then(() => font); })
    .then(font => { if (!dead && window.Hero3D) api3d = window.Hero3D.mount(hero, {products: P, font, photo: "assets/tip-pack.png"}); })
    .catch(() => {});                                                // any failure: the CSS hero simply stays
  return () => { dead = true; if (api3d) api3d.destroy(); };
}
const loaded = {};
const loadScript = src => loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));

/* details shown inside the zoomed drawer */
function icDetail(p) {
  const n = avail(p), sp = Object.fromEntries(p.specs || []);
  const code = p.pkg || window.TTChips.guessPkg(p.name, p.cat), o = p.pkgOk !== false && window.TTChips.spec(p.name, code);
  const dims = o && !["RELAY", "CAP"].includes(code) ? `${fa(+o.bw.toFixed(2))}×${fa(+o.bd.toFixed(2))} میلی‌متر، ${fa(o.pins)} پایه` : "";   // the checked outline's real size
  const pkg = (sp["بسته‌بندی"] || window.TTChips.PKGS[code] || "—") + (dims && p.pkgOk ? ` · ${dims}` : "");
  const kv = [["نوع", sp["نوع قطعه"]], ["سازنده", sp["سازنده"]], ["کاربرد در", sp["کاربرد در"]], ["بسته‌بندی", pkg], ["موجودی", p.stock ? fa(p.stock) + " عدد" : "تمام شده"]].filter(x => x[1]);
  return `<p class="kicker">${esc(catName(p.cat))}</p><h2 id="icz-t">${esc(p.name)}</h2>${stockBadge(p)}
    ${p.why ? `<p class="icz-why">${esc(p.why)}</p>` : ""}
    <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="icz-buy"><span class="price num">${toman(p.price)}</span>
      ${n > 0 ? `<button class="btn" type="button" data-add="${p.id}">${icon("i-cart")}افزودن به سبد</button>` : `<button class="btn outline" type="button" data-notify="${p.id}">${icon("i-bell")}موجود شد خبرم کن</button>`}</div>
    <a class="icz-more" href="#/product/${p.id}">صفحه‌ی کامل محصول</a>`;
}
/* what lies in the opened drawer: the shop's own photos of the part (first one shown), and the 3D model of its
   package. The model is loaded on first use, only for packages the generator knows, and skipped on data-saver /
   weak devices / ?flat. The svg drawing stays until a photo or the first 3D frame is ready. A part whose package
   has not been checked yet (p.pkgOk === false) gets no model: a wrong-looking chip is worse than none. */
function icView3D(floor, p) {
  const pkg = p.pkg || window.TTChips.guessPkg(p.name, p.cat), photos = p.photos || [];
  const weak = (navigator.connection && navigator.connection.saveData) || (navigator.deviceMemory || 8) <= 2 || /[?&]flat\b/.test(location.search);
  const can3d = !weak && p.pkgOk !== false && !!window.TTChips.spec(p.name, pkg);
  const mount3d = () => { let dead = false, kill = null;
    floor.classList.add("c3d-loading");
    Promise.all([loadScript(THREE_URL), loadScript("chip3d.js?v=4")]).then(() => {
      if (dead) return;
      kill = window.TTChip3D.mount(floor, p, pkg, () => { floor.classList.remove("c3d-loading"); floor.classList.add("has3d"); });
      if (!kill) floor.classList.remove("c3d-loading");
    }).catch(() => floor.classList.remove("c3d-loading"));
    return () => { dead = true; if (kill) kill(); floor.classList.remove("has3d", "c3d-loading"); }; };
  if (!photos.length) return can3d ? mount3d() : null;
  // photos: a zoomable photo, and a small rail to switch between the photos and the 3D model
  const view = document.createElement("div"), rail = document.createElement("div");
  view.className = "icz-ph"; rail.className = "icz-rail"; rail.setAttribute("role", "group"); rail.setAttribute("aria-label", "عکس‌ها و مدل سه‌بعدی");
  rail.innerHTML = photos.map((u, i) => `<button type="button" data-v="${i}" aria-label="عکس ${fa(i + 1)}"><img src="${esc((p.thumbs || [])[i] || u)}" alt=""></button>`).join("")
    + (can3d ? `<button type="button" data-v="3d" class="r3d" aria-label="مدل سه‌بعدی">3D</button>` : "");
  floor.append(view, rail); floor.classList.add("hasph");
  let kill3d = null, stopPZ = null;
  const show = v => {
    if (kill3d) { kill3d(); kill3d = null; } if (stopPZ) { stopPZ(); stopPZ = null; }
    $$("button", rail).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === String(v))));
    if (v === "3d") { view.hidden = true; floor.classList.remove("hasph"); kill3d = mount3d(); return; }
    floor.classList.add("hasph"); view.hidden = false;
    view.innerHTML = `<img src="${esc(photos[v])}" alt="${esc(p.name)} - عکس ${fa(+v + 1)}" draggable="false">`;
    stopPZ = panZoom(view, view.firstChild);
  };
  rail.addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) show(b.dataset.v); });
  show(0);
  return () => { if (kill3d) kill3d(); if (stopPZ) stopPZ(); view.remove(); rail.remove(); floor.classList.remove("hasph"); };
}
/* photo zoom: wheel / trackpad pinch / two fingers zoom toward the pointer (1x-4x), drag pans when zoomed,
   double-click toggles 2.5x. The photo never leaves its frame. */
function panZoom(box, img) {
  let s = 1, x = 0, y = 0; const pts = new Map(); let last = null, pinch = null;
  const clampXY = () => { const w = box.clientWidth, h = box.clientHeight, mx = w * (s - 1) / 2, my = h * (s - 1) / 2; x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); };
  const apply = () => { clampXY(); img.style.transform = `translate(${x}px,${y}px) scale(${s})`; box.classList.toggle("zoomed", s > 1.01); };
  const zoomAt = (ns, cx, cy) => { const r = box.getBoundingClientRect(), ox = cx - r.left - r.width / 2, oy = cy - r.top - r.height / 2;
    ns = Math.max(1, Math.min(4, ns)); x = ox - (ox - x) * ns / s; y = oy - (oy - y) * ns / s; s = ns; apply(); };
  const onWheel = e => { e.preventDefault(); zoomAt(s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX, e.clientY); };
  const down = e => { try { box.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s}; } else last = [e.clientX, e.clientY]; img.style.transition = "none"; };
  const move = e => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; zoomAt(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
    if (last && s > 1) { x += e.clientX - last[0]; y += e.clientY - last[1]; apply(); } last = [e.clientX, e.clientY]; };
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) last = null; else last = [...pts.values()][0]; img.style.transition = ""; };
  const dbl = e => { img.style.transition = ""; if (s > 1.01) { s = 1; x = y = 0; apply(); } else zoomAt(2.5, e.clientX, e.clientY); };
  box.addEventListener("wheel", onWheel, {passive: false}); box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up); box.addEventListener("dblclick", dbl);
  apply();
  return () => { box.removeEventListener("wheel", onWheel); box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move);
    box.removeEventListener("pointerup", up); box.removeEventListener("pointercancel", up); box.removeEventListener("dblclick", dbl); };
}
/* showcase view: hanging packs go on the pegboard, ECU parts go in their drawers in the IC cabinets */
function showcaseHTML(list, q) {
  const packs = list.filter(p => !isIC(p)), ics = list.filter(isIC);
  return (packs.length ? rackHTML(packs, {grouped: !q}) : "")
    + (ics.length ? `<div class="icwall" id="icwall" style="${packs.length ? "margin-top:var(--s6)" : ""}">${ICCATS().filter(c => ics.some(p => p.cat === c.id)).map(c => window.TTCabinet.cabinetHTML(c, ics.filter(p => p.cat === c.id), avail)).join("")}</div>` : "");
}

/* shop */
let sheetKeep = false;
VIEWS.shop = r => {
  const cats = (r.q.get("cat") || "").split(",").filter(Boolean);
  const q = (r.q.get("q") || "").trim(), inStock = r.q.get("stock") === "1";
  const sort = r.q.get("sort") || "default", view = UI.mode === "bench" ? "rack" : "grid";   // the header switch decides
  let list = P.filter(p => (cats.length ? cats.includes(p.cat) : (!isIC(p) || q)) && (!inStock || avail(p) > 0));   // ICs appear in search; the full list lives in the cabinet wall
  if (q) { const t = enDigits(q).toLowerCase(); list = list.filter(p => (p.name + " " + p.code + " " + catName(p.cat)).toLowerCase().includes(t)); }
  if (sort === "cheap") list.sort((a, b) => a.price - b.price);
  else if (sort === "exp") list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.order - b.order);
  const title = cats.length === 1 ? catName(cats[0]) : q ? `نتایج «${esc(q)}»` : "همه‌ی محصولات";
  return {
    title,
    html: `<div class="wrap">
      <nav class="crumbs" aria-label="مسیر"><a href="#/">خانه</a><span aria-hidden="true">/</span><span aria-current="page">${title}</span></nav>
      <div class="page-h"><h1>${title}</h1></div>
      <div class="shop">
        <aside class="filters card" id="filters" aria-label="فیلترها">
          <h2>فیلترها</h2>
          <fieldset><legend>دسته‌بندی</legend>${SHOPCATS().map(c => `<label class="opt"><input type="checkbox" name="cat" value="${c.id}" ${cats.includes(c.id) ? "checked" : ""}>${esc(c.name)}<small class="num">${fa(P.filter(p => p.cat === c.id).length)}</small></label>`).join("")}</fieldset>
          <fieldset><legend>موجودی</legend><label class="opt"><input type="checkbox" name="stock" ${inStock ? "checked" : ""}>فقط کالاهای موجود</label></fieldset>
          ${cats.length || inStock || q ? `<button class="btn ghost" type="button" data-clear style="margin-top:12px">پاک کردن فیلترها</button>` : ""}
          <button class="btn block" type="button" data-close-sheet hidden style="margin-top:16px">نمایش ${fa(list.length)} کالا</button>
        </aside>
        <div>
          <div class="toolbar">
            <button class="btn outline sm filter-open" type="button" data-open-sheet aria-controls="filters">${icon("i-filter")}فیلترها${cats.length || inStock ? ` (${fa(cats.length + inStock)})` : ""}</button>
            <span class="count num">${fa(list.length)} کالا</span>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <label class="sr-only" for="sort">مرتب‌سازی</label>
              <select class="sel" id="sort"><option value="default">پیش‌فرض (موجودها اول)</option><option value="cheap" ${sort === "cheap" ? "selected" : ""}>ارزان‌ترین</option><option value="exp" ${sort === "exp" ? "selected" : ""}>گران‌ترین</option></select>
            </div>
          </div>
          ${!list.length ? `<div class="empty card">${icon("i-search")}<b>کالایی پیدا نشد</b><p>عبارت دیگری را جستجو کنید یا فیلترها را پاک کنید.</p><button class="btn outline" type="button" data-clear style="margin-top:16px">پاک کردن فیلترها</button></div>`
            : view === "rack" ? showcaseHTML(list, q) : `<div class="grid">${list.map(cardHTML).join("")}</div>`}
        </div>
      </div></div>`,
    mount() {
      const setQ = (k, v) => { const p = new URLSearchParams(r.q); if (v) p.set(k, v); else p.delete(k); location.hash = "#/shop" + (p.toString() ? "?" + p : ""); };
      const f = $("#filters");
      f.addEventListener("change", () => { const p = new URLSearchParams(r.q);
        const c = $$("input[name=cat]:checked", f).map(i => i.value).join(","); if (c) p.set("cat", c); else p.delete("cat");
        if ($("input[name=stock]", f).checked) p.set("stock", "1"); else p.delete("stock");
        sheetKeep = f.classList.contains("sheet"); location.hash = "#/shop" + (p.toString() ? "?" + p : ""); });
      $("#sort").addEventListener("change", e => setQ("sort", e.target.value === "default" ? "" : e.target.value));
      $$("[data-clear]").forEach(b => b.addEventListener("click", () => { location.hash = "#/shop"; }));
      let scrim = null;
      const closeSheet = () => { f.classList.remove("sheet"); $("[data-close-sheet]", f).hidden = true; if (scrim) scrim.remove(); scrim = null; };
      const openSheet = () => { f.classList.add("sheet"); $("[data-close-sheet]", f).hidden = false; scrim = document.createElement("div"); scrim.style.cssText = "position:fixed;inset:0;z-index:49;background:rgba(10,20,15,.45)"; scrim.onclick = closeSheet; document.body.appendChild(scrim); $("input", f).focus(); };
      const onKey = e => { if (e.key === "Escape" && scrim) closeSheet(); };
      $("[data-open-sheet]").addEventListener("click", openSheet); $("[data-close-sheet]", f).addEventListener("click", closeSheet); addEventListener("keydown", onKey);
      if (sheetKeep && matchMedia("(max-width:900px)").matches) openSheet(); sheetKeep = false;
      const stopCab = $("#icwall") ? window.TTCabinet.mount($("#icwall"), byId, {detail: icDetail, view3d: icView3D}) : null;
      return () => { closeSheet(); removeEventListener("keydown", onKey); stopCab && stopCab(); };
    }
  };
};

/* product */
VIEWS.product = r => {
  const p = byId[r.arg]; if (!p) return VIEWS.notfound(r);
  const n = avail(p), inCart = cart[p.id] || 0, cheapest = SHIP.filter(m => m.price > 0).sort((a, b) => a.price - b.price)[0];
  const related = P.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4), cut = cutoffNote();
  return {
    title: p.name,
    html: `<div class="wrap">
      <nav class="crumbs" aria-label="مسیر"><a href="#/">خانه</a><span aria-hidden="true">/</span><a href="#/shop?cat=${p.cat}">${esc(catName(p.cat))}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.code || p.name)}</span></nav>
      <div class="pdp">
        ${isIC(p) && p.photos && p.photos.length ? `<div class="gallery ph-gal"><div class="icz-ph" id="gmain"><img src="${esc(p.photos[0])}" alt="${esc(p.name)}" draggable="false"></div>
          ${p.photos.length > 1 ? `<div class="icz-rail" role="group" aria-label="عکس‌ها">${p.photos.map((u, i) => `<button type="button" data-g="${i}" aria-label="عکس ${fa(i + 1)}" aria-pressed="${i === 0}"><img src="${esc((p.thumbs || [])[i] || u)}" alt=""></button>`).join("")}</div>` : ""}</div>`
          : `<div class="gallery"><span class="pk">${packHTML(p)}</span></div>`}
        <div>
          <h1>${nameHTML(p.name)}</h1><div class="code">${esc(p.code)}</div>
          <div class="buybox card">
            <div class="row"><span class="price num">${toman(p.price)}</span>${stockBadge(p)}</div>
            ${n > 0 ? `<div class="row" style="margin-top:16px">
                <div class="qty" role="group" aria-label="تعداد"><button type="button" data-q="-1" aria-label="کم کردن" disabled>${icon("i-minus")}</button><output id="qv" class="num" aria-live="polite">${fa(1)}</output><button type="button" data-q="1" aria-label="زیاد کردن" ${n <= 1 ? "disabled" : ""}>${icon("i-plus")}</button></div>
                <button class="btn" type="button" id="addBtn" style="flex:1">${icon("i-cart")}افزودن به سبد</button></div>`
              : `<button class="btn outline block" type="button" data-notify="${p.id}" style="margin-top:16px">${icon("i-bell")}موجود شد خبرم کن</button>`}
            ${inCart ? `<p class="ship-note">${icon("i-check")}<span>${fa(inCart)} عدد در سبد شماست. <a href="#/cart" style="color:var(--primary-700);font-weight:700">دیدن سبد</a></span></p>` : ""}
            ${cut && n > 0 ? `<p class="ship-note">${icon("i-clock")}<span>${cut}</span></p>` : ""}
            <p class="ship-note">${icon("i-truck")}<span>ارسال از ${cheapest ? tomanTxt(cheapest.price) : "—"}؛ برای خرید بالای ${tomanTxt(FREE())} رایگان. تحویل حضوری از فروشگاه هم ممکن است.</span></p>
            <p class="ship-note">${icon("i-return")}<span>۷ روز ضمانت بازگشت کالا. <a href="#/help" style="color:var(--primary-700);font-weight:700">شرایط بازگشت</a></span></p>
          </div>
          ${p.why ? `<p>${esc(p.why)}</p>` : ""}
          ${(() => { const rows = [...(p.specs || [])];
            if (isIC(p)) { if (!rows.some(r => r[0] === "بسته‌بندی")) rows.unshift(["بسته‌بندی", window.TTChips.PKGS[p.pkg || window.TTChips.guessPkg(p.name, p.cat)] || "—"]); rows.unshift(["شماره‌ی قطعه", p.name]); }
            return rows.length ? `<h2 class="tabs-h">مشخصات</h2><table class="specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td ${k === "شماره‌ی قطعه" ? 'dir="ltr" style="text-align:right;font-family:Consolas,monospace;font-weight:700"' : ""}>${esc(v)}</td></tr>`).join("")}<tr><th scope="row">دسته</th><td>${esc(catName(p.cat))}</td></tr></tbody></table>` : ""; })()}
          ${isIC(p) ? `<p style="margin-top:16px"><a class="btn outline" href="#/ic?find=${p.id}">پیدا کردن در قفسه</a></p>` : ""}
          ${p.tip ? `<p style="margin-top:16px"><a class="btn outline" href="#/?tip=${p.id}">دیدن مدل سه‌بعدی این نوک</a></p>` : ""}
        </div>
      </div>
      ${related.length ? `<section class="sec" style="padding-top:0" aria-labelledby="rel-h"><div class="sec-h"><h2 id="rel-h">از همین دسته</h2></div><div class="grid">${related.map(cardHTML).join("")}</div></section>` : ""}
    </div>
    ${n > 0 ? `<div class="sticky-buy"><span class="price num">${toman(p.price)}</span><button class="btn" type="button" data-add="${p.id}">${icon("i-cart")}افزودن به سبد</button></div>` : ""}`,
    mount() {
      const gm = $("#gmain"); let stopPZ = gm ? panZoom(gm, gm.firstChild) : null;   // part photos: zoomable, thumbnails switch
      if (gm) $$("[data-g]").forEach(b => b.addEventListener("click", () => { if (stopPZ) stopPZ();
        gm.innerHTML = `<img src="${esc(p.photos[+b.dataset.g])}" alt="${esc(p.name)} - عکس ${fa(+b.dataset.g + 1)}" draggable="false">`; stopPZ = panZoom(gm, gm.firstChild);
        $$("[data-g]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); }));
      let q = 1; const out = $("#qv"); if (!out) return () => stopPZ && stopPZ();
      $$("[data-q]").forEach(b => b.addEventListener("click", () => { q = Math.max(1, Math.min(n, q + +b.dataset.q)); out.textContent = fa(q);
        $("[data-q='-1']").disabled = q <= 1; $("[data-q='1']").disabled = q >= n; }));
      $("#addBtn").addEventListener("click", () => addToCart(p.id, q, $(".gallery .pk") || $("#gmain")));
      return () => stopPZ && stopPZ();
    }
  };
};

/* cart */
function summaryHTML(m, cta) {
  const sub = subtotal(), shipCost = !m ? null : (m.id === "pickup" || sub >= FREE() ? 0 : m.price);
  return `<aside class="summary card" aria-labelledby="sum-h"><h2 id="sum-h">خلاصه‌ی سفارش</h2><dl>
    <div><dt>جمع کالاها (${fa(cartQty())})</dt><dd class="num">${tomanTxt(sub)}</dd></div>
    <div><dt>هزینه‌ی ارسال</dt><dd class="num">${shipCost == null ? "در مرحله‌ی بعد" : shipCost === 0 ? "رایگان" : tomanTxt(shipCost)}</dd></div>
    <div class="total"><dt>مبلغ قابل پرداخت</dt><dd class="num">${tomanTxt(sub + (shipCost || 0))}</dd></div></dl>
    ${sub < FREE() ? `<p class="ship-note">${icon("i-truck")}<span>${tomanTxt(FREE() - sub)} دیگر تا ارسال رایگان</span></p>` : `<p class="ship-note">${icon("i-check")}<span>ارسال رایگان شد</span></p>`}
    ${cta || ""}</aside>`;
}
VIEWS.cart = () => {
  const items = cartItems();
  if (!items.length) return {title: "سبد خرید", html: `<div class="wrap"><div class="page-h"><h1>سبد خرید</h1></div><div class="empty card">${icon("i-cart")}<b>سبد خرید شما خالی است</b><p>از فروشگاه یا ویترین، کالای مورد نیازتان را اضافه کنید.</p><a class="btn" href="#/shop" style="margin-top:16px">رفتن به فروشگاه</a></div></div>`};
  return {
    title: "سبد خرید",
    html: `<div class="wrap"><div class="page-h"><h1>سبد خرید</h1></div><div class="two">
      <section class="card" aria-label="کالاهای سبد">${items.map(({p, q}) => `
        <div class="citem">
          <a class="thumb" href="#/product/${p.id}" aria-hidden="true" tabindex="-1"><span class="pk">${packHTML(p)}</span></a>
          <div><a class="t" href="#/product/${p.id}">${nameHTML(p.name)}</a><div class="price num" style="font-weight:600">${toman(p.price)}</div>${q > p.stock ? `<span class="stock out">فقط ${fa(p.stock)} عدد موجود است</span>` : ""}</div>
          <div class="act">
            <div class="qty" role="group" aria-label="تعداد ${esc(p.short || p.name)}"><button type="button" data-set="${p.id}" data-v="${q - 1}" aria-label="کم کردن" ${q <= 1 ? "disabled" : ""}>${icon("i-minus")}</button><output class="num">${fa(q)}</output><button type="button" data-set="${p.id}" data-v="${q + 1}" aria-label="زیاد کردن" ${q >= p.stock ? "disabled" : ""}>${icon("i-plus")}</button></div>
            <button class="link-danger" type="button" data-remove="${p.id}">${icon("i-trash")}حذف</button>
          </div></div>`).join("")}</section>
      ${summaryHTML(null, `<a class="btn block" href="#/checkout" style="margin-top:16px">ادامه‌ی خرید</a>`)}
    </div></div>`,
  };
};

/* checkout: 1) delivery method  2) details (address only when it's needed)  3) review + payment.
   Guest checkout; required and optional fields both marked; specific errors next to fields. */
const ck = {step: 1, info: store.get("addr", {}), ship: store.get("ship", ""), pay: ""};
const FIELDS = [
  {k:"name", label:"نام و نام خانوادگی", req:1, auto:"name"},
  {k:"mobile", label:"شماره‌ی موبایل", req:1, type:"tel", mode:"tel", auto:"tel", ltr:1, help:"برای پیامک کد رهگیری و هماهنگی تحویل؛ جای دیگری استفاده نمی‌شود.", check:v => /^09\d{9}$/.test(enDigits(v)) || "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید."},
  {k:"province", label:"استان", req:1, addr:1, select:PROVINCES, auto:"address-level1"},
  {k:"city", label:"شهر", req:1, addr:1, auto:"address-level2", check:v => ck.ship !== "courier" || v.includes("شیراز") || "پیک فقط برای شهر شیراز است؛ روش ارسال را عوض کنید."},
  {k:"address", label:"نشانی کامل", req:1, addr:1, full:1, area:1, auto:"street-address", help:"خیابان، کوچه، پلاک، واحد", check:v => v.length >= 10 || "نشانی را کامل‌تر بنویسید."},
  {k:"postal", label:"کد پستی", req:0, addr:1, mode:"numeric", auto:"postal-code", ltr:1, help:"۱۰ رقم بدون خط تیره", check:v => !v || /^\d{10}$/.test(enDigits(v)) || "کد پستی باید ۱۰ رقم باشد."},
];
const activeFields = () => FIELDS.filter(f => !(f.addr && ck.ship === "pickup"));
function fieldHTML(f) {
  const v = esc(ck.info[f.k] || ""), id = "f-" + f.k, d = `${id}-help ${id}-err`;
  const tag = f.req ? ` <span class="req" aria-hidden="true">*</span><span class="sr-only">(الزامی)</span>` : ` <small style="font-weight:400;color:var(--mute)">(اختیاری)</small>`;
  const ctrl = f.select ? `<select id="${id}" name="${f.k}" autocomplete="${f.auto}" aria-describedby="${d}" ${f.req ? "required" : ""}><option value="">انتخاب کنید</option>${f.select.map(o => `<option ${o === ck.info[f.k] ? "selected" : ""}>${o}</option>`).join("")}</select>`
    : f.area ? `<textarea id="${id}" name="${f.k}" autocomplete="${f.auto}" aria-describedby="${d}" ${f.req ? "required" : ""}>${v}</textarea>`
    : `<input id="${id}" name="${f.k}" type="${f.type || "text"}" ${f.mode ? `inputmode="${f.mode}"` : ""} ${f.ltr ? 'dir="ltr"' : ""} autocomplete="${f.auto}" value="${v}" aria-describedby="${d}" ${f.req ? "required" : ""}>`;
  return `<div class="field${f.full ? " full" : ""}"><label for="${id}">${f.label}${tag}</label>${ctrl}<span class="help" id="${id}-help">${f.help || ""}</span><span class="err" id="${id}-err" role="alert"></span></div>`;
}
function setFieldError(k, msg) { const el = $("#f-" + k); if (!el) return; const box = el.closest(".field"); box.classList.toggle("invalid", !!msg); el.setAttribute("aria-invalid", !!msg); $(".err", box).textContent = msg || ""; }
function validate(f, el) { const v = el.value.trim(); let msg = ""; if (f.req && !v) msg = `${f.label} را وارد کنید.`; else if (f.check) { const c = f.check(v); if (c !== true) msg = c; } setFieldError(f.k, msg); return msg; }
function errSummary(list) {
  const s = $("#errSum"); if (!s) return;
  s.innerHTML = `<div class="err-summary" tabindex="-1" role="alert"><b>${fa(list.length)} مورد نیاز به اصلاح دارد:</b><ul style="margin:6px 18px 0">${list.map(([k, m]) => `<li><a href="#f-${k}" data-focus="f-${k}">${esc(m)}</a></li>`).join("")}</ul></div>`;
  $(".err-summary").focus();
  $$("[data-focus]", s).forEach(a => a.addEventListener("click", ev => { ev.preventDefault(); const el = $("#" + a.dataset.focus); if (el) el.focus(); else { ck.step = 1; render(false); } }));
}
VIEWS.checkout = r => {
  if (!cartItems().length) return VIEWS.cart();
  if (r.q.get("pay") === "failed" && ck.step === 1 && !ck.warned) { ck.warned = true; setTimeout(() => toast("پرداخت انجام نشد و سفارش ثبت نشد. می‌توانید دوباره تلاش کنید."), 300); }
  const m = SHIP.find(s => s.id === ck.ship);
  if (ck.step > 1 && !m) ck.step = 1;
  const steps = ["روش تحویل", "مشخصات گیرنده", "بازبینی و پرداخت"];
  const stepper = `<ol class="steps">${steps.map((s, i) => `<li ${i + 1 === ck.step ? 'aria-current="step"' : ""} class="${i + 1 < ck.step ? "done" : ""}">${s}</li>`).join("")}</ol>`;
  const sub = subtotal(); let body = "";
  if (ck.step === 1) body = `<form class="form card" id="ckForm"><h2>چطور تحویل بگیرید؟</h2><div id="errSum"></div><fieldset style="border:0"><legend class="sr-only">روش تحویل</legend><div class="choices">${SHIP.map(s => `
      <label class="choice"><input type="radio" name="ship" value="${s.id}" ${s.id === ck.ship ? "checked" : ""} required><span><b>${esc(s.name)}</b><small>${esc(eta(s))} · ${esc(s.note)}</small></span><span class="p num">${s.id === "pickup" || sub >= FREE() ? "رایگان" : tomanTxt(s.price)}</span></label>`).join("")}</div></fieldset>
      ${cutoffNote() ? `<p class="ship-note">${icon("i-clock")}<span>${cutoffNote()}</span></p>` : ""}
      <div class="form-actions"><a class="btn ghost" href="#/cart">بازگشت به سبد</a><button class="btn" type="submit">ادامه</button></div></form>`;
  if (ck.step === 2) body = `<form class="form card" id="ckForm" novalidate><h2>${ck.ship === "pickup" ? "مشخصات تحویل‌گیرنده" : "مشخصات و نشانی گیرنده"}</h2><div id="errSum"></div>
      <div class="fields">${activeFields().map(fieldHTML).join("")}</div>
      <div class="form-actions"><button class="btn ghost" type="button" data-step="1">مرحله‌ی قبل</button><button class="btn" type="submit">ادامه</button></div></form>`;
  if (ck.step === 3) {
    const codOk = SET.cod === "1" && (ck.ship === "courier" || ck.ship === "pickup");
    if (!ck.pay || (ck.pay === "cod" && !codOk) || (ck.pay === "online" && !PAY_ONLINE)) ck.pay = PAY_ONLINE ? "online" : codOk ? "cod" : "";
    body = `<form class="form card" id="ckForm"><h2>بازبینی سفارش</h2><div id="errSum"></div>
      <table class="specs"><tbody>
        <tr><th scope="row">گیرنده</th><td>${esc(ck.info.name)} · <span class="ltr num">${esc(enDigits(ck.info.mobile))}</span> <button class="btn ghost sm" type="button" data-step="2">ویرایش</button></td></tr>
        ${ck.ship !== "pickup" ? `<tr><th scope="row">نشانی</th><td>${esc(ck.info.province)}، ${esc(ck.info.city)}، ${esc(ck.info.address)}</td></tr>` : ""}
        <tr><th scope="row">تحویل</th><td>${esc(m.name)} · ${esc(eta(m))} <button class="btn ghost sm" type="button" data-step="1">تغییر</button></td></tr>
        ${cartItems().map(({p, q}) => `<tr><th scope="row">${fa(q)} × ${esc(p.short || p.name)}</th><td class="num">${tomanTxt(p.price * q)}</td></tr>`).join("")}
      </tbody></table>
      <h2 style="margin-top:24px">پرداخت</h2>
      <fieldset style="border:0"><legend class="sr-only">روش پرداخت</legend><div class="choices">
        <label class="choice" ${PAY_ONLINE ? "" : 'style="opacity:.55"'}><input type="radio" name="pay" value="online" ${ck.pay === "online" ? "checked" : ""} ${PAY_ONLINE ? "" : "disabled"}><span><b>پرداخت اینترنتی</b><small>${PAY_ONLINE ? "درگاه امن زرین‌پال؛ همه‌ی کارت‌های شتاب" : "به‌زودی فعال می‌شود"}</small></span></label>
        <label class="choice" ${codOk ? "" : 'style="opacity:.55"'}><input type="radio" name="pay" value="cod" ${ck.pay === "cod" ? "checked" : ""} ${codOk ? "" : "disabled"}><span><b>پرداخت در محل</b><small>${codOk ? "هنگام تحویل با کارتخوان یا نقد" : "فقط برای پیک شیراز و تحویل حضوری"}</small></span></label>
      </div></fieldset>
      ${!ck.pay ? `<p class="err-summary" style="margin-top:12px">برای این روش ارسال هنوز راه پرداختی فعال نیست. لطفاً با فروشگاه تماس بگیرید یا تحویل حضوری را انتخاب کنید.</p>` : ""}
      <div class="form-actions"><button class="btn ghost" type="button" data-step="2">مرحله‌ی قبل</button><button class="btn" type="submit" id="payBtn" ${ck.pay ? "" : "disabled"}>${ck.pay === "online" ? "پرداخت " + tomanTxt(sub + ((m.id === "pickup" || sub >= FREE()) ? 0 : m.price)) : "ثبت سفارش"}</button></div></form>`;
  }
  return {
    title: "تکمیل خرید",
    html: `<div class="wrap"><div class="page-h"><h1>تکمیل خرید</h1><p>بدون نیاز به ثبت‌نام.</p></div>${stepper}<div class="two"><div>${body}</div>${summaryHTML(m || null)}</div></div>`,
    mount() {
      const form = $("#ckForm");
      $$("[data-step]").forEach(b => b.addEventListener("click", () => { ck.step = +b.dataset.step; render(false); }));
      if (ck.step === 1) form.addEventListener("submit", e => { e.preventDefault(); const v = (form.querySelector("input[name=ship]:checked") || {}).value;
        if (!v) { errSummary([["ship", "روش تحویل را انتخاب کنید."]]); return; } ck.ship = v; store.set("ship", v); ck.step = 2; render(false); });
      if (ck.step === 2) {
        activeFields().forEach(f => { const el = $("#f-" + f.k);
          el.addEventListener("blur", () => { if (el.value.trim()) validate(f, el); });
          el.addEventListener("input", () => { if (el.closest(".field").classList.contains("invalid")) validate(f, el); }); });
        form.addEventListener("submit", e => { e.preventDefault();
          activeFields().forEach(f => ck.info[f.k] = $("#f-" + f.k).value.trim()); store.set("addr", ck.info);
          const errs = activeFields().map(f => [f.k, validate(f, $("#f-" + f.k))]).filter(x => x[1]);
          if (errs.length) { errSummary(errs); return; }
          ck.step = 3; render(false); });
      }
      if (ck.step === 3) {
        form.addEventListener("change", e => { if (e.target.name === "pay") { ck.pay = e.target.value; refresh(); } });
        form.addEventListener("submit", async e => { e.preventDefault();
          const b = $("#payBtn"); b.disabled = true; b.textContent = ck.pay === "online" ? "در حال اتصال به درگاه…" : "در حال ثبت…";
          try {
            const res = await API.call("order.create", {items: cartItems().map(({p, q}) => ({id: p.id, qty: q})), ...ck.info, ship: ck.ship, pay: ck.pay});
            cart = {}; saveCart(); updateBadges(); ck.step = 1;
            if (res.pay_url) { location.href = res.pay_url; return; }
            await reloadCatalog(); location.hash = "#/done/" + res.code;
          } catch (err) {
            b.disabled = false; b.textContent = "دوباره تلاش کنید";
            if (err.fields) { const f2 = Object.entries(err.fields); if (f2.some(([k]) => ["name","mobile","province","city","address","postal"].includes(k))) { ck.step = 2; await render(false); f2.forEach(([k, m]) => setFieldError(k, m)); errSummary(f2); return; } errSummary(f2); return; }
            if (err.error === "stock" || err.error === "items") { await reloadCatalog(); toast(esc(err.message)); location.hash = "#/cart"; return; }
            errSummary([["pay", err.message || "ثبت سفارش انجام نشد."]]);
          }
        });
      }
    }
  };
};
async function reloadCatalog() { try { applyBoot(await API.call("boot")); } catch (e) {} }

VIEWS.done = r => ({
  title: "سفارش ثبت شد",
  html: `<div class="wrap"><div class="success card"><span class="ok">${icon("i-check")}</span><h1>سفارش شما ثبت شد</h1>
    <p>کد رهگیری سفارش:</p><div class="code-box">${esc(r.arg || "")}</div>
    <p>${ck.info.mobile ? "این کد با پیامک هم برایتان فرستاده می‌شود. " : ""}وضعیت سفارش را هر زمان از «پیگیری سفارش» ببینید.</p>
    <div class="hero-cta" style="justify-content:center;margin-top:24px"><a class="btn" href="#/track?code=${encodeURIComponent(r.arg || "")}">پیگیری سفارش</a><a class="btn outline" href="#/shop">ادامه‌ی خرید</a></div></div></div>`
});

/* tracking (code + the mobile used for the order) */
VIEWS.track = async r => {
  const code = (r.q.get("code") || "").toUpperCase(), mobile = r.q.get("m") || "";
  let o = null, msg = "";
  if (code) { try { o = (await API.call("track", {code, mobile})).order; } catch (e) { msg = e.error === "need_mobile" ? "" : e.message; } }
  const ask = code && !o && !msg;
  const steps = ["ثبت سفارش", o && o.pay_method === "cod" ? "تایید سفارش" : "پرداخت", "آماده‌سازی", o && o.ship_method === "pickup" ? "آماده‌ی تحویل" : "ارسال", "تحویل"];
  const level = o ? ({pending: 0, paid: 1, confirmed: 1, preparing: 2, ready: 3, shipped: 3, delivered: 4}[o.status] ?? -1) : -1;
  return {
    title: "پیگیری سفارش",
    html: `<div class="wrap" style="max-width:720px"><div class="page-h"><h1>پیگیری سفارش</h1></div>
      <form class="form card" id="tf" novalidate><div class="fields">
        <div class="field"><label for="tcode">کد رهگیری</label><input id="tcode" value="${esc(code)}" placeholder="TT123456" autocomplete="off" dir="ltr" aria-describedby="tcode-help"><span class="help" id="tcode-help">در پیامک ثبت سفارش آمده است.</span></div>
        <div class="field"><label for="tm">موبایل سفارش‌دهنده</label><input id="tm" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" value="${esc(mobile)}" aria-describedby="tm-help"><span class="help" id="tm-help">${ask ? "برای دیدن این سفارش، شماره‌ی موبایل را وارد کنید." : "همان شماره‌ای که با آن سفارش دادید."}</span></div>
      </div><div class="form-actions"><span></span><button class="btn" type="submit">پیگیری</button></div></form>
      ${o ? `<section class="card form" style="margin-top:16px" aria-label="وضعیت سفارش"><h2>سفارش <span class="ltr">${esc(o.code)}</span> · ${esc(o.status_label)}</h2>
          ${o.status === "cancelled" ? `<p class="err-summary">این سفارش لغو شده است.</p>` : `<ol class="timeline">${steps.map((s, i) => `<li class="${i <= level ? "done" : ""}"><b>${s}</b>${i < level ? "انجام شد" : i === level ? "مرحله‌ی فعلی" : "در انتظار"}</li>`).join("")}</ol>`}
          ${o.tracking_no ? `<p>کد رهگیری مرسوله: <b class="ltr">${esc(o.tracking_no)}</b></p>` : ""}
          <table class="specs"><tbody>${o.items.map(x => `<tr><th scope="row">${fa(x.qty)} × ${esc(x.name)}</th><td class="num">${tomanTxt(x.price * x.qty)}</td></tr>`).join("")}<tr><th scope="row">جمع کل</th><td class="num"><b>${tomanTxt(o.total)}</b></td></tr></tbody></table></section>`
        : msg ? `<div class="empty card" style="margin-top:16px">${icon("i-box")}<b>${esc(msg)}</b><p>کد و شماره را دوباره بررسی کنید یا با فروشگاه تماس بگیرید.</p></div>` : ""}</div>`,
    mount() { $("#tf").addEventListener("submit", e => { e.preventDefault(); const c = enDigits($("#tcode").value.trim()).toUpperCase(), mm = enDigits($("#tm").value.trim());
      location.hash = "#/track?code=" + encodeURIComponent(c) + (mm ? "&m=" + encodeURIComponent(mm) : ""); }); }
  };
};

/* account: mobile + one-time code */
let otp = {phone: "", sent: false, debug: ""};
VIEWS.account = async () => {
  if (!user) return {
    title: "ورود",
    html: `<div class="wrap" style="max-width:460px"><div class="page-h"><h1>ورود یا ثبت‌نام</h1><p>با شماره‌ی موبایل؛ بدون رمز عبور. برای خرید نیازی به ورود نیست.</p></div>
      <form class="form card" id="lf" novalidate><div id="errSum"></div>
        ${!otp.sent ? `<div class="field"><label for="f-ph">شماره‌ی موبایل</label><input id="f-ph" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="09123456789" aria-describedby="f-ph-err"><span class="err" id="f-ph-err" role="alert"></span></div>
          <button class="btn block" type="submit" style="margin-top:16px">دریافت کد ورود</button>`
        : `<div class="field"><label for="f-code">کد ۵ رقمی پیامک‌شده به <span class="ltr num">${otp.phone}</span></label><input id="f-code" inputmode="numeric" autocomplete="one-time-code" dir="ltr" maxlength="5" aria-describedby="f-code-help f-code-err"><span class="help" id="f-code-help">${otp.debug ? "کد آزمایشی: " + otp.debug : "کد تا ۲ دقیقه معتبر است."}</span><span class="err" id="f-code-err" role="alert"></span></div>
          <button class="btn block" type="submit" style="margin-top:16px">ورود</button><button class="btn ghost block" type="button" id="chg" style="margin-top:8px">تغییر شماره</button>`}
      </form></div>`,
    mount() {
      const f = $("#lf"); $("#chg") && $("#chg").addEventListener("click", () => { otp = {phone: "", sent: false, debug: ""}; render(false); });
      f.addEventListener("submit", async e => { e.preventDefault(); const b = $("button[type=submit]", f); b.disabled = true;
        try {
          if (!otp.sent) { const v = enDigits($("#f-ph").value.trim()); if (!/^09\d{9}$/.test(v)) { setFieldError("ph", "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید."); $("#f-ph").focus(); b.disabled = false; return; }
            const r2 = await API.call("otp.send", {phone: v}); otp = {phone: v, sent: true, debug: r2.debug_code || ""}; await render(false); $("#f-code").focus(); return; }
          const r2 = await API.call("otp.verify", {phone: otp.phone, code: enDigits($("#f-code").value.trim())});
          user = r2.user; otp = {phone: "", sent: false, debug: ""}; render(false); toast("خوش آمدید!");
        } catch (err) { b.disabled = false; const k = otp.sent ? "code" : "ph"; setFieldError(k, err.message); $("#f-" + k).focus(); }
      });
    }
  };
  let orders = []; try { orders = (await API.call("me.orders")).orders; } catch (e) { if (e.error === "auth") { user = null; return VIEWS.account(); } }
  return {
    title: "حساب من",
    html: `<div class="wrap" style="max-width:820px"><div class="page-h"><h1>حساب من</h1><p class="num">شماره: <span class="ltr">${esc(user.phone)}</span></p></div>
      <section class="card form" aria-labelledby="o-h"><h2 id="o-h">سفارش‌های من</h2>
        ${orders.length ? `<table class="specs"><thead><tr><th>کد</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>${orders.map(o => `<tr><td><a class="ltr" style="color:var(--primary-700);font-weight:700" href="#/track?code=${o.code}">${o.code}</a></td><td>${new Date(o.created_at).toLocaleDateString("fa-IR")}</td><td class="num">${tomanTxt(o.total)}</td><td>${esc(o.status_label)}</td></tr>`).join("")}</tbody></table>`
          : `<div class="empty">${icon("i-box")}<b>هنوز سفارشی ندارید</b><a class="btn" href="#/shop" style="margin-top:12px">رفتن به فروشگاه</a></div>`}
      </section>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid var(--line)"><button class="link-danger" type="button" id="logout">خروج از حساب</button></div></div>`,
    mount() { $("#logout").addEventListener("click", async () => { try { await API.call("logout", {}); } catch (e) {} user = null; render(false); }); }
  };
};

/* guide */
const GUIDE = [
  {a:"قطعات SMD ریز", s:"مقاومت و خازن‌های کوچک، پایه‌های نزدیک", tip:"i"},
  {a:"آی‌سی با پایه‌های زیاد", s:"لحیم کشیدنی، برداشتن پل قلع", tip:"k"},
  {a:"تعمیرات عمومی", s:"کمی از همه چیز", tip:"b"},
  {a:"قطعات DIP و سیم", s:"پایه‌های معمولی، اتصال سیم", tip:"d"},
  {a:"پد بزرگ و کابل", s:"حرارت زیاد، قلع‌اندود کردن", tip:"c"},
];
VIEWS.guide = r => {
  const pick = r.q.get("a"), g = pick !== null ? GUIDE[+pick] : null, p = g && P.find(x => x.tip === g.tip);
  return {
    title: "راهنمای انتخاب نوک هویه",
    html: `<div class="wrap" style="max-width:900px"><nav class="crumbs" aria-label="مسیر"><a href="#/">خانه</a><span aria-hidden="true">/</span><span aria-current="page">راهنمای انتخاب</span></nav>
      <div class="page-h"><h1>کدام نوک هویه را بخرم؟</h1><p>بیشتر چه کاری انجام می‌دهید؟ یکی را انتخاب کنید.</p></div>
      <div class="card guide"><p class="q" id="gq">بیشتر روی چه چیزی کار می‌کنید؟</p>
        <div class="answers" role="group" aria-labelledby="gq">${GUIDE.map((x, i) => `<a href="#/guide?a=${i}" ${pick !== null && +pick === i ? 'aria-current="true"' : ""}><b>${x.a}</b><small>${x.s}</small></a>`).join("")}</div></div>
      ${g && !p ? `<section class="card guide" style="margin-top:16px"><p>نوک مناسب این کار فعلاً در فروشگاه نیست. <a href="#/contact" style="color:var(--primary-700);font-weight:700">از ما بپرسید</a>.</p></section>` : ""}
      ${p ? `<section class="card guide" style="margin-top:16px" aria-live="polite"><div class="rec"><span class="pk">${packHTML(p)}</span><div>
        <p class="kicker">پیشنهاد ما</p><h2 style="font-size:var(--fs-24)">${esc(p.name)}</h2><p>${esc(p.why)}</p><p style="margin:8px 0">${stockBadge(p)} · <span class="price num">${toman(p.price)}</span></p>
        <div class="hero-cta">${avail(p) > 0 ? `<button class="btn" type="button" data-add="${p.id}">${icon("i-cart")}افزودن به سبد</button>` : `<button class="btn outline" type="button" data-notify="${p.id}">${icon("i-bell")}خبرم کن</button>`}<a class="btn outline" href="#/?tip=${p.id}">دیدن سه‌بعدی</a></div>
        <p style="margin-top:12px;font-size:var(--fs-14);color:var(--mute)">همه‌ی نوک‌های 900M روی ${TIP_COMPAT} نصب می‌شوند.</p></div></div></section>` : ""}
    </div>`,
  };
};

/* contact */
VIEWS.contact = () => ({
  title: "تماس و نشانی",
  html: `<div class="wrap"><nav class="crumbs" aria-label="مسیر"><a href="#/">خانه</a><span aria-hidden="true">/</span><span aria-current="page">تماس</span></nav>
    <div class="page-h"><h1>تماس با ${esc(SET.store_name || "طاها الکترونیک")}</h1><p>برای سؤال فنی پیش از خرید یا هماهنگی خرید حضوری.</p></div>
    <div class="info">
      <div class="card">${icon("i-phone")}<b>تلفن فروشگاه</b><a href="tel:${esc(enDigits(SET.phone).replace(/\D/g, ""))}" class="num"><span class="ltr">${esc(SET.phone)}</span></a></div>
      <div class="card">${icon("i-pin")}<b>نشانی</b><span>${esc(SET.address || "شیراز")}</span></div>
      <div class="card">${icon("i-clock")}<b>ساعت کاری</b><span>${esc(SET.hours || "با فروشگاه تماس بگیرید")}</span></div>
    </div>
    <section class="sec" style="max-width:720px" aria-labelledby="cf-h"><form class="form card" id="cf" novalidate><h2 id="cf-h">پیام بگذارید</h2>
      <div class="fields">
        <div class="field"><label for="c-name">نام <span class="req" aria-hidden="true">*</span></label><input id="c-name" autocomplete="name" required aria-describedby="c-name-err"><span class="err" id="c-name-err" role="alert"></span></div>
        <div class="field"><label for="c-ph">موبایل <span class="req" aria-hidden="true">*</span></label><input id="c-ph" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required aria-describedby="c-ph-help c-ph-err"><span class="help" id="c-ph-help">برای پاسخ دادن به شما</span><span class="err" id="c-ph-err" role="alert"></span></div>
        <div class="field full"><label for="c-msg">پیام <span class="req" aria-hidden="true">*</span></label><textarea id="c-msg" required aria-describedby="c-msg-help c-msg-err"></textarea><span class="help" id="c-msg-help">مثلاً مدل ایستگاه لحیم‌کاری‌تان را بنویسید تا نوک سازگار را پیشنهاد دهیم.</span><span class="err" id="c-msg-err" role="alert"></span></div>
      </div><div class="form-actions"><span></span><button class="btn" type="submit">ارسال پیام</button></div></form></section></div>`,
  mount() {
    const f = $("#cf"), rules = {"c-name": v => !!v || "نام را وارد کنید.", "c-ph": v => /^09\d{9}$/.test(enDigits(v)) || "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.", "c-msg": v => v.length >= 5 || "پیام را کامل‌تر بنویسید."};
    const chk = id => { const el = $("#" + id), r = rules[id](el.value.trim()), bad = r !== true; el.closest(".field").classList.toggle("invalid", bad); el.setAttribute("aria-invalid", bad); $("#" + id + "-err").textContent = bad ? r : ""; return !bad; };
    Object.keys(rules).forEach(id => $("#" + id).addEventListener("blur", e => { if (e.target.value) chk(id); }));
    f.addEventListener("submit", async e => { e.preventDefault(); const bad = Object.keys(rules).filter(id => !chk(id)); if (bad.length) { $("#" + bad[0]).focus(); return; }
      const b = $("button[type=submit]", f); b.disabled = true;
      try { await API.call("contact.send", {name: $("#c-name").value.trim(), phone: enDigits($("#c-ph").value.trim()), body: $("#c-msg").value.trim()}); f.reset(); toast("پیام شما ثبت شد. به‌زودی تماس می‌گیریم."); }
      catch (err) { toast(esc(err.message || "ارسال نشد.")); } b.disabled = false; });
  }
});

VIEWS.help = () => ({
  title: "ارسال، بازگشت و سوالات متداول",
  html: `<div class="wrap" style="max-width:820px"><div class="page-h"><h1>راهنمای خرید و سوالات متداول</h1></div><div class="faq card form">
    ${[["هزینه و زمان ارسال چقدر است؟", SHIP.map(m => `${m.name}: ${m.price ? tomanTxt(m.price) : "رایگان"} (${m.note})`).join("، ") + `. برای خرید بالای ${tomanTxt(FREE())} ارسال رایگان است.`],
       ["نوک‌های 900M روی هویه‌ی من نصب می‌شوند؟", `این نوک‌ها برای ${TIP_COMPAT} هستند. اگر مطمئن نیستید، مدل ایستگاه‌تان را از صفحه‌ی تماس برای ما بفرستید.`],
       ["کالا اصل است؟", "همه‌ی کالاها با ضمانت اصالت و فاکتور فروش ارسال می‌شوند."],
       ["چطور کالا را برگردانم؟", "تا ۷ روز پس از تحویل، اگر کالا استفاده نشده و بسته‌بندی سالم باشد، طبق شرایط بازگشت کالا قابل مرجوع کردن است. پیش از ارسال با فروشگاه هماهنگ کنید."],
       ["برای خرید باید ثبت‌نام کنم؟", "نه. فقط نام، موبایل و نشانی لازم است. با ورود (بدون رمز و با کد پیامکی) سفارش‌های قبلی‌تان را یک‌جا می‌بینید."],
       ["خرید حضوری هم دارید؟", "بله؛ در مرحله‌ی تحویل «تحویل حضوری از فروشگاه» را انتخاب کنید یا مستقیم به فروشگاه بیایید."]]
      .map(([q, a]) => `<details><summary>${q}</summary><p>${esc(a)}</p></details>`).join("")}
  </div></div>`
});
/* IC list view: one markup, a data table on wide screens and stacked rows on phones (CSS decides).
   Sort is in the URL (drawer by default, part number, price both ways); the drawer tag opens that drawer in the cabinet. */
function partsTable(list, withCat, href, sort) {
  const by = {pn: (a, b) => a.name.localeCompare(b.name, "en", {numeric: true}), price: (a, b) => a.price - b.price, "-price": (a, b) => b.price - a.price};
  const rows = by[sort] ? [...list].sort(by[sort]) : list, key = sort.replace("-", "") || "drawer";
  const nextOf = k => k === "drawer" ? "" : k === "price" && sort === "price" ? "-price" : k;
  const dirOf = k => key !== k ? "none" : sort === "-price" ? "descending" : "ascending";
  const th = (k, label, cls = "") => `<th scope="col" class="${cls}" aria-sort="${dirOf(k)}"><a href="${href("sort", nextOf(k))}">${label}<i class="pt-si" aria-hidden="true"></i></a></th>`;
  const sortName = {drawer: "ترتیب قفسه", pn: "شماره‌ی قطعه", price: sort === "-price" ? "گران‌ترین" : "ارزان‌ترین"}[key];
  const stockShort = p => { const n = avail(p);                       // a list row has room for a word or two, not a sentence
    return n <= 0 ? (p.stock > 0 ? `<span class="stock low">در سبد شما</span>` : `<span class="stock out">ناموجود</span>`)
      : n <= Math.max(1, p.low_at) ? `<span class="stock low">${fa(n)} عدد مانده</span>` : `<span class="stock">موجود</span>`; };
  const pkg = p => window.TTChips.PKGS[p.pkg || window.TTChips.guessPkg(p.name, p.cat)] || "";
  return `<div class="pt-bar"><p class="pt-count" aria-live="polite"><b class="num">${fa(rows.length)}</b> قطعه · مرتب بر اساس ${sortName}</p>
      <nav class="pt-sort" aria-label="مرتب‌سازی">${[["drawer", "قفسه"], ["pn", "شماره"], ["price", sort === "price" ? "قیمت ↑" : sort === "-price" ? "قیمت ↓" : "قیمت"]].map(([k, l]) => `<a href="${href("sort", nextOf(k))}" aria-current="${key === k}">${l}</a>`).join("")}</nav></div>
    <div class="pt-wrap"><table class="parts"><caption class="sr-only">فهرست آی‌سی‌ها</caption>
      <thead><tr><th scope="col" class="pt-img"><span class="sr-only">تصویر</span></th>${th("pn", "شماره‌ی قطعه")}${th("drawer", "قفسه")}${withCat ? `<th scope="col" class="pt-cat">دسته</th>` : ""}${th("price", "قیمت", "pt-price")}<th scope="col">موجودی</th><th scope="col" class="pt-act"><span class="sr-only">خرید</span></th></tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td class="pt-img"><img src="${window.TTCabinet.chipURL(p)}" alt="" loading="lazy" width="44" height="44"></td>
        <td class="pt-name"><a class="pt-pn" href="#/product/${p.id}"><bdi>${esc(p.name)}</bdi></a>${pkg(p) ? `<small class="pt-pkg"><bdi>${esc(pkg(p))}</bdi></small>` : ""}</td>
        <td class="pt-drawer"><a href="#/ic?find=${p.id}" aria-label="نمایش ${esc(p.name)} در قفسه">${icon("i-rack")}<span>در قفسه</span></a></td>
        ${withCat ? `<td class="pt-cat">${esc(catName(p.cat))}</td>` : ""}
        <td class="pt-price"><b class="num">${fa(p.price)}</b> <small>تومان</small></td>
        <td class="pt-stock">${stockShort(p)}</td>
        <td class="pt-act">${avail(p) > 0 ? `<button class="btn sm" type="button" data-add="${p.id}" aria-label="افزودن ${esc(p.name)} به سبد">${icon("i-plus")}<span class="pt-bl">افزودن</span></button>` : `<button class="btn sm outline" type="button" data-notify="${p.id}" aria-label="خبرم کن برای ${esc(p.name)}">${icon("i-bell")}<span class="pt-bl">خبرم کن</span></button>`}</td>
      </tr>`).join("")}</tbody></table></div>`;
}
/* IC cabinet wall page: find by part number -> its drawer opens; cabinet or table view; one cabinet per group */
VIEWS.ic = r => {
  const cat = r.q.get("cat") || "", find = r.q.get("find"), view = find || UI.mode === "bench" ? "cab" : "table";   // finding a part always opens its drawer
  const cats = ICCATS(), shown = cat ? cats.filter(c => c.id === cat) : cats, all = P.filter(isIC);
  const list = P.filter(p => isIC(p) && (!cat || p.cat === cat)).sort((a, b) => (parseInt(a.drawer) || 1e9) - (parseInt(b.drawer) || 1e9));
  const href = (k, v) => { const q = new URLSearchParams(r.q); q.delete("find"); if (v) q.set(k, v); else q.delete(k); return "#/ic" + (q.toString() ? "?" + q : ""); };
  return {
    title: "آی‌سی‌های ECU خودرو",
    html: `<div class="wrap">
      <nav class="crumbs" aria-label="مسیر"><a href="#/">خانه</a><span aria-hidden="true">/</span><span aria-current="page">آی‌سی‌های ECU</span></nav>
      <div class="page-h"><h1>قفسه‌ی آی‌سی‌های ECU</h1><p>${fa(all.length)} قطعه، هر کدام در کشوی خودش. تعداد آی‌سی‌های داخل هر کشو همان موجودی است.</p></div>
      <div class="ic-tools">
        <div class="ic-find" role="combobox" aria-expanded="false" aria-owns="ic-sugg" aria-haspopup="listbox">
          <label class="sr-only" for="icq">جستجوی شماره‌ی قطعه</label>
          <input id="icq" type="search" placeholder="شماره‌ی قطعه را بنویسید" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="ic-sugg">${icon("i-search")}
          <ul class="ic-sugg" id="ic-sugg" role="listbox" hidden></ul>
        </div>
        <nav class="ic-nav" aria-label="کابینت‌ها" style="flex-basis:100%"><a href="${href("cat", "")}" aria-current="${!cat}">همه</a>${cats.map(c => `<a href="${href("cat", c.id)}" aria-current="${c.id === cat}">${esc(c.name)} <small class="num">(${fa(P.filter(p => p.cat === c.id).length)})</small></a>`).join("")}</nav>
      </div>
      ${view === "table" ? partsTable(list, !cat, href, r.q.get("sort") || "")
        :`<div class="icwall" id="icwall">${shown.map(c => window.TTCabinet.cabinetHTML(c, P.filter(p => p.cat === c.id), avail)).join("")}</div>`}
    </div>`,
    mount() {
      const root = $("#icwall"), stop = root ? window.TTCabinet.mount(root, byId, {detail: icDetail, view3d: icView3D}) : null;
      const tools = $(".ic-tools"), ro = new ResizeObserver(() => document.documentElement.style.setProperty("--ict", tools.offsetHeight + "px"));   // the table header sticks just under the toolbar
      ro.observe(tools);
      const inp = $("#icq"), ul = $("#ic-sugg"), box = $(".ic-find"); let hits = [], sel = -1;
      const norm = s => enDigits(s).toUpperCase().replace(/[\s\-_.]/g, "");
      const close = () => { ul.hidden = true; box.setAttribute("aria-expanded", "false"); sel = -1; };
      const go = p => { close(); inp.value = p.name;
        if (root && window.TTCabinet.reveal(root, p.id)) return;
        location.hash = "#/ic?find=" + p.id; };                       // table view or another cabinet: switch to the cabinet that holds it
      inp.addEventListener("input", () => {
        const q = norm(inp.value); if (q.length < 2) { close(); return; }
        hits = all.filter(p => norm(p.name).includes(q) || norm(p.drawer) === q).sort((a, b) => norm(a.name).indexOf(q) - norm(b.name).indexOf(q)).slice(0, 8);
        ul.innerHTML = hits.length ? hits.map((p, i) => `<li role="option" id="sg${i}" data-i="${i}" aria-selected="false"><img src="${window.TTCabinet.chipURL(p)}" alt=""><span><b>${esc(p.name)}</b><br><small>${esc(catName(p.cat))}</small></span>${stockBadge(p)}</li>`).join("")
          : `<li aria-disabled="true"><span></span><span>قطعه‌ای با این شماره پیدا نشد. <a href="#/contact" style="color:var(--primary-700);font-weight:700">بپرسید</a></span></li>`;
        ul.hidden = false; box.setAttribute("aria-expanded", "true"); sel = -1;
      });
      inp.addEventListener("keydown", e => {
        if (ul.hidden || !hits.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
          $$("li", ul).forEach((li, i) => li.setAttribute("aria-selected", i === sel)); inp.setAttribute("aria-activedescendant", "sg" + sel); }
        else if (e.key === "Enter") { e.preventDefault(); go(hits[Math.max(0, sel)]); }
        else if (e.key === "Escape") close();
      });
      ul.addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) go(hits[+li.dataset.i]); });
      const onDoc = e => { if (!box.contains(e.target)) close(); }; document.addEventListener("click", onDoc);
      if (find && root) setTimeout(() => window.TTCabinet.reveal(root, find), 350);
      return () => { stop && stop(); ro.disconnect(); document.removeEventListener("click", onDoc); };
    }
  };
};
VIEWS.notfound = () => ({title: "پیدا نشد", html: `<div class="wrap"><div class="empty card" style="margin-top:32px">${icon("i-search")}<b>این صفحه یا کالا پیدا نشد</b><a class="btn" href="#/shop" style="margin-top:16px">رفتن به فروشگاه</a></div></div>`});

/* ---------- global events ---------- */
document.addEventListener("click", e => {
  const add = e.target.closest("[data-add]");
  if (add) { e.preventDefault(); const hook = add.closest(".hook"); addToCart(add.dataset.add, 1, (hook && $(".pk.front", hook)) || add.closest(".pcard")?.querySelector(".media .pk") || null); return; }
  const nt = e.target.closest("[data-notify]"); if (nt) { e.preventDefault(); notifyMe(nt.dataset.notify); return; }
  const set = e.target.closest("[data-set]"); if (set) { setQty(set.dataset.set, +set.dataset.v); return; }
  const rm = e.target.closest("[data-remove]"); if (rm) { removeItem(rm.dataset.remove); return; }
});
$("#searchForm").addEventListener("submit", e => { e.preventDefault(); const q = $("#q").value.trim(); location.hash = "#/shop" + (q ? "?q=" + encodeURIComponent(q) : ""); });

/* ---------- start ---------- */
(async function start() {
  try { applyBoot(await API.boot()); }
  catch (e) {
    $("#app").innerHTML = `<div class="wrap"><div class="empty card" style="margin-top:32px" role="alert">${icon("i-box")}<b>اتصال به فروشگاه برقرار نشد</b><p>${esc(e.message || "")}</p><p>برای سفارش تلفنی: <a class="ltr" href="tel:07132308902">071-32308902</a></p><button class="btn" type="button" onclick="location.reload()" style="margin-top:16px">تلاش دوباره</button></div></div>`;
    return;
  }
  if (API.demo) document.body.insertAdjacentHTML("beforeend", `<div class="proto" aria-hidden="true">نسخه‌ی نمایشی · داده‌ها در همین مرورگر</div>`);
  if (SET.notice) $(".top").insertAdjacentHTML("beforebegin", `<div role="note" style="background:var(--deep);color:var(--on-deep);text-align:center;font-size:var(--fs-14);padding:6px 16px">${esc(SET.notice)}</div>`);
  $("#subnav").innerHTML = SHOPCATS().map(c => `<a href="#/shop?cat=${c.id}">${esc(c.name)}</a>`).join("") + (ICCATS().length ? `<a href="#/ic">آی‌سی‌های ECU</a>` : "") + `<a href="#/track">پیگیری سفارش</a><a href="#/help">راهنمای خرید</a>`;
  updateBadges(); render(false);
})();
})();
