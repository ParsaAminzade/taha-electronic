<?php
/* Writes the checked packages (packages.php) into api/ic-info.json (fields pk = package code for A/B, p = the
   package line shown in the store, pc = package confidence) and lists every change in package-check.csv.
   php tools/ic-info/apply-packages.php */
$root = dirname(__DIR__, 2);
$file = $root . '/tahatronic/api/ic-info.json';
$rows = json_decode(file_get_contents($file), true);
$pk = require __DIR__ . '/packages.php';
$names = ['SOP8' => 'SO-8', 'SO14' => 'SO-14', 'SOP16' => 'SO-16', 'SOP20' => 'SO-20 (بدنه‌ی عریض)', 'SOP24' => 'SO-24 (بدنه‌ی عریض)', 'SOP28' => 'SO-28 (بدنه‌ی عریض)',
  'SO44' => 'SO-44', 'DSO8EP' => 'DSO-8 با پد حرارتی', 'DSO12' => 'DSO-12 قدرت با پد حرارتی', 'SOIC32' => 'SOIC-32 (گام ۰٫۶۵)', 'SOIC32EP' => 'SOIC-32 با پد حرارتی',
  'SSOP24' => 'SSOP-24', 'SSOP24EP' => 'SSOP-24 با پد حرارتی', 'TSSOP8' => 'TSSOP-8', 'TSSOP20EP' => 'TSSOP-20 با پد حرارتی', 'TSSOP28' => 'TSSOP-28',
  'TSSOP28EP' => 'HTSSOP-28 با پد حرارتی', 'TSSOP38' => 'TSSOP-38', 'HTSSOP24' => 'HTSSOP-24', 'HTSSOP32' => 'HTSSOP-32', 'HTSSOP38' => 'HTSSOP-38',
  'PSO10' => 'PowerSO-10', 'PSO20' => 'PowerSO-20 / DSO-20 قدرت', 'PSO36' => 'PowerSO-36 / DSO-36 قدرت', 'PSSO12' => 'PowerSSO-12', 'PSSO24' => 'PowerSSO-24',
  'PSSO36' => 'PowerSSO-36', 'TSOP48' => 'TSOP-48', 'QFP32' => 'TQFP-32', 'QFP44' => 'TQFP-44', 'QFP48' => 'LQFP-48', 'QFP64S' => 'LQFP-64 (۱۰×۱۰)',
  'QFP64' => 'QFP-64 (۱۴×۱۴)', 'QFP100' => 'LQFP-100', 'QFP112' => 'LQFP-112', 'QFP144' => 'LQFP-144 (۲۰×۲۰)', 'QFP144B' => 'PQFP-144 بزرگ (۲۸×۲۸)',
  'QFP176' => 'LQFP-176', 'PLCC28' => 'PLCC-28', 'PLCC44' => 'PLCC-44', 'QFN32' => 'PQFN-32', 'BGA388' => 'PBGA-388 (ساچمه‌ای)',
  'TO252' => 'DPAK (TO-252)', 'TO252-5' => 'DPAK ۵ پایه (TO-252-5)', 'TO263' => 'D2PAK (TO-263)', 'TO263-5' => 'D2PAK ۵ پایه (TO-263-5)', 'TO263-7' => 'D2PAK ۷ پایه (TO-263-7)',
  'SOT223' => 'SOT-223', 'SOT23' => 'SOT-23', 'SOT89' => 'SOT-89', 'SMA' => 'SMA (DO-214AC)', 'SMB' => 'SMB (DO-214AA)', 'DO218' => 'DO-218AB', 'RELAY' => ''];
$vs = [];                                                               // vespida.com product page per drawer (the source of the package)
foreach (array_slice(file(__DIR__ . '/vespida-sources.tsv', FILE_IGNORE_NEW_LINES), 1) as $l) { $c = explode("\t", $l); if (count($c) === 3 && $c[2][0] !== '(') $vs[$c[0]] = 'https://vespida.com/Products/' . $c[2]; }
$seen = []; $out = []; $n = ['A' => 0, 'B' => 0, 'C' => 0, 'X' => 0]; $changed = 0;
$csv = fopen(__DIR__ . '/package-check.csv', 'w'); fwrite($csv, "\xEF\xBB\xBF");
fputcsv($csv, ['drawer', 'part', 'before (3D shape)', 'checked package', 'confidence', 'shown as', 'changed', 'vespida']);
foreach ($rows as &$r) {
  $d = $r['drawer']; if (isset($seen[$d])) fwrite(STDERR, "duplicate drawer $d\n"); $seen[$d] = 1;
  [$code, $conf, $note] = ($pk[$d] ?? ['', 'X', '']) + [2 => ''];
  $before = $r['pk'] ?? '';
  $ok = in_array($conf, ['A', 'B'], true) && $code !== '';
  $r['pk'] = $ok ? $code : '';
  $r['pc'] = $conf;
  $r['p'] = $note !== '' ? $note : ($ok ? ($names[$code] ?? $code) : 'بسته‌بندی این قطعه در منابع عمومی پیدا نشد');
  if ($r['p'] === '') unset($r['p']);
  if (isset($vs[$d])) $r['s'] = array_values(array_unique(array_merge($r['s'] ?? [], [$vs[$d]])));
  $n[$conf]++; $ch = $before !== $r['pk']; if ($ch) $changed++;
  fputcsv($csv, [$d, $r['name'], $before ?: '(guess)', $r['pk'] ?: '-', $conf, $r['p'] ?? '', $ch ? 'yes' : '', $vs[$d] ?? '']);
}
unset($r);
foreach (array_diff(array_keys($pk), array_keys($seen)) as $d) fwrite(STDERR, "packages.php has unknown drawer $d\n");
fclose($csv);
file_put_contents($file, json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
echo json_encode(['parts' => count($rows), 'confidence' => $n, 'package_code_changed' => $changed]), "\n";
