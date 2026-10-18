<?php
$db = new PDO('sqlite:' . __DIR__ . '/../testsite/data/shop.sqlite');
$r = $db->query("SELECT drawer, name, cat FROM products WHERE cat LIKE 'ic-%' ORDER BY cat, CAST(drawer AS INTEGER), drawer")->fetchAll(PDO::FETCH_ASSOC);
file_put_contents(__DIR__ . '/parts.json', json_encode($r, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
$by = []; foreach ($r as $p) $by[$p['cat']][] = $p['drawer'] . '=' . $p['name'];
foreach ($by as $c => $l) echo "## $c (" . count($l) . ")\n" . implode(' | ', $l) . "\n";