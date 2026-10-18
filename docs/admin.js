/* Taha Electronic admin panel. Routes: #/dash #/orders?status=&q= #/order/:id #/products?q=&cat=
   #/product/:id|new #/rack #/notify #/messages #/settings. Talks to the same API as the store (api.js). */
(() => {
"use strict";
const API = window.ShopAPI, PK = window.TTPacks, esc = PK.esc;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fa = n => Number(n || 0).toLocaleString("fa-IR"), toman = n => `${fa(n)} تومان`;
const en = s => String(s ?? "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
const date = ms => new Date(ms).toLocaleDateString("fa-IR", {day: "numeric", month: "short"}) + " · " + new Date(ms).toLocaleTimeString("fa-IR", {hour: "2-digit", minute: "2-digit"});
const SHIPN = {courier: "پیک شیراز", post: "پست پیشتاز", tipax: "تیپاکس", pickup: "تحویل حضوری"};
const REASONS = {instore: "فروش حضوری", count: "شمارش انبار", purchase: "خرید از تامین‌کننده", return: "مرجوعی", damage: "خرابی/مفقودی", order: "سفارش آنلاین", cancel: "لغو سفارش", expired: "پرداخت‌نشده", initial: "موجودی اولیه"};
const ACT = {preparing: "شروع آماده‌سازی", shipped: "ثبت ارسال", ready: "آماده‌ی تحویل حضوری", delivered: "تحویل شد", cancelled: "لغو سفارش", refunded: "ثبت بازپرداخت"};
let me = null, counts = {todo: 0, unseen: 0};

function toast(msg) { const b = $("#toasts"), t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span>${msg}</span>`; b.appendChild(t); setTimeout(() => t.remove(), 4000); }
const chip = (s, label) => `<span class="chip s-${s}">${esc(label)}</span>`;
async function call(a, d, f) { try { return await API.call(a, d, f); } catch (e) { if (e.error === "auth" || e.error === "forbidden") { me = null; renderLogin(e.error === "forbidden" ? e.message : ""); } throw e; } }
function confirmBox(text, okLabel, danger) {
  return new Promise(res => {
    const d = document.createElement("dialog"); d.className = "card";
    d.innerHTML = `<div class="form"><p style="color:var(--ink);font-weight:700">${text}</p><div class="form-actions"><button class="btn ghost" type="button" data-no>انصراف</button><button class="btn" type="button" data-yes ${danger ? 'style="background:var(--danger)"' : ""}>${okLabel}</button></div></div>`;
    document.body.appendChild(d); d.showModal(); $("[data-no]", d).focus();
    const done = v => { d.close(); d.remove(); res(v); };
    $("[data-no]", d).onclick = () => done(false); $("[data-yes]", d).onclick = () => done(true); d.addEventListener("cancel", e => { e.preventDefault(); done(false); });
  });
}

/* ---------- login ---------- */
function renderLogin(msg) {
  $("#root").innerHTML = `<div class="login-wrap"><form class="card form" id="lf" novalidate aria-labelledby="lh">
    <div class="logo" style="margin-bottom:16px"><span class="logo-mark" aria-hidden="true">ط</span>پنل مدیریت فروشگاه</div>
    <h1 id="lh" style="font-size:var(--fs-20)">ورود مدیر</h1>
    ${msg ? `<p class="err-summary" role="alert">${esc(msg)}</p>` : ""}
    <div class="field" style="margin-top:12px"><label for="lp">شماره‌ی موبایل</label><input id="lp" type="tel" inputmode="tel" autocomplete="username" dir="ltr" required></div>
    <div class="field" style="margin-top:12px"><label for="lw">رمز عبور</label><input id="lw" type="password" autocomplete="current-password" dir="ltr" required></div>
    <span class="err" id="lerr" role="alert" style="display:block;margin-top:8px"></span>
    <button class="btn block" type="submit" style="margin-top:12px">ورود</button>
    ${API.demo ? `<p class="help" style="margin-top:12px;font-size:var(--fs-14)">نسخه‌ی نمایشی: <span class="ltr">09120000000</span> و رمز <span class="ltr">demo-admin-123</span></p>` : ""}
    <p style="margin-top:12px;font-size:var(--fs-14)"><a href="index.html" style="color:var(--primary-700)">بازگشت به فروشگاه</a></p>
  </form></div>`;
  $("#lp").focus();
  $("#lf").addEventListener("submit", async e => { e.preventDefault(); const b = $("button[type=submit]", e.target); b.disabled = true; $("#lerr").textContent = "";
    try { const r = await API.call("admin.login", {phone: en($("#lp").value.trim()), password: $("#lw").value}); me = r.user; shell(); }
    catch (err) { $("#lerr").textContent = err.message || "ورود انجام نشد."; b.disabled = false; $("#lw").focus(); } });
}

/* ---------- shell + router ---------- */
const NAV = [["dash", "داشبورد", "i-dash"], ["orders", "سفارش‌ها", "i-box"], ["products", "کالاها", "i-tag"], ["import", "ورود از اکسل", "i-ext"], ["photos", "عکس قطعه‌ها", "i-img"], ["rack", "موجودی (ویترین)", "i-rack"], ["notify", "درخواست «خبرم کن»", "i-bell"], ["messages", "پیام‌ها", "i-mail"], ["settings", "تنظیمات", "i-gear"]];
function shell() {
  $("#root").innerHTML = `<div class="adm">
    <nav class="side" aria-label="منوی مدیریت">
      <div class="logo"><span class="logo-mark" aria-hidden="true">ط</span>مدیریت فروشگاه</div>
      ${NAV.map(([k, l, i]) => `<a href="#/${k}" data-nav="${k}">${icon(i)}${l}${k === "orders" ? `<span class="cnt num" data-cnt="todo" hidden></span>` : k === "messages" ? `<span class="cnt num" data-cnt="unseen" hidden></span>` : ""}</a>`).join("")}
      <div class="who"><b>${esc(me.name || me.phone)}</b>${me.role === "admin" ? "مدیر" : "کارمند"} · <a href="index.html" target="_blank" rel="noopener">دیدن فروشگاه</a><br><button type="button" id="out">خروج</button></div>
    </nav>
    <nav class="mtop" aria-label="منوی مدیریت">${NAV.map(([k, l, i]) => `<a href="#/${k}" data-nav="${k}">${icon(i)}${l}</a>`).join("")}</nav>
    <main class="main" id="view" tabindex="-1"></main></div>`;
  $("#out").onclick = async () => { try { await API.call("logout", {}); } catch (e) {} me = null; renderLogin(""); };
  if (!location.hash || location.hash === "#/") location.hash = "#/dash"; else route();
}
function setCounts() { $$("[data-cnt]").forEach(c => { const n = counts[c.dataset.cnt]; c.hidden = !n; c.textContent = fa(n); }); }
const parse = () => { const h = location.hash.replace(/^#\/?/, ""); const [p, qs] = h.split("?"); const [name, arg] = p.split("/"); return {name: name || "dash", arg, q: new URLSearchParams(qs || "")}; };
let seq = 0;
async function route() {
  if (!me) return;
  const r = parse(), my = ++seq, v = $("#view");
  $$("[data-nav]").forEach(a => { const on = a.dataset.nav === ({order: "orders", product: "products"}[r.name] || r.name); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  v.innerHTML = `<p style="color:var(--mute)">در حال بارگذاری…</p>`;
  try {
    const fn = VIEWS[r.name] || VIEWS.dash, out = await fn(r);
    if (my !== seq) return;
    v.innerHTML = out.html; document.title = out.title + " | پنل مدیریت"; if (out.mount) out.mount(); v.focus({preventScroll: true}); scrollTo(0, 0);
  } catch (e) { if (my === seq && me) v.innerHTML = `<div class="empty card" role="alert"><b>بارگذاری نشد</b><p>${esc(e.message || "")}</p><button class="btn" type="button" onclick="location.reload()">تلاش دوباره</button></div>`; }
}
addEventListener("hashchange", route);
const VIEWS = {};

/* ---------- dashboard ---------- */
VIEWS.dash = async () => {
  const d = await call("admin.dashboard"); counts = {todo: d.todo, unseen: d.unseen}; setCounts();
  const max = Math.max(1, ...d.series.map(s => s.sum)), sum14 = d.series.reduce((s, x) => s + x.sum, 0);
  return { title: "داشبورد", html: `<h1>داشبورد</h1>
    <div class="kpis">
      <div class="card kpi"><span>فروش امروز</span><b>${toman(d.today.sum)}</b></div>
      <div class="card kpi"><span>سفارش امروز</span><b>${fa(d.today.orders)}</b></div>
      <a class="card kpi ${d.todo ? "alert" : ""}" href="#/orders?status=todo"><span>در انتظار رسیدگی</span><b>${fa(d.todo)}</b></a>
      <a class="card kpi ${d.low.length ? "alert" : ""}" href="#/rack"><span>کالای رو به اتمام</span><b>${fa(d.low.length)}</b></a>
    </div>
    <div class="panes">
      <section class="card pane" aria-labelledby="c-h"><h2 id="c-h">فروش ۱۴ روز اخیر <small class="num" style="color:var(--mute);font-weight:400">${toman(sum14)}</small></h2>
        <div class="chart" role="img" aria-label="نمودار فروش روزانه‌ی ۱۴ روز اخیر">${d.series.map((s, i) => `<div class="${i === 13 ? "today" : ""}" title="${new Date(s.day).toLocaleDateString("fa-IR")}: ${toman(s.sum)} (${fa(s.count)} سفارش)"><i style="height:${Math.round(s.sum / max * 100)}%"></i><small>${new Date(s.day).toLocaleDateString("fa-IR", {day: "numeric"})}</small></div>`).join("")}</div>
        <table class="sr-only"><caption>فروش روزانه</caption><tbody>${d.series.map(s => `<tr><th>${new Date(s.day).toLocaleDateString("fa-IR")}</th><td>${toman(s.sum)}</td></tr>`).join("")}</tbody></table>
      </section>
      <section class="card pane" aria-labelledby="l-h"><h2 id="l-h">رو به اتمام <a href="#/rack">موجودی</a></h2>
        ${d.low.length ? `<table class="t"><tbody>${d.low.slice(0, 7).map(p => `<tr data-go="#/product/${p.id}"><td>${esc(p.name)}</td><td class="num" style="color:${p.stock ? "var(--warn)" : "var(--danger)"};font-weight:800">${p.stock ? fa(p.stock) + " عدد" : "تمام"}</td></tr>`).join("")}</tbody></table>` : `<p>همه‌ی کالاها موجودی کافی دارند.</p>`}
        ${d.demand.length ? `<h2 style="margin-top:16px">بیشترین «خبرم کن» <a href="#/notify">همه</a></h2><table class="t"><tbody>${d.demand.map(x => `<tr data-go="#/product/${x.id}"><td>${esc(x.name)}</td><td class="num">${fa(x.c)} نفر</td></tr>`).join("")}</tbody></table>` : ""}
      </section>
    </div>
    <section class="card pane" style="margin-top:16px" aria-labelledby="r-h"><h2 id="r-h">آخرین سفارش‌ها <a href="#/orders">همه‌ی سفارش‌ها</a></h2>${ordersTable(d.recent)}</section>`,
    mount: bindRows };
};
function ordersTable(list) {
  if (!list.length) return `<div class="empty"><b>سفارشی نیست</b></div>`;
  return `<div class="tw"><table class="t"><thead><tr><th>کد</th><th>زمان</th><th>مشتری</th><th>ارسال</th><th>مبلغ</th><th>وضعیت</th></tr></thead><tbody>
    ${list.map(o => `<tr data-go="#/order/${o.id}"><td><a class="ltr" href="#/order/${o.id}" style="font-weight:800;color:var(--primary-700)">${o.code}</a></td><td class="num">${date(o.created_at)}</td><td>${esc(o.name)}<br><small class="ltr num" style="color:var(--mute)">${o.mobile}</small></td><td>${SHIPN[o.ship_method] || o.ship_method}${o.pay_method === "cod" ? "<br><small>پرداخت در محل</small>" : ""}</td><td class="num">${toman(o.total)}</td><td>${chip(o.status, o.status_label)}</td></tr>`).join("")}</tbody></table></div>`;
}
function bindRows() { $$("tr[data-go]").forEach(tr => tr.addEventListener("click", e => { if (!e.target.closest("a,button")) location.hash = tr.dataset.go; })); }

/* ---------- orders ---------- */
VIEWS.orders = async r => {
  const status = r.q.get("status") || "todo", q = r.q.get("q") || "";
  const d = await call("admin.orders", {status: status === "all" ? "" : status, q});
  const tabs = [["todo", "در انتظار رسیدگی"], ["all", "همه"], ...Object.entries(d.statuses)];
  return { title: "سفارش‌ها", html: `<div class="bar"><h1>سفارش‌ها</h1>
      <form class="searchbox" id="sf" role="search"><label class="sr-only" for="oq">جستجو</label><input id="oq" type="search" value="${esc(q)}" placeholder="کد، موبایل یا نام">${icon("i-search")}</form></div>
    <nav class="tabsb" aria-label="وضعیت">${tabs.map(([k, l]) => `<a href="#/orders?status=${k}${q ? "&q=" + encodeURIComponent(q) : ""}" ${k === status ? 'aria-current="page"' : ""}>${esc(l)}</a>`).join("")}</nav>
    <p style="color:var(--mute);font-size:var(--fs-14);margin-bottom:8px">${fa(d.total)} سفارش</p>${ordersTable(d.orders)}`,
    mount() { bindRows(); $("#sf").addEventListener("submit", e => { e.preventDefault(); location.hash = `#/orders?status=${status}&q=${encodeURIComponent($("#oq").value.trim())}`; }); } };
};
VIEWS.order = async r => {
  const d = await call("admin.order", {id: r.arg}), o = d.order, next = d.next;
  const primary = next.find(s => s !== "cancelled" && s !== "refunded");
  return { title: "سفارش " + o.code, html: `
    <a href="#/orders" class="btn ghost sm" style="margin-bottom:8px">${icon("i-back")}همه‌ی سفارش‌ها</a>
    <div class="bar"><h1>سفارش <span class="ltr">${o.code}</span> ${chip(o.status, o.status_label)}</h1><button class="btn outline sm" type="button" id="pr">${icon("i-print")}چاپ فاکتور</button></div>
    <div class="od">
      <div>
        ${next.length ? `<section class="card" aria-labelledby="a-h" style="margin-bottom:16px"><h2 id="a-h">قدم بعدی</h2>
          <form id="af" class="actions-row">
            ${next.includes("shipped") && o.ship_method !== "pickup" ? `<div class="field" style="flex:1;min-width:200px"><label for="trk">کد رهگیری مرسوله ${o.ship_method === "courier" ? '<small style="font-weight:400">(اختیاری)</small>' : ""}</label><input id="trk" dir="ltr" value="${esc(o.tracking_no || "")}"></div>` : ""}
            <div class="field" style="flex:1;min-width:200px"><label for="nt">یادداشت <small style="font-weight:400">(اختیاری، فقط برای فروشگاه)</small></label><input id="nt"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${primary ? `<button class="btn" type="button" data-to="${primary}">${ACT[primary]}</button>` : ""}
              ${next.filter(s => s !== primary && s !== "cancelled").map(s => `<button class="btn outline" type="button" data-to="${s}">${ACT[s]}</button>`).join("")}
              ${next.includes("cancelled") ? `<button class="btn ghost" type="button" data-to="cancelled" style="color:var(--danger)">لغو سفارش</button>` : ""}
            </div>
          </form><p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-top:8px">${o.ship_method === "pickup" ? "با «آماده‌ی تحویل» به مشتری پیامک می‌رود." : "با «ثبت ارسال» کد رهگیری برای مشتری پیامک می‌شود."} لغو سفارش، موجودی کالاها را برمی‌گرداند.</p></section>` : ""}
        <section class="card" aria-labelledby="i-h"><h2 id="i-h">اقلام</h2>
          <table class="t"><thead><tr><th>کالا</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr></thead><tbody>
          ${o.items.map(x => `<tr data-go="#/product/${x.product_id}"><td>${esc(x.name)}<br><small class="ltr" style="color:var(--mute)">${esc(x.code)}</small></td><td class="num">${fa(x.qty)}</td><td class="num">${toman(x.price)}</td><td class="num">${toman(x.price * x.qty)}</td></tr>`).join("")}
          <tr><td colspan="3">ارسال (${SHIPN[o.ship_method] || o.ship_method})</td><td class="num">${o.ship_cost ? toman(o.ship_cost) : "رایگان"}</td></tr>
          <tr><td colspan="3"><b>جمع کل</b></td><td class="num"><b>${toman(o.total)}</b></td></tr></tbody></table></section>
      </div>
      <div>
        <section class="card" aria-labelledby="c-h" style="margin-bottom:16px"><h2 id="c-h">مشتری و تحویل</h2><dl class="kv">
          <dt>نام</dt><dd>${esc(o.name)}</dd><dt>موبایل</dt><dd><a class="ltr num" href="tel:${o.mobile}" style="color:var(--primary-700)">${o.mobile}</a></dd>
          <dt>روش</dt><dd>${SHIPN[o.ship_method] || o.ship_method}</dd>
          ${o.ship_method !== "pickup" ? `<dt>نشانی</dt><dd>${esc(o.province)}، ${esc(o.city)}، ${esc(o.address)}</dd>${o.postal ? `<dt>کد پستی</dt><dd class="ltr">${esc(o.postal)}</dd>` : ""}` : ""}
          <dt>پرداخت</dt><dd>${o.pay_method === "cod" ? "در محل" : "اینترنتی"}${o.pay_ref ? ` · <span class="ltr">${esc(o.pay_ref)}</span>` : ""}</dd>
          ${o.tracking_no ? `<dt>رهگیری</dt><dd class="ltr">${esc(o.tracking_no)}</dd>` : ""}
        </dl>${o.ship_method !== "pickup" ? `<button class="btn ghost sm" type="button" id="cpy" style="margin-top:8px">کپی نشانی برای برچسب</button>` : ""}</section>
        <section class="card" aria-labelledby="e-h"><h2 id="e-h">تاریخچه</h2><ul class="ev">${o.events.slice().reverse().map(e => `<li><span>${chip(e.status, d.statuses[e.status] || e.status)}${e.note ? `<br><small>${esc(e.note)}</small>` : ""}</span><small class="num">${date(e.at)}</small></li>`).join("")}</ul></section>
      </div>
    </div>`,
    mount() {
      bindRows();
      $("#pr").onclick = () => { $("#invoice").innerHTML = `<h2>فاکتور فروش · طاها الکترونیک</h2><p>سفارش ${o.code} · ${new Date(o.created_at).toLocaleDateString("fa-IR")}</p><p>${esc(o.name)} · ${o.mobile}<br>${o.ship_method !== "pickup" ? esc(o.province + "، " + o.city + "، " + o.address) + (o.postal ? " · کد پستی " + esc(o.postal) : "") : "تحویل حضوری"}</p>
        <table><thead><tr><th>کالا</th><th>کد</th><th>تعداد</th><th>قیمت</th><th>جمع</th></tr></thead><tbody>${o.items.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.code)}</td><td>${fa(x.qty)}</td><td>${toman(x.price)}</td><td>${toman(x.price * x.qty)}</td></tr>`).join("")}
        <tr><td colspan="4">ارسال</td><td>${toman(o.ship_cost)}</td></tr><tr><td colspan="4"><b>جمع کل</b></td><td><b>${toman(o.total)}</b></td></tr></tbody></table>`; print(); };
      const cpy = $("#cpy"); if (cpy) cpy.onclick = async () => { try { await navigator.clipboard.writeText(`${o.name}\n${o.mobile}\n${o.province}، ${o.city}، ${o.address}${o.postal ? "\nکد پستی: " + o.postal : ""}`); toast("نشانی کپی شد."); } catch (e) { toast("کپی ممکن نشد."); } };
      $$("[data-to]").forEach(b => b.addEventListener("click", async () => {
        const to = b.dataset.to;
        if (to === "cancelled" && !(await confirmBox(`سفارش ${o.code} لغو شود؟ موجودی کالاها برمی‌گردد و به مشتری پیامک می‌رود.`, "لغو سفارش", true))) return;
        $$("[data-to]").forEach(x => x.disabled = true);
        try { await call("admin.order.update", {id: o.id, status: to, tracking_no: $("#trk") ? $("#trk").value.trim() : undefined, note: $("#nt").value.trim()}); toast("وضعیت سفارش به‌روز شد."); route(); }
        catch (e) { toast(esc(e.message)); $$("[data-to]").forEach(x => x.disabled = false); if (e.error === "tracking") $("#trk").focus(); }
      }));
    } };
};

