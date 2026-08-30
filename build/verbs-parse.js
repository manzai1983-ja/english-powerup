/* PDFから起こしたテキストを、動詞1語＝1項目の構造に直す。
   1項目のならび:
     カテゴリ / 動詞 / 日本語訳 / 【使う場面】… / Ex: 英文 / （訳）
   【使う場面】と（訳）は行の途中で折り返されることがあるので繋ぎ直す。 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

const SKIP = new Set(['カテゴリ', '動詞', '日本語訳 ＆ 場面・ニュアンス解説 ＆ 実践例文']);

const sections = [];
let cur = null;
let buf = [];        /* 直前の見出し行（カテゴリ・動詞・訳）を溜める */
let entry = null;
let mode = null;     /* null | 'note' | 'ja' */

function flush() {
  if (entry && cur) {
    entry.note = entry.note.replace(/^【使う場面】/, '').trim();
    entry.ja = entry.ja.replace(/^[（(]/, '').replace(/[）)]$/, '').trim();
    cur.items.push(entry);
  }
  entry = null;
  mode = null;
}

for (let i = 0; i < src.length; i++) {
  const line = src[i];

  const sec = line.match(/^(\d+)\.\s*(.+)$/);
  if (sec) {
    flush();
    buf = [];
    cur = { no: Number(sec[1]), title: sec[2], desc: '', items: [] };
    sections.push(cur);
    if (src[i + 1] && !SKIP.has(src[i + 1]) && !/^\d+\.\s/.test(src[i + 1])) {
      cur.desc = src[i + 1];
      i++;
    }
    continue;
  }
  if (!cur) continue;                 /* 表紙・前書き */
  if (SKIP.has(line)) { buf = []; continue; }
  if (/^\d{1,3}$/.test(line)) continue;   /* ページ番号 */

  if (line.indexOf('【使う場面】') === 0) {
    /* 直前3行が カテゴリ / 動詞 / 訳 */
    const t = buf.slice(-3);
    flush();
    entry = {
      cat: t.length === 3 ? t[0] : '',
      verb: t.length === 3 ? t[1] : (t[0] || ''),
      mean: t.length === 3 ? t[2] : (t[1] || ''),
      note: line, en: '', ja: ''
    };
    buf = [];
    mode = 'note';
    continue;
  }

  if (/^Ex:\s*/.test(line)) {
    if (entry) { entry.en = line.replace(/^Ex:\s*/, '').trim(); mode = 'ja'; }
    continue;
  }

  if (mode === 'note') { entry.note += line; continue; }
  if (mode === 'ja') {
    entry.ja += line;
    /* 閉じ括弧が来たらその項目は終わり。ここで切らないと次の項目を飲み込む */
    if (/[）)]\s*$/.test(entry.ja)) flush();
    continue;
  }

  buf.push(line);
}
flush();

const all = [];
for (const s of sections) for (const it of s.items) all.push(Object.assign({ sec: s.no, secTitle: s.title }, it));

const out = { sections: sections.map(s => ({ no: s.no, title: s.title, desc: s.desc, count: s.items.length })), items: all };
fs.writeFileSync(path.join(__dirname, 'verbs.json'), JSON.stringify(out, null, 1), 'utf8');

console.log('セクション:');
for (const s of out.sections) console.log('  ' + s.no + '. ' + s.title + '  → ' + s.count + '語');
console.log('合計: ' + all.length + ' 語');
const bad = all.filter(x => !x.verb || !x.en || !x.ja || !x.mean);
console.log('欠けのある項目: ' + bad.length);
for (const b of bad.slice(0, 5)) console.log('  ' + JSON.stringify(b));
console.log('');
console.log('--- 例 ---');
for (const x of [all[0], all[30], all[all.length - 1]]) {
  if (!x) continue;
  console.log('[' + x.sec + '] ' + x.cat + ' / ' + x.verb + ' — ' + x.mean);
  console.log('   場面: ' + x.note.slice(0, 60) + '…');
  console.log('   Ex: ' + x.en);
  console.log('   訳: ' + x.ja);
}
