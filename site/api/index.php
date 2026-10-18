<?php
/* Taha Electronic store API. One endpoint: api/?a=<action>. JSON in, JSON out.
   Every POST needs the X-CSRF header from "boot". Admin actions need a staff/admin session. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

try {
  start_session();
  $a = (string)($_GET['a'] ?? '');
  if ($a === 'pay.back') pay_back();                                   // browser redirect from the bank, no CSRF
  if ($_SERVER['REQUEST_METHOD'] === 'POST') csrf_check();
  release_expired();
  $fn = 'act_' . str_replace('.', '_', $a);
  if (!preg_match('/^[a-z_]+$/', str_replace('.', '_', $a)) || !function_exists($fn)) fail('unknown', 'درخواست نامعتبر.', 404);
  $fn();
} catch (Throwable $e) {
  error_log('[tahatronic] ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine());
  fail('server', 'خطای سرور. لطفاً دوباره تلاش کنید.', 500);
}

/* ================= public ================= */
function act_boot() {
  $installed = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn() > 0;
  $s = settings();
  $cats = db()->query('SELECT id, name, icon, note, cab FROM categories ORDER BY sort, name')->fetchAll();
  $prods = array_map('product_row', db()->query('SELECT * FROM products WHERE active = 1 ORDER BY sort, id')->fetchAll());
  out(['ok' => true, 'installed' => $installed, 'csrf' => $_SESSION['csrf'], 'user' => public_user(current_user()),
    'settings' => array_intersect_key($s, array_flip(['store_name', 'phone', 'address', 'hours', 'notice', 'free_ship', 'cutoff_hour', 'cod', 'instagram', 'enamad'])),
    'ship' => ship_methods(), 'cats' => $cats, 'products' => $prods, 'pay_online' => zp_enabled(), 'sms' => sms_enabled()]);
}

