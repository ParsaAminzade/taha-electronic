/* Data layer shared by the storefront and the admin panel.
   Real: the PHP API on the host (api/?a=...).
   Demo: the same contract kept in this browser, used ONLY on localhost / a local file / ?demo / the static
   showcase build (demo-data.js sets window.TT_DEMO_DATA: a snapshot of the real catalogue, no PHP needed),
   so a failed request on the live site can never turn into a fake order. */
window.ShopAPI = (() => {
"use strict";
const SNAP = window.TT_DEMO_DATA || null;                              // static showcase (e.g. GitHub Pages)
const DEMO_OK = !!SNAP || location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /[?&]demo\b/.test(location.search);

const Real = {
  csrf: "",
  async call(a, data, form) {
    const opt = {credentials: "same-origin", headers: {"X-CSRF": Real.csrf}};
    if (form) { opt.method = "POST"; opt.body = form; }
    else if (data !== undefined) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(data); }
    let r; try { r = await fetch("api/?a=" + encodeURIComponent(a), opt); } catch (e) { throw {error: "network", message: "اتصال برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید."}; }
    let j; try { j = await r.json(); } catch (e) { throw {error: "server", message: "پاسخ سرور نامعتبر بود. چند لحظه بعد دوباره تلاش کنید."}; }
    if (j.csrf) Real.csrf = j.csrf;
    if (!j.ok) throw j;
    return j;
  }
};

/* ---------------- demo (mirrors api/index.php) ---------------- */
const Demo = (() => {
  const K = SNAP ? "tt-showcase-" + (SNAP.v || 1) : "tt-demo-v2";       // a new snapshot starts clean
  const now = () => Date.now();
  const STATUSES = {pending:"در انتظار پرداخت", paid:"پرداخت شد", confirmed:"تایید شد (پرداخت در محل)", preparing:"در حال آماده‌سازی", ready:"آماده‌ی تحویل حضوری", shipped:"ارسال شد", delivered:"تحویل شد", cancelled:"لغو شد", refunded:"بازپرداخت شد"};
  const FLOW = {paid:["preparing","cancelled"], confirmed:["preparing","cancelled"], preparing:["shipped","ready","cancelled"], ready:["delivered","cancelled"], shipped:["delivered"], delivered:["refunded"], pending:["cancelled"], cancelled:[], refunded:[]};
  const DEF = {store_name:"طاها الکترونیک", phone:"071-32308902", address:"", hours:"", notice:"", ship_courier:"60000", ship_post:"85000", ship_tipax:"120000", pickup:"1", cod:"1", free_ship:"2000000", cutoff_hour:"14", instagram:"", enamad:""};
  const TIP_SPEC = (shape, use) => [["شکل", shape], ["مناسب برای", use], ["سازگاری", "ایستگاه‌های سری ۹۳۶ / ۹۳۷ و سازگار با 900M"], ["سری", "900M"]];
  const seed = () => {
    if (SNAP) return {seq: {order: 0, msg: 0, user: 2}, settings: {...DEF, ...(SNAP.settings || {})},       // the real catalogue, frozen in demo-data.js
      users: [{id: 1, phone: "09120000000", name: "مدیر نمونه", role: "admin", pw: "demo-admin-123"}],
      cats: SNAP.cats, products: SNAP.products.map(p => ({low_at: 2, active: 1, sort: p.id, updated_at: now(), ...p})),
      stock_log: [], orders: [], notify: [], messages: [], session: {uid: null, orders: []}};
    let id = 0; const P = (o) => ({id: ++id, slug: "p" + id, low_at: 2, active: 1, photo: null, color: "#0E7A4B", ico: "tip", tip: null, why: "", specs: [], short: "", sort: id, updated_at: now(), ...o});
    return {
      seq: {order: 0, msg: 0, user: 2},
      settings: {...DEF},
      users: [{id: 1, phone: "09120000000", name: "مدیر نمونه", role: "admin", pw: "demo-admin-123"}],
      cats: [{id:"tips",name:"نوک هویه",icon:"i-tip",note:"سری 900M و سرامیکی"},{id:"solder",name:"لحیم و فلکس",icon:"i-solder",note:"سیم لحیم، فلکس، قلع‌کش"},{id:"probe",name:"پراب و تست",icon:"i-probe",note:"پراب مولتی‌متر، تستر"},{id:"tools",name:"ابزار دستی",icon:"i-cutter",note:"کف‌چین، پنس، انبر"},{id:"station",name:"هویه و هیتر",icon:"i-heat",note:"هیتر، نازل هوای گرم"},{id:"chem",name:"چسب و مواد",icon:"i-chem",note:"چسب سیلیکون، خمیر"}],
      products: [
        P({cat:"tips",code:"900M-T-B",name:"نوک هویه مخروطی 900M-T-B",short:"نوک مخروطی",price:180000,stock:9,photo:"assets/tip-pack.png",tip:"b",why:"همه‌کاره‌ترین نوک؛ اگر فقط یکی می‌خواهید، این است.",specs:TIP_SPEC("مخروطی با سر گرد","کار عمومی، قطعات معمولی و سیم‌کشی")}),
        P({cat:"tips",code:"900M-T-I",name:"نوک هویه سوزنی 900M-T-I",short:"نوک سوزنی",price:185000,stock:6,photo:"assets/tip-pack.png",tip:"i",why:"برای جاهای تنگ که نوک معمولی به پایه‌ی کناری می‌خورد.",specs:TIP_SPEC("سوزنی بسیار باریک","قطعات SMD ریز و پایه‌های نزدیک به هم")}),
        P({cat:"tips",code:"900M-T-K",name:"نوک هویه چاقویی 900M-T-K",short:"نوک چاقویی",price:210000,stock:2,photo:"assets/tip-pack.png",tip:"k",why:"با لبه‌اش یک ردیف پایه را یک‌جا لحیم می‌کنید.",specs:TIP_SPEC("تیغه‌ای با لبه‌ی اریب","لحیم کشیدنی آی‌سی‌ها و برداشتن پل قلع")}),
        P({cat:"tips",code:"900M-T-2.4D",name:"نوک هویه پیچ‌گوشتی 900M-T-2.4D",short:"نوک تخت",price:190000,stock:5,photo:"assets/tip-pack.png",tip:"d",why:"سطح تماس بیشتر یعنی حرارت سریع‌تر و لحیم تمیزتر.",specs:TIP_SPEC("تخت، ۲.۴ میلی‌متر","قطعات DIP، سیم‌ها و پدهای متوسط")}),
        P({cat:"tips",code:"900M-T-3C",name:"نوک هویه اریب 900M-T-3C",short:"نوک اریب",price:195000,stock:0,photo:"assets/tip-pack.png",tip:"c",why:"برش اریب قلع را نگه می‌دارد و حرارت زیادی منتقل می‌کند.",specs:TIP_SPEC("استوانه‌ای با برش ۴۵ درجه","پدهای بزرگ، قلع‌اندود کردن و کابل")}),
        P({cat:"tips",code:"YIHUA 60W I",name:"نوک هویه سرامیکی ۶۰ وات yihua I",price:260000,stock:3,color:"#7a2f2f",specs:[["توان","۶۰ وات"]]}),
        P({cat:"solder",code:"SN63 0.8mm",name:"سیم لحیم ۰.۸ میلی‌متر",price:240000,stock:4,color:"#7a5212",ico:"spool",specs:[["آلیاژ","Sn63/Pb37"]]}),
        P({cat:"solder",code:"FLUX PASTE",name:"خمیر فلکس لحیم‌کاری",price:95000,stock:6,color:"#a2431a",ico:"jar"}),
        P({cat:"solder",code:"WICK 2.0mm",name:"سیم قلع‌کش ۲ میلی‌متر",price:70000,stock:1,color:"#245a8c",ico:"wick"}),
        P({cat:"probe",code:"SS-024",name:"پراب مولتی‌متر سان‌شاین SS-024",price:160000,stock:3,color:"#9f2219",ico:"probe"}),
        P({cat:"probe",code:"SS-024A",name:"پراب مولتی‌متر سان‌شاین SS-024A",price:175000,stock:0,color:"#1d3d86",ico:"probe"}),
        P({cat:"probe",code:"LAMP TEST",name:"تست لامپ خودرو",price:130000,stock:2,color:"#4c4f18",ico:"bulb"}),
        P({cat:"tools",code:"PCAFC 170",name:"کف‌چین PCAFC مدل 170",price:290000,stock:7,ico:"cutter"}),
        P({cat:"station",code:"BK701 D",name:"هیتر هویه Bakon BK701 D",price:350000,stock:2,color:"#1d1d1d",ico:"heater"}),
        P({cat:"station",code:"HOT AIR NOZZLE",name:"نازل دوبل دسته هوای گرم",price:120000,stock:0,color:"#5c5f63",ico:"nozzle"}),
        P({cat:"chem",code:"KAFUTER",name:"چسب سیلیکون کافوتر (Kafuter)",price:85000,stock:8,color:"#b8860b",ico:"tube"}),
      ],
      stock_log: [], orders: [], notify: [], messages: [], session: {uid: null, orders: []},
    };
  };
  const load = () => { try { const s = JSON.parse(localStorage.getItem(K)); if (s && s.products) return s; } catch (e) {} return seed(); };
  let S = load();
  const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} };
  const err = (error, message, extra) => { throw {ok: false, error, message, ...(extra || {})}; };
  const en = s => String(s ?? "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const phone = p => { p = en(p).replace(/\D/g, ""); if (p.startsWith("98") && p.length === 12) p = "0" + p.slice(2); if (p.length === 10 && p[0] === "9") p = "0" + p; return /^09\d{9}$/.test(p) ? p : ""; };
  const me = () => S.users.find(u => u.id === S.session.uid) || null;
  const pub = u => u ? {id: u.id, name: u.name, phone: u.phone, role: u.role} : null;
  const staff = () => { const u = me(); if (!u) err("auth", "ابتدا وارد حساب شوید."); if (!["admin", "staff"].includes(u.role)) err("forbidden", "دسترسی به پنل مدیریت ندارید."); return u; };
  const ship = () => { const s = S.settings, m = [
    {id:"courier",name:"پیک (فقط شیراز)",note:"تحویل همان روز یا روز بعد",price:+s.ship_courier,days:[0,1]},
    {id:"post",name:"پست پیشتاز",note:"سراسر کشور",price:+s.ship_post,days:[2,4]},
    {id:"tipax",name:"تیپاکس",note:"سراسر کشور",price:+s.ship_tipax,days:[1,3]}];
    if (s.pickup === "1") m.push({id:"pickup",name:"تحویل حضوری از فروشگاه",note:"رایگان؛ پس از پیامک «آماده‌ی تحویل»",price:0,days:[0,1]}); return m; };
  const prod = id => S.products.find(p => p.id === +id);
  const adjust = (pid, delta, reason, ref, uid) => {
    const p = prod(pid); if (!p || p.stock + delta < 0) return null;
    p.stock += delta; p.updated_at = now();
    S.stock_log.unshift({id: S.stock_log.length + 1, product_id: p.id, delta, after_qty: p.stock, reason, ref: ref || null, user_id: uid || null, uname: uid ? (S.users.find(u => u.id === uid) || {}).name : null, at: now()});
    if (delta > 0 && p.stock === delta) S.notify.filter(n => n.product_id === p.id && !n.sent_at).forEach(n => n.sent_at = now());
    return p.stock;
  };
  const full = o => ({...o, status_label: STATUSES[o.status]});
  const nextSteps = o => (FLOW[o.status] || []).filter(s => !(s === "ready" && o.ship_method !== "pickup") && !(s === "shipped" && o.ship_method === "pickup"));
  const restock = (o, reason, uid) => o.items.forEach(x => adjust(x.product_id, x.qty, reason, o.code, uid));
  const ev = (o, status, note, uid) => o.events.push({status, note: note || null, at: now(), user_id: uid || null});
  const pubProducts = () => S.products.filter(p => p.active).sort((a, b) => a.sort - b.sort || a.id - b.id);

  const A = {
    boot: () => ({installed: true, csrf: "demo", user: pub(me()), settings: S.settings, ship: ship(), cats: S.cats, products: pubProducts(), pay_online: true, sms: false, demo: true}),
    "order.create": d => {
      const s = S.settings, methods = Object.fromEntries(ship().map(m => [m.id, m])), e = {};
      const mobile = phone(d.mobile), city = (d.city || "").trim(), address = (d.address || "").trim();
      if ((d.name || "").trim().length < 3) e.name = "نام و نام خانوادگی را کامل وارد کنید.";
      if (!mobile) e.mobile = "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.";
      if (!methods[d.ship]) e.ship = "روش ارسال را انتخاب کنید.";
      if (d.ship !== "pickup") { if (!d.province) e.province = "استان را انتخاب کنید."; if (!city) e.city = "شهر را وارد کنید."; if (address.length < 10) e.address = "نشانی کامل را وارد کنید."; }
      const postal = en(d.postal || "").replace(/\D/g, ""); if (postal && postal.length !== 10) e.postal = "کد پستی باید ۱۰ رقم باشد.";
      if (d.ship === "courier" && !city.includes("شیراز")) e.ship = "پیک فقط برای شهر شیراز است.";
      if (d.pay === "cod" && (!["courier", "pickup"].includes(d.ship) || s.cod !== "1")) e.pay = "پرداخت در محل فقط برای پیک شیراز و تحویل حضوری است.";
      if (Object.keys(e).length) err("invalid", "چند مورد نیاز به اصلاح دارد.", {fields: e});
      const code = "TT" + Math.floor(100000 + Math.random() * 900000), lines = []; let sub = 0;
      for (const x of d.items || []) { const p = prod(x.id), q = Math.max(0, Math.min(99, +x.qty || 0));
        if (!p || !p.active || q < 1) { lines.forEach(([p2, q2]) => adjust(p2.id, q2, "cancel", code)); err("items", "یکی از کالاهای سبد دیگر فروخته نمی‌شود. سبد را بررسی کنید."); }
        if (adjust(p.id, -q, "order", code) === null) { lines.forEach(([p2, q2]) => adjust(p2.id, q2, "cancel", code)); err("stock", `موجودی «${p.name}» کافی نیست. تعداد را کم کنید.`); }
        lines.push([p, q]); sub += p.price * q; }
      if (!lines.length) err("items", "سبد خرید خالی است.");
      const shipCost = d.ship === "pickup" || sub >= +s.free_ship ? 0 : methods[d.ship].price;
      const o = {id: ++S.seq.order, code, user_id: S.session.uid, name: d.name.trim(), mobile, province: d.province || "", city, address, postal: postal || null, ship_method: d.ship, ship_cost: shipCost,
        subtotal: sub, total: sub + shipCost, pay_method: d.pay, status: d.pay === "cod" ? "confirmed" : "paid", pay_ref: d.pay === "cod" ? null : "DEMO-" + code, tracking_no: null, note: null,
        created_at: now(), updated_at: now(), items: lines.map(([p, q]) => ({product_id: p.id, name: p.name, code: p.code, price: p.price, qty: q})), events: []};
      ev(o, o.status, d.pay === "cod" ? null : "پرداخت آزمایشی (نسخه‌ی نمایشی)");
      S.orders.unshift(o); S.session.orders.push(code); return {code};
    },
    track: d => { const code = en(d.code).toUpperCase().replace(/[^A-Z0-9]/g, ""), o = S.orders.find(x => x.code === code), m = phone(d.mobile);
      if (!o || !(S.session.orders.includes(code) || o.mobile === m || (me() && me().phone === o.mobile))) err("not_found", "سفارشی با این مشخصات پیدا نشد.");
      const r = full(o); delete r.address; delete r.postal; return {order: r}; },
    "otp.send": d => { const p = phone(d.phone); if (!p) err("phone", "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید."); S._otp = p; return {debug_code: "12345"}; },
    "otp.verify": d => { const p = phone(d.phone); if (p !== S._otp) err("expired", "کد منقضی شده است. کد تازه بگیرید."); if (en(d.code) !== "12345") err("code", "کد درست نیست. دوباره امتحان کنید.");
      let u = S.users.find(x => x.phone === p); if (!u) { u = {id: ++S.seq.user + 10, phone: p, name: "", role: "customer"}; S.users.push(u); } S.session.uid = u.id; return {user: pub(u)}; },
    logout: () => { S.session.uid = null; return {csrf: "demo"}; },
    "me.orders": () => { const u = me(); if (!u) err("auth", "ابتدا وارد حساب شوید."); return {orders: S.orders.filter(o => o.user_id === u.id || o.mobile === u.phone).map(full)}; },
    "notify.add": d => { const p = (me() && me().phone) || phone(d.phone); if (!p) err("phone", "شماره‌ی موبایل را وارد کنید تا خبرتان کنیم."); S.notify = S.notify.filter(n => !(n.product_id === +d.id && n.phone === p)); S.notify.unshift({product_id: +d.id, phone: p, created_at: now(), sent_at: null}); return {}; },
    "contact.send": d => { if (!d.name || !phone(d.phone) || (d.body || "").length < 5) err("invalid", "نام، موبایل و پیام را کامل وارد کنید."); S.messages.unshift({id: ++S.seq.msg, name: d.name, phone: phone(d.phone), body: d.body, created_at: now(), seen: 0}); return {}; },

    "admin.login": d => { const u = S.users.find(x => x.phone === phone(d.phone) && ["admin", "staff"].includes(x.role)); if (!u || u.pw !== d.password) err("login", "شماره یا رمز درست نیست."); S.session.uid = u.id; return {user: pub(u), csrf: "demo"}; },
    "admin.dashboard": () => { staff(); const live = o => !["pending", "cancelled", "refunded"].includes(o.status), day = new Date(); day.setHours(0, 0, 0, 0); const d0 = +day;
      const t = S.orders.filter(o => live(o) && o.created_at >= d0);
      const series = []; for (let i = 13; i >= 0; i--) { const from = d0 - i * 864e5, to = from + 864e5, os = S.orders.filter(o => live(o) && o.created_at >= from && o.created_at < to); series.push({day: from, sum: os.reduce((s, o) => s + o.total, 0), count: os.length}); }
      const dem = {}; S.notify.filter(n => !n.sent_at).forEach(n => { dem[n.product_id] = (dem[n.product_id] || 0) + 1; });
      return {today: {orders: t.length, sum: t.reduce((s, o) => s + o.total, 0)}, todo: S.orders.filter(o => ["paid", "confirmed", "preparing"].includes(o.status)).length,
        low: S.products.filter(p => p.active && p.stock <= p.low_at).sort((a, b) => a.stock - b.stock), demand: Object.entries(dem).map(([id, c]) => ({id: +id, name: prod(id).name, c})).sort((a, b) => b.c - a.c).slice(0, 8),
        recent: S.orders.slice(0, 8).map(full), series, unseen: S.messages.filter(m => !m.seen).length}; },
    "admin.orders": d => { staff(); let L = S.orders;
      if (d.status === "todo") L = L.filter(o => ["paid", "confirmed", "preparing"].includes(o.status)); else if (STATUSES[d.status]) L = L.filter(o => o.status === d.status);
      if (d.q) { const q = en(d.q).toUpperCase(); L = L.filter(o => o.code.includes(q) || o.mobile.includes(en(d.q)) || o.name.includes(d.q)); }
      return {total: L.length, orders: L.slice(0, 30).map(full), statuses: STATUSES}; },
    "admin.order": d => { staff(); const o = S.orders.find(x => x.id === +d.id); if (!o) err("not_found", "سفارش پیدا نشد."); return {order: full(o), next: nextSteps(o), statuses: STATUSES}; },
    "admin.order.update": d => { const u = staff(), o = S.orders.find(x => x.id === +d.id); if (!o) err("not_found", "سفارش پیدا نشد.");
      const to = d.status || ""; if (to && !nextSteps(o).includes(to)) err("flow", "این تغییر وضعیت مجاز نیست.");
      const tr = (d.tracking_no ?? o.tracking_no ?? "").trim(); if (to === "shipped" && o.ship_method !== "courier" && !tr) err("tracking", "کد رهگیری مرسوله را وارد کنید.");
      if (to === "cancelled") restock(o, "cancel", u.id);
      if (to) o.status = to; o.tracking_no = tr || null; o.updated_at = now(); if (to || d.note) ev(o, to || o.status, d.note, u.id);
      return A["admin.order"]({id: o.id}); },
    "admin.products": () => { staff(); return {products: S.products.slice().sort((a, b) => a.sort - b.sort || a.id - b.id), cats: S.cats}; },
    "admin.product.save": (d, form) => { const u = staff(); if (form) d = Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string"));
      const e = {}; if ((d.name || "").trim().length < 2) e.name = "نام کالا را وارد کنید."; if (!S.cats.find(c => c.id === d.cat)) e.cat = "دسته را انتخاب کنید.";
      if (Object.keys(e).length) err("invalid", "چند مورد نیاز به اصلاح دارد.", {fields: e});
      let p = d.id ? prod(d.id) : null;
      const specs = (typeof d.specs === "string" ? JSON.parse(d.specs || "[]") : d.specs || []).filter(r => r[0] && r[1]);
      const vals = {cat: d.cat, code: (d.code || "").trim(), name: d.name.trim(), short: (d.short || "").trim(), price: +en(d.price) || 0, low_at: +en(d.low_at) || 0, active: d.active === "0" || d.active === 0 ? 0 : 1,
        color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : "#0E7A4B", ico: d.ico || "tip", tip: ["b","i","k","d","c"].includes(d.tip) ? d.tip : null, why: (d.why || "").trim(), specs, updated_at: now()};
      if (d.sort !== undefined && d.sort !== "") vals.sort = +d.sort; else if (!d.id) vals.sort = Math.max(0, ...S.products.map(x => x.sort)) + 1;
      if (d._photo) vals.photo = d._photo; if (d.remove_photo === "1") vals.photo = null;
      if (p) Object.assign(p, vals); else { p = {id: Math.max(0, ...S.products.map(x => x.id)) + 1, slug: "p" + Date.now(), stock: 0, photo: null, ...vals}; S.products.push(p); }
      if (d.stock !== undefined && d.stock !== "") { const diff = (+en(d.stock) || 0) - p.stock; if (diff) adjust(p.id, diff, d.id ? "count" : "initial", null, u.id); }
      return {product: p}; },
    "admin.stock.adjust": d => { const u = staff(), R = ["instore", "count", "purchase", "return", "damage"]; if (!R.includes(d.reason)) err("reason", "دلیل تغییر را انتخاب کنید.");
      const delta = +en(d.delta); if (!delta) err("delta", "تعداد را وارد کنید."); const a = adjust(d.id, delta, d.reason, d.note, u.id); if (a === null) err("stock", "موجودی منفی نمی‌شود."); return {stock: a}; },
    "admin.stock.log": d => { staff(); return {log: S.stock_log.filter(l => l.product_id === +d.id).slice(0, 60)}; },
    "admin.notify": () => { staff(); return {rows: S.notify.map(n => ({...n, name: (prod(n.product_id) || {}).name, stock: (prod(n.product_id) || {}).stock}))}; },
    "admin.messages": () => { staff(); const rows = S.messages.map(m => ({...m})); S.messages.forEach(m => m.seen = 1); return {rows}; },
    "admin.settings": () => { staff(); return {settings: S.settings, sms: false, pay_online: false}; },
    "admin.settings.save": d => { const u = staff(); if (u.role !== "admin") err("forbidden", "این کار فقط برای مدیر فروشگاه است."); Object.keys(DEF).forEach(k => { if (k in d) S.settings[k] = String(d[k]); }); return {settings: S.settings}; },
    "admin.staff": () => { staff(); return {rows: S.users.filter(u => ["admin", "staff"].includes(u.role)).map(pub)}; },
    "admin.staff.save": d => { staff(); const p = phone(d.phone); if (!p || !d.name) err("invalid", "نام و شماره را وارد کنید."); if ((d.password || "").length < 8) err("password", "رمز دست‌کم ۸ کاراکتر باشد.");
      let u = S.users.find(x => x.phone === p); if (u && u.role === "admin") err("exists", "این شماره مدیر است."); if (!u) { u = {id: ++S.seq.user + 10, phone: p}; S.users.push(u); } Object.assign(u, {name: d.name, role: "staff", pw: d.password}); return A["admin.staff"](); },
    "admin.staff.remove": d => { const me_ = staff(); if (+d.id === me_.id) err("self", "نمی‌توانید خودتان را حذف کنید."); const u = S.users.find(x => x.id === +d.id && x.role === "staff"); if (u) { u.role = "customer"; delete u.pw; } return A["admin.staff"](); },
  };
  return {
    async call(a, data, form) {
      await new Promise(r => setTimeout(r, 120));          // feel like a network round-trip
      if (!A[a]) err("unknown", "درخواست نامعتبر.");
      if (form && form.get("photo") instanceof File && form.get("photo").size) {
        const f = form.get("photo"); if (f.size > 400000) err("upload", "در نسخه‌ی نمایشی عکس باید کمتر از ۴۰۰ کیلوبایت باشد.");
        form.set("_photo", await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }));
      }
      try { const res = {ok: true, ...A[a](data || {}, form)}; save(); return res; } catch (e) { save(); throw e; }
    },
    reset() { localStorage.removeItem(K); S = seed(); }
  };
})();

let api = null, isDemo = false;
async function boot() {
  if (SNAP) { api = Demo; isDemo = true; return Demo.call("boot"); }    // static showcase: there is no server to ask
  try { const r = await Real.call("boot"); api = Real; return r; }
  catch (e) {
    if (!DEMO_OK) { api = Real; throw e; }
    api = Demo; isDemo = true; return Demo.call("boot");
  }
}
return {
  boot,
  call: (a, d, f) => (api || Real).call(a, d, f),
  get demo() { return isDemo; },
  resetDemo: () => Demo.reset(),
};
})();
