/* 生成したページのスクリプトを、最小限のDOM代役で実際に走らせて確かめる */
const fs = require('fs');
const vm = require('vm');

const PAGE = require('path').join(__dirname, '..', 'verbs.html');
const html = fs.readFileSync(PAGE, 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const dataBlock = blocks[0], ttsBlock = blocks[1], recBlock = blocks[2];

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  console.log((cond ? 'pass ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || '')));
  cond ? pass++ : fail++;
}

/* ---------- DOM 代役 ---------- */
function El(tag) {
  return {
    nodeType: 1, tagName: tag || 'div', className: '', innerHTML: '', textContent: '',
    hidden: false, dataset: {}, childNodes: [], _handlers: {}, _attrs: {}, style: {},
    disabled: false, value: '', type: '',
    classList: {
      _o: null,
      add(...c) { const s = new Set(String(this._o.className).split(/\s+/).filter(Boolean)); c.forEach(x => s.add(x)); this._o.className = [...s].join(' '); },
      remove(...c) { const s = new Set(String(this._o.className).split(/\s+/).filter(Boolean)); c.forEach(x => s.delete(x)); this._o.className = [...s].join(' '); },
      contains(c) { return (' ' + this._o.className + ' ').indexOf(' ' + c + ' ') >= 0; },
    },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
    addEventListener(t, h) { this._handlers[t] = h; },
    appendChild(c) { this.childNodes.push(c); c.parentNode = this; return c; },
    insertBefore(c) { this.childNodes.unshift(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); return c; },
    get firstChild() { return this.childNodes[0] || null; },
    querySelector(sel) { return descend(this, sel)[0] || null; },
    querySelectorAll(sel) { return descend(this, sel); },
  };
}
function mk(tag) { const e = El(tag); e.classList._o = e; return e; }

function matches(el, sel) {
  const notHidden = /:not\(\[hidden\]\)$/.test(sel);
  const cls = sel.replace(/:not\(\[hidden\]\)$/, '').replace(/^\./, '');
  const has = (' ' + el.className + ' ').indexOf(' ' + cls + ' ') >= 0;
  return has && (!notHidden || !el.hidden);
}
function descend(root, sel) {
  const out = [];
  (function walk(n) {
    for (const c of n.childNodes || []) {
      if (matches(c, sel)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}

/* ---------- 認識・録音の代役 ---------- */
function FakeSR() { this.lang = ''; }
FakeSR.prototype.start = function () { FakeSR.last = this; };
FakeSR.prototype.stop = function () {};
FakeSR.prototype.abort = function () {};

function FakeMR() { this.state = 'recording'; }
FakeMR.prototype.start = function () {};
FakeMR.prototype.stop = function () {
  this.state = 'inactive';
  if (this.ondataavailable) this.ondataavailable({ data: { size: 42, type: 'audio/webm' } });
  if (this.onstop) this.onstop();
};

function boot(opts) {
  opts = opts || {};
  const store = opts.store || {};
  const calls = { getUserMedia: 0, stopMicCheck: 0 };
  const ids = {};
  for (const id of ['vstat', 'vhelp', 'rhelp', 'tally', 'list', 'empty', 'jump', 'totalN',
                    'flt-a', 'flt-t', 'flt-x', 'spd-s', 'spd-n', 'spd-f',
                    'msk-on', 'msk-off', 'jam-on', 'jam-off']) ids[id] = mk('div');
  const body = mk('body');

  const stopped = [];
  const fakeStream = { getTracks: () => [{ stop: () => stopped.push(1) }] };

  const spoken = [];
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Object, Array, String, Number, RegExp, Set,
    location: { protocol: 'https:' },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
    Blob: function (p, o) { this.parts = p; this.type = o && o.type; },
    Audio: function () { return { play() {}, pause() {}, currentTime: 0 }; },
    navigator: opts.media
      ? { mediaDevices: { getUserMedia: () => { calls.getUserMedia++; return Promise.resolve(fakeStream); } } }
      : { mediaDevices: null },
    MediaRecorder: opts.media ? FakeMR : undefined,
    document: {
      body: body,
      getElementById: (id) => ids[id] || null,
      createElement: (t) => mk(t),
    },
  };
  sandbox.window = {
    SpeechRecognition: FakeSR,
    speechSynthesis: { getVoices: () => [{ name: 'Google US English', lang: 'en-US' }],
                       cancel() {}, speak(u) { spoken.push(u); } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: k => { delete store[k]; },
    },
    matchMedia: () => ({ matches: !!opts.coarse }),
    addEventListener() {},
    __stopMicCheck: () => { calls.stopMicCheck++; },
  };
  sandbox.window.document = sandbox.document;
  sandbox.window.MediaRecorder = sandbox.MediaRecorder;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.SpeechSynthesisUtterance = function (t) { this.text = t; };

  vm.createContext(sandbox);
  vm.runInContext(dataBlock, sandbox);
  vm.runInContext(ttsBlock, sandbox);
  vm.runInContext(recBlock, sandbox);

  return { sandbox, ids, calls, store, stopped, body, spoken };
}

/* class 名は語単位で見る。部分一致だと mask-on が jamask-on にも当たる */
function hasClass(el, name) {
  return (' ' + String(el.className) + ' ').indexOf(' ' + name + ' ') >= 0;
}

/* 本物の DOM なら親の textContent が子を連結する。代役は連結しないので自前で */
function textOf(node) {
  if (!node) return '';
  if (!node.childNodes || !node.childNodes.length) return node.textContent || '';
  return node.childNodes.map(textOf).join('');
}
function maskTextOf(el) {
  const m = el.querySelector('.mask');
  return m ? textOf(m) : '(なし)';
}

/* ================= テスト ================= */

console.log('=== 組み立て ===');
const b = boot({});
const items = b.ids.list.querySelectorAll('.item');
const secs = b.ids.list.querySelectorAll('.ep');
ok('91語すべてカードになる', items.length === 91, 'got ' + items.length);
ok('3構文ぶんの節ができる', secs.length === 3, 'got ' + secs.length);
ok('件数表示が入る', /91 語 \/ 3 構文/.test(b.ids.totalN.textContent), b.ids.totalN.textContent);
ok('カテゴリのジャンプ先がある', b.ids.jump.childNodes.length === 4, 'got ' + b.ids.jump.childNodes.length);
ok('動詞・意味・使う場面がカードに出る', (function () {
  const c = b.ids.list.querySelectorAll('.item')[0];
  return textOf(c.querySelector('.v-word')) === b.sandbox.DATA[0].verb &&
         textOf(c.querySelector('.v-mean')) === b.sandbox.DATA[0].mean &&
         c.querySelector('.v-note') !== null;
})());
ok('使う場面が二重に出ない', b.ids.list.querySelectorAll('.memo').length === 0,
   'got ' + b.ids.list.querySelectorAll('.memo').length);
ok('カテゴリ見出しが16個できる', b.ids.list.querySelectorAll('.cat-head').length === 16,
   'got ' + b.ids.list.querySelectorAll('.cat-head').length);

/* 1件目のカードで判定を回す */
function cardFor(bt, idx) {
  const it = bt.ids.list.querySelectorAll('.item')[idx];
  return {
    el: it,
    speak: it.querySelector('.speak'),
    back: it.querySelector('.back'),
    rec: it.querySelector('.rec'),
    reveal: it.querySelector('.reveal'),
    mask: it.querySelector('.mask'),
    en: it.querySelector('.en'),
  };
}
function outText(el) {
  const o = el.querySelector('.rec-out');
  return o ? o.innerHTML.replace(/<[^>]*>/g, '') : '';
}
function outClass(el) {
  const o = el.querySelector('.rec-out');
  return o ? o.className.replace('rec-out', '').trim() : '(none)';
}
function fire(card, transcripts, opts) {
  opts = opts || {};
  card.rec._handlers.click();
  const rec = FakeSR.last;
  if (transcripts) {
    const results = transcripts.map(t => {
      const r = [{ transcript: t }]; r.isFinal = true; r.length = 1; return r;
    });
    results.resultIndex = 0;
    rec.onresult({ resultIndex: 0, results });
  }
  if (opts.error) rec.onerror({ error: opts.error });
  rec.onend();
}

console.log('');
console.log('=== 判定（英語）===');
{
  const t = boot({});
  const c = cardFor(t, 0);
  const target = t.sandbox.DATA[0].say;
  fire(c, [target]);
  ok('そのまま言えば ○', outClass(c.el) === 'ok', outClass(c.el) + ' / ' + outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, [t.sandbox.DATA[0].say.toLowerCase().replace(/[.,!?]/g, '') + ' you know']);
  ok('前後に語が付いても ○', outClass(c.el) === 'ok', outClass(c.el) + ' / ' + outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, ['what']);
  ok('まるで別の語なら ×', outClass(c.el) === 'ng', outClass(c.el) + ' / ' + outText(c.el));
  ok('何と聞こえたかを必ず出す', /聞こえた/.test(outText(c.el)), outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  const words = t.sandbox.DATA[0].say.split(/\s+/);
  fire(c, [words.slice(0, Math.max(1, words.length - 1)).join(' ')]);
  const cl = outClass(c.el);
  ok('1語落とすと ○ 以外になる', cl === 'near' || cl === 'ng', cl + ' / ' + outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  /* 第1候補が外れ、第2候補が正解 */
  c.rec._handlers.click();
  const rec = FakeSR.last;
  const r = [{ transcript: 'totally wrong sentence here' }, { transcript: t.sandbox.DATA[0].say }];
  r.isFinal = true; r.length = 2;
  rec.onresult({ resultIndex: 0, results: [r] });
  rec.onend();
  ok('候補の中に正解があれば拾う', outClass(c.el) === 'ok', outClass(c.el) + ' / ' + outText(c.el));
}

console.log('');
console.log('=== 記録 ===');
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, [t.sandbox.DATA[0].say]);
  const saved = JSON.parse(t.store['english-powerup-verbs-v1'] || '{}');
  const keys = Object.keys(saved);
  ok('結果が localStorage に残る', keys.length === 1 && saved[keys[0]].r === 'ok', JSON.stringify(saved));
  ok('カードに印が付く', /done-ok/.test(c.el.className), c.el.className);
  ok('チップが更新される', /通じた/.test(c.el.querySelector('.chip').textContent), c.el.querySelector('.chip').textContent);
}
{
  /* 保存済みの状態で開き直すと印が復元される */
  const t0 = boot({});
  const id0 = t0.sandbox.DATA[0].id;
  const t = boot({ store: { 'english-powerup-verbs-v1': JSON.stringify({ [id0]: { r: 'ok', t: 1 } }) } });
  const c = cardFor(t, 0);
  ok('開き直しても印が残る', /done-ok/.test(c.el.className), c.el.className);
}

console.log('');
console.log('=== 絞り込み ===');
{
  const t0 = boot({});
  const store = {};
  const ids = t0.sandbox.DATA.slice(0, 5).map(d => d.id);
  const rec = {}; ids.forEach(i => rec[i] = { r: 'ok', t: 1 });
  store['english-powerup-verbs-v1'] = JSON.stringify(rec);
  const t = boot({ store });
  t.ids['flt-t']._handlers.click();
  const visible = t.ids.list.querySelectorAll('.item').filter(x => !x.hidden).length;
  ok('未クリアで絞ると通過ぶんが消える', visible === 91 - 5, 'got ' + visible);
  t.ids['flt-a']._handlers.click();
  const all = t.ids.list.querySelectorAll('.item').filter(x => !x.hidden).length;
  ok('すべてに戻すと全部出る', all === 91, 'got ' + all);
}

console.log('');
console.log('=== スマホ：録音と認識の同時実行をやめる ===');
{
  const t = boot({ coarse: true, media: true });
  const c = cardFor(t, 0);
  c.rec._handlers.click();
  ok('スマホでは getUserMedia を呼ばない', t.calls.getUserMedia === 0, 'got ' + t.calls.getUserMedia);
  ok('マイク確認が開いていれば閉じる', t.calls.stopMicCheck === 1, 'got ' + t.calls.stopMicCheck);
  const rec = FakeSR.last;
  const r = [{ transcript: t.sandbox.DATA[0].say }]; r.isFinal = true; r.length = 1;
  rec.onresult({ resultIndex: 0, results: [r] });
  rec.onend();
  ok('判定は出る', outClass(c.el) === 'ok', outClass(c.el));
  const labels = [];
  (function walk(n) { for (const x of n.childNodes || []) { if (x.textContent) labels.push(x.textContent); walk(x); } })(c.el.querySelector('.rec-out'));
  ok('録って聞き比べるボタンが出る', labels.some(x => x.indexOf('録って聞き比べる') >= 0), labels.join('|'));
}
{
  const t = boot({ media: true, store: { 'english-powerup-dual': 'ok' }, coarse: true });
  const c = cardFor(t, 0);
  c.rec._handlers.click();
  ok('同時に使えると分かっていれば録音する', t.calls.getUserMedia === 1, 'got ' + t.calls.getUserMedia);
}

console.log('');
console.log('=== 判定が返らないときに黙って消さない ===');
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, null);
  ok('無言で終わっても理由を出す', /何も返しませんでした/.test(outText(c.el)), outText(c.el));
  ok('端末側の原因を案内する', /音声入力/.test(outText(c.el)), outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, null, { error: 'network' });
  ok('通信エラーはそう言う', /認識サーバー/.test(outText(c.el)), outText(c.el));
}
{
  const t = boot({});
  const c = cardFor(t, 0);
  fire(c, null, { error: 'no-speech' });
  ok('no-speech は聞き取れなかったと出す', /聞き取れませんでした/.test(outText(c.el)), outText(c.el));
}

console.log('');
console.log('=== 長い文でも途中で切れない ===');
{
  const t = boot({});
  const longIdx = t.sandbox.DATA.reduce((best, d, i, a) => d.say.length > a[best].say.length ? i : best, 0);
  const idxInList = longIdx;
  const c = cardFor(t, idxInList);
  const target = t.sandbox.DATA[idxInList].say;
  /* 認識が3回に分けて確定を返す */
  const words = target.split(/\s+/);
  const third = Math.ceil(words.length / 3);
  c.rec._handlers.click();
  const rec = FakeSR.last;
  for (let i = 0; i < 3; i++) {
    const seg = words.slice(i * third, (i + 1) * third).join(' ');
    if (!seg) continue;
    const r = [{ transcript: seg }]; r.isFinal = true; r.length = 1;
    rec.onresult({ resultIndex: 0, results: [r] });
  }
  rec.onend();
  ok('分割して返っても繋いで ○ になる', outClass(c.el) === 'ok', outClass(c.el) + ' / ' + outText(c.el).slice(0, 120));
}

console.log('');
console.log('=== 英文を隠す ===');
{
  const t = boot({});
  const c = cardFor(t, 0);
  ok('既定は見せる', !/mask-on/.test(t.body.className), t.body.className);
  t.ids['msk-on']._handlers.click();
  ok('隠すを押すと body に印が付く', /mask-on/.test(t.body.className), t.body.className);
  ok('隠す設定が保存される', t.store['english-powerup-mask'] === '1', t.store['english-powerup-mask']);

  const en = t.sandbox.DATA[0].en;
  const m = maskTextOf(c.el);
  ok('伏字は英字を潰す', !/[A-Za-z]/.test(m), m);
  ok('伏字は長さを保つ', m.length === en.length, m.length + ' vs ' + en.length);
  ok('伏字は語の区切りを残す',
     m.split(' ').length === en.split(' ').length, m);
}
{
  /* 保存済みの設定で開き直すと隠れた状態で始まる */
  const t = boot({ store: { 'english-powerup-mask': '1' } });
  ok('開き直しても隠れたまま', /mask-on/.test(t.body.className), t.body.className);
}
{
  const t = boot({ store: { 'english-powerup-mask': '1' } });
  const c = cardFor(t, 0);
  const btns = [];
  (function walk(n) { for (const x of n.childNodes || []) { if (x._handlers.click) btns.push(x); walk(x); } })(c.el);
  const rv = btns.find(b => /英文を見る/.test(b.innerHTML || ''));
  ok('英文を見るボタンがある', !!rv);
  ok('隠すぶんのラベルも持っている', /英文を隠す/.test(rv.innerHTML), rv.innerHTML);
  rv._handlers.click();
  ok('押すとそのカードだけ開く', /revealed/.test(c.el.className), c.el.className);
  const other = cardFor(t, 1);
  ok('他のカードは隠れたまま', !/revealed/.test(other.el.className), other.el.className);
  rv._handlers.click();
  ok('もう一度押すと閉じ直せる', !/revealed/.test(c.el.className), c.el.className);
  rv._handlers.click();
  ok('さらに押せばまた開く', /revealed/.test(c.el.className), c.el.className);
}
{
  /* 判定で自動的に開いたあとも、手で閉じ直せる */
  const t = boot({ store: { 'english-powerup-mask': '1' } });
  const c = cardFor(t, 0);
  fire(c, [t.sandbox.DATA[0].say]);
  const btns = [];
  (function walk(n) { for (const x of n.childNodes || []) { if (x._handlers.click) btns.push(x); walk(x); } })(c.el);
  const rv = btns.find(b => /英文を見る/.test(b.innerHTML || ''));
  ok('判定後は開いている', /revealed/.test(c.el.className), c.el.className);
  rv._handlers.click();
  ok('判定後でも閉じ直せる', !/revealed/.test(c.el.className), c.el.className);
}
{
  const t = boot({ store: { 'english-powerup-mask': '1' } });
  const c = cardFor(t, 0);
  fire(c, [t.sandbox.DATA[0].say]);
  ok('判定を出すと自動で開く', /revealed/.test(c.el.className), c.el.className);
}
{
  const t = boot({ store: { 'english-powerup-mask': '1' } });
  const c = cardFor(t, 0);
  c.el.classList.add('revealed');
  t.ids['msk-off']._handlers.click();
  t.ids['msk-on']._handlers.click();
  ok('隠すに戻すと開いたぶんも閉じ直す', !/revealed/.test(c.el.className), c.el.className);
}

console.log('');
/* 8語以上ある例文を選ぶ。短い文だと3語戻す動きが確かめられない */
const LONG = b.sandbox.DATA.findIndex(d => d.en.split(/\s+/).length >= 8);
if (LONG < 0) { console.error('8語以上の例文がありません'); process.exit(1); }
console.log('=== 途中から・少し戻して聞く ===');
{
  const t = boot({});
  const c = cardFor(t, LONG);
  const words = t.sandbox.DATA[LONG].say.split(/\s+/);

  c.speak._handlers.click();
  ok('聞くは頭から読む', t.spoken[0].text === words.join(' '), t.spoken[0].text);

  /* 語を押すとそこから */
  const spans = c.en.childNodes.filter(n => n.dataset && n.dataset.i !== undefined);
  ok('語ごとに span ができる', spans.length === words.length, spans.length + ' vs ' + words.length);
  c.en._handlers.click({ target: spans[3] });
  ok('4語目を押すとそこから読む',
     t.spoken[t.spoken.length - 1].text === words.slice(3).join(' '),
     t.spoken[t.spoken.length - 1].text);

  /* 伏字のほうを押しても同じ */
  const mspans = c.mask.childNodes.filter(n => n.dataset && n.dataset.i !== undefined);
  ok('伏字も語ごとに分かれる', mspans.length === words.length, '' + mspans.length);
  c.mask._handlers.click({ target: mspans[2] });
  ok('伏字を押してもそこから読む',
     t.spoken[t.spoken.length - 1].text === words.slice(2).join(' '),
     t.spoken[t.spoken.length - 1].text);
}
{
  const t = boot({});
  const c = cardFor(t, LONG);
  const words = t.sandbox.DATA[LONG].say.split(/\s+/);

  c.speak._handlers.click();
  const u = t.spoken[t.spoken.length - 1];
  /* 6語目まで読んだところ、と認識器に伝える */
  let charIndex = 0;
  for (let i = 0; i < 6; i++) charIndex += words[i].length + 1;
  u.onboundary({ charIndex });

  c.back._handlers.click();
  ok('少し戻るは3語ぶん戻る',
     t.spoken[t.spoken.length - 1].text === words.slice(3).join(' '),
     t.spoken[t.spoken.length - 1].text);
}
{
  const t = boot({});
  const c = cardFor(t, LONG);
  const words = t.sandbox.DATA[LONG].say.split(/\s+/);
  c.speak._handlers.click();
  t.spoken[t.spoken.length - 1].onend();
  c.back._handlers.click();
  ok('読み終わってから押すと最後の3語を繰り返す',
     t.spoken[t.spoken.length - 1].text === words.slice(words.length - 4).join(' '),
     t.spoken[t.spoken.length - 1].text);
}
{
  const t = boot({});
  const c = cardFor(t, LONG);
  const words = t.sandbox.DATA[LONG].say.split(/\s+/);
  c.speak._handlers.click();
  const u = t.spoken[t.spoken.length - 1];
  let ci = 0;
  for (let i = 0; i < 2; i++) ci += words[i].length + 1;
  u.onboundary({ charIndex: ci });
  const now = c.el.querySelectorAll('.w').filter(w => /now/.test(w.className));
  ok('読み上げ中の語に目印が付く（英文と伏字の両方）', now.length === 2, 'got ' + now.length);
  ok('目印は3語目に付く', now.every(w => String(w.dataset.i) === '2'), now.map(w => w.dataset.i).join(','));
  u.onend();
  const after = c.el.querySelectorAll('.w').filter(w => /now/.test(w.className));
  ok('読み終わると目印が消える', after.length === 0, 'got ' + after.length);
}
{
  const t = boot({});
  const c = cardFor(t, LONG);
  c.speak._handlers.click();
  const before = t.spoken.length;
  c.speak._handlers.click();
  ok('読み上げ中にもう一度押すと止まる（読み直さない）', t.spoken.length === before, '' + (t.spoken.length - before));
}
{
  /* 動詞ページは表示と読み上げが常に同じなので、全件で語クリックが効く */
  const t = boot({});
  const noSeek = t.ids.list.querySelectorAll('.item').filter(x => /no-seek/.test(x.className)).length;
  ok('全件で語ごとの頭出しが効く', noSeek === 0, 'got ' + noSeek);
}

console.log('');
console.log('=== 日本語訳 ===');
{
  const t = boot({});
  const withJa = t.sandbox.DATA.filter(d => d.ja && d.ja.trim()).length;
  ok('全語に例文の訳が付く', withJa === 91, 'got ' + withJa);

  const c = cardFor(t, 0);
  ok('訳がカードに入る', textOf(c.el.querySelector('.ja')) === t.sandbox.DATA[0].ja,
     textOf(c.el.querySelector('.ja')));

  const jm = textOf(c.el.querySelector('.ja-mask'));
  ok('訳の伏字がある', jm.length > 0);
  ok('訳の伏字は文字を残さない', !/[ぁ-んァ-ヶ一-龥A-Za-z]/.test(jm), jm);
  ok('訳の伏字は長さを保つ', jm.length === t.sandbox.DATA[0].ja.length,
     jm.length + ' vs ' + t.sandbox.DATA[0].ja.length);
}
{
  const t = boot({});
  ok('訳は既定で見せる', !/jamask-on/.test(t.body.className), t.body.className);
  t.ids['jam-on']._handlers.click();
  ok('訳を隠すと body に印が付く', /jamask-on/.test(t.body.className), t.body.className);
  ok('訳の設定が保存される', t.store['english-powerup-jamask'] === '1', t.store['english-powerup-jamask']);
  ok('英文の設定は巻き込まれない', !hasClass(t.body, 'mask-on'), t.body.className);
}
{
  const t = boot({ store: { 'english-powerup-jamask': '1' } });
  ok('開き直しても訳は隠れたまま', /jamask-on/.test(t.body.className), t.body.className);
  const c = cardFor(t, 0);
  const btns = [];
  (function walk(n) { for (const x of n.childNodes || []) { if (x._handlers.click) btns.push(x); walk(x); } })(c.el);
  const rj = btns.find(b => /訳を見る/.test(b.innerHTML || ''));
  ok('訳を見るボタンがある', !!rj);
  ok('訳を隠すぶんのラベルも持つ', /訳を隠す/.test(rj.innerHTML), rj.innerHTML);
  rj._handlers.click();
  ok('押すとそのカードの訳だけ開く', /ja-revealed/.test(c.el.className), c.el.className);
  ok('英文側は開かない', !/(^|\s)revealed(\s|$)/.test(c.el.className), c.el.className);
  rj._handlers.click();
  ok('もう一度押すと訳を閉じ直せる', !/ja-revealed/.test(c.el.className), c.el.className);
}
{
  /* 英文と訳は別々に効く */
  const t = boot({ store: { 'english-powerup-mask': '1', 'english-powerup-jamask': '1' } });
  ok('両方隠せる', hasClass(t.body, 'mask-on') && hasClass(t.body, 'jamask-on'), t.body.className);
  t.ids['msk-off']._handlers.click();
  ok('英文だけ見せても訳は隠れたまま',
     !hasClass(t.body, 'mask-on') && hasClass(t.body, 'jamask-on'), t.body.className);
}
{
  /* 判定は英文だけ開き、訳は開かない */
  const t = boot({ store: { 'english-powerup-mask': '1', 'english-powerup-jamask': '1' } });
  const c = cardFor(t, 0);
  fire(c, [t.sandbox.DATA[0].say]);
  ok('判定で英文は開く', /(^|\s)revealed(\s|$)/.test(c.el.className), c.el.className);
  ok('判定で訳は開かない', !/ja-revealed/.test(c.el.className), c.el.className);
}
{
  const t = boot({ store: { 'english-powerup-jamask': '1' } });
  const c = cardFor(t, 0);
  c.el.classList.add('ja-revealed');
  t.ids['jam-off']._handlers.click();
  t.ids['jam-on']._handlers.click();
  ok('隠すに戻すと開いた訳も閉じ直す', !/ja-revealed/.test(c.el.className), c.el.className);
}

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