function act_order_create() {
  $s = settings();
  $items = in('items'); if (!is_array($items) || !$items || count($items) > 50) fail('items', 'سبد خرید خالی است.');
  $name = clean_text(in('name'), 80); $mobile = norm_phone(in('mobile'));
  $ship = (string)in('ship'); $pay = (string)in('pay');
  $province = clean_text(in('province'), 40); $city = clean_text(in('city'), 40); $address = clean_text(in('address'), 400);
  $postal = preg_replace('/\D/', '', en_digits(in('postal', '')));
  $methods = array_column(ship_methods(), null, 'id');
  $err = [];
  if (mb_strlen($name) < 3) $err['name'] = 'نام و نام خانوادگی را کامل وارد کنید.';
  if (!$mobile) $err['mobile'] = 'شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.';
  if (!isset($methods[$ship])) $err['ship'] = 'روش ارسال را انتخاب کنید.';
  if ($ship !== 'pickup') {
    if (!$province) $err['province'] = 'استان را انتخاب کنید.';
    if (!$city) $err['city'] = 'شهر را وارد کنید.';
    if (mb_strlen($address) < 10) $err['address'] = 'نشانی کامل را وارد کنید.';
  }
  if ($postal !== '' && strlen($postal) !== 10) $err['postal'] = 'کد پستی باید ۱۰ رقم باشد.';
  if ($ship === 'courier' && mb_strpos($city, 'شیراز') === false) $err['ship'] = 'پیک فقط برای شهر شیراز است.';
  if ($pay === 'cod' && (!in_array($ship, ['courier', 'pickup'], true) || $s['cod'] !== '1')) $err['pay'] = 'پرداخت در محل فقط برای پیک شیراز و تحویل حضوری است.';
  if (!in_array($pay, ['online', 'cod'], true)) $err['pay'] = 'روش پرداخت را انتخاب کنید.';
  if ($pay === 'online' && !zp_enabled()) $err['pay'] = 'پرداخت اینترنتی هنوز فعال نیست؛ پرداخت در محل یا تماس تلفنی را انتخاب کنید.';
  if ($err) out(['ok' => false, 'error' => 'invalid', 'message' => 'چند مورد نیاز به اصلاح دارد.', 'fields' => $err], 422);
  if (too_many('order:' . $mobile, 10, 60, 60)) fail('rate', 'تعداد سفارش‌ها زیاد است. کمی بعد دوباره تلاش کنید.', 429);
  note_attempt('order:' . $mobile);

  $pdo = db(); $pdo->beginTransaction();
  $code = 'TT' . random_int(100000, 999999);
  $lines = []; $subtotal = 0;
  foreach ($items as $x) {
    $p = get_product((int)($x['id'] ?? 0)); $q = int_in($x['qty'] ?? 0, 0, 99);
    if (!$p || !$p['active'] || $q < 1) { $pdo->rollBack(); fail('items', 'یکی از کالاهای سبد دیگر فروخته نمی‌شود. سبد را بررسی کنید.', 409); }
    if (adjust_stock((int)$p['id'], -$q, 'order', $code) === null) { $pdo->rollBack(); fail('stock', "موجودی «{$p['name']}» کافی نیست. تعداد را کم کنید.", 409); }
    $lines[] = [$p, $q]; $subtotal += (int)$p['price'] * $q;
  }
  $shipCost = ($ship === 'pickup' || $subtotal >= (int)$s['free_ship']) ? 0 : (int)$methods[$ship]['price'];
  $total = $subtotal + $shipCost; $now = now_ms(); $status = $pay === 'cod' ? 'confirmed' : 'pending';
  $u = current_user();
  $pdo->prepare('INSERT INTO orders (code, user_id, name, mobile, province, city, address, postal, ship_method, ship_cost, subtotal, total, pay_method, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    ->execute([$code, $u ? (int)$u['id'] : null, $name, $mobile, $province, $city, $address, $postal ?: null, $ship, $shipCost, $subtotal, $total, $pay, $status, $now, $now]);
  $oid = (int)$pdo->lastInsertId();
  $ins = $pdo->prepare('INSERT INTO order_items (order_id, product_id, name, code, price, qty) VALUES (?, ?, ?, ?, ?, ?)');
  foreach ($lines as [$p, $q]) $ins->execute([$oid, (int)$p['id'], $p['name'], $p['code'], (int)$p['price'], $q]);
  order_event($oid, $status);
  $pdo->commit();
  $_SESSION['orders'][] = $code;

  if ($pay === 'cod') { $o = ['code' => $code, 'mobile' => $mobile, 'tracking_no' => null]; status_sms($o, 'confirmed'); out(['ok' => true, 'code' => $code]); }

  $z = cfg('zarinpal');
  $r = zp_post('/pg/v4/payment/request.json', ['merchant_id' => $z['merchant_id'], 'amount' => $total * 10, 'currency' => 'IRR',
    'callback_url' => rtrim((string)cfg('base_url'), '/') . '/api/?a=pay.back&code=' . $code,
    'description' => "سفارش $code طاها الکترونیک", 'metadata' => ['mobile' => $mobile]]);
  $auth = $r['data']['authority'] ?? null;
  if (($r['data']['code'] ?? 0) !== 100 || !$auth) {
    $pdo->beginTransaction(); $pdo->prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?")->execute([now_ms(), $oid]);
    restock_order(['id' => $oid, 'code' => $code], 'cancel'); order_event($oid, 'cancelled', 'اتصال به درگاه ناموفق'); $pdo->commit();
    fail('gateway', 'اتصال به درگاه پرداخت برقرار نشد. چند دقیقه بعد دوباره تلاش کنید.', 502);
  }
  $pdo->prepare('UPDATE orders SET authority = ? WHERE id = ?')->execute([$auth, $oid]);
  out(['ok' => true, 'code' => $code, 'pay_url' => zp_host() . '/pg/StartPay/' . rawurlencode($auth)]);
}

function pay_back() {
  $code = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)($_GET['code'] ?? '')));
  $auth = (string)($_GET['Authority'] ?? ''); $okStatus = ($_GET['Status'] ?? '') === 'OK';
  $base = rtrim((string)cfg('base_url'), '/');
  $st = db()->prepare('SELECT * FROM orders WHERE code = ?'); $st->execute([$code]); $o = $st->fetch();
  $go = function (string $hash) use ($base) { header('Location: ' . $base . '/#' . $hash); exit; };
  if (!$o || !$auth || !hash_equals((string)$o['authority'], $auth)) $go('/checkout?pay=failed');
  if ($o['status'] === 'paid') $go('/done/' . $code);
  if (!$okStatus) {
    if ($o['status'] === 'pending') { $pdo = db(); $pdo->beginTransaction();
      $pdo->prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?")->execute([now_ms(), $o['id']]);
      restock_order($o, 'cancel'); order_event((int)$o['id'], 'cancelled', 'پرداخت انجام نشد'); $pdo->commit(); }
    $go('/checkout?pay=failed&code=' . $code);
  }
  $z = cfg('zarinpal');
  $r = zp_post('/pg/v4/payment/verify.json', ['merchant_id' => $z['merchant_id'], 'amount' => (int)$o['total'] * 10, 'authority' => $auth]);
  $c = $r['data']['code'] ?? 0;
  if ($c !== 100 && $c !== 101) $go('/checkout?pay=failed&code=' . $code);
  $pdo = db(); $pdo->beginTransaction();
  $note = null;
  if ($o['status'] === 'cancelled') {                                  // paid after the hold expired: take the stock again if possible
    $it = $pdo->prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?'); $it->execute([$o['id']]);
    foreach ($it->fetchAll() as $x) if (adjust_stock((int)$x['product_id'], -(int)$x['qty'], 'order', $code) === null) $note = 'پرداخت پس از پایان مهلت؛ موجودی را بررسی کنید.';
  }
  $pdo->prepare("UPDATE orders SET status = 'paid', pay_ref = ?, updated_at = ? WHERE id = ?")->execute([(string)($r['data']['ref_id'] ?? ''), now_ms(), $o['id']]);
  order_event((int)$o['id'], 'paid', $note ?? ('کد پیگیری بانک: ' . ($r['data']['ref_id'] ?? '')));
  $pdo->commit();
  status_sms($o, 'paid');
  $go('/done/' . $code);
}