/* ---------- products ---------- */
let CATS = [];
VIEWS.products = async r => {
  const d = await call("admin.products"); CATS = d.cats;
  const q = (r.q.get("q") || "").trim(), cat = r.q.get("cat") || "", show = r.q.get("show") || "all";
  let list = d.products.filter(p => (!cat || p.cat === cat) && (show === "all" || (show === "off" ? !p.active : show === "low" ? p.active && p.stock <= p.low_at : p.active)));
  if (q) list = list.filter(p => (p.name + " " + p.code).toLowerCase().includes(en(q).toLowerCase()));
  const inactive = d.products.filter(p => !p.active).length;
  return { title: "کالاها", html: `<div class="bar"><h1>کالاها</h1><a class="btn" href="#/product/new">${icon("i-plus")}کالای جدید</a></div>
    ${inactive ? `<p class="ship-note" style="margin:-8px 0 12px">${fa(inactive)} کالا غیرفعال است و در فروشگاه دیده نمی‌شود. <a href="#/products?show=off" style="color:var(--primary-700);font-weight:700">دیدن</a></p>` : ""}
    <div class="bar"><form class="searchbox" id="pf" role="search"><label class="sr-only" for="pq">جستجوی کالا</label><input id="pq" type="search" value="${esc(q)}" placeholder="نام یا کد کالا">${icon("i-search")}</form>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="sr-only" for="pc">دسته</label><select class="sel" id="pc"><option value="">همه‌ی دسته‌ها</option>${CATS.map(c => `<option value="${c.id}" ${c.id === cat ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <label class="sr-only" for="ps">وضعیت</label><select class="sel" id="ps"><option value="all">همه</option><option value="on" ${show === "on" ? "selected" : ""}>فعال</option><option value="off" ${show === "off" ? "selected" : ""}>غیرفعال</option><option value="low" ${show === "low" ? "selected" : ""}>رو به اتمام</option></select></div></div>
    ${list.length ? `<div class="tw"><table class="t"><thead><tr><th><span class="sr-only">عکس</span></th><th>کالا</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>وضعیت</th></tr></thead><tbody>
      ${list.map(p => `<tr data-go="#/product/${p.id}" class="${p.active ? "" : "off"}"><td><span class="thumb-s"><span class="pk">${PK.html(p)}</span></span></td><td><a href="#/product/${p.id}" style="font-weight:700;color:var(--ink)">${esc(p.name)}</a><br><small class="ltr" style="color:var(--mute)">${esc(p.code)}</small></td>
        <td>${esc((CATS.find(c => c.id === p.cat) || {}).name || p.cat)}</td><td class="num">${p.price ? toman(p.price) : `<span style="color:var(--danger)">بدون قیمت</span>`}</td>
        <td class="num" style="font-weight:800;color:${!p.stock ? "var(--danger)" : p.stock <= p.low_at ? "var(--warn)" : "var(--ink)"}">${fa(p.stock)}</td><td>${p.active ? chip("delivered", "فعال") : chip("cancelled", "غیرفعال")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty card"><b>کالایی پیدا نشد</b><a class="btn" href="#/product/new" style="margin-top:12px">افزودن کالا</a></div>`}`,
    mount() { bindRows();
      const go = () => { const p = new URLSearchParams(); const v = $("#pq").value.trim(); if (v) p.set("q", v); if ($("#pc").value) p.set("cat", $("#pc").value); if ($("#ps").value !== "all") p.set("show", $("#ps").value); location.hash = "#/products" + (p.toString() ? "?" + p : ""); };
      $("#pf").addEventListener("submit", e => { e.preventDefault(); go(); }); $("#pc").onchange = go; $("#ps").onchange = go; } };
};
const COLORS = ["#0E7A4B", "#7a2f2f", "#7a5212", "#a2431a", "#245a8c", "#1d3d86", "#9f2219", "#4c4f18", "#1d1d1d", "#5c5f63", "#b8860b", "#5b3cc4"];
const TIPS = {"": "ندارد", b: "مخروطی (B)", i: "سوزنی (I)", k: "چاقویی (K)", d: "تخت / پیچ‌گوشتی (D)", c: "اریب (C)"};
VIEWS.product = async r => {
  const d = await call("admin.products"); CATS = d.cats;
  const isNew = r.arg === "new", p = isNew ? {name: "", code: "", short: "", cat: CATS[0] ? CATS[0].id : "", price: 0, stock: 0, low_at: 2, active: 1, color: "#0E7A4B", ico: "tip", tip: null, why: "", specs: [], photo: null} : d.products.find(x => String(x.id) === r.arg);
  if (!p) return {title: "پیدا نشد", html: `<div class="empty card"><b>کالا پیدا نشد</b><a class="btn" href="#/products">کالاها</a></div>`};
  const log = isNew ? [] : (await call("admin.stock.log", {id: p.id})).log;
  const isICp = !!(CATS.find(c => c.id === p.cat) || {}).cab;
  const F = (id, label, input, help, opt) => `<div class="field ${opt && opt.full ? "full" : ""}"><label for="${id}">${label}</label>${input}<span class="help" id="${id}-help">${help || ""}</span><span class="err" id="${id}-err" role="alert"></span></div>`;
  return { title: isNew ? "کالای جدید" : p.name, html: `
    <a href="#/products" class="btn ghost sm" style="margin-bottom:8px">${icon("i-back")}همه‌ی کالاها</a>
    <div class="bar"><h1>${isNew ? "کالای جدید" : esc(p.name)}</h1>${!isNew ? `<a class="btn ghost sm" href="index.html#/product/${p.id}" target="_blank" rel="noopener">${icon("i-ext")}دیدن در فروشگاه</a>` : ""}</div>
    <form id="pform" novalidate><div class="pform">
      <div>
        <section class="card" aria-labelledby="b-h"><h2 id="b-h" style="font-size:var(--fs-18);margin-bottom:16px">اطلاعات اصلی</h2><div id="errSum"></div><div class="fields">
          ${F("f-name", 'نام کالا <span class="req" aria-hidden="true">*</span>', `<input id="f-name" name="name" value="${esc(p.name)}" required aria-describedby="f-name-err">`, "", {full: 1})}
          ${F("f-code", "کد / مدل", `<input id="f-code" name="code" dir="ltr" value="${esc(p.code)}" aria-describedby="f-code-help">`, "روی برچسب بسته چاپ می‌شود، مثلاً 900M-T-K")}
          ${F("f-short", "نام کوتاه", `<input id="f-short" name="short" value="${esc(p.short)}" aria-describedby="f-short-help">`, "برای پیام‌ها و رگال، مثلاً «نوک چاقویی»")}
          ${F("f-cat", 'دسته <span class="req" aria-hidden="true">*</span>', `<select id="f-cat" name="cat" required>${CATS.map(c => `<option value="${c.id}" ${c.id === p.cat ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`)}
          ${F("f-price", 'قیمت (تومان) <span class="req" aria-hidden="true">*</span>', `<input id="f-price" name="price" inputmode="numeric" dir="ltr" value="${p.price || ""}" required aria-describedby="f-price-help">`, p.price ? `= ${toman(p.price)}` : "")}
          ${F("f-drawer", "شماره‌ی کشو", `<input id="f-drawer" dir="ltr" value="${esc(p.drawer || "")}" aria-describedby="f-drawer-help">`, "همان کد کشو در انبار، مثلاً 32 یا 32-1")}
          ${F("f-pkg", "بسته‌بندی آی‌سی", `<select id="f-pkg"><option value="">خودکار از روی نام</option>${Object.entries(window.TTChips.PKGS).map(([k, l]) => `<option value="${k}" ${k === p.pkg ? "selected" : ""}>${l}</option>`).join("")}</select>`, "برای کالاهای قفسه‌ی آی‌سی؛ شکل تصویر قطعه")}
          ${me.role === "admin" ? F("f-buy", "قیمت خرید (تومان)", `<input id="f-buy" inputmode="numeric" dir="ltr" value="${p.buy_price || ""}" aria-describedby="f-buy-help">`, "فقط در پنل؛ در سایت دیده نمی‌شود") : ""}
          ${F("f-why", "توضیح کوتاه برای مشتری", `<textarea id="f-why" name="why" aria-describedby="f-why-help">${esc(p.why)}</textarea>`, "یکی‌دو جمله: به چه کاری می‌آید و چرا این را بخرد.", {full: 1})}
        </div></section>
        <section class="card" aria-labelledby="s-h" style="margin-top:16px"><h2 id="s-h" style="font-size:var(--fs-18);margin-bottom:8px">مشخصات فنی</h2><p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-bottom:12px">هر ردیف: عنوان و مقدار. برای نوک‌ها «شکل» و «مناسب برای» در معرفی سه‌بعدی نشان داده می‌شود.</p>
          <div id="specs">${(p.specs.length ? p.specs : [["", ""]]).map(specRow).join("")}</div>
          <button class="btn ghost sm" type="button" id="addSpec">${icon("i-plus")}ردیف جدید</button></section>
        ${!isNew ? `<section class="card" aria-labelledby="l-h" style="margin-top:16px"><h2 id="l-h" style="font-size:var(--fs-18);margin-bottom:8px">تاریخچه‌ی موجودی</h2>
          ${log.length ? `<table class="t"><thead><tr><th>زمان</th><th>تغییر</th><th>بعد از آن</th><th>دلیل</th></tr></thead><tbody>${log.map(l => `<tr><td class="num">${date(l.at)}</td><td class="num ltr" style="font-weight:800;color:${l.delta > 0 ? "var(--primary-700)" : "var(--danger)"}">${l.delta > 0 ? "+" : ""}${fa(l.delta)}</td><td class="num">${fa(l.after_qty)}</td><td>${REASONS[l.reason] || l.reason}${l.ref ? ` · <span class="ltr">${esc(l.ref)}</span>` : ""}${l.uname ? ` <small style="color:var(--mute)">(${esc(l.uname)})</small>` : ""}</td></tr>`).join("")}</tbody></table>` : `<p>هنوز تغییری ثبت نشده.</p>`}</section>` : ""}
      </div>
      <div>
        <section class="card" aria-labelledby="v-h"><h2 id="v-h" style="font-size:var(--fs-18);margin-bottom:12px">نمایش</h2>
          <label class="switch"><input type="checkbox" id="f-active" ${p.active ? "checked" : ""}>در فروشگاه نمایش داده شود</label>
          <div class="prev" id="prev"><span class="pk">${PK.html(p)}</span></div>
          <div ${isICp ? "hidden" : ""}>                                   <!-- hanging packs only; IC parts use the photo slots below -->
          <div class="field"><label for="f-photo">عکس بسته (روبه‌رو، پس‌زمینه‌ی ساده)</label><input id="f-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="f-photo-help"><span class="help" id="f-photo-help">JPG، PNG یا WebP؛ عمودی، مثل بسته‌ی آویزان.</span></div>
          ${p.photo && !isICp ? `<label class="switch" style="font-weight:400"><input type="checkbox" id="f-rmphoto">حذف عکس فعلی</label>` : ""}
          <fieldset style="border:0;margin-top:12px"><legend style="font-weight:700;font-size:var(--fs-14);color:var(--ink)">بدون عکس: رنگ و طرح بسته</legend>
            <div class="swatches" style="margin:8px 0">${COLORS.map(c => `<label><input type="radio" name="color" value="${c}" ${c === p.color ? "checked" : ""}><span style="background:${c}"></span><span class="sr-only">${c}</span></label>`).join("")}</div>
            <label class="sr-only" for="f-ico">طرح</label><select class="sel" id="f-ico" style="width:100%">${Object.entries(PK.NAMES).map(([k, l]) => `<option value="${k}" ${k === p.ico ? "selected" : ""}>${l}</option>`).join("")}</select></fieldset>
          <div class="field" style="margin-top:12px"><label for="f-tip">مدل سه‌بعدی نوک هویه</label><select id="f-tip" aria-describedby="f-tip-help">${Object.entries(TIPS).map(([k, l]) => `<option value="${k}" ${(p.tip || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select><span class="help" id="f-tip-help">اگر انتخاب شود، این کالا در معرفی سه‌بعدی صفحه‌ی اول می‌آید.</span></div>
          </div>
        </section>
        ${!isNew && isICp ? `<section class="card" aria-labelledby="ps-h" style="margin-top:16px"><h2 id="ps-h" style="font-size:var(--fs-18);margin-bottom:4px">عکس‌های قطعه</h2>
          <p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-bottom:12px">تا ۳ عکس. عکس اول در کشو و فهرست دیده می‌شود. گروهی هم از <a href="#/photos" style="color:var(--primary-700)">عکس قطعه‌ها</a>.</p>
          <div class="ph-slots" id="pslots">${slotTiles(p)}</div></section>` : ""}
        <section class="card" aria-labelledby="st-h" style="margin-top:16px"><h2 id="st-h" style="font-size:var(--fs-18);margin-bottom:12px">موجودی</h2><div class="fields" style="grid-template-columns:1fr 1fr">
          ${F("f-stock", "موجودی فعلی", `<input id="f-stock" inputmode="numeric" dir="ltr" value="${p.stock}" aria-describedby="f-stock-help">`, "تغییرش در تاریخچه ثبت می‌شود.")}
          ${F("f-low", "هشدار وقتی کمتر از", `<input id="f-low" inputmode="numeric" dir="ltr" value="${p.low_at}">`)}</div></section>
      </div>
    </div>
    <div class="sticky-save"><a class="btn ghost" href="#/products">انصراف</a><button class="btn" type="submit" id="save">${icon("i-check")}ذخیره</button></div></form>`,
    mount() {
      bindRows();
      const ps = $("#pslots");
      if (ps) {
        ps.addEventListener("change", async e => { const inp = e.target.closest("input[data-slot]"); if (!inp || !inp.files[0]) return;
          const s = inp.dataset.slot, tile = inp.closest(".ph-slot"); tile.classList.add("busy");
          try { const r = await sendPhoto({id: p.id}, s, inp.files[0]); Object.assign(p, r.product); ps.innerHTML = slotTiles(p); toast(r.replaced ? "عکس عوض شد." : "عکس اضافه شد."); }
          catch (err) { tile.classList.remove("busy"); toast(esc(err.message || "ارسال نشد.")); } inp.value = ""; });
        ps.addEventListener("click", async e => { const b = e.target.closest("[data-rmslot]"); if (!b) return;
          if (!(await confirmBox(`عکس ${SLOTN[b.dataset.rmslot]} حذف شود؟`, "حذف", true))) return;
          try { const r = await call("admin.photos.remove", {id: p.id, slot: b.dataset.rmslot}); Object.assign(p, r.product); ps.innerHTML = slotTiles(p); toast("حذف شد."); }
          catch (err) { toast(esc(err.message || "حذف نشد.")); } });
      }
      $("#addSpec").onclick = () => { $("#specs").insertAdjacentHTML("beforeend", specRow(["", ""])); $("#specs .specrow:last-child input").focus(); };
      $("#specs").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) b.closest(".specrow").remove(); });
      const preview = () => { const f = $("#f-photo").files[0], tmp = {...p, name: $("#f-name").value || "نام کالا", code: $("#f-code").value, color: ($("input[name=color]:checked") || {}).value, ico: $("#f-ico").value, tip: $("#f-tip").value || null};
        if ($("#f-rmphoto") && $("#f-rmphoto").checked) tmp.photo = null;
        if (f) tmp.photo = URL.createObjectURL(f); $("#prev .pk").innerHTML = PK.html(tmp); };
      $("#pform").addEventListener("input", e => { if (["f-name", "f-code", "f-ico", "f-tip"].includes(e.target.id) || e.target.name === "color") preview(); });
      $("#pform").addEventListener("change", e => { if (["f-photo", "f-rmphoto", "f-ico", "f-tip"].includes(e.target.id) || e.target.name === "color") preview();
        if (e.target.id === "f-price") $("#f-price-help").textContent = +en(e.target.value) ? "= " + toman(+en(e.target.value)) : ""; });
      $("#pform").addEventListener("submit", async e => { e.preventDefault();
        const errs = []; if ($("#f-name").value.trim().length < 2) errs.push(["f-name", "نام کالا را وارد کنید."]);
        const price = +en($("#f-price").value.replace(/[,،٬\s]/g, "")); if ($("#f-active").checked && !price) errs.push(["f-price", "برای نمایش در فروشگاه، قیمت لازم است."]);
        $$(".field.invalid").forEach(f => f.classList.remove("invalid"));
        if (errs.length) { errs.forEach(([id, m]) => { $("#" + id).closest(".field").classList.add("invalid"); $("#" + id + "-err").textContent = m; }); $("#" + errs[0][0]).focus(); return; }
        const fd = new FormData(); if (!isNew) fd.set("id", p.id);
        fd.set("name", $("#f-name").value.trim()); fd.set("code", $("#f-code").value.trim()); fd.set("short", $("#f-short").value.trim()); fd.set("cat", $("#f-cat").value);
        fd.set("price", String(price)); fd.set("why", $("#f-why").value.trim()); fd.set("active", $("#f-active").checked ? "1" : "0");
        fd.set("color", ($("input[name=color]:checked") || {value: "#0E7A4B"}).value); fd.set("ico", $("#f-ico").value); fd.set("tip", $("#f-tip").value);
        fd.set("stock", en($("#f-stock").value.trim())); fd.set("low_at", en($("#f-low").value.trim()));
        fd.set("drawer", en($("#f-drawer").value.trim())); fd.set("pkg", $("#f-pkg").value);
        if ($("#f-buy")) fd.set("buy_price", en($("#f-buy").value.replace(/[,،٬\s]/g, "")) || "0");
        fd.set("specs", JSON.stringify($$("#specs .specrow").map(r2 => [$("input[data-k]", r2).value.trim(), $("input[data-v]", r2).value.trim()]).filter(x => x[0] && x[1])));
        if ($("#f-photo").files[0]) fd.set("photo", $("#f-photo").files[0]); if ($("#f-rmphoto") && $("#f-rmphoto").checked) fd.set("remove_photo", "1");
        const b = $("#save"); b.disabled = true; b.textContent = "در حال ذخیره…";
        try { const res = await call("admin.product.save", undefined, fd); toast("ذخیره شد."); if (isNew) location.hash = "#/product/" + res.product.id; else route(); }
        catch (err) { b.disabled = false; b.innerHTML = icon("i-check") + "ذخیره"; toast(esc(err.message || "ذخیره نشد."));
          if (err.fields) Object.entries(err.fields).forEach(([k, m]) => { const el = $("#f-" + k); if (el) { el.closest(".field").classList.add("invalid"); $("#f-" + k + "-err").textContent = m; } }); }
      });
    } };
};
const slotTiles = p => SLOTS.map(s => { const src = p.slots && p.slots[s];
  return `<div class="ph-slot${src ? " has" : ""}">${src ? `<img src="${esc(src)}" alt="عکس ${SLOTN[s]} ${esc(p.name)}">` : `<span class="ph-empty">${icon("i-img")}</span>`}
    <span class="ph-lab">عکس ${SLOTN[s]}</span>
    <div class="ph-act"><label class="btn sm ${src ? "ghost" : "outline"}">${src ? "عوض کردن" : "افزودن"}<input type="file" accept="image/jpeg,image/png,image/webp" data-slot="${s}" class="sr-only"></label>
      ${src ? `<button class="icon-btn" type="button" data-rmslot="${s}" aria-label="حذف عکس ${SLOTN[s]}">${icon("i-trash")}</button>` : ""}</div></div>`; }).join("");
const specRow = ([k, v]) => `<div class="specrow"><input data-k aria-label="عنوان" placeholder="مثلاً شکل" value="${esc(k)}"><input data-v aria-label="مقدار" placeholder="مثلاً تیغه‌ای" value="${esc(v)}"><button class="icon-btn" type="button" data-rm aria-label="حذف ردیف">${icon("i-trash")}</button></div>`;

/* ---------- rack: the pegboard as an inventory screen ---------- */
VIEWS.rack = async () => {
  const d = await call("admin.products"); CATS = d.cats;
  const hook = p => { const n = p.stock, vis = Math.min(n, 6); let packs = "";
    for (let k = vis - 1; k >= 0; k--) packs += `<span class="pk ${k === 0 ? "front" : ""}" style="transform:translate(${-k * 3}px,${-k * 7}px) scale(${(1 - k * .025).toFixed(3)});filter:brightness(${(1 - k * .13).toFixed(2)});z-index:${10 - k}">${PK.html(p)}</span>`;
    return `<li class="hook" style="${p.active ? "" : "opacity:.5"}"><div class="tag${n ? "" : " out"}"><b class="num">${fa(n)} عدد</b><small>${esc(p.short || p.code || p.name)}</small></div><i class="rod" aria-hidden="true"></i>
      ${n ? `<div class="stack">${packs}</div>` : `<div class="empty-hook"><span>${esc(p.name)}</span></div>`}
      <button class="quick" type="button" data-adj="${p.id}" aria-label="تغییر موجودی ${esc(p.name)}، الان ${fa(n)} عدد">${icon("i-plus")}${icon("i-minus")}موجودی</button></li>`; };
  return { title: "موجودی", html: `<div class="bar"><h1>موجودی (ویترین)</h1><a class="btn outline sm" href="#/products?show=all">آی‌سی‌ها در فهرست کالاها</a><p style="color:var(--mute);font-size:var(--fs-14)">فروش حضوری، شمارش یا خرید جدید را همین‌جا ثبت کنید تا سایت با قفسه یکی بماند.</p></div>
    <div class="rack">${CATS.filter(c => !c.cab).map(c => { const items = d.products.filter(p => p.cat === c.id); return items.length ? `<h2 class="rail" style="font-size:var(--fs-16)">${esc(c.name)}</h2><ul class="hooks">${items.map(hook).join("")}</ul>` : ""; }).join("")}</div>`,
    mount() { $$("[data-adj]").forEach(b => b.addEventListener("click", () => adjustDialog(d.products.find(p => String(p.id) === b.dataset.adj)))); } };
};
function adjustDialog(p) {
  const d = document.createElement("dialog"); d.className = "card"; d.setAttribute("aria-labelledby", "ad-h"); let delta = -1;
  d.innerHTML = `<form class="form adj" novalidate><h2 id="ad-h" style="font-size:var(--fs-18)">${esc(p.name)}</h2><p>الان: <b class="num">${fa(p.stock)}</b> عدد</p>
    <div class="stepper"><button class="icon-btn" type="button" data-d="-1" aria-label="یکی کمتر" style="border:1.5px solid var(--line-2)">${icon("i-minus")}</button><output class="ltr num" id="dv" aria-live="polite">-۱</output><button class="icon-btn" type="button" data-d="1" aria-label="یکی بیشتر" style="border:1.5px solid var(--line-2)">${icon("i-plus")}</button>
      <span>→ <b class="num" id="after">${fa(p.stock - 1)}</b> عدد</span></div>
    <div class="field"><label for="ar">دلیل</label><select id="ar"><option value="instore">فروش حضوری</option><option value="purchase">خرید از تامین‌کننده (اضافه شد)</option><option value="count">شمارش انبار</option><option value="return">مرجوعی</option><option value="damage">خرابی/مفقودی</option></select></div>
    <div class="field"><label for="an">یادداشت <small style="font-weight:400">(اختیاری)</small></label><input id="an"></div>
    <span class="err" id="aerr" role="alert" style="display:block"></span>
    <div class="form-actions"><button class="btn ghost" type="button" data-x>انصراف</button><button class="btn" type="submit">ثبت</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  const upd = () => { $("#dv", d).textContent = (delta > 0 ? "+" : "") + fa(delta); $("#after", d).textContent = fa(p.stock + delta); $("[data-d='-1']", d).disabled = p.stock + delta <= 0; };
  upd(); $("[data-d='-1']", d).focus();
  d.addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (b) { delta += +b.dataset.d; if (delta === 0) delta += +b.dataset.d; upd();
    if (delta > 0 && $("#ar", d).value === "instore") $("#ar", d).value = "purchase"; if (delta < 0 && $("#ar", d).value === "purchase") $("#ar", d).value = "instore"; } });
  const close = () => { d.close(); d.remove(); };
  $("[data-x]", d).onclick = close; d.addEventListener("cancel", e => { e.preventDefault(); close(); });
  $("form", d).onsubmit = async e => { e.preventDefault(); const b = $("button[type=submit]", d); b.disabled = true;
    try { await call("admin.stock.adjust", {id: p.id, delta, reason: $("#ar", d).value, note: $("#an", d).value.trim()}); close(); toast(`موجودی «${esc(p.short || p.name)}» ثبت شد.`); route(); }
    catch (err) { $("#aerr", d).textContent = err.message || "ثبت نشد."; b.disabled = false; } };
}

/* ---------- import from Excel / CSV (parsed here in the browser; the server only receives clean rows) ---------- */
async function unzip(buf) {                                          // minimal .xlsx reader: central directory + inflate
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("این فایل اکسل (xlsx) معتبر نیست.");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {}, dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    const ds = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = u8.subarray(ds, ds + csize);
    files[name] = async () => method === 0 ? dec.decode(data) : await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return files;
}
async function readSheet(file) {
  if (/\.csv$/i.test(file.name)) {                                    // CSV: quoted fields, comma or semicolon
    const t = (await file.text()).replace(/^﻿/, ""), sep = (t.split("\n")[0].match(/;/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ""; } else if (ch === "\n") { row.push(cur.replace(/\r$/, "")); rows.push(row); row = []; cur = ""; } else cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  const files = await unzip(await file.arrayBuffer()), P = new DOMParser();
  const ss = files["xl/sharedStrings.xml"] ? [...P.parseFromString(await files["xl/sharedStrings.xml"](), "application/xml").getElementsByTagName("si")].map(si => si.textContent) : [];
  const sheetName = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0]; if (!sheetName) throw new Error("برگه‌ای در فایل پیدا نشد.");
  const doc = P.parseFromString(await files[sheetName](), "application/xml"), rows = [];
  for (const r of doc.getElementsByTagName("row")) { const row = [];
    for (const c of r.getElementsByTagName("c")) { const ref = c.getAttribute("r") || "", col = [...ref.replace(/\d/g, "")].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = c.getAttribute("t"), v = c.getElementsByTagName("v")[0]; let val = v ? v.textContent : "";
      if (t === "s") val = ss[+val] ?? ""; else if (t === "inlineStr") val = c.textContent;
      row[col] = val; }
    rows.push(Array.from(row, x => x ?? "")); }
  return rows;
}
/* first-pass group from the part number (the admin can change it in the preview) */
const IC_RULES = [["ic-relay", /رله|^V230|G8N|EX[12]-/i], ["ic-memory", /^24(C|LC)|^25LC|^93[CS]|^M?95\d|AM29F|M29F|M27C|CY62256|IS65C/i],
  ["ic-mcu", /ST10F|SAK|MC9S12|S9S12|S912|S9S08|MPC5|SPC5|R5F|D7[68]F|ATMEGA|PIC16|TMS470/i], ["ic-can", /TJA1|PCA82C|SN65HVD|TLE625|AMIS4|UJA|ATA ?6560|MCZ33290|MC33662|6LB176|MC33972/i],
  ["ic-asic", /^\d{5}$|^\d{5}\D|^28\d{6}|A2C|ATIC|SDIC|APIC|^E3\d\d|SE742|SAGEM|VALEO|JCI|MLX|SC9009|GEC44|0?990-|21093|MGH80|B59233|U705|AMIS ATM|SC74822|^793[56]|0D097|07096|0021[01]|4AK19|6A930|7030|C5664|E322|E351/i],
  ["ic-driver", /^VN|^VB0|BTS|TLE8[12]0|TLE62\d\d|TLE8444|TLE9201|TLE72[04]|L98|L99|L96|TPIC|NCV84|NCV77|UD[NQ]29|A3979|MC33926|M?C?Z?33810|MC33291|TLS208|L9741|L9708|L9177|BD99011|HIP9011|TDA16810|TC1-110|UPC1251|M5269|MR2835|M1924|MAR9746/i],
  ["ic-reg", /TLE4\d{3}|4270|L4995|LM2576|MC33063|HT75|TPS43335|L0517/i], ["ic-power", /ISLV|ISL9V|9V3040|GB10NB|NGD8201|FDD|BUK|IRLR|2N0|4N0|BCP|BSP|BC8|J122|2SK|2SB|18N40|SM[58]A27|BAV|MURS|M7\(|TSPD|AULR|VDR|DALE|NVD1NV|NCV8402|74A50/i],
  ["ic-logic", /^74|HEF40|ULN|ULQ|MC1413|LM29|LM324|KA7500|TDA73|TDA5220|YD1028/i]];
const guessCat = n => (IC_RULES.find(([, re]) => re.test(n)) || ["ic-misc"])[0];
const findCol = (head, res) => head.findIndex(h => res.some(re => re.test(String(h).trim())));
let IMP = null;
VIEWS.import = async () => {
  const d = await call("admin.products"); CATS = d.cats;
  const existing = d.products, admin = me.role === "admin";
  return { title: "ورود از اکسل", html: `<h1>ورود کالاها از اکسل</h1>
    ${!admin ? `<p class="err-summary">فقط مدیر فروشگاه می‌تواند از اکسل وارد کند.</p>` : ""}
    <section class="card form" aria-labelledby="ih"><h2 id="ih">۱. فایل را انتخاب کنید</h2>
      <p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-bottom:12px">خروجی اکسل انبار (xlsx) یا CSV. ستون‌های «نام کالا»، «کد کالا» (شماره‌ی کشو)، «موجودی»، «قیمت خرید» و «قیمت فروش» خودکار شناخته می‌شوند. قیمت خرید فقط در پنل می‌ماند و در سایت دیده نمی‌شود.</p>
      <div class="fields"><div class="field"><label for="imf">فایل</label><input id="imf" type="file" accept=".xlsx,.csv" ${admin ? "" : "disabled"}></div>
        <div class="field"><label for="imu">واحد قیمت در فایل</label><select id="imu"><option value="1">تومان</option><option value="0.1">ریال (تقسیم بر ۱۰)</option></select></div></div>
      <p id="imerr" class="err" role="alert" style="display:block"></p></section>
    <div id="impv"></div>
    ${admin ? `<section class="card form" style="margin-top:16px" aria-labelledby="inf-h"><h2 id="inf-h">توضیحات فنی آی‌سی‌ها</h2>
      <p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-bottom:12px">کاربرد، سازنده، ECU و خودروها، مشخصات کلیدی، بسته‌بندی واقعی و قطعه‌های مشابه برای ۳۶۱ آی‌سی (بر اساس دیتاشیت سازنده و فروشگاه‌های تخصصی ECU). فقط به کالایی اضافه می‌شود که هم شماره‌ی کشو و هم شماره‌ی قطعه‌اش یکی باشد.</p>
      <label class="switch" style="font-weight:400"><input type="checkbox" id="infall">توضیحات فعلی را هم جایگزین کن</label>
      <div class="actions-row" style="margin-top:12px"><button class="btn" type="button" id="infgo">${icon("i-check")}افزودن توضیحات</button><span id="infres" aria-live="polite" style="align-self:center;color:var(--mute)"></span></div></section>` : ""}`,
    mount() {
      if ($("#infgo")) $("#infgo").onclick = async () => {
        const all = $("#infall").checked;
        if (all && !(await confirmBox("توضیحاتی که قبلاً برای آی‌سی‌ها نوشته‌اید جایگزین شود؟", "جایگزین کن", true))) return;
        const b = $("#infgo"); b.disabled = true; $("#infres").textContent = "در حال افزودن…";
        try { const r = await call("admin.info.apply", {mode: all ? "all" : "empty"});
          $("#infres").textContent = `${fa(r.updated)} کالا به‌روز شد${r.kept ? `، ${fa(r.kept)} کالا توضیح داشت و دست نخورد` : ""}${r.not_found ? `، ${fa(r.not_found)} کشو پیدا نشد` : ""}${r.name_mismatch.length ? `، ${fa(r.name_mismatch.length)} کشو قطعه‌ی دیگری داشت` : ""}.`; }
        catch (err) { $("#infres").textContent = ""; toast(esc(err.message || "انجام نشد.")); }
        b.disabled = false; };
      $("#imf").addEventListener("change", async e => {
        const f = e.target.files[0]; if (!f) return; $("#imerr").textContent = ""; $("#impv").innerHTML = `<p>در حال خواندن فایل…</p>`;
        try {
          const rows = await readSheet(f); const head = rows[0] || [];
          const ci = {name: findCol(head, [/نام/, /^name/i, /part/i]), code: findCol(head, [/کد/, /drawer/i, /^code/i]), stock: findCol(head, [/موجودی/, /stock/i, /qty/i]),
            buy: findCol(head, [/خرید/, /cost/i, /buy/i]), price: findCol(head, [/فروش/, /^price/i, /sale/i])};
          if (ci.name < 0) throw new Error("ستون «نام کالا» پیدا نشد. سطر اول فایل باید عنوان ستون‌ها باشد.");
          const unit = +$("#imu").value, num = v => Math.round((+en(String(v ?? "").replace(/[,،٬\s]/g, "")) || 0) * unit);
          const byDrawer = new Map(existing.filter(p => p.drawer).map(p => [p.drawer, p])), byName = new Map(existing.map(p => [p.name, p]));
          const seen = new Map();
          IMP = rows.slice(1).map((r, i) => {
            const name = String(r[ci.name] ?? "").replace(/\s+/g, " ").trim(), code = ci.code >= 0 ? en(String(r[ci.code] ?? "").trim()) : "";
            const key = name.toUpperCase().replace(/\s/g, ""), dup = seen.has(key); if (!dup) seen.set(key, i + 2);
            const flags = []; if (!code) flags.push("بدون شماره‌ی کشو"); if (dup) flags.push("تکراری با سطر " + fa(seen.get(key))); if (!/[A-Za-z0-9]/.test(name)) flags.push("شماره‌ی قطعه ندارد");
            const ex = (code && byDrawer.get(code)) || byName.get(name);
            const cat = guessCat(name);
            return {row: i + 2, name, drawer: code, cat, pkg: window.TTChips.guessPkg(name, cat), stock: num(r[ci.stock]) / unit | 0, buy: num(r[ci.buy]), price: num(r[ci.price]),
              flags, exists: !!ex, on: !!name && !(!code && !/[A-Za-z0-9]/.test(name))};       // rows with no drawer and no part number (test rows) start unchecked
          }).filter(x => x.name);
          renderPreview();
        } catch (err) { $("#impv").innerHTML = ""; $("#imerr").textContent = err.message || "خواندن فایل ممکن نشد."; }
      });
    } };
};
function renderPreview(filter) {
  const icCats = CATS.filter(c => c.cab), other = CATS.filter(c => !c.cab), on = IMP.filter(x => x.on);
  const byCat = {}; on.forEach(x => byCat[x.cat] = (byCat[x.cat] || 0) + 1);
  const issues = IMP.filter(x => x.flags.length).length, rows = filter ? IMP.filter(x => x.flags.length) : IMP;
  const catSel = x => `<select class="sel" data-f="cat" data-r="${x.row}" aria-label="دسته‌ی ${esc(x.name)}" style="height:36px">${[...icCats, ...other].map(c => `<option value="${c.id}" ${c.id === x.cat ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`;
  const pkgSel = x => `<select class="sel" data-f="pkg" data-r="${x.row}" aria-label="بسته‌بندی ${esc(x.name)}" style="height:36px">${Object.entries(window.TTChips.PKGS).map(([k, l]) => `<option value="${k}" ${k === x.pkg ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  $("#impv").innerHTML = `<section class="card form" style="margin-top:16px" aria-labelledby="ih2"><h2 id="ih2">۲. بررسی و اصلاح</h2>
    <div class="kpis" style="margin-bottom:12px"><div class="card kpi"><span>ردیف‌های انتخاب‌شده</span><b>${fa(on.length)}</b></div><div class="card kpi"><span>جدید</span><b>${fa(on.filter(x => !x.exists).length)}</b></div><div class="card kpi"><span>به‌روزرسانی</span><b>${fa(on.filter(x => x.exists).length)}</b></div><div class="card kpi ${issues ? "alert" : ""}"><span>نیاز به بررسی</span><b>${fa(issues)}</b></div></div>
    <p style="font-size:var(--fs-14);margin-bottom:8px">${Object.entries(byCat).map(([k, n]) => `${esc((CATS.find(c => c.id === k) || {}).name || k)}: <b class="num">${fa(n)}</b>`).join(" · ")}</p>
    <div class="actions-row" style="margin-bottom:12px"><button class="btn sm outline" type="button" id="flt">${filter ? "نمایش همه" : `فقط ${fa(issues)} مورد نیازمند بررسی`}</button></div>
    <div class="tw" style="max-height:60vh;overflow:auto"><table class="t"><thead><tr><th>ورود</th><th>سطر</th><th>قطعه</th><th>کشو</th><th>دسته</th><th>بسته‌بندی</th><th>موجودی</th><th>خرید</th><th>فروش</th><th>وضعیت</th></tr></thead><tbody>
      ${rows.map(x => `<tr style="${x.on ? "" : "opacity:.5"}"><td><input type="checkbox" data-on="${x.row}" ${x.on ? "checked" : ""} aria-label="وارد شود: ${esc(x.name)}" style="width:20px;height:20px;accent-color:var(--primary)"></td><td class="num">${fa(x.row)}</td>
        <td dir="ltr" style="text-align:right;font-family:Consolas,monospace;font-weight:700">${esc(x.name)}</td><td class="num">${esc(x.drawer || "—")}</td><td>${catSel(x)}</td><td>${pkgSel(x)}</td>
        <td class="num">${fa(x.stock)}</td><td class="num">${fa(x.buy)}</td><td class="num">${fa(x.price)}</td>
        <td>${x.exists ? chip("paid", "به‌روزرسانی") : chip("delivered", "جدید")}${x.flags.map(f => `<br>${chip("pending", f)}`).join("")}${!x.price ? `<br>${chip("cancelled", "بدون قیمت؛ غیرفعال می‌ماند")}` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="sticky-save"><span id="improg" style="margin-inline-end:auto;align-self:center;color:var(--mute)" aria-live="polite"></span><button class="btn" type="button" id="imgo">${icon("i-check")}وارد کردن ${fa(on.length)} کالا</button></div></section>`;
  $("#flt").onclick = () => renderPreview(!filter);
  $("#impv").onchange = e => { const t = e.target, row = +(t.dataset.on || t.dataset.r), x = IMP.find(y => y.row === row); if (!x) return;
    if (t.dataset.on) { x.on = t.checked; renderPreview(filter); } else x[t.dataset.f] = t.value; };
  $("#imgo").onclick = async () => {
    const list = IMP.filter(x => x.on); if (!list.length) return;
    if (!(await confirmBox(`${fa(list.length)} کالا وارد شود؟ کالاهای موجود با همان شماره‌ی کشو به‌روز می‌شوند و تغییر موجودی‌ها در تاریخچه ثبت می‌شود.`, "وارد کردن"))) return;
    const b = $("#imgo"); b.disabled = true; let made = 0, upd = 0, skip = 0;
    try {
      for (let i = 0; i < list.length; i += 150) {
        $("#improg").textContent = `در حال وارد کردن ${fa(Math.min(i + 150, list.length))} از ${fa(list.length)}…`;
        const r = await call("admin.import", {rows: list.slice(i, i + 150).map(x => ({row: x.row, name: x.name, drawer: x.drawer, cat: x.cat, pkg: x.pkg, stock: x.stock, buy: x.buy, price: x.price}))});
        made += r.created; upd += r.updated; skip += r.skipped;
      }
      $("#impv").innerHTML = `<div class="success card"><span class="ok">${icon("i-check")}</span><h2>وارد شد</h2><p>${fa(made)} کالای جدید، ${fa(upd)} به‌روزرسانی${skip ? `، ${fa(skip)} ردیف رد شد` : ""}.</p>
        <div class="actions-row" style="justify-content:center;margin-top:16px"><a class="btn" href="index.html#/ic" target="_blank" rel="noopener">دیدن قفسه‌ی آی‌سی</a><a class="btn outline" href="#/products">کالاها</a></div></div>`;
      IMP = null;
    } catch (err) { b.disabled = false; $("#improg").textContent = ""; toast(esc(err.message || "وارد کردن ناموفق بود.")); }
  };
}

/* ---------- part photos: bulk upload by file name ----------
   "32-1_a.jpg" -> drawer 32-1, first photo; _b / _c are the 2nd and 3rd; no letter = first. Each photo is resized here
   (1600 px + a 420 px copy for the drawers), which also drops the phone's EXIF data (location), then sent one by one. */
const SLOTS = ["a", "b", "c"], SLOTN = {a: "اول", b: "دوم", c: "سوم"};
const parsePhotoName = n => { const m = en(n).replace(/\.[a-z0-9]+$/i, "").trim().match(/^(\d{1,4}(?:-\d{1,2})?)(?:[\s_.]*([abc]))?$/i);
  return m ? {drawer: m[1], slot: (m[2] || "a").toLowerCase()} : null; };
async function prepImage(file) {
  let src;
  try { src = await createImageBitmap(file, {imageOrientation: "from-image"}); }
  catch (e) { src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(/heic|heif/i.test(file.type + file.name) ? "عکس HEIC آیفون است؛ در تنظیمات دوربین «Most Compatible» را بزنید یا به JPG تبدیل کنید." : "این فایل عکس قابل خواندن نیست.")); i.src = URL.createObjectURL(file); }); }
  const W = src.width || src.naturalWidth, H = src.height || src.naturalHeight;
  const out = async (max, q) => { const s = Math.min(1, max / Math.max(W, H)), w = Math.round(W * s), h = Math.round(H * s);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h);
    let b = await new Promise(r => c.toBlob(r, "image/webp", q)); if (!b || b.type !== "image/webp") b = await new Promise(r => c.toBlob(r, "image/jpeg", q)); return b; };
  return {big: await out(1600, .86), small: await out(420, .8), w: W, h: H};
}
async function sendPhoto(target, slot, file) {
  const im = await prepImage(file), ext = im.big.type === "image/webp" ? "webp" : "jpg", fd = new FormData();
  if (target.id) fd.set("id", target.id); else fd.set("drawer", target.drawer);
  fd.set("slot", slot); fd.set("photo", im.big, "p." + ext); fd.set("thumb", im.small, "s." + ext);
  return call("admin.photos.upload", undefined, fd);
}
let PH = [];
VIEWS.photos = async () => {
  const d = await call("admin.products"); CATS = d.cats;
  const icIds = new Set(CATS.filter(c => c.cab).map(c => c.id)), parts = d.products.filter(p => icIds.has(p.cat));
  const byDrawer = new Map(); parts.concat(d.products.filter(p => !icIds.has(p.cat))).forEach(p => { if (p.drawer) byDrawer.set(p.drawer, [...(byDrawer.get(p.drawer) || []), p]); });
  const withPhoto = parts.filter(p => p.photos && p.photos.length).length, missing = parts.filter(p => !(p.photos && p.photos.length));
  PH = [];
  const match = () => { const seen = new Set();
    PH.forEach(x => { x.err = ""; x.p = null; x.note = "";
      if (!x.key) { x.err = "نام فایل شماره‌ی کشو نیست"; return; }
      const list = byDrawer.get(x.key.drawer) || [];
      if (!list.length) { x.err = "کالایی با این کشو نیست"; return; }
      if (list.length > 1) { x.err = "چند کالا این کشو را دارند"; return; }
      const k = x.key.drawer + "_" + x.key.slot; if (seen.has(k)) { x.err = "تکراری در همین انتخاب"; return; } seen.add(k);
      x.p = list[0]; x.note = x.p.slots && x.p.slots[x.key.slot] ? "جایگزین عکس فعلی" : "عکس " + SLOTN[x.key.slot]; }); };
  const table = () => { const ok = PH.filter(x => x.p && x.state !== "done"), bad = PH.filter(x => x.err);
    return !PH.length ? "" : `<section class="card form" style="margin-top:16px" aria-labelledby="ph2"><h2 id="ph2">۲. بررسی</h2>
      <div class="kpis" style="margin-bottom:12px"><div class="card kpi"><span>فایل‌ها</span><b>${fa(PH.length)}</b></div><div class="card kpi"><span>آماده‌ی ارسال</span><b>${fa(ok.length)}</b></div><div class="card kpi ${bad.length ? "alert" : ""}"><span>نیاز به اصلاح نام</span><b>${fa(bad.length)}</b></div></div>
      <div class="tw" style="max-height:60vh;overflow:auto"><table class="t ph-t"><thead><tr><th><span class="sr-only">پیش‌نمایش</span></th><th>فایل</th><th>کشو</th><th>قطعه</th><th>وضعیت</th></tr></thead><tbody>
        ${PH.map((x, i) => `<tr data-i="${i}"><td><img class="ph-th" src="${x.url}" alt="" loading="lazy"></td><td dir="ltr" class="ph-fn">${esc(x.file.name)}</td>
          <td class="num">${x.key ? esc(x.key.drawer) + ` <small>(${SLOTN[x.key.slot]})</small>` : "—"}</td>
          <td dir="ltr" class="ph-pn">${x.p ? esc(x.p.name) : ""}</td>
          <td class="ph-st">${x.state === "done" ? chip("delivered", "ارسال شد") : x.state === "busy" ? chip("preparing", "در حال ارسال…") : x.state === "fail" ? chip("cancelled", x.fail) : x.err ? chip("cancelled", x.err) : chip(x.note.startsWith("جایگزین") ? "pending" : "paid", x.note)}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="sticky-save"><span id="phprog" style="margin-inline-end:auto;align-self:center;color:var(--mute)" aria-live="polite"></span><button class="btn ghost" type="button" id="phclr">پاک کردن فهرست</button><button class="btn" type="button" id="phgo" ${ok.length ? "" : "disabled"}>${icon("i-check")}ارسال ${fa(ok.length)} عکس</button></div></section>`; };
  const paint = () => { $("#phpv").innerHTML = table(); };
  const add = files => { [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).forEach(f => PH.push({file: f, key: parsePhotoName(f.name), url: URL.createObjectURL(f)}));
    PH.sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || String(a.key && a.key.drawer).localeCompare(String(b.key && b.key.drawer), "en", {numeric: true}) || String(a.key && a.key.slot).localeCompare(String(b.key && b.key.slot)));
    match(); paint(); };
  const csv = () => { const rows = [["کشو", "شماره‌ی قطعه"], ...missing.sort((a, b) => String(a.drawer).localeCompare(String(b.drawer), "en", {numeric: true})).map(p => [p.drawer || "", p.name])];
    const blob = new Blob(["﻿" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n")], {type: "text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "parts-without-photo.csv"; a.click(); };
  return { title: "عکس قطعه‌ها", html: `<h1>عکس قطعه‌ها</h1>
    <div class="kpis" style="margin-bottom:16px"><div class="card kpi"><span>قطعه‌های قفسه</span><b>${fa(parts.length)}</b></div><div class="card kpi"><span>عکس دارند</span><b>${fa(withPhoto)}</b></div><div class="card kpi ${missing.length ? "alert" : ""}"><span>بدون عکس</span><b>${fa(missing.length)}</b></div></div>
    <section class="card form" aria-labelledby="ph1"><h2 id="ph1">۱. عکس‌ها را انتخاب کنید</h2>
      <div class="ph-rule"><p>نام هر فایل = <b>شماره‌ی کشو</b>، و برای عکس دوم و سوم یک حرف:</p>
        <ul><li dir="ltr"><code>32-1_a.jpg</code> <span dir="rtl">عکس اول کشوی 32-1 (بدون حرف هم اول است: <code dir="ltr">32-1.jpg</code>)</span></li><li dir="ltr"><code>32-1_b.jpg</code> <span dir="rtl">عکس دوم</span></li><li dir="ltr"><code>32-1_c.jpg</code> <span dir="rtl">عکس سوم</span></li></ul>
        <p class="help">عکس تکراری برای همان کشو و همان حرف، عکس قبلی را عوض می‌کند. پیشنهاد: اول از روبه‌رو با شماره‌ی خوانا، دوم از زاویه تا پایه‌ها دیده شوند، سوم از زیر. پس‌زمینه‌ی ساده و نور روز.</p></div>
      <label class="ph-drop" id="phdrop" for="phf">${icon("i-img")}<b>عکس‌ها را اینجا رها کنید</b><span>یا بزنید تا انتخاب کنید · چند فایل با هم</span>
        <input id="phf" type="file" accept="image/jpeg,image/png,image/webp,.heic" multiple class="sr-only"></label>
      <div class="actions-row" style="margin-top:12px"><label class="btn outline sm" for="phdir">انتخاب یک پوشه</label><input id="phdir" type="file" webkitdirectory multiple class="sr-only">
        ${missing.length ? `<button class="btn ghost sm" type="button" id="phcsv">${icon("i-ext")}فهرست ${fa(missing.length)} قطعه‌ی بدون عکس (اکسل)</button>` : ""}</div></section>
    <div id="phpv"></div>`,
    mount() {
      $("#phf").addEventListener("change", e => { add(e.target.files); e.target.value = ""; });
      $("#phdir").addEventListener("change", e => { add(e.target.files); e.target.value = ""; });
      const z = $("#phdrop");
      ["dragenter", "dragover"].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.add("on"); }));
      ["dragleave", "drop"].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.remove("on"); }));
      z.addEventListener("drop", e => add(e.dataTransfer.files));
      if ($("#phcsv")) $("#phcsv").onclick = csv;
      $("#phpv").addEventListener("click", async e => {
        if (e.target.id === "phclr") { PH.forEach(x => URL.revokeObjectURL(x.url)); PH = []; paint(); return; }
        if (e.target.closest("#phgo")) {
          const list = PH.filter(x => x.p && x.state !== "done"); if (!list.length) return;
          $("#phgo").disabled = true; $("#phclr").disabled = true; let done = 0, fail = 0;
          const prog = () => { $("#phprog").textContent = `${fa(done + fail)} از ${fa(list.length)}${fail ? ` · ${fa(fail)} ناموفق` : ""}`; };
          const row = x => { const tr = $(`#phpv tr[data-i="${PH.indexOf(x)}"] .ph-st`); if (tr) tr.innerHTML = x.state === "done" ? chip("delivered", "ارسال شد") : x.state === "busy" ? chip("preparing", "در حال ارسال…") : chip("cancelled", x.fail); };
          const q = list.slice(); prog();
          const worker = async () => { for (let x; (x = q.shift());) { x.state = "busy"; row(x);
            try { const r = await sendPhoto({drawer: x.key.drawer}, x.key.slot, x.file); x.state = "done"; done++; Object.assign(x.p, r.product); }
            catch (err) { x.state = "fail"; x.fail = err.message || "ارسال نشد"; fail++; }
            row(x); prog(); } };
          await Promise.all([worker(), worker(), worker()]);           // three at a time
          toast(fail ? `${fa(done)} عکس ارسال شد، ${fa(fail)} ناموفق.` : `${fa(done)} عکس ارسال شد.`);
          $("#phclr").disabled = false; $("#phgo").disabled = !PH.some(x => x.p && x.state !== "done");
        }
      });
    } };
};

/* ---------- notify / messages ---------- */
VIEWS.notify = async () => {
  const d = await call("admin.notify"), waiting = d.rows.filter(r => !r.sent_at);
  const byP = {}; waiting.forEach(r => { (byP[r.product_id] = byP[r.product_id] || {name: r.name, stock: r.stock, phones: []}).phones.push(r.phone); });
  return { title: "خبرم کن", html: `<h1>درخواست‌های «خبرم کن»</h1><p style="color:var(--mute);margin-bottom:16px">وقتی موجودی کالایی از صفر بیشتر شود، به همه‌ی این شماره‌ها خودکار پیامک می‌رود. این فهرست نشان می‌دهد چه چیزی را بیشتر شارژ کنید.</p>
    ${Object.keys(byP).length ? `<div class="tw"><table class="t"><thead><tr><th>کالا</th><th>منتظرها</th><th>موجودی</th><th>شماره‌ها</th></tr></thead><tbody>${Object.entries(byP).sort((a, b) => b[1].phones.length - a[1].phones.length).map(([id, x]) => `<tr data-go="#/product/${id}"><td>${esc(x.name)}</td><td class="num"><b>${fa(x.phones.length)}</b> نفر</td><td class="num">${fa(x.stock)}</td><td class="ltr num" style="font-size:var(--fs-12)">${x.phones.join("، ")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty card"><b>درخواستی در انتظار نیست</b></div>`}`, mount: bindRows };
};
VIEWS.messages = async () => {
  const d = await call("admin.messages"); counts.unseen = 0; setCounts();
  return { title: "پیام‌ها", html: `<h1>پیام‌های تماس</h1>${d.rows.length ? d.rows.map(m => `<article class="card pane" style="margin-bottom:12px${m.seen ? "" : ";border-color:var(--copper)"}"><h2 style="margin-bottom:4px">${esc(m.name)} <a class="ltr num" href="tel:${m.phone}">${m.phone}</a></h2><small class="num" style="color:var(--mute)">${date(m.created_at)}${m.seen ? "" : " · تازه"}</small><p style="margin-top:8px;white-space:pre-wrap">${esc(m.body)}</p></article>`).join("") : `<div class="empty card"><b>پیامی نیست</b></div>`}` };
};

/* ---------- settings + staff ---------- */
VIEWS.settings = async () => {
  const d = await call("admin.settings"), s = d.settings, admin = me.role === "admin";
  const staff = admin ? (await call("admin.staff")).rows : [];
  const F = (k, label, help, attrs) => `<div class="field"><label for="s-${k}">${label}</label><input id="s-${k}" name="${k}" value="${esc(s[k])}" ${attrs || ""} ${admin ? "" : "disabled"} aria-describedby="s-${k}-help"><span class="help" id="s-${k}-help">${help || ""}</span></div>`;
  return { title: "تنظیمات", html: `<h1>تنظیمات</h1>
    ${!admin ? `<p class="err-summary">فقط مدیر فروشگاه می‌تواند تنظیمات را تغییر دهد.</p>` : ""}
    <form id="sf" novalidate>
      <section class="card form"><h2>اطلاعات فروشگاه</h2><div class="fields">
        ${F("store_name", "نام فروشگاه")}${F("phone", "تلفن", "", 'dir="ltr"')}${F("address", "نشانی")}${F("hours", "ساعت کاری", "مثلاً شنبه تا پنجشنبه ۹ تا ۲۰")}
        ${F("notice", "اطلاعیه‌ی بالای سایت", "خالی بگذارید تا نمایش داده نشود؛ مثلاً «ارسال‌های پنجشنبه شنبه انجام می‌شود»")}${F("enamad", "کد نماد اعتماد (اینماد)", "پس از دریافت اینماد")}
      </div></section>
      <section class="card form" style="margin-top:16px"><h2>ارسال و پرداخت</h2><div class="fields">
        ${F("ship_courier", "هزینه‌ی پیک شیراز (تومان)", "", 'inputmode="numeric" dir="ltr"')}${F("ship_post", "هزینه‌ی پست پیشتاز (تومان)", "", 'inputmode="numeric" dir="ltr"')}
        ${F("ship_tipax", "هزینه‌ی تیپاکس (تومان)", "", 'inputmode="numeric" dir="ltr"')}${F("free_ship", "ارسال رایگان از مبلغ (تومان)", "۰ یعنی ارسال رایگان ندارد", 'inputmode="numeric" dir="ltr"')}
        ${F("cutoff_hour", "ساعت آخر ارسال همان روز", "مثلاً ۱۴ یعنی سفارش تا ۲ بعدازظهر، همان روز ارسال می‌شود", 'inputmode="numeric" dir="ltr"')}
        <div class="field"><span style="font-weight:700;font-size:var(--fs-14);color:var(--ink)">گزینه‌ها</span>
          <label class="switch" style="font-weight:400"><input type="checkbox" id="s-pickup" ${s.pickup === "1" ? "checked" : ""} ${admin ? "" : "disabled"}>تحویل حضوری از فروشگاه</label>
          <label class="switch" style="font-weight:400"><input type="checkbox" id="s-cod" ${s.cod === "1" ? "checked" : ""} ${admin ? "" : "disabled"}>پرداخت در محل (پیک و حضوری)</label></div>
      </div>
      <p class="ship-note" style="margin-top:16px">درگاه زرین‌پال: <b>${d.pay_online ? "فعال" : "تنظیم نشده"}</b> · پیامک: <b>${d.sms ? "فعال" : "تنظیم نشده"}</b>. این دو در فایل <span class="ltr">api/config.php</span> روی هاست تنظیم می‌شوند.</p></section>
      ${admin ? `<div class="sticky-save"><button class="btn" type="submit">${icon("i-check")}ذخیره‌ی تنظیمات</button></div>` : ""}
    </form>
    ${admin ? `<section class="card form" style="margin-top:16px" aria-labelledby="stf-h"><h2 id="stf-h">کارمندان پنل</h2>
      <p class="help" style="font-size:var(--fs-14);color:var(--mute);margin-bottom:12px">کارمند می‌تواند سفارش، کالا و موجودی را مدیریت کند؛ تنظیمات و کارمندان فقط دست مدیر است.</p>
      <table class="t"><tbody>${staff.map(u => `<tr><td>${esc(u.name)}</td><td class="ltr num">${u.phone}</td><td>${u.role === "admin" ? "مدیر" : "کارمند"}</td><td>${u.role === "staff" ? `<button class="link-danger" type="button" data-rmstaff="${u.id}">حذف دسترسی</button>` : ""}</td></tr>`).join("")}</tbody></table>
      <form id="stf" class="fields" style="margin-top:16px" novalidate>
        <div class="field"><label for="n-name">نام</label><input id="n-name" autocomplete="off"></div>
        <div class="field"><label for="n-phone">موبایل</label><input id="n-phone" type="tel" inputmode="tel" dir="ltr" autocomplete="off"></div>
        <div class="field"><label for="n-pass">رمز (دست‌کم ۸ کاراکتر)</label><input id="n-pass" type="password" autocomplete="new-password" dir="ltr"></div>
        <div class="field" style="justify-content:end"><button class="btn outline" type="submit">${icon("i-plus")}افزودن کارمند</button></div>
      </form></section>` : ""}`,
    mount() {
      if (!admin) return;
      $("#sf").addEventListener("submit", async e => { e.preventDefault(); const body = {};
        $$("#sf input[name]").forEach(i => body[i.name] = ["ship_courier", "ship_post", "ship_tipax", "free_ship", "cutoff_hour"].includes(i.name) ? en(i.value).replace(/\D/g, "") || "0" : i.value.trim());
        body.pickup = $("#s-pickup").checked ? "1" : "0"; body.cod = $("#s-cod").checked ? "1" : "0";
        try { await call("admin.settings.save", body); toast("تنظیمات ذخیره شد."); } catch (err) { toast(esc(err.message)); } });
      $("#stf").addEventListener("submit", async e => { e.preventDefault();
        try { await call("admin.staff.save", {name: $("#n-name").value.trim(), phone: en($("#n-phone").value.trim()), password: $("#n-pass").value}); toast("کارمند اضافه شد."); route(); } catch (err) { toast(esc(err.message)); } });
      $$("[data-rmstaff]").forEach(b => b.addEventListener("click", async () => { if (!(await confirmBox("دسترسی این کارمند به پنل برداشته شود؟", "حذف دسترسی", true))) return;
        try { await call("admin.staff.remove", {id: +b.dataset.rmstaff}); route(); } catch (err) { toast(esc(err.message)); } }));
    } };
};

/* ---------- start ---------- */
(async () => {
  try { const b = await API.boot(); if (!b.installed) { $("#root").innerHTML = `<div class="login-wrap"><div class="card form"><h1>فروشگاه هنوز نصب نشده</h1><p>اول <a href="install.php" style="color:var(--primary-700);font-weight:700">install.php</a> را باز کنید.</p></div></div>`; return; }
    me = b.user && ["admin", "staff"].includes(b.user.role) ? b.user : null; }
  catch (e) { $("#root").innerHTML = `<div class="login-wrap"><div class="card form" role="alert"><h1>اتصال برقرار نشد</h1><p>${esc(e.message || "")}</p><button class="btn" onclick="location.reload()">تلاش دوباره</button></div></div>`; return; }
  if (me) shell(); else renderLogin("");
})();
})();
