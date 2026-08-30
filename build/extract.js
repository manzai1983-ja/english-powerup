/* ラジオ英会話2026 Excel から「（全然聞こえない）」で印を付けた英文を抜き出す。
   印は直前の文に付いている。1行に複数の印があるので、印ごとに区切って拾う。
   印の後ろに「※…」が続く場合はメモ（直前の文への補足）。
   印の付いていない末尾は対象外。 */
const { open } = require('./xl.js');
const fs = require('fs');

const wb = open('C:/Users/user/Documents/ラジオ英会話_2026.xlsx');
const c = wb.cellsOf('2026年度_main-part');
const MARK = /[（(]\s*全然聞こえない\s*[)）]/g;

function clean(s) {
  return s.replace(/\*/g, '')
          .replace(/^[\s.,、。]+/, '')
          .replace(/\s+/g, ' ')
          .trim();
}
function hasEn(s) { return /[A-Za-z]{2}/.test(s); }

/* 読み上げ・判定に使う形。[代替] は落とし、/ 区切りは別項目に分ける */
function speakable(s) {
  return s.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

const out = [], seen = new Set();
let skippedWithout = 0, dropped = 0;

for (let r = 5; r <= 1200; r++) {
  const f = c['F' + r] || '';
  MARK.lastIndex = 0;
  if (!MARK.test(f)) continue;
  const label = (c['E' + r] || '').replace(/\r?\n/g, ' ').trim();
  const ep = parseInt(c['C' + r], 10);
  const month = parseInt(c['B' + r], 10);
  const theme = (c['D' + r] || '').replace(/\r?\n/g, ' ').trim();
  /* without repeat は本人の聞き取りメモ（誤字だらけ）なので練習対象にしない */
  if (/without repeat/i.test(label)) {
    skippedWithout += (f.match(/全然聞こえない/g) || []).length;
    continue;
  }

  for (const line of f.split(/\r?\n/)) {
    MARK.lastIndex = 0;
    if (!MARK.test(line)) continue;
    /* 印を外した行全体。対象が行の一部でしかないときの文脈として持たせる */
    const fullLine = clean(line.replace(MARK, ' ').replace(/※.*$/, ''));
    MARK.lastIndex = 0;
    const segs = line.split(MARK);
    /* segs[0..n-2] が印の付いた文、segs[n-1] は印なしの残り */
    for (let i = 0; i < segs.length; i++) {
      const isMarked = i < segs.length - 1;
      let seg = segs[i];
      if (!isMarked) {
        const m = seg.match(/※\s*(.+)$/);
        if (m && out.length) out[out.length - 1].note = m[1].trim();
        continue;
      }
      /* 印の直前に ※メモ が挟まる形もある */
      const nm = seg.match(/※\s*(.+)$/);
      if (nm) seg = seg.slice(0, seg.indexOf('※'));
      let en = clean(seg);
      if (!hasEn(en)) { dropped++; continue; }

      /* 「A / B / C」は別々の言い方なので項目を分ける。
         ただし [ A / B ] の中のスラッシュは代替表記なので割らない */
      const parts = (en.indexOf(' / ') >= 0 && en.indexOf('[') < 0)
        ? en.split(' / ').map(clean).filter(hasEn)
        : [en];
      for (const p of parts) {
        const sp = speakable(p);
        if (!hasEn(sp)) { dropped++; continue; }
        const k = ep + '|' + sp.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ ep, month, theme, label, en: p, say: sp,
                   note: nm ? nm[1].trim() : '',
                   ctx: (fullLine !== p && fullLine.length > p.length + 4) ? fullLine : '' });
      }
    }
  }
}

fs.writeFileSync('sentences.json', JSON.stringify(out, null, 1));
console.log('抽出:', out.length, '件 /', new Set(out.map(x => x.ep)).size, '回ぶん');
console.log('除外: without-repeat', skippedWithout, '件、英語なし', dropped, '件');
console.log('メモ付き:', out.filter(x => x.note).length);
console.log('表示と読み上げが異なる（[代替]あり）:', out.filter(x => x.en !== x.say).length);
console.log('\n--- 分割・メモの確認 ---');
for (const x of out.filter(x => x.note || x.en !== x.say || x.ep === 33 || x.ep === 58).slice(0, 14)) {
  console.log('  ep' + x.ep + ': ' + x.en + (x.note ? '   ※' + x.note : '') +
              (x.en !== x.say ? '   [読み] ' + x.say : ''));
}
