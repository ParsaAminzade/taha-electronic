<?php
/* Merges the researched IC info (asic/driver/rest.json) with the parts list, checks every part has exactly one
   entry, and writes tahatronic/api/ic-info.json (shipped; applied from the admin panel) + a review CSV. */
$parts = json_decode(file_get_contents(__DIR__ . '/parts.json'), true);
$info = [];
foreach (['asic', 'driver', 'rest'] as $f) {
  $rows = json_decode(file_get_contents(__DIR__ . "/$f.json"), true);
  if (!is_array($rows)) { fwrite(STDERR, "bad JSON in $f.json: " . json_last_error_msg() . "\n"); exit(1); }
  foreach ($rows as $r) { if (isset($info[$r['d']])) fwrite(STDERR, "duplicate drawer {$r['d']} ($f)\n"); $info[$r['d']] = $r; }
}
$out = []; $missing = []; $count = ['A' => 0, 'B' => 0, 'C' => 0, 'X' => 0];
foreach ($parts as $p) {
  $r = $info[$p['drawer']] ?? null;
  if (!$r) { $missing[] = $p['drawer'] . ' ' . $p['name']; continue; }
  unset($info[$p['drawer']]);
  $count[$r['c']]++;
  $out[] = ['drawer' => $p['drawer'], 'name' => $p['name']] + array_diff_key($r, ['d' => 1]);
}
$extra = array_keys($info);
file_put_contents(__DIR__ . '/../../tahatronic/api/ic-info.json', json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
$csv = fopen(__DIR__ . '/../../ic-info-review.csv', 'w'); fwrite($csv, "\xEF\xBB\xBF");
$lab = ['A' => 'دیتاشیت سازنده / چند فروشگاه', 'B' => 'یک فروشگاه تخصصی', 'C' => 'محدود', 'X' => 'پیدا نشد'];
fputcsv($csv, ['کشو', 'شماره‌ی قطعه', 'نوع', 'سازنده', 'کاربرد', 'ECU / خودرو', 'بسته‌بندی', 'مشابه', 'اطمینان', 'منبع']);
foreach ($out as $r) fputcsv($csv, [$r['drawer'], $r['name'], $r['t'] ?? '', $r['m'] ?? '', $r['u'] ?? '', $r['e'] ?? '', $r['p'] ?? '', $r['a'] ?? '', $lab[$r['c']], implode(' ', $r['s'] ?? [])]);
fclose($csv);
printf("parts %d | written %d | A %d B %d C %d X %d | missing %d | extra %d\n", count($parts), count($out), $count['A'], $count['B'], $count['C'], $count['X'], count($missing), count($extra));
if ($missing) echo "MISSING: " . implode(' ; ', $missing) . "\n";
if ($extra) echo "EXTRA: " . implode(' ; ', $extra) . "\n";
require __DIR__ . '/apply-packages.php';   // checked packages (packages.php) on top of the descriptions
