/* ToUnicode CMap を使って PDF のテキストを取り出す。
   このPDFはサブセットフォントの16進文字列で書かれているので、
   グリフ番号→Unicode の対応表を先に作ってから content stream を読む。 */
const fs = require('fs'), zlib = require('zlib');
const buf = fs.readFileSync(process.argv[2]);

/* --- 全ストリームを展開 --- */
const streams = [];
{
  let i = 0;
  while (true) {
    const s = buf.indexOf('stream', i);
    if (s < 0) break;
    let p = s + 6;
    if (buf[p] === 0x0d) p++;
    if (buf[p] === 0x0a) p++;
    const e = buf.indexOf('endstream', p);
    if (e < 0) break;
    let d = null;
    try { d = zlib.inflateSync(buf.slice(p, e)); } catch (err) {}
    if (d) streams.push(d.toString('latin1'));
    i = e + 9;
  }
}

/* --- ToUnicode を集める --- */
const MAP = new Map();
let cmapCount = 0;
for (const t of streams) {
  if (t.indexOf('beginbfchar') < 0 && t.indexOf('beginbfrange') < 0) continue;
  cmapCount++;
  let m;
  const bfchar = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = bfchar.exec(t)) !== null) {
    const pairs = m[1].match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) || [];
    for (const p of pairs) {
      const g = p.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
      const code = parseInt(g[1], 16);
      const uni = g[2].match(/.{4}/g).map(h => String.fromCharCode(parseInt(h, 16))).join('');
      if (!MAP.has(code)) MAP.set(code, uni);
    }
  }
  const bfrange = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrange.exec(t)) !== null) {
    const rows = m[1].match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) || [];
    for (const r of rows) {
      const g = r.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
      const lo = parseInt(g[1], 16), hi = parseInt(g[2], 16), base = parseInt(g[3], 16);
      for (let c = lo; c <= hi && c - lo < 65536; c++) {
        if (!MAP.has(c)) MAP.set(c, String.fromCharCode(base + (c - lo)));
      }
    }
  }
}
console.error('CMap streams: ' + cmapCount + ' / glyphs: ' + MAP.size);

function decodeHex(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  for (let i = 0; i + 3 < clean.length; i += 4) {
    const code = parseInt(clean.substr(i, 4), 16);
    const u = MAP.get(code);
    out += (u !== undefined) ? u : '�';
  }
  return out;
}

/* --- content stream を読む --- */
const lines = [];
for (const t of streams) {
  if (t.indexOf('TJ') < 0 && t.indexOf('Tj') < 0) continue;
  const re = /<[0-9a-fA-F\s]*>|\[[\s\S]*?\]|\bTJ\b|\bTj\b|\bTm\b|\bTd\b|\bTD\b|\bT\*|\bET\b/g;
  let m, pending = null, line = '';
  while ((m = re.exec(t)) !== null) {
    const tok = m[0];
    if (tok[0] === '<' || tok[0] === '[') { pending = tok; continue; }
    if (tok === 'Tj' && pending && pending[0] === '<') {
      line += decodeHex(pending);
    } else if (tok === 'TJ' && pending && pending[0] === '[') {
      const parts = pending.match(/<[0-9a-fA-F\s]*>|-?[\d.]+/g) || [];
      for (const p of parts) {
        if (p[0] === '<') line += decodeHex(p);
        else if (parseFloat(p) < -150) line += ' ';
      }
    } else if (tok === 'Tm' || tok === 'Td' || tok === 'TD' || tok === 'T*' || tok === 'ET') {
      if (line.trim()) { lines.push(line.replace(/\s+/g, ' ').trim()); line = ''; }
    }
    pending = null;
  }
  if (line.trim()) lines.push(line.replace(/\s+/g, ' ').trim());
}

const bad = lines.join('').split('�').length - 1;
console.error('lines: ' + lines.length + ' / 未対応グリフ: ' + bad);
console.log(lines.join('\n'));
