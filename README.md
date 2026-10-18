# فروشگاه طاها الکترونیک

فروشگاه اینترنتی طاها الکترونیک (شیراز): ابزار لحیم‌کاری، نوک هویه، ابزار اندازه‌گیری و قطعات ECU خودرو.

**دموی زنده:** پوشه‌ی `docs/` روی GitHub Pages، به آدرس `https://<نام‌کاربری>.github.io/taha-electronic-shop/`

## در دمو چه می‌بینید

- **قفسه‌ی آی‌سی‌ها:** ۳۶۱ آی‌سی ECU، هر کدام در کشوی واقعی خودش، در کابینت‌های سه‌بعدی که با اسکرول می‌چرخند. کشوها با بردن ماوس بیرون می‌آیند و با کلیک، دوربین از بالا وارد کشو می‌شود.
- **مدل سه‌بعدی هر قطعه:** بسته‌بندی هر آی‌سی با دیتاشیت سازنده و فروشگاه‌های تخصصی چک شده است. اندازه، تعداد پایه، گام و پد حرارتی واقعی‌اند و مدل را می‌شود چرخاند و زوم کرد.
- **دو حالت نمایش:** «ویترین» (حس سه‌بعدی، پس‌زمینه‌ی زنده‌ی برد مدار) و «شبکه» (ساده و سریع)، به‌علاوه‌ی تم روشن و تیره.
- **پنل مدیریت:** در `admin.html`. در دمو با شماره‌ی `09120000000` و رمز `demo-admin-123` وارد شوید.

> دمو روی GitHub Pages است و سرور ندارد. سفارش، ورود و پنل مدیریت فقط در همان مرورگر بیننده ذخیره می‌شوند و هیچ سفارش واقعی ثبت نمی‌شود. داده‌ها نسخه‌ای از کاتالوگ فروشگاه‌اند؛ قیمت خرید در آن نیست.

## ساختار مخزن

| پوشه | چیست |
|---|---|
| `site/` | کد کامل فروشگاه برای نصب روی هاست: PHP 8 و SQLite، پنل مدیریت، درگاه زرین‌پال و پیامک کاوه‌نگار. راهنمای نصب: `site/README-fa.md` |
| `docs/` | همان سایت به‌صورت نمایشی برای GitHub Pages |
| `research/` | داده‌ی پژوهش آی‌سی‌ها: کاربرد، بسته‌بندی و منبع هر قطعه |

## نصب روی هاست

۱. محتوای `site/` را در پوشه‌ی اصلی هاست بگذارید.
۲. `install.php` را باز کنید و مدیر فروشگاه را بسازید.
۳. کلیدهای زرین‌پال و کاوه‌نگار را در `api/config.php` بگذارید (از روی `config.sample.php`).

جزئیات کامل در `site/README-fa.md`.

---

**English:** Online store for Taha Electronic (Shiraz, Iran): soldering tools and automotive ECU parts. `site/` is the full PHP 8 + SQLite store with its admin panel; `docs/` is a static, server-less showcase of the same front end on GitHub Pages (orders and sign-in stay in the visitor's browser). Highlights: a CSS-3D IC cabinet wall (361 parts, drawers that slide out, a camera that drops into a drawer) and procedurally built Three.js models of every IC package from real JEDEC / maker outlines.
