<?php
/*
 * تنظیمات فروشگاه — این فایل را به نام config.php کپی کنید و مقادیر را عوض کنید.
 * Copy this file to config.php and edit the values. config.php is never served to browsers.
 */
return [
  // پایگاه داده — پیش‌فرض SQLite است و به هیچ تنظیمی نیاز ندارد.
  // برای MySQL:  'dsn' => 'mysql:host=localhost;dbname=NAME;charset=utf8mb4', 'db_user' => '...', 'db_pass' => '...'
  'dsn'     => 'sqlite:' . __DIR__ . '/../data/shop.sqlite',
  'db_user' => null,
  'db_pass' => null,

  // نشانی کامل سایت، بدون / آخر (برای بازگشت از درگاه پرداخت)
  'base_url' => 'https://tahatronic.ir',

  // درگاه زرین‌پال. merchant_id را از پنل زرین‌پال بگیرید.
  // sandbox => true برای آزمایش با درگاه آزمایشی زرین‌پال (پول واقعی جابه‌جا نمی‌شود).
  'zarinpal' => ['merchant_id' => '', 'sandbox' => false],

  // پیامک (کاوه‌نگار): کد ورود، کد رهگیری سفارش، تغییر وضعیت، «موجود شد»
  // 'sms' => ['provider' => 'kavenegar', 'api_key' => '...', 'sender' => '...']
  'sms' => null,

  // فقط برای آزمایش روی هاست: کد ورود را در پاسخ برمی‌گرداند. روی سایت واقعی حتماً false بماند.
  'otp_debug' => false,

  // حداکثر حجم عکس محصول (مگابایت)
  'max_upload_mb' => 6,

  // سفارش‌هایی که در این مدت پرداخت نشوند لغو و موجودی‌شان برگردانده می‌شود (دقیقه)
  'reserve_minutes' => 30,

  // اگر سایت پشت HTTPS است true بگذارید (کوکی امن)
  'https' => true,
];
