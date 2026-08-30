/* ja_a.js / ja_b.js の参考訳を sentences.json に統合する。
   使い方:  node build/merge-ja.js */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const ja = Object.assign({}, require('./ja_a.js'), require('./ja_b.js'));
const file = path.join(here, 'sentences.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const missing = [];
for (let i = 0; i < data.length; i++) {
  if (!ja[i] || !String(ja[i]).trim()) missing.push(i);
}
const extra = Object.keys(ja).filter(k => Number(k) >= data.length);

for (let i = 0; i < data.length; i++) data[i].ja = ja[i] || '';
fs.writeFileSync(file, JSON.stringify(data, null, 1), 'utf8');

console.log('訳 ' + Object.keys(ja).length + ' 件 / 文 ' + data.length + ' 件');
console.log('訳の無い文: ' + (missing.length ? missing.join(',') : 'なし'));
console.log('余分なキー: ' + (extra.length ? extra.join(',') : 'なし'));
if (missing.length || extra.length) process.exit(1);