function act_track() {
  $code = preg_replace('/[^A-Z0-9]/', '', strtoupper(en_digits(in('code', $_GET['code'] ?? ''))));
  $mobile = norm_phone(in('mobile', $_GET['mobile'] ?? ''));
  $mine = in_array($code, $_SESSION['orders'] ?? [], true);
  if (!$mine && !$mobile) fail('need_mobile', 'شماره‌ی موبایلی را که با آن سفارش داده‌اید وارد کنید.', 422);
  if (too_many('track:' . ip(), 30, 60)) fail('rate', 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.', 429);
  note_attempt('track:' . ip());
  $st = db()->prepare('SELECT * FROM orders WHERE code = ?'); $st->execute([$code]); $o = $st->fetch();
  $u = current_user();
  if (!$o || (!$mine && $o['mobile'] !== $mobile && !($u && $u['phone'] === $o['mobile']))) fail('not_found', 'سفارشی با این مشخصات پیدا نشد.', 404);
  $o = order_full($o); unset($o['address'], $o['postal'], $o['note']);
  out(['ok' => true, 'order' => $o]);
}

function act_otp_send() {
  $phone = norm_phone(in('phone')); if (!$phone) fail('phone', 'شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.', 422);
  if (!sms_enabled() && !cfg('otp_debug')) fail('sms_off', 'ورود با پیامک هنوز فعال نیست. سفارش را بدون ورود ثبت کنید.', 503);
  $st = db()->prepare('SELECT sent_at FROM otp WHERE phone = ?'); $st->execute([$phone]); $last = (int)$st->fetchColumn();
  if ($last && now_ms() - $last < 60000) fail('wait', 'کد قبلی همین الان فرستاده شد. یک دقیقه صبر کنید.', 429);
  if (too_many('otp:' . $phone, 5, 40)) fail('rate', 'تعداد درخواست کد زیاد است. ۱۵ دقیقه بعد دوباره تلاش کنید.', 429);
  note_attempt('otp:' . $phone);
  $code = (string)random_int(10000, 99999);
  db()->prepare('DELETE FROM otp WHERE phone = ?')->execute([$phone]);
  db()->prepare('INSERT INTO otp (phone, code_hash, expires, tries, sent_at) VALUES (?, ?, ?, 0, ?)')->execute([$phone, password_hash($code, PASSWORD_DEFAULT), now_ms() + 120000, now_ms()]);
  send_sms($phone, "کد ورود طاها الکترونیک: $code");
  out(['ok' => true] + (cfg('otp_debug') ? ['debug_code' => $code] : []));
}
function act_otp_verify() {
  $phone = norm_phone(in('phone')); $code = preg_replace('/\D/', '', en_digits(in('code')));
  $st = db()->prepare('SELECT * FROM otp WHERE phone = ?'); $st->execute([$phone]); $o = $st->fetch();
  if (!$o || (int)$o['expires'] < now_ms()) fail('expired', 'کد منقضی شده است. کد تازه بگیرید.', 422);
  if ((int)$o['tries'] >= 5) fail('tries', 'تعداد تلاش زیاد بود. کد تازه بگیرید.', 429);
  db()->prepare('UPDATE otp SET tries = tries + 1 WHERE phone = ?')->execute([$phone]);
  if (!password_verify($code, $o['code_hash'])) fail('code', 'کد درست نیست. دوباره امتحان کنید.', 422);
  db()->prepare('DELETE FROM otp WHERE phone = ?')->execute([$phone]);
  $st = db()->prepare('SELECT * FROM users WHERE phone = ?'); $st->execute([$phone]); $u = $st->fetch();
  if (!$u) { db()->prepare("INSERT INTO users (phone, role, created_at) VALUES (?, 'customer', ?)")->execute([$phone, now_ms()]); $st->execute([$phone]); $u = $st->fetch(); }
  session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id'];
  out(['ok' => true, 'user' => public_user($u)]);
}
function act_logout() { $_SESSION = []; session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(16)); out(['ok' => true, 'csrf' => $_SESSION['csrf']]); }
function act_me_orders() {
  $u = need_user();
  $st = db()->prepare('SELECT * FROM orders WHERE user_id = ? OR mobile = ? ORDER BY id DESC LIMIT 50'); $st->execute([(int)$u['id'], $u['phone']]);
  out(['ok' => true, 'orders' => array_map('order_full', $st->fetchAll())]);
}
function act_notify_add() {
  $u = current_user(); $phone = $u ? $u['phone'] : norm_phone(in('phone')); $pid = (int)in('id');
  if (!$phone) fail('phone', 'شماره‌ی موبایل را وارد کنید تا خبرتان کنیم.', 422);
  if (!get_product($pid)) fail('not_found', 'کالا پیدا نشد.', 404);
  if (too_many('notify:' . ip(), 30, 60)) fail('rate', 'تعداد درخواست‌ها زیاد است.', 429);
  note_attempt('notify:' . ip());
  db()->prepare('DELETE FROM notify WHERE product_id = ? AND phone = ?')->execute([$pid, $phone]);
  db()->prepare('INSERT INTO notify (product_id, phone, created_at) VALUES (?, ?, ?)')->execute([$pid, $phone, now_ms()]);
  out(['ok' => true]);
}
function act_contact_send() {
  $name = clean_text(in('name'), 80); $phone = norm_phone(in('phone')); $body = clean_text(in('body'), 2000);
  if (!$name || !$phone || mb_strlen($body) < 5) fail('invalid', 'نام، موبایل و پیام را کامل وارد کنید.', 422);
  if (too_many('msg:' . ip(), 5, 20, 60)) fail('rate', 'پیام‌های زیادی فرستاده‌اید. کمی بعد دوباره تلاش کنید.', 429);
  note_attempt('msg:' . ip());
  db()->prepare('INSERT INTO messages (name, phone, body, created_at) VALUES (?, ?, ?, ?)')->execute([$name, $phone, $body, now_ms()]);
  out(['ok' => true]);
}

