<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Tehran');

/* ---------- bootstrap ---------- */
function cfg(?string $k = null) {
  static $c = null;
  if ($c === null) { $f = __DIR__ . '/config.php'; $c = file_exists($f) ? require $f : require __DIR__ . '/config.sample.php'; }
  return $k === null ? $c : ($c[$k] ?? null);
}
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $pdo = new PDO(cfg('dsn'), cfg('db_user'), cfg('db_pass'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  if (is_sqlite()) { $pdo->exec('PRAGMA foreign_keys = ON'); $pdo->exec('PRAGMA journal_mode = WAL'); $pdo->exec('PRAGMA busy_timeout = 5000'); }
  migrate($pdo);
  return $pdo;
}
function is_sqlite(): bool { return str_starts_with((string)cfg('dsn'), 'sqlite:'); }

function migrate(PDO $pdo): void {
  $id = is_sqlite() ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
  $t = is_sqlite() ? 'TEXT' : 'VARCHAR(255)';
  $long = 'TEXT';
  $e = is_sqlite() ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
  $pdo->exec("CREATE TABLE IF NOT EXISTS users (id $id, phone VARCHAR(11) NOT NULL UNIQUE, name $t NOT NULL DEFAULT '', role VARCHAR(10) NOT NULL DEFAULT 'customer',
    pass_hash $t NULL, created_at BIGINT NOT NULL, failed INT NOT NULL DEFAULT 0, locked_until BIGINT NOT NULL DEFAULT 0)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS categories (id VARCHAR(20) PRIMARY KEY, name $t NOT NULL, icon VARCHAR(20) NOT NULL DEFAULT 'i-box', note $t NOT NULL DEFAULT '', sort INT NOT NULL DEFAULT 0)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS products (id $id, slug VARCHAR(60) NOT NULL UNIQUE, cat VARCHAR(20) NOT NULL, code $t NOT NULL DEFAULT '', name $t NOT NULL, short $t NOT NULL DEFAULT '',
    price BIGINT NOT NULL DEFAULT 0, stock INT NOT NULL DEFAULT 0, low_at INT NOT NULL DEFAULT 2, active INT NOT NULL DEFAULT 1,
    photo $t NULL, pack_color VARCHAR(9) NOT NULL DEFAULT '#0E7A4B', pack_icon VARCHAR(12) NOT NULL DEFAULT 'tip', tip_type VARCHAR(2) NULL,
    why $long NULL, specs $long NULL, sort INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS stock_log (id $id, product_id INT NOT NULL, delta INT NOT NULL, after_qty INT NOT NULL, reason VARCHAR(12) NOT NULL, ref $t NULL, user_id INT NULL, at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS orders (id $id, code VARCHAR(12) NOT NULL UNIQUE, user_id INT NULL, name $t NOT NULL, mobile VARCHAR(11) NOT NULL,
    province $t NOT NULL DEFAULT '', city $t NOT NULL DEFAULT '', address $long NULL, postal VARCHAR(10) NULL,
    ship_method VARCHAR(12) NOT NULL, ship_cost BIGINT NOT NULL DEFAULT 0, subtotal BIGINT NOT NULL, total BIGINT NOT NULL,
    pay_method VARCHAR(10) NOT NULL, status VARCHAR(12) NOT NULL, authority $t NULL, pay_ref $t NULL, tracking_no $t NULL, note $long NULL,
    created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS order_items (order_id INT NOT NULL, product_id INT NOT NULL, name $t NOT NULL, code $t NOT NULL, price BIGINT NOT NULL, qty INT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS order_events (id $id, order_id INT NOT NULL, status VARCHAR(12) NOT NULL, note $long NULL, user_id INT NULL, at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS notify (product_id INT NOT NULL, phone VARCHAR(11) NOT NULL, created_at BIGINT NOT NULL, sent_at BIGINT NULL, PRIMARY KEY (product_id, phone))$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS otp (phone VARCHAR(11) PRIMARY KEY, code_hash $t NOT NULL, expires BIGINT NOT NULL, tries INT NOT NULL DEFAULT 0, sent_at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS attempts (id $id, ip VARCHAR(45) NOT NULL, k VARCHAR(40) NOT NULL, at BIGINT NOT NULL)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS messages (id $id, name $t NOT NULL, phone VARCHAR(11) NOT NULL, body $long NOT NULL, created_at BIGINT NOT NULL, seen INT NOT NULL DEFAULT 0)$e");
  $pdo->exec("CREATE TABLE IF NOT EXISTS settings (k VARCHAR(40) PRIMARY KEY, v $long NOT NULL)$e");
  // v2: ECU parts live in drawers of IC cabinets; purchase price is admin-only
  add_column($pdo, 'products', 'drawer', 'VARCHAR(12) NULL');
  add_column($pdo, 'products', 'pkg', 'VARCHAR(12) NULL');
  add_column($pdo, 'products', 'buy_price', 'BIGINT NOT NULL DEFAULT 0');
  add_column($pdo, 'categories', 'cab', 'VARCHAR(12) NULL');                 // cabinet style; set = shown in the IC cabinet wall
  add_column($pdo, 'products', 'photos', 'TEXT NULL');                       // v3: up to 3 part photos {"a":"x.webp","b":..,"c":..}; x_s.webp is the small copy
  add_column($pdo, 'products', 'pkg_ok', 'INTEGER NULL');                    // v4: 1 = package checked against the datasheet, 0 = not confirmed (no 3D model)
  $ins = $pdo->prepare('INSERT INTO categories (id, name, icon, note, sort, cab) VALUES (?, ?, ?, ?, ?, ?)');
  $has = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE id = ?');
  foreach (IC_CATS as $i => [$cid, $name, $note, $cab]) { $has->execute([$cid]); if (!(int)$has->fetchColumn()) $ins->execute([$cid, $name, 'i-chip', $note, 100 + $i, $cab]); }
}
/* the IC cabinet wall: one cabinet per group, styled after how those parts are really stored */
const IC_CATS = [
  ['ic-asic',   'آی‌سی‌های اختصاصی ECU', 'بوش، کنتیننتال، مگنتی، دلفی',  'copper'],
  ['ic-driver', 'درایور و سوئیچ قدرت',    'انژکتور، کویل، دریچه گاز',     'steel'],
  ['ic-mcu',    'میکروکنترلر',           'ST10، TriCore، S12، رنساس',     'tray'],
  ['ic-memory', 'حافظه EEPROM و فلش',     '۲۴C، ۹۳C، ۹۵xxx، AM29F',        'foam'],
  ['ic-power',  'ترانزیستور، IGBT و دیود', 'ایگنیشن، ماسفت، دیود',          'tape'],
  ['ic-can',    'ترنسیور CAN و LIN',      'TJA، SN65HVD، ATA',             'teal'],
  ['ic-reg',    'رگولاتور ولتاژ',         'TLE42xx، L4995',                'amber'],
  ['ic-logic',  'منطقی و آپ‌امپ',          '۷۴HC، ULN2003، LM29xx',         'grey'],
  ['ic-relay',  'رله‌ی خودرو',            'رله‌های برد ECU و BCM',          'deep'],
  ['ic-misc',   'سایر قطعات ECU',         'خازن، مقاومت شنت، متفرقه',      'plain'],
];
function add_column(PDO $pdo, string $table, string $col, string $def): void {
  if (is_sqlite()) { $cols = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(), 'name'); }
  else { $st = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'); $st->execute([$table]); $cols = $st->fetchAll(PDO::FETCH_COLUMN); }
  if (!in_array($col, $cols, true)) $pdo->exec("ALTER TABLE $table ADD COLUMN $col $def");
}

/* ---------- settings ---------- */
const DEFAULTS = [
  'store_name' => 'طاها الکترونیک', 'phone' => '071-32308902', 'address' => '', 'hours' => '', 'notice' => '',
  'ship_courier' => '60000', 'ship_post' => '85000', 'ship_tipax' => '120000', 'pickup' => '1', 'cod' => '1',
  'free_ship' => '2000000', 'cutoff_hour' => '14', 'instagram' => '', 'enamad' => '',
];
function settings(): array { $s = DEFAULTS; foreach (db()->query('SELECT k, v FROM settings') as $r) $s[$r['k']] = $r['v']; return $s; }
function set_setting(string $k, string $v): void { $p = db(); $p->prepare('DELETE FROM settings WHERE k = ?')->execute([$k]); $p->prepare('INSERT INTO settings (k, v) VALUES (?, ?)')->execute([$k, $v]); }
function ship_methods(): array {
  $s = settings(); $m = [];
  $m[] = ['id' => 'courier', 'name' => 'پیک (فقط شیراز)', 'note' => 'تحویل همان روز یا روز بعد', 'price' => (int)$s['ship_courier'], 'days' => [0, 1]];
  $m[] = ['id' => 'post', 'name' => 'پست پیشتاز', 'note' => 'سراسر کشور', 'price' => (int)$s['ship_post'], 'days' => [2, 4]];
  $m[] = ['id' => 'tipax', 'name' => 'تیپاکس', 'note' => 'سراسر کشور', 'price' => (int)$s['ship_tipax'], 'days' => [1, 3]];
  if ($s['pickup'] === '1') $m[] = ['id' => 'pickup', 'name' => 'تحویل حضوری از فروشگاه', 'note' => 'رایگان؛ پس از پیامک «آماده‌ی تحویل»', 'price' => 0, 'days' => [0, 1]];
  return $m;
}

/* ---------- http helpers ---------- */
function out($data, int $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
  echo json_encode($data, JSON_UNESCAPED_UNICODE); exit;
}
function fail(string $code, string $msg, int $http = 400) { out(['ok' => false, 'error' => $code, 'message' => $msg], $http); }
function body(): array { static $b = null; if ($b !== null) return $b; $b = json_decode(file_get_contents('php://input') ?: '', true); if (!is_array($b)) $b = $_POST; return $b; }
function in(string $k, $def = null) { $b = body(); return $b[$k] ?? $def; }
function ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0'), 0, 45); }
function now_ms(): int { return (int)floor(microtime(true) * 1000); }
function en_digits($s): string {
  return strtr((string)$s, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
}
function norm_phone($p): string {
  $p = preg_replace('/\D/', '', en_digits($p));
  if (str_starts_with($p, '98') && strlen($p) === 12) $p = '0' . substr($p, 2);
  if (strlen($p) === 10 && $p[0] === '9') $p = '0' . $p;
  return preg_match('/^09\d{9}$/', $p) ? $p : '';
}
function clean_text($s, int $max): string { return mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', (string)$s)), 0, $max); }
function int_in($v, int $min, int $max): int { return max($min, min($max, (int)en_digits($v))); }

/* ---------- session + csrf ---------- */
function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  session_name('ttsid');
  $secure = (bool)cfg('https') && ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';
  session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $secure]);
  session_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
function csrf_check(): void {
  $t = $_SERVER['HTTP_X_CSRF'] ?? '';
  if (!is_string($t) || !hash_equals($_SESSION['csrf'] ?? '', $t)) fail('csrf', 'نشست منقضی شده است. صفحه را دوباره باز کنید.', 403);
}
function current_user(): ?array {
  if (empty($_SESSION['uid'])) return null;
  static $u = false;
  if ($u === false) { $st = db()->prepare('SELECT * FROM users WHERE id = ?'); $st->execute([$_SESSION['uid']]); $u = $st->fetch() ?: null; }
  return $u;
}
function need_user(): array { $u = current_user(); if (!$u) fail('auth', 'ابتدا وارد حساب شوید.', 401); return $u; }
function need_staff(): array { $u = need_user(); if (!in_array($u['role'], ['admin', 'staff'], true)) fail('forbidden', 'دسترسی به پنل مدیریت ندارید.', 403); return $u; }
function need_admin(): array { $u = need_staff(); if ($u['role'] !== 'admin') fail('forbidden', 'این کار فقط برای مدیر فروشگاه است.', 403); return $u; }
function public_user(?array $u): ?array { return $u ? ['id' => (int)$u['id'], 'name' => $u['name'], 'phone' => $u['phone'], 'role' => $u['role']] : null; }

/* ---------- throttling (per key and per IP; Iranian carriers share IPs, so the IP limit is generous) ---------- */
function too_many(string $key, int $perKey, int $perIp, int $minutes = 15): bool {
  $since = now_ms() - $minutes * 60000;
  $st = db()->prepare('SELECT COUNT(*) FROM attempts WHERE k = ? AND at > ?'); $st->execute([$key, $since]);
  if ((int)$st->fetchColumn() >= $perKey) return true;
  $st = db()->prepare('SELECT COUNT(*) FROM attempts WHERE ip = ? AND at > ?'); $st->execute([ip(), $since]);
  return (int)$st->fetchColumn() >= $perIp;
}
function note_attempt(string $key): void {
  db()->prepare('INSERT INTO attempts (ip, k, at) VALUES (?, ?, ?)')->execute([ip(), $key, now_ms()]);
  db()->prepare('DELETE FROM attempts WHERE at < ?')->execute([now_ms() - 86400000]);
}

/* ---------- sms (Kavenegar) ---------- */
function sms_enabled(): bool { $s = cfg('sms'); return is_array($s) && !empty($s['api_key']); }
function send_sms(string $phone, string $text): bool {
  if (!sms_enabled()) return false;
  $s = cfg('sms');
  $url = 'https://api.kavenegar.com/v1/' . rawurlencode($s['api_key']) . '/sms/send.json';
  $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 8, 'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
    'content' => http_build_query(['receptor' => $phone, 'sender' => $s['sender'] ?? '', 'message' => $text])]]);
  return @file_get_contents($url, false, $ctx) !== false;
}

/* ---------- catalog ---------- */
/* part photos in slot order (a, b, c); a product with only the older single photo keeps working */
function photo_slots(array $p): array { $s = json_decode((string)($p['photos'] ?? ''), true); if (!is_array($s)) return []; ksort($s); return array_intersect_key($s, ['a' => 1, 'b' => 1, 'c' => 1]); }
function small_name(string $f): string { return preg_replace('/(\.[a-z0-9]+)$/', '_s$1', $f); }
function product_row(array $p, bool $admin = false): array {
  $slots = photo_slots($p); $up = __DIR__ . '/../uploads/';
  $photos = array_values(array_map(fn($f) => 'uploads/' . $f, $slots));
  $thumbs = array_values(array_map(fn($f) => 'uploads/' . (is_file($up . small_name($f)) ? small_name($f) : $f), $slots));
  if (!$photos && $p['photo']) { $photos = ['uploads/' . $p['photo']]; $thumbs = $photos; }
  $r = ['id' => (int)$p['id'], 'slug' => $p['slug'], 'cat' => $p['cat'], 'code' => $p['code'], 'name' => $p['name'], 'short' => $p['short'],
    'price' => (int)$p['price'], 'stock' => (int)$p['stock'], 'low_at' => (int)$p['low_at'], 'photo' => $photos[0] ?? null, 'photos' => $photos, 'thumbs' => $thumbs,
    'color' => $p['pack_color'], 'ico' => $p['pack_icon'], 'tip' => $p['tip_type'], 'why' => $p['why'], 'specs' => json_decode((string)$p['specs'], true) ?: [],
    'drawer' => $p['drawer'] ?? null, 'pkg' => $p['pkg'] ?? null];
  if (isset($p['pkg_ok'])) $r['pkgOk'] = (bool)$p['pkg_ok'];                // false = package not checked yet: no 3D model
  if ($admin) { $r['active'] = (int)$p['active']; $r['sort'] = (int)$p['sort']; $r['updated_at'] = (int)$p['updated_at']; $r['buy_price'] = (int)($p['buy_price'] ?? 0);
    $r['slots'] = array_map(fn($f) => 'uploads/' . (is_file($up . small_name($f)) ? small_name($f) : $f), $slots); }   // which of a/b/c are taken
  return $r;
}
function get_product(int $id): ?array { $st = db()->prepare('SELECT * FROM products WHERE id = ?'); $st->execute([$id]); return $st->fetch() ?: null; }

/* change stock and keep a log line; returns new qty, or null if it would go negative */
function adjust_stock(int $pid, int $delta, string $reason, ?string $ref = null, ?int $uid = null): ?int {
  $pdo = db();
  if ($delta < 0) { $st = $pdo->prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock >= ?'); $st->execute([$delta, now_ms(), $pid, -$delta]); }
  else { $st = $pdo->prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?'); $st->execute([$delta, now_ms(), $pid]); }
  if ($st->rowCount() !== 1) return null;
  $q = $pdo->prepare('SELECT stock FROM products WHERE id = ?'); $q->execute([$pid]); $after = (int)$q->fetchColumn();
  $pdo->prepare('INSERT INTO stock_log (product_id, delta, after_qty, reason, ref, user_id, at) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$pid, $delta, $after, $reason, $ref, $uid, now_ms()]);
  if ($delta > 0 && $after === $delta) notify_back_in_stock($pid);      // went from 0 to available
  return $after;
}
function notify_back_in_stock(int $pid): void {
  $p = get_product($pid); if (!$p || !$p['active']) return;
  $st = db()->prepare('SELECT phone FROM notify WHERE product_id = ? AND sent_at IS NULL'); $st->execute([$pid]);
  $url = rtrim((string)cfg('base_url'), '/') . '/#/product/' . $pid;
  foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $ph) send_sms($ph, "«{$p['name']}» در طاها الکترونیک موجود شد.\n$url");
  db()->prepare('UPDATE notify SET sent_at = ? WHERE product_id = ? AND sent_at IS NULL')->execute([now_ms(), $pid]);
}

/* ---------- orders ---------- */
const STATUSES = [
  'pending'   => 'در انتظار پرداخت', 'paid' => 'پرداخت شد', 'confirmed' => 'تایید شد (پرداخت در محل)',
  'preparing' => 'در حال آماده‌سازی', 'ready' => 'آماده‌ی تحویل حضوری', 'shipped' => 'ارسال شد', 'delivered' => 'تحویل شد',
  'cancelled' => 'لغو شد', 'refunded' => 'بازپرداخت شد',
];
const FLOW = ['paid' => ['preparing', 'cancelled'], 'confirmed' => ['preparing', 'cancelled'], 'preparing' => ['shipped', 'ready', 'cancelled'],
  'ready' => ['delivered', 'cancelled'], 'shipped' => ['delivered'], 'delivered' => ['refunded'], 'pending' => ['cancelled'], 'cancelled' => [], 'refunded' => []];
/* allowed next statuses for this order: pickup orders become "ready", the rest get "shipped" */
function next_steps(array $o): array {
  return array_values(array_filter(FLOW[$o['status']] ?? [], fn($s) => !($s === 'ready' && $o['ship_method'] !== 'pickup') && !($s === 'shipped' && $o['ship_method'] === 'pickup')));
}
function order_full(array $o): array {
  $it = db()->prepare('SELECT product_id, name, code, price, qty FROM order_items WHERE order_id = ?'); $it->execute([$o['id']]);
  $ev = db()->prepare('SELECT status, note, at FROM order_events WHERE order_id = ? ORDER BY id'); $ev->execute([$o['id']]);
  $o['items'] = $it->fetchAll(); $o['events'] = $ev->fetchAll(); $o['status_label'] = STATUSES[$o['status']] ?? $o['status'];
  foreach (['id', 'subtotal', 'total', 'ship_cost', 'created_at', 'updated_at'] as $k) $o[$k] = (int)$o[$k];
  unset($o['authority']);
  return $o;
}
function order_event(int $oid, string $status, ?string $note = null, ?int $uid = null): void {
  db()->prepare('INSERT INTO order_events (order_id, status, note, user_id, at) VALUES (?, ?, ?, ?, ?)')->execute([$oid, $status, $note, $uid, now_ms()]);
}
function restock_order(array $o, string $reason, ?int $uid = null): void {
  $it = db()->prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?'); $it->execute([$o['id']]);
  foreach ($it->fetchAll() as $x) adjust_stock((int)$x['product_id'], (int)$x['qty'], $reason, $o['code'], $uid);
}
/* unpaid online orders hold stock only for a while; released on any request (no cron needed) */
function release_expired(): void {
  $limit = now_ms() - (int)(cfg('reserve_minutes') ?: 30) * 60000;
  $st = db()->prepare("SELECT * FROM orders WHERE status = 'pending' AND created_at < ?"); $st->execute([$limit]);
  foreach ($st->fetchAll() as $o) {
    $pdo = db(); $pdo->beginTransaction();
    $u = $pdo->prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending'"); $u->execute([now_ms(), $o['id']]);
    if ($u->rowCount() === 1) { restock_order($o, 'expired'); order_event((int)$o['id'], 'cancelled', 'پرداخت در مهلت انجام نشد'); }
    $pdo->commit();
  }
}
function status_sms(array $o, string $status): void {
  $url = rtrim((string)cfg('base_url'), '/') . '/#/track?code=' . $o['code'];
  $map = ['paid' => "سفارش {$o['code']} ثبت و پرداخت شد. پیگیری: $url", 'confirmed' => "سفارش {$o['code']} ثبت شد (پرداخت در محل). پیگیری: $url",
    'ready' => "سفارش {$o['code']} آماده‌ی تحویل در فروشگاه است.", 'shipped' => "سفارش {$o['code']} ارسال شد." . ($o['tracking_no'] ? " کد رهگیری مرسوله: {$o['tracking_no']}" : ''),
    'cancelled' => "سفارش {$o['code']} لغو شد. برای پیگیری با فروشگاه تماس بگیرید."];
  if (isset($map[$status])) send_sms($o['mobile'], $map[$status]);
}

/* ---------- zarinpal v4 ---------- */
function zp_host(): string { $z = cfg('zarinpal') ?: []; return !empty($z['sandbox']) ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com'; }
function zp_enabled(): bool { $z = cfg('zarinpal') ?: []; return !empty($z['merchant_id']); }
function zp_post(string $path, array $data): ?array {
  $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 15, 'ignore_errors' => true,
    'header' => "Content-Type: application/json\r\nAccept: application/json\r\n", 'content' => json_encode($data)]]);
  $r = @file_get_contents(zp_host() . $path, false, $ctx);
  $j = $r ? json_decode($r, true) : null;
  return is_array($j) ? $j : null;
}
