<?php
/* One-time setup: creates the database, the store manager's account and the categories.
   Delete this file from the host after setup (README-fa.md, step 5). */
declare(strict_types=1);
require __DIR__ . '/api/lib.php';

$msg = ''; $done = false;
$hasAdmin = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn() > 0;
$writable = is_writable(__DIR__ . '/data') && is_writable(__DIR__ . '/uploads');

if (!$hasAdmin && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $name = clean_text($_POST['name'] ?? '', 60); $phone = norm_phone($_POST['phone'] ?? ''); $pass = (string)($_POST['password'] ?? '');
  if (!$name || !$phone) $msg = 'نام و شماره‌ی موبایل مدیر را درست وارد کنید.';
  elseif (mb_strlen($pass) < 10) $msg = 'رمز باید دست‌کم ۱۰ کاراکتر باشد.';
  elseif ($pass !== ($_POST['password2'] ?? '')) $msg = 'تکرار رمز با خود رمز یکی نیست.';
  else {
    $pdo = db(); $pdo->beginTransaction(); $now = now_ms();
    $pdo->prepare("INSERT INTO users (phone, name, role, pass_hash, created_at) VALUES (?, ?, 'admin', ?, ?)")->execute([$phone, $name, password_hash($pass, PASSWORD_DEFAULT), $now]);
    $cats = [['tips','نوک هویه','i-tip','سری 900M و سرامیکی'],['solder','لحیم و فلکس','i-solder','سیم لحیم، فلکس، قلع‌کش'],['probe','پراب و تست','i-probe','پراب مولتی‌متر، تستر'],
             ['tools','ابزار دستی','i-cutter','کف‌چین، پنس، انبر'],['station','هویه و هیتر','i-heat','هیتر، نازل هوای گرم'],['chem','چسب و مواد','i-chem','چسب سیلیکون، خمیر']];
    $ci = $pdo->prepare('INSERT INTO categories (id, name, icon, note, sort) VALUES (?, ?, ?, ?, ?)');
    $ck = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE id = ?');
    foreach ($cats as $i => $c) { $ck->execute([$c[0]]); if (!(int)$ck->fetchColumn()) $ci->execute([...$c, $i]); }
    if (!empty($_POST['seed'])) {
      // the current site's products plus the 900M tips, inactive with no price, ready for the manager to complete
      @copy(__DIR__ . '/assets/tip-pack.png', __DIR__ . '/uploads/tip-pack.png');
      $seed = [
        ['tips','900M-T-B','نوک هویه مخروطی 900M-T-B','نوک مخروطی','b','tip-pack.png','#0E7A4B','tip'],
        ['tips','900M-T-I','نوک هویه سوزنی 900M-T-I','نوک سوزنی','i','tip-pack.png','#0E7A4B','tip'],
        ['tips','900M-T-K','نوک هویه چاقویی 900M-T-K','نوک چاقویی','k','tip-pack.png','#0E7A4B','tip'],
        ['tips','900M-T-2.4D','نوک هویه پیچ‌گوشتی 900M-T-2.4D','نوک تخت','d','tip-pack.png','#0E7A4B','tip'],
        ['tips','900M-T-3C','نوک هویه اریب 900M-T-3C','نوک اریب','c','tip-pack.png','#0E7A4B','tip'],
        ['tips','YIHUA 60W I','نوک هویه سرامیکی ۶۰ وات yihua I','',null,null,'#7a2f2f','tip'],
        ['tools','PCAFC 170','کف‌چین PCAFC مدل 170','',null,null,'#0E7A4B','cutter'],
        ['probe','LAMP TEST','تست لامپ خودرو','',null,null,'#4c4f18','bulb'],
        ['probe','SS-024','پراب مولتی‌متر سان‌شاین SS-024','',null,null,'#9f2219','probe'],
        ['probe','SS-024A','پراب مولتی‌متر سان‌شاین SS-024A','',null,null,'#1d3d86','probe'],
        ['station','BK701 D','هیتر هویه Bakon BK701 D','',null,null,'#1d1d1d','heater'],
        ['station','HOT AIR NOZZLE','نازل دوبل دسته هوای گرم (هیتر)','',null,null,'#5c5f63','nozzle'],
        ['chem','KAFUTER','چسب سیلیکون کافوتر (Kafuter)','',null,null,'#b8860b','tube'],
      ];
      $pi = $pdo->prepare('INSERT INTO products (slug, cat, code, name, short, price, stock, low_at, active, photo, pack_color, pack_icon, tip_type, why, specs, sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 2, 0, ?, ?, ?, ?, NULL, ?, ?, ?, ?)');
      foreach ($seed as $i => [$cat, $code, $pname, $short, $tip, $photo, $color, $ico])
        $pi->execute(['p' . bin2hex(random_bytes(4)), $cat, $code, $pname, $short, $photo, $color, $ico, $tip, $tip ? json_encode([['سری', '900M']], JSON_UNESCAPED_UNICODE) : '[]', $i, $now, $now]);
    }
    $pdo->commit(); $done = true; $hasAdmin = true;
  }
}
?><!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>نصب فروشگاه طاها الکترونیک</title>
<style>
body{font-family:Vazirmatn,Tahoma,sans-serif;background:#F3F6F2;color:#0F2219;margin:0;padding:24px;line-height:1.8}
.box{max-width:460px;margin:40px auto;background:#fff;border:1px solid #D8E0D6;border-radius:20px;padding:28px}
h1{font-size:1.4rem;margin:0 0 6px}label{display:block;font-weight:700;margin-top:14px;font-size:.9rem}
input[type=text],input[type=tel],input[type=password]{width:100%;box-sizing:border-box;min-height:46px;border:1.5px solid #C6D1C3;border-radius:12px;padding:8px 12px;font:inherit}
.chk{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin-top:16px}
button,.btn{display:inline-block;margin-top:20px;min-height:46px;padding:0 24px;border:0;border-radius:999px;background:#0E7A4B;color:#fff;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;line-height:46px}
.err{background:#FDECEA;color:#B42318;border-radius:12px;padding:10px 14px;margin-top:12px}.ok{background:#E3F2EA;color:#095C37;border-radius:12px;padding:10px 14px}
small{color:#56645B}
</style></head><body><div class="box">
<?php if ($done): ?>
  <h1>نصب انجام شد</h1><p class="ok">حساب مدیر و دسته‌بندی‌ها ساخته شد.</p>
  <p><b>حتماً فایل <code>install.php</code> را از هاست پاک کنید.</b></p>
  <a class="btn" href="admin.html">ورود به پنل مدیریت</a>
<?php elseif ($hasAdmin): ?>
  <h1>فروشگاه قبلاً نصب شده است</h1><p>برای امنیت، فایل <code>install.php</code> را از هاست پاک کنید.</p><a class="btn" href="admin.html">پنل مدیریت</a>
<?php else: ?>
  <h1>نصب فروشگاه طاها الکترونیک</h1><p><small>حساب مدیر فروشگاه را بسازید. با همین شماره و رمز وارد پنل مدیریت می‌شوید.</small></p>
  <?php if (!$writable): ?><p class="err">پوشه‌های <code>data</code> و <code>uploads</code> قابل نوشتن نیستند. دسترسی آن‌ها را ۷۵۵ یا ۷۷۵ کنید.</p><?php endif; ?>
  <?php if ($msg): ?><p class="err" role="alert"><?= htmlspecialchars($msg) ?></p><?php endif; ?>
  <form method="post">
    <label for="n">نام مدیر</label><input type="text" id="n" name="name" required autocomplete="name" value="<?= htmlspecialchars($_POST['name'] ?? '') ?>">
    <label for="p">شماره‌ی موبایل</label><input type="tel" id="p" name="phone" required dir="ltr" autocomplete="tel" value="<?= htmlspecialchars($_POST['phone'] ?? '') ?>">
    <label for="w">رمز عبور <small>(دست‌کم ۱۰ کاراکتر)</small></label><input type="password" id="w" name="password" required autocomplete="new-password" minlength="10">
    <label for="w2">تکرار رمز</label><input type="password" id="w2" name="password2" required autocomplete="new-password">
    <label class="chk"><input type="checkbox" name="seed" value="1" checked> <span>کالاهای فعلی سایت و نوک‌های 900M را اضافه کن <small>(غیرفعال و بدون قیمت؛ در پنل قیمت و موجودی را وارد و فعالشان کنید)</small></span></label>
    <button type="submit">نصب</button>
  </form>
<?php endif; ?>
</div></body></html>