/* ================= admin ================= */
function act_admin_login() {
  $phone = norm_phone(in('phone')); $pass = (string)in('password');
  if (!$phone || $pass === '') fail('invalid', 'شماره و رمز را وارد کنید.', 422);
  if (too_many('login:' . $phone, 8, 40)) fail('rate', 'تلاش زیاد بود. ۱۵ دقیقه بعد دوباره امتحان کنید.', 429);
  note_attempt('login:' . $phone);
  $st = db()->prepare("SELECT * FROM users WHERE phone = ? AND role IN ('admin','staff')"); $st->execute([$phone]); $u = $st->fetch();
  if (!$u || !$u['pass_hash'] || !password_verify($pass, $u['pass_hash'])) fail('login', 'شماره یا رمز درست نیست.', 401);
  session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id'];
  out(['ok' => true, 'user' => public_user($u), 'csrf' => $_SESSION['csrf']]);
}

function act_admin_dashboard() {
  need_staff();
  $dayStart = strtotime('today') * 1000; $live = "status NOT IN ('pending','cancelled','refunded')";
  $q = function (string $sql, array $p = []) { $s = db()->prepare($sql); $s->execute($p); return $s; };
  $today = $q("SELECT COUNT(*) c, COALESCE(SUM(total),0) s FROM orders WHERE $live AND created_at >= ?", [$dayStart])->fetch();
  $todo = (int)$q("SELECT COUNT(*) FROM orders WHERE status IN ('paid','confirmed','preparing')")->fetchColumn();
  $low = array_map(fn($p) => product_row($p, true), $q('SELECT * FROM products WHERE active = 1 AND stock <= low_at ORDER BY stock, name')->fetchAll());
  $demand = $q('SELECT n.product_id id, p.name, COUNT(*) c FROM notify n JOIN products p ON p.id = n.product_id WHERE n.sent_at IS NULL GROUP BY n.product_id, p.name ORDER BY c DESC LIMIT 8')->fetchAll();
  $recent = array_map('order_full', $q('SELECT * FROM orders ORDER BY id DESC LIMIT 8')->fetchAll());
  $series = [];
  for ($i = 13; $i >= 0; $i--) { $from = strtotime("-$i day", strtotime('today')) * 1000; $to = $from + 86400000;
    $r = $q("SELECT COALESCE(SUM(total),0) s, COUNT(*) c FROM orders WHERE $live AND created_at >= ? AND created_at < ?", [$from, $to])->fetch();
    $series[] = ['day' => $from, 'sum' => (int)$r['s'], 'count' => (int)$r['c']]; }
  $unseen = (int)$q('SELECT COUNT(*) FROM messages WHERE seen = 0')->fetchColumn();
  out(['ok' => true, 'today' => ['orders' => (int)$today['c'], 'sum' => (int)$today['s']], 'todo' => $todo, 'low' => $low, 'demand' => $demand, 'recent' => $recent, 'series' => $series, 'unseen' => $unseen]);
}

function act_admin_orders() {
  need_staff();
  $status = (string)in('status', ''); $q = clean_text(in('q', ''), 40); $page = int_in(in('page', 1), 1, 1000);
  $w = []; $p = [];
  if ($status === 'todo') $w[] = "status IN ('paid','confirmed','preparing')";
  elseif (isset(STATUSES[$status])) { $w[] = 'status = ?'; $p[] = $status; }
  if ($q !== '') { $w[] = '(code LIKE ? OR mobile LIKE ? OR name LIKE ?)'; $like = '%' . en_digits($q) . '%'; array_push($p, strtoupper($like), $like, '%' . $q . '%'); }
  $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
  $st = db()->prepare("SELECT COUNT(*) FROM orders $where"); $st->execute($p); $total = (int)$st->fetchColumn();
  $st = db()->prepare("SELECT * FROM orders $where ORDER BY id DESC LIMIT 30 OFFSET " . (($page - 1) * 30)); $st->execute($p);
  out(['ok' => true, 'total' => $total, 'orders' => array_map('order_full', $st->fetchAll()), 'statuses' => STATUSES]);
}
function act_admin_order() {
  need_staff(); $st = db()->prepare('SELECT * FROM orders WHERE id = ?'); $st->execute([(int)in('id')]); $o = $st->fetch();
  if (!$o) fail('not_found', 'سفارش پیدا نشد.', 404);
  out(['ok' => true, 'order' => order_full($o), 'next' => next_steps($o), 'statuses' => STATUSES]);
}
function act_admin_order_update() {
  $u = need_staff(); $pdo = db();
  $st = $pdo->prepare('SELECT * FROM orders WHERE id = ?'); $st->execute([(int)in('id')]); $o = $st->fetch();
  if (!$o) fail('not_found', 'سفارش پیدا نشد.', 404);
  $to = (string)in('status', ''); $tracking = clean_text(in('tracking_no', $o['tracking_no'] ?? ''), 40); $note = clean_text(in('note', ''), 500);
  if ($to !== '' && !in_array($to, next_steps($o), true)) fail('flow', 'این تغییر وضعیت مجاز نیست.', 422);
  if ($to === 'shipped' && $o['ship_method'] !== 'courier' && $tracking === '') fail('tracking', 'کد رهگیری مرسوله را وارد کنید.', 422);
  $pdo->beginTransaction();
  $pdo->prepare('UPDATE orders SET status = ?, tracking_no = ?, updated_at = ? WHERE id = ?')->execute([$to ?: $o['status'], $tracking ?: null, now_ms(), $o['id']]);
  if ($to === 'cancelled') restock_order($o, 'cancel', (int)$u['id']);          // every non-final order still holds its stock
  if ($to || $note) order_event((int)$o['id'], $to ?: $o['status'], $note ?: null, (int)$u['id']);
  $pdo->commit();
  if ($to) { $o['tracking_no'] = $tracking; status_sms($o, $to); }
  act_admin_order();
}

