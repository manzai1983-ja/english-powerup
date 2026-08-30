/* verbs.json を動詞ページ用テンプレートに流し込んで ../verbs.html を作る。
   テンプレートは tmpl.html から make-tmpl-verbs.js が毎回作り直すので、
   tmpl.html に手を入れれば2つのページ両方に反映される。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const here = __dirname;
const out = process.argv[2] || path.join(here, '..', 'verbs.html');

execFileSync(process.execPath, [path.join(here, 'make-tmpl-verbs.js')], { stdio: 'inherit' });
const tmpl = fs.readFileSync(path.join(here, 'tmpl-verbs.html'), 'utf8');
const src = JSON.parse(fs.readFileSync(path.join(here, 'verbs.json'), 'utf8'));

const descBySec = {};
for (const s of src.sections) descBySec[s.no] = s.desc;

const slim = src.items.map(x => ({
  sec: x.sec,
  secTitle: x.secTitle,
  secDesc: descBySec[x.sec] || '',
  cat: x.cat,
  verb: x.verb,
  mean: x.mean,
  note: x.note,
  en: x.en,
  ja: x.ja
}));

const bad = slim.filter(x => !x.verb || !x.en || !x.ja || !x.mean);
if (bad.length) {
  console.error('欠けのある項目が ' + bad.length + ' 件あります。');
  process.exit(1);
}
if (tmpl.split('/*__DATA__*/').length - 1 !== 1) {
  console.error('tmpl-verbs.html に /*__DATA__*/ が1つ見つかりません。');
  process.exit(1);
}

const html = tmpl.replace('/*__DATA__*/', JSON.stringify(slim));
fs.writeFileSync(out, html, 'utf8');

const cats = new Set(slim.map(x => x.sec + '|' + x.cat)).size;
console.log('書きました: ' + out);
console.log('  ' + Buffer.byteLength(html, 'utf8') + ' bytes / ' + slim.length + ' 語 / ' +
            src.sections.length + ' 構文 / ' + cats + ' カテゴリ');
