/* しゃべって英語 共通部品（speak.html と speak-stats.html で使う）
   ・記録は端末のブラウザ内（IndexedDB）にだけ保存する。外には送らない
   ・集計は1日ごと。終わった日は記録が変わらない限り作り直さない */
'use strict';
var SpeakLib = (function () {

  /* ---------------- 保存（IndexedDB） ---------------- */
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('speak-eikaiwa', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('utt')) d.createObjectStore('utt', { keyPath: 'id', autoIncrement: true }).createIndex('day', 'day');
        if (!d.objectStoreNames.contains('daily')) d.createObjectStore('daily', { keyPath: 'day' });
        if (!d.objectStoreNames.contains('speakers')) d.createObjectStore('speakers', { keyPath: 'id' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), q = fn(t.objectStore(store)), out;
        if (q) q.onsuccess = function () { out = q.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var put = function (st, o) { return tx(st, 'readwrite', function (s) { return s.put(o); }); };
  var get = function (st, k) { return tx(st, 'readonly', function (s) { return s.get(k); }); };
  var del = function (st, k) { return tx(st, 'readwrite', function (s) { return s.delete(k); }); };
  var all = function (st) { return tx(st, 'readonly', function (s) { return s.getAll(); }); };
  var byDay = function (day) { return tx('utt', 'readonly', function (s) { return s.index('day').getAll(day); }); };

  function dayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------------- 英語の単語 ---------------- */
  var STOP = {};
  ('a an the and or but so if then than that this these those there here it its it\'s i i\'m i\'ve i\'ll i\'d me my mine myself you you\'re you\'ve you\'ll you\'d your yours yourself ' +
   'he he\'s him his she she\'s her hers we we\'re we\'ve we\'ll our ours us they they\'re they\'ve their them what what\'s which who whom whose when where why how ' +
   'is am are was were be been being do does did done doing have has had having will would shall should can could may might must ' +
   'not no don\'t doesn\'t didn\'t isn\'t aren\'t wasn\'t weren\'t won\'t wouldn\'t can\'t couldn\'t shouldn\'t haven\'t hasn\'t that\'s let\'s ' +
   'to of in on at by for with from up down out about into over under again also just very too much many more most some any all each every ' +
   'as because while until after before through during off only own same such both few other another one yes oh ok okay well really').split(' ').forEach(function (w) { STOP[w] = 1; });

  function enTokens(s) { return (String(s || '').toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)?/g)) || []; }
  function wordBase(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 3 && /[^su']s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }

  /* ---------------- イディオム・決まり文句 ----------------
     A / B / ~ / sb / sth / someone / something は「好きな語が1〜3語入る」、one's は所有格、oneself は再帰代名詞 */
  var COMMON = [
    'look forward to', 'take care of', 'find out', 'figure out', 'come up with', 'get along with', 'give up', 'pick up', 'look for', 'look up',
    'look after', 'look like', 'feel like', 'sound like', 'turn on', 'turn off', 'by the way', 'of course', 'as soon as possible', 'at least',
    'in fact', 'a lot of', 'kind of', 'sort of', 'make sure', 'make sense', 'take a break', 'take a look', 'on time', 'in time', 'right now',
    'for a while', 'used to', 'be about to', 'be supposed to', 'have to', 'had better', 'would like to', 'how about', 'what about', 'it depends',
    'no problem', 'never mind', 'let me know', 'keep in mind', 'get ready', 'get used to', 'run out of', 'catch up', 'check in', 'check out',
    'hang out', 'set up', 'show up', 'work out', 'go ahead', 'go on', 'carry on', 'put off', 'call off', 'come back', 'get back', 'get up',
    'wake up', 'sit down', 'calm down', 'slow down', 'hurry up', 'cheer up', 'so far', 'after all', 'in the end', 'at first', 'for example',
    'such as', 'as well', 'as usual', 'on the other hand', 'in my opinion', 'i think so', "i'm not sure", 'thank you for', 'excuse me',
    'take your time', "it's up to you", "what's up", 'nice to meet you', 'see you', 'a little bit', 'each other', 'be good at', 'be interested in',
    'be afraid of', 'be worried about', 'be able to', 'be going to', 'in order to', 'because of', 'instead of', 'according to', 'thanks to',
    'due to', 'as long as', 'even if', 'even though', 'no matter', 'all the time', 'from now on', 'once in a while', 'at the moment', 'on the way',
    'by oneself', "on one's own", 'make a decision', 'make a mistake', "do one's best", 'pay attention to', 'take part in', 'take place',
    'get in touch', 'keep in touch', 'take it easy', 'not at all', 'you know', 'i mean', 'as far as', 'more or less', 'sooner or later',
    'little by little', 'one by one', 'at all', 'in a hurry', 'on purpose', 'by mistake', 'come true', 'get lost', 'get married', 'get tired',
    'take a seat', 'make friends with', 'have a good time', 'have fun', 'how long', 'how much', 'how many', 'what time', 'is it okay if'
  ];
  var IRR = {
    be: 'am is are was were been being', have: 'has had having', do: 'does did done doing', go: 'goes went gone going', get: 'gets got gotten getting',
    make: 'makes made making', take: 'takes took taken taking', come: 'comes came coming', give: 'gives gave given giving', keep: 'keeps kept keeping',
    find: 'finds found finding', run: 'runs ran running', put: 'puts putting', set: 'sets setting', let: 'lets letting', hold: 'holds held holding',
    break: 'breaks broke broken breaking', bring: 'brings brought bringing', think: 'thinks thought thinking', feel: 'feels felt feeling',
    sit: 'sits sat sitting', see: 'sees saw seen seeing', say: 'says said saying', tell: 'tells told telling', pay: 'pays paid paying',
    hang: 'hangs hung hanging', catch: 'catches caught catching', wake: 'wakes woke woken waking', show: 'shows showed shown showing',
    stop: 'stops stopped stopping', plan: 'plans planned planning', shop: 'shops shopped shopping'
  };
  function forms(w) {
    if (IRR[w]) return [w].concat(IRR[w].split(' '));
    if (!/^[a-z]{3,}$/.test(w)) return [w];
    var f = [w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing'];
    if (/e$/.test(w)) f.push(w.slice(0, -1) + 'ing');
    if (/[^aeiou]y$/.test(w)) f.push(w.slice(0, -1) + 'ies', w.slice(0, -1) + 'ied');
    return f;
  }
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  /* 大文字の A / B（先頭以外）は「何か入る」の印。小文字の a は冠詞のまま */
  var PH = /^(A|B|~)$/;
  function compile(text, src, meaning) {
    var raw = String(text).replace(/[’‘]/g, "'").replace(/[.,!?;:"()]/g, ' ').replace(/[〜～]/g, ' ~ ').trim();
    var orig = raw.split(/\s+/).filter(Boolean); if (orig.length < 2 || orig.length > 8) return null;
    var toks = orig.map(function (t) { return t.toLowerCase(); });
    var lit = 0, re = '';
    toks.forEach(function (t, i) {
      var o = orig[i];
      if ((PH.test(o) && !(i === 0 && /^[AB]$/.test(o))) || (/^(sb|sth|someone|something|somebody)$/.test(t))) { re += "(?:[a-z0-9']+ ){1,3}"; return; }
      if (t === "one's") { re += "(?:my|your|his|her|its|our|their|one's) "; lit++; return; }
      if (t === 'oneself') { re += '(?:myself|yourself|himself|herself|itself|ourselves|yourselves|themselves|oneself) '; lit++; return; }
      var f = i === 0 ? forms(t) : [t];
      re += (f.length > 1 ? '(?:' + f.map(esc).join('|') + ')' : esc(t)) + ' '; lit++;
    });
    if (lit < 2) return null;
    return { key: src + ':' + toks.join(' '), label: text, src: src, meaning: meaning || '', re: new RegExp('(?:^|(?<= ))' + re) };
  }
  /* ラジオ英会話の「知らなかったイディオム」（idioms.html と同じデータ）。読めなければ前回分を使う */
  var RADIO_URL = 'https://script.google.com/macros/s/AKfycbzkCIdC6N_U6qZYhR07t2buQtzO96BQoO5wqlan7Wy3n2W4n_AhZtZOcVh4u7jyLli1/exec?data=unknown';
  function loadRadio() {
    var cached = null; try { cached = JSON.parse(localStorage.getItem('speak.radioIdioms') || 'null'); } catch (e) {}
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch(RADIO_URL, ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json(); }).then(function (d) {
      clearTimeout(to);
      var rows = (d.rows || []).filter(function (r) { return r.idiom && r.word; }).map(function (r) { return [r.word, r.meaning || '']; });
      try { localStorage.setItem('speak.radioIdioms', JSON.stringify(rows)); } catch (e) {}
      return rows;
    }).catch(function () { clearTimeout(to); return cached || []; });
  }
  function buildIdioms(radioRows) {
    var list = [], seen = {};
    (radioRows || []).forEach(function (r) { var c = compile(r[0], 'radio', r[1]); if (c && !seen[c.key]) { seen[c.key] = 1; list.push(c); } });
    COMMON.forEach(function (t) { var c = compile(t, 'common'); if (c && !seen[c.key]) { seen[c.key] = 1; list.push(c); } });
    return list;
  }

  /* ---------------- 日本語の言葉 ---------------- */
  var JA_STOP = {};
  'です ます でした ました ください ちょっと これ それ あれ どれ ここ そこ どこ この その あの どの こと もの ので から けど けれど でも そして それから ため よう みたい'.split(' ').forEach(function (w) { JA_STOP[w] = 1; });
  var seg = (window.Intl && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  function jaWords(s) {
    if (!seg) return [];
    var out = [];
    for (var it of seg.segment(String(s || ''))) {
      if (!it.isWordLike) continue;
      var w = it.segment;
      if (JA_STOP[w]) continue;
      if (/[一-龯々ァ-ヶーA-Za-z]/.test(w) || (/^[ぁ-ん]+$/.test(w) && w.length >= 4)) out.push(w);
    }
    return out;
  }

  /* ---------------- 集計 ---------------- */
  function top(map, n, min) { return Object.keys(map).filter(function (k) { return map[k] >= (min || 1); }).sort(function (a, b) { return map[b] - map[a] || (a < b ? -1 : 1); }).slice(0, n).map(function (k) { return [k, map[k]]; }); }
  function summarizeGroup(recs, idioms) {
    var words = {}, phr = {}, ja = {}, id = {}, idEx = {};
    recs.forEach(function (r) {
      var toks = enTokens(r.en), seenP = {};
      toks.forEach(function (w) { if (!STOP[w] && w.length > 1) { var b = wordBase(w); words[b] = (words[b] || 0) + 1; } });
      for (var n = 2; n <= 4; n++) for (var i = 0; i + n <= toks.length; i++) {
        var g = toks.slice(i, i + n);
        if (g.every(function (w) { return STOP[w]; })) continue;
        if (/^(a|an|the|and|or|but|so)$/.test(g[0]) || /^(a|an|the|and|or|but|so|my|your)$/.test(g[n - 1])) continue;
        var p = g.join(' '); if (seenP[p]) continue; seenP[p] = 1; phr[p] = (phr[p] || 0) + 1;
      }
      jaWords(r.ja).forEach(function (w) { ja[w] = (ja[w] || 0) + 1; });
      var norm = toks.join(' ') + ' ';
      idioms.forEach(function (d) {
        if (!d.re.test(norm)) return;
        id[d.key] = (id[d.key] || 0) + 1;
        var ex = idEx[d.key] || (idEx[d.key] = { label: d.label, src: d.src, meaning: d.meaning, ex: [] });
        if (ex.ex.length < 2) ex.ex.push([r.en, r.ja]);
      });
    });
    /* 長いフレーズに含まれて回数も同じ短いフレーズは省く */
    var ph = top(phr, 60, 2), keep = ph.filter(function (a) { return !ph.some(function (b) { return b[0] !== a[0] && b[1] === a[1] && (' ' + b[0] + ' ').indexOf(' ' + a[0] + ' ') >= 0; }); });
    return {
      n: recs.length,
      words: top(words, 40), phrases: keep.slice(0, 25), ja: top(ja, 40),
      idioms: top(id, 40).map(function (a) { var e = idEx[a[0]]; return { key: a[0], label: e.label, src: e.src, meaning: e.meaning, n: a[1], ex: e.ex }; })
    };
  }
  function summarizeDay(day, recs, idioms) {
    var groups = { '*': summarizeGroup(recs, idioms) }, by = {};
    recs.forEach(function (r) { var k = r.sp || '?'; (by[k] = by[k] || []).push(r); });
    Object.keys(by).forEach(function (k) { groups[k] = summarizeGroup(by[k], idioms); });
    return { day: day, at: Date.now(), sig: signature(recs), groups: groups };
  }
  function signature(recs) { var m = 0; recs.forEach(function (r) { m = Math.max(m, r.up || r.ts || 0); }); return recs.length + ':' + m; }

  /* 終わった日の集計を（なければ・記録が変わっていれば）作る。今日の分は force のときだけ */
  function ensureDaily(idioms, forceToday) {
    var today = dayKey();
    return Promise.all([all('utt'), all('daily')]).then(function (res) {
      var by = {}, have = {};
      res[0].forEach(function (r) { (by[r.day] = by[r.day] || []).push(r); });
      res[1].forEach(function (d) { have[d.day] = d; });
      var jobs = [];
      Object.keys(by).forEach(function (day) {
        if (day === today && !forceToday) return;
        var h = have[day];
        if (h && h.sig === signature(by[day])) return;
        jobs.push(put('daily', summarizeDay(day, by[day], idioms)));
      });
      Object.keys(have).forEach(function (day) { if (!by[day]) jobs.push(del('daily', day)); });   /* 記録を消した日 */
      return Promise.all(jobs).then(function () { return all('daily'); });
    });
  }

  /* 複数日・複数グループの集計を足し合わせる */
  function merge(list) {
    var out = { n: 0 }, acc = { words: {}, phrases: {}, ja: {} }, id = {};
    list.forEach(function (g) {
      if (!g) return; out.n += g.n;
      ['words', 'phrases', 'ja'].forEach(function (k) { g[k].forEach(function (a) { acc[k][a[0]] = (acc[k][a[0]] || 0) + a[1]; }); });
      g.idioms.forEach(function (d) { var x = id[d.key] || (id[d.key] = { key: d.key, label: d.label, src: d.src, meaning: d.meaning, n: 0, ex: [] }); x.n += d.n; d.ex.forEach(function (e) { if (x.ex.length < 2) x.ex.push(e); }); });
    });
    out.words = top(acc.words, 40); out.phrases = top(acc.phrases, 25, 2); out.ja = top(acc.ja, 40);
    out.idioms = Object.keys(id).map(function (k) { return id[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 40);
    return out;
  }

  var COLORS = ['#2E6FBF', '#C0582E', '#2E8F5A', '#8A4FBF', '#B8862E', '#2E8F8F', '#BF2E6F', '#5F6570'];

  return {
    put: put, get: get, del: del, all: all, byDay: byDay, dayKey: dayKey,
    loadRadio: loadRadio, buildIdioms: buildIdioms, ensureDaily: ensureDaily, merge: merge, summarizeDay: summarizeDay,
    enTokens: enTokens, jaWords: jaWords, COLORS: COLORS
  };
})();