function act_admin_products() {
  need_staff();
  out(['ok' => true, 'products' => array_map(fn($p) => product_row($p, true), db()->query('SELECT * FROM products ORDER BY sort, id')->fetchAll()),
    'cats' => db()->query('SELECT id, name, icon, note, cab FROM categories ORDER BY sort, name')->fetchAll()]);
}
function act_admin_product_save() {
  $u = need_staff(); $pdo = db();
  $id = (int)in('id', 0); $old = $id ? get_product($id) : null;
  if ($id && !$old) fail('not_found', 'کالا پیدا نشد.', 404);
  $name = clean_text(in('name'), 120); $cat = (string)in('cat'); $price = int_in(in('price'), 0, 2000000000);
  $err = [];
  if (mb_strlen($name) < 2) $err['name'] = 'نام کالا را وارد کنید.';
  $c = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE id = ?'); $c->execute([$cat]); if (!(int)$c->fetchColumn()) $err['cat'] = 'دسته را انتخاب کنید.';
  if ($err) out(['ok' => false, 'error' => 'invalid', 'message' => 'چند مورد نیاز به اصلاح دارد.', 'fields' => $err], 422);
  $specs = in('specs'); if (is_string($specs)) $specs = json_decode($specs, true);
  $specs = array_values(array_filter(array_map(fn($r) => [clean_text($r[0] ?? '', 40), clean_text($r[1] ?? '', 200)], is_array($specs) ? $specs : []), fn($r) => $r[0] !== '' && $r[1] !== ''));
  $tip = in_array(in('tip'), ['b', 'i', 'k', 'd', 'c'], true) ? in('tip') : null;
  $color = preg_match('/^#[0-9a-fA-F]{6}$/', (string)in('color')) ? in('color') : '#0E7A4B';
  $ico = in_array(in('ico'), ['tip', 'spool', 'jar', 'wick', 'probe', 'bulb', 'cutter', 'heater', 'nozzle', 'tube'], true) ? in('ico') : 'tip';
  $vals = ['cat' => $cat, 'code' => clean_text(in('code'), 40), 'name' => $name, 'short' => clean_text(in('short'), 60), 'price' => $price,
    'low_at' => int_in(in('low_at', 2), 0, 999), 'active' => in('active', '1') ? 1 : 0, 'pack_color' => $color, 'pack_icon' => $ico, 'tip_type' => $tip,
    'why' => clean_text(in('why'), 600), 'specs' => json_encode($specs, JSON_UNESCAPED_UNICODE), 'updated_at' => now_ms(),
    'drawer' => clean_text(en_digits(in('drawer', '')), 12) ?: null, 'pkg' => clean_text(in('pkg', ''), 12) ?: null];
  if (!$vals['pkg']) $vals['pkg_ok'] = null;                                  // automatic again
  elseif (!$old || $vals['pkg'] !== $old['pkg']) $vals['pkg_ok'] = 1;          // the shop picked the package itself (it has the part in hand)
  if (in('buy_price') !== null && in('buy_price') !== '') $vals['buy_price'] = int_in(in('buy_price'), 0, 2000000000);   // only when sent (staff forms don't show it)
  if (in('sort') !== null && in('sort') !== '') $vals['sort'] = int_in(in('sort'), -9999, 9999);                       // editing never reshuffles the order
  elseif (!$old) $vals['sort'] = (int)$pdo->query('SELECT COALESCE(MAX(sort), 0) + 1 FROM products')->fetchColumn();
  $photo = save_photo(); if ($photo) $vals['photo'] = $photo;
  if (in('remove_photo') && !$photo) $vals['photo'] = null;
  $pdo->beginTransaction();
  if ($old) {
    $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($vals)));
    $pdo->prepare("UPDATE products SET $set WHERE id = ?")->execute([...array_values($vals), $id]);
    if (array_key_exists('photo', $vals) && $old['photo'] && $old['photo'] !== $vals['photo']) @unlink(__DIR__ . '/../uploads/' . basename($old['photo']));
  } else {
    $vals['slug'] = 'p' . bin2hex(random_bytes(4)); $vals['stock'] = 0; $vals['created_at'] = now_ms();
    $cols = implode(', ', array_keys($vals)); $qs = implode(', ', array_fill(0, count($vals), '?'));
    $pdo->prepare("INSERT INTO products ($cols) VALUES ($qs)")->execute(array_values($vals));
    $id = (int)$pdo->lastInsertId();
  }
  // stock typed in the form is applied as a logged adjustment
  $want = in('stock'); if ($want !== null && $want !== '') { $cur = (int)get_product($id)['stock']; $d = int_in($want, 0, 99999) - $cur; if ($d) adjust_stock($id, $d, $old ? 'count' : 'initial', null, (int)$u['id']); }
  $pdo->commit();
  out(['ok' => true, 'product' => product_row(get_product($id), true)]);
}
function save_photo(): ?string {
  if (empty($_FILES['photo']) || ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
  $f = $_FILES['photo'];
  if ($f['error'] !== UPLOAD_ERR_OK) fail('upload', 'آپلود عکس ناموفق بود.', 422);
  if ($f['size'] > (int)(cfg('max_upload_mb') ?: 6) * 1048576) fail('upload', 'حجم عکس زیاد است.', 422);
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
  $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
  if (!$ext) fail('upload', 'فقط عکس JPG، PNG یا WebP.', 422);
  $name = bin2hex(random_bytes(10)) . '.' . $ext;
  if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/../uploads/' . $name)) fail('upload', 'ذخیره‌ی عکس ممکن نشد. دسترسی پوشه‌ی uploads را بررسی کنید.', 500);
  return $name;
}
/* part photos, sent one file at a time by the admin's bulk uploader (resized in the browser to ~1600 px, plus a small
   copy for the drawers). The file name decided the drawer and slot; here the drawer finds the product. A slot that
   already has a photo is replaced and the old files are deleted. */
function upload_image(string $key, string $base): ?string {
  if (empty($_FILES[$key]) || ($_FILES[$key]['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
  $f = $_FILES[$key];
  if ($f['error'] !== UPLOAD_ERR_OK) fail('upload', 'آپلود عکس ناموفق بود.', 422);
  if ($f['size'] > (int)(cfg('max_upload_mb') ?: 6) * 1048576) fail('upload', 'حجم عکس زیاد است.', 422);
  $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name'])] ?? null;
  if (!$ext) fail('upload', 'فقط عکس JPG، PNG یا WebP.', 422);
  $name = $base . '.' . $ext;
  if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/../uploads/' . $name)) fail('upload', 'ذخیره‌ی عکس ممکن نشد. دسترسی پوشه‌ی uploads را بررسی کنید.', 500);
  return $name;
}
function drop_photo_files(?string $f): void { if (!$f) return; $d = __DIR__ . '/../uploads/'; @unlink($d . basename($f)); @unlink($d . basename(small_name($f))); }
function photo_target(): array {
  $pdo = db(); $id = (int)in('id', 0);
  if ($id) { $p = get_product($id); if (!$p) fail('not_found', 'کالا پیدا نشد.', 404); return $p; }
  $drawer = clean_text(en_digits(in('drawer', '')), 12); if ($drawer === '') fail('drawer', 'شماره‌ی کشو در نام فایل نیست.', 422);
  $st = $pdo->prepare('SELECT * FROM products WHERE drawer = ?'); $st->execute([$drawer]); $rows = $st->fetchAll();
  if (!$rows) fail('not_found', "کالایی با کشوی {$drawer} نیست.", 404);
  if (count($rows) > 1) fail('ambiguous', "چند کالا کشوی {$drawer} دارند؛ از صفحه‌ی همان کالا عکس بگذارید.", 409);
  return $rows[0];
}
function act_admin_photos_upload() {
  need_staff(); $p = photo_target();
  $slot = in_array(in('slot'), ['a', 'b', 'c'], true) ? in('slot') : 'a';
  $base = bin2hex(random_bytes(10));
  $name = upload_image('photo', $base); if (!$name) fail('upload', 'عکسی فرستاده نشد.', 422);
  $small = upload_image('thumb', $base . '_s');
  if ($small && $small !== small_name($name)) { @rename(__DIR__ . '/../uploads/' . $small, __DIR__ . '/../uploads/' . small_name($name)); }   // keep the pair's names in step
  $slots = photo_slots($p); $old = $slots[$slot] ?? null; $slots[$slot] = $name; ksort($slots);
  db()->prepare('UPDATE products SET photos = ?, updated_at = ? WHERE id = ?')->execute([json_encode($slots), now_ms(), $p['id']]);
  drop_photo_files($old);
  out(['ok' => true, 'replaced' => (bool)$old, 'product' => product_row(get_product((int)$p['id']), true)]);
}
function act_admin_photos_remove() {
  need_staff(); $p = photo_target(); $slot = (string)in('slot');
  $slots = photo_slots($p); if (!isset($slots[$slot])) fail('not_found', 'این عکس وجود ندارد.', 404);
  $old = $slots[$slot]; unset($slots[$slot]);
  db()->prepare('UPDATE products SET photos = ?, updated_at = ? WHERE id = ?')->execute([$slots ? json_encode($slots) : null, now_ms(), $p['id']]);
  drop_photo_files($old);
  out(['ok' => true, 'product' => product_row(get_product((int)$p['id']), true)]);
}
/* researched IC descriptions (api/ic-info.json): what each part does, maker, ECUs, key specs, package, look-alikes.
   Matched by drawer AND part name, so a different part now sitting in that drawer is never overwritten.
   mode "empty" fills only parts without a description; "all" replaces. The real package code is set too. */
function act_admin_info_apply() {
  need_admin(); $pdo = db();
  $all = in('mode') === 'all';
  $rows = json_decode((string)@file_get_contents(__DIR__ . '/ic-info.json'), true);
  if (!is_array($rows)) fail('missing', 'فایل اطلاعات آی‌سی‌ها پیدا نشد.', 500);
  $norm = fn($s) => preg_replace('/[^A-Z0-9]/', '', strtoupper(en_digits((string)$s)));
  $conf = ['A' => 'دیتاشیت سازنده و فروشگاه‌های تخصصی', 'B' => 'فروشگاه‌های تخصصی قطعات ECU', 'C' => 'اطلاعات محدود؛ پیش از خرید با ما هماهنگ کنید', 'X' => 'در منابع عمومی منتشر نشده'];
  $none = 'کاربرد دقیق و مشخصات این قطعه در منابع عمومی منتشر نشده است. اگر شماره‌ی ECU یا مدل خودرو را بدانید، برای راهنمایی با ما تماس بگیرید.';
  $find = $pdo->prepare('SELECT * FROM products WHERE drawer = ?');
  $upd = $pdo->prepare('UPDATE products SET why = ?, specs = ?, pkg = COALESCE(?, pkg), pkg_ok = ?, updated_at = ? WHERE id = ?');
  $updPkg = $pdo->prepare('UPDATE products SET specs = ?, pkg = COALESCE(?, pkg), pkg_ok = ?, updated_at = ? WHERE id = ?');
  $res = ['updated' => 0, 'kept' => 0, 'not_found' => 0, 'name_mismatch' => []];
  $pdo->beginTransaction();
  foreach ($rows as $r) {
    $find->execute([$r['drawer']]); $cands = $find->fetchAll(); $p = null;
    foreach ($cands as $c) if ($norm($c['name']) === $norm($r['name'])) $p = $c;
    if (!$cands) { $res['not_found']++; continue; }
    if (!$p) { $res['name_mismatch'][] = $r['drawer'] . ' ' . $r['name']; continue; }   // another part sits in this drawer now: leave it alone
    $pk = !empty($r['pk']) ? clean_text($r['pk'], 12) : null;
    if (!$all && trim((string)$p['why']) !== '') {
      // the shop's own text stays, but the checked package is a fact: package code and its line in the specs are refreshed
      $sp = json_decode((string)$p['specs'], true) ?: []; $sp = array_values(array_filter($sp, fn($x) => ($x[0] ?? '') !== 'بسته‌بندی'));
      if (!empty($r['p'])) array_splice($sp, min(3, count($sp)), 0, [['بسته‌بندی', clean_text($r['p'], 200)]]);
      $updPkg->execute([json_encode($sp, JSON_UNESCAPED_UNICODE), $pk, $pk ? 1 : 0, now_ms(), $p['id']]);
      $res['kept']++; continue; }
    $specs = [];
    foreach ([['نوع قطعه', 't'], ['سازنده', 'm'], ['کاربرد در', 'e'], ['مشخصات کلیدی', 'k'], ['بسته‌بندی', 'p']] as [$k, $f]) if (!empty($r[$f])) $specs[] = [$k, $r[$f]];
    if (!empty($r['a'])) $specs[] = ['قطعه‌های مشابه', $r['a'] . ' (به گفته‌ی تعمیرکاران؛ پیش از جایگزینی پایه‌ها را تطبیق دهید)'];
    $specs[] = ['منبع اطلاعات', $conf[$r['c']] ?? $conf['X']];
    $specs = array_map(fn($x) => [clean_text($x[0], 40), clean_text($x[1], 200)], $specs);
    $upd->execute([clean_text(($r['u'] ?? '') !== '' ? $r['u'] : $none, 600), json_encode($specs, JSON_UNESCAPED_UNICODE), $pk, $pk ? 1 : 0, now_ms(), $p['id']]);
    $res['updated']++;
  }
  $pdo->commit();
  $res['name_mismatch'] = array_slice($res['name_mismatch'], 0, 20);
  out(['ok' => true] + $res);
}
/* bulk import from the admin's spreadsheet (parsed in the browser). Rows match existing products by drawer
   code, else by exact part name; stock changes are logged; purchase price stays admin-only. */
function act_admin_import() {
  $u = need_admin(); $pdo = db();
  $rows = in('rows'); if (!is_array($rows) || !$rows || count($rows) > 200) fail('invalid', 'هر بار حداکثر ۲۰۰ ردیف.', 422);
  $cats = array_flip($pdo->query('SELECT id FROM categories')->fetchAll(PDO::FETCH_COLUMN));
  $byDrawer = $pdo->prepare('SELECT * FROM products WHERE drawer = ?'); $byName = $pdo->prepare('SELECT * FROM products WHERE name = ?');
  $sort = (int)$pdo->query('SELECT COALESCE(MAX(sort), 0) FROM products')->fetchColumn();
  $res = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];
  $pdo->beginTransaction();
  foreach ($rows as $i => $r) {
    $name = clean_text($r['name'] ?? '', 120); $drawer = clean_text(en_digits($r['drawer'] ?? ''), 12); $cat = (string)($r['cat'] ?? '');
    if (mb_strlen($name) < 2 || !isset($cats[$cat])) { $res['skipped']++; $res['errors'][] = ($r['row'] ?? $i) . ': ' . ($name ?: 'بی‌نام'); continue; }
    $price = int_in($r['price'] ?? 0, 0, 2000000000); $buy = int_in($r['buy'] ?? 0, 0, 2000000000); $stock = int_in($r['stock'] ?? 0, 0, 99999);
    $pkg = clean_text($r['pkg'] ?? '', 12) ?: null;
    $old = null;
    if ($drawer !== '') { $byDrawer->execute([$drawer]); $old = $byDrawer->fetch() ?: null; }
    if (!$old && $drawer === '') { $byName->execute([$name]); $old = $byName->fetch() ?: null; }   // same part in two drawers = two products
    if ($old) {
      $pdo->prepare('UPDATE products SET name = ?, code = ?, cat = ?, drawer = ?, pkg = ?, price = ?, buy_price = ?, active = ?, updated_at = ? WHERE id = ?')
        ->execute([$name, $name, $cat, $drawer ?: null, $pkg, $price, $buy, $price > 0 ? 1 : 0, now_ms(), $old['id']]);
      $d = $stock - (int)$old['stock']; if ($d) adjust_stock((int)$old['id'], $d, 'count', 'import', (int)$u['id']);
      $res['updated']++;
    } else {
      $pdo->prepare("INSERT INTO products (slug, cat, code, name, short, price, buy_price, stock, low_at, active, pack_color, pack_icon, drawer, pkg, specs, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', ?, ?, 0, 1, ?, '#0E7A4B', 'tip', ?, ?, '[]', ?, ?, ?)")
        ->execute(['p' . bin2hex(random_bytes(4)), $cat, $name, $name, $price, $buy, $price > 0 ? 1 : 0, $drawer ?: null, $pkg, ++$sort, now_ms(), now_ms()]);
      $id = (int)$pdo->lastInsertId(); if ($stock) adjust_stock($id, $stock, 'initial', 'import', (int)$u['id']);
      $res['created']++;
    }
  }
  $pdo->commit();
  out(['ok' => true] + $res);
}
function act_admin_stock_adjust() {
  $u = need_staff(); $id = (int)in('id'); $delta = (int)en_digits(in('delta'));
  $reasons = ['instore' => 'فروش حضوری', 'count' => 'شمارش انبار', 'purchase' => 'خرید از تامین‌کننده', 'return' => 'مرجوعی', 'damage' => 'خرابی/مفقودی'];
  $reason = (string)in('reason'); if (!isset($reasons[$reason])) fail('reason', 'دلیل تغییر را انتخاب کنید.', 422);
  if (!$delta || abs($delta) > 9999) fail('delta', 'تعداد را وارد کنید.', 422);
  if (!get_product($id)) fail('not_found', 'کالا پیدا نشد.', 404);
  $after = adjust_stock($id, $delta, $reason, clean_text(in('note', ''), 80) ?: null, (int)$u['id']);
  if ($after === null) fail('stock', 'موجودی منفی نمی‌شود.', 422);
  out(['ok' => true, 'stock' => $after]);
}
function act_admin_stock_log() {
  need_staff(); $st = db()->prepare('SELECT l.*, u.name uname FROM stock_log l LEFT JOIN users u ON u.id = l.user_id WHERE product_id = ? ORDER BY l.id DESC LIMIT 60'); $st->execute([(int)in('id')]);
  out(['ok' => true, 'log' => $st->fetchAll()]);
}
function act_admin_notify() {
  need_staff();
  out(['ok' => true, 'rows' => db()->query('SELECT n.product_id, p.name, p.stock, n.phone, n.created_at, n.sent_at FROM notify n JOIN products p ON p.id = n.product_id ORDER BY n.sent_at IS NOT NULL, n.created_at DESC LIMIT 300')->fetchAll()]);
}
function act_admin_messages() {
  need_staff(); $rows = db()->query('SELECT * FROM messages ORDER BY id DESC LIMIT 200')->fetchAll();
  db()->exec('UPDATE messages SET seen = 1 WHERE seen = 0');
  out(['ok' => true, 'rows' => $rows]);
}
function act_admin_settings() { need_staff(); out(['ok' => true, 'settings' => settings(), 'sms' => sms_enabled(), 'pay_online' => zp_enabled()]); }
function act_admin_settings_save() {
  need_admin(); $b = body();
  foreach (array_keys(DEFAULTS) as $k) if (array_key_exists($k, $b)) set_setting($k, clean_text($b[$k], 600));
  out(['ok' => true, 'settings' => settings()]);
}
function act_admin_staff() {
  need_admin();
  out(['ok' => true, 'rows' => db()->query("SELECT id, name, phone, role FROM users WHERE role IN ('admin','staff') ORDER BY role, id")->fetchAll()]);
}
function act_admin_staff_save() {
  $me = need_admin(); $phone = norm_phone(in('phone')); $name = clean_text(in('name'), 60); $pass = (string)in('password');
  if (!$phone || !$name) fail('invalid', 'نام و شماره را وارد کنید.', 422);
  if (mb_strlen($pass) < 8) fail('password', 'رمز دست‌کم ۸ کاراکتر باشد.', 422);
  $st = db()->prepare('SELECT * FROM users WHERE phone = ?'); $st->execute([$phone]); $u = $st->fetch();
  if ($u && $u['role'] === 'admin') fail('exists', 'این شماره مدیر است.', 422);
  if ($u) db()->prepare("UPDATE users SET name = ?, role = 'staff', pass_hash = ? WHERE id = ?")->execute([$name, password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
  else db()->prepare("INSERT INTO users (phone, name, role, pass_hash, created_at) VALUES (?, ?, 'staff', ?, ?)")->execute([$phone, $name, password_hash($pass, PASSWORD_DEFAULT), now_ms()]);
  act_admin_staff();
}
function act_admin_staff_remove() {
  $me = need_admin(); $id = (int)in('id'); if ($id === (int)$me['id']) fail('self', 'نمی‌توانید خودتان را حذف کنید.', 422);
  db()->prepare("UPDATE users SET role = 'customer', pass_hash = NULL WHERE id = ? AND role = 'staff'")->execute([$id]);
  act_admin_staff();
}
