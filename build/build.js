/* build/sentences.json をテンプレートに流し込んで ../index.html を作る。
   使い方:  node build/build.js   （リポジトリのルートから） */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const root = path.join(here, '..');

const tmpl = fs.readFileSync(path.join(here, 'tmpl.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(here, 'sentences.json'), 'utf8'));

const slim = data.map(x => ({
  ep: x.ep, theme: x.theme, en: x.en, say: x.say, ctx: x.ctx, note: x.note, ja: x.ja
}));

const missing = slim.filter(x => !x.ja || !x.ja.trim());
if (missing.length) {
  console.error('訳の無い文が ' + missing.length + ' 件あります。先に merge-ja.js を流してください。');
  process.exit(1);
}

if (tmpl.split('/*__DATA__*/').length - 1 !== 1) {
  console.error('tmpl.html に /*__DATA__*/ が1つ見つかりません。');
  process.exit(1);
}

const out = tmpl.replace('/*__DATA__*/', JSON.stringify(slim));
const dest = path.join(root, 'index.html');
fs.writeFileSync(dest, out, 'utf8');

const eps = new Set(slim.map(x => x.ep)).size;
console.log('index.html を書きました: ' + Buffer.byteLength(out, 'utf8') + ' bytes / ' +
            slim.length + ' 文 / ' + eps + ' 回ぶん');
