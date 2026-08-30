/* tmpl.html（聞き取れなかった英文ページ）を、動詞パターン用に作り替える。
   読み上げ・発音チェック・伏字・記録のしくみはそのまま使い、
   見出しと1件の組み立てだけを差し替える。 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
let s = fs.readFileSync(path.join(here, 'tmpl.html'), 'utf8');

function rep(name, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error('FAIL ' + name + ': matched ' + n); process.exit(1); }
  s = s.replace(from, to);
  console.log('ok  ' + name);
}

/* ---------- タイトル ---------- */
rep('title',
  '<title>聞き取れなかった英文 — 音読と発音チェック</title>',
  '<title>動詞の文型リファレンス — 例文の音読と発音チェック</title>');

rep('header', `<header class="top">
  <h1>聞き取れなかった英文</h1>
  <p>ラジオ英会話2026 のスタディファイルで「全然聞こえない」と印を付けた文だけを集めたページ。<strong id="totalN"></strong></p>
</header>`,
`<header class="top">
  <h1>動詞の文型リファレンス</h1>
  <p>S+V+O+C / V 構文をとる動詞を、意味・使う場面・例文つきで1語ずつ。例文はそのまま音読と発音チェックにかけられます。<strong id="totalN"></strong></p>
</header>`);

/* ---------- 使い方 ---------- */
rep('howto-1',
  '<li><strong>スピーカーの印で聞く。</strong>端末の読み上げ音声です。<strong>ゆっくり</strong>は口の形をなぞる用、<strong>ふつう</strong>は覚える用、<strong>はやい</strong>は本来の速さに近く聞き取りの練習用。聞き取れなかった文なので、まず「はやい」で聞いて、分からなければ「ゆっくり」に落として音を確かめるのが順序です。</li>',
  '<li><strong>スピーカーの印で例文を聞く。</strong>端末の読み上げ音声です。<strong>ゆっくり</strong>は口の形をなぞる用、<strong>ふつう</strong>は覚える用、<strong>はやい</strong>は本来の速さに近く聞き取りの練習用。文型は口が覚えるまで繰り返すのが早いので、「ふつう」で音読を重ねてください。</li>');

rep('howto-mask',
  '<li><strong>英文を「隠す」にすると、伏字になります。</strong>文字を見てしまうと聞き取れた気になるので、聞き取りの練習はこちらで。語の数と長さ、句読点だけ残してあるので、何語の文かは分かります。答え合わせはカードの<strong>「英文を見る」</strong>、または発音チェックを実行すると自動で開きます。開いたあとに<strong>「英文を隠す」</strong>で1件ずつ閉じ直せるので、同じ文をもう一度音だけで確かめられます。設定は次に開いたときも残ります。</li>',
  '<li><strong>英文を「隠す」にすると、伏字になります。</strong>動詞の意味と「使う場面」は残るので、<strong>それを手がかりに例文を自分で作る</strong>練習になります。語の数と長さ、句読点だけ残してあるので、何語の文かは分かります。答え合わせはカードの<strong>「英文を見る」</strong>、または発音チェックを実行すると自動で開きます。開いたあとに<strong>「英文を隠す」</strong>で1件ずつ閉じ直せます。設定は次に開いたときも残ります。</li>');

rep('howto-ja',
  '<li><strong>日本語訳も同じように隠せます。</strong>ツールバーの<strong>訳</strong>で全体を切り替え、カードの<strong>「訳を見る／訳を隠す」</strong>で1件ずつ。英文とは<strong>別々に</strong>効くので、「英文は隠す・訳は見せる」（意味を知ったうえで英語を作る）や、両方隠して純粋な聞き取りに、といった使い分けができます。</li>',
  '<li><strong>例文の訳も同じように隠せます。</strong>ツールバーの<strong>訳</strong>で全体を切り替え、カードの<strong>「訳を見る／訳を隠す」</strong>で1件ずつ。英文とは<strong>別々に</strong>効きます。動詞の意味と「使う場面」は隠れません。これは答えではなく、引くための情報だからです。</li>');

/* ---------- フッター ---------- */
rep('footer', `  出典: <code>ラジオ英会話_2026.xlsx</code> の 2026年度_main-part シートで「（全然聞こえない）」と印を付けた箇所。
  Main part（教科書の正しい英文）と各回のキーフレーズ行から抽出しています。
  聞き取りメモ（Main part without repeat）は誤字を含む書き取りのため、練習対象から外しています。
  <br><strong>日本語訳は教科書の訳例ではなく、英文から起こした参考訳です。</strong>意味をつかむ目的で付けています。正式な訳はテキストを参照してください。`,
`  出典: <code>verb_patterns_reference-v4.pdf</code>「英語の文型リファレンス：S+V+O+C / V 構文」。
  カテゴリ・動詞・日本語訳・使う場面・例文とその訳を、PDFからそのまま起こしています。
  <br>ページの読み上げ・発音チェックのしくみは<a href="index.html">聞き取れなかった英文</a>のページと同じものです。`);

/* ---------- 空表示 ---------- */
rep('empty',
  '<p class="empty" id="empty" hidden>この条件に当てはまる文はありません。</p>',
  '<p class="empty" id="empty" hidden>この条件に当てはまる動詞はありません。</p>');

/* ---------- カードのCSSを足す ---------- */
rep('css', `  /* ---------- 語をクリックしてそこから聞く ---------- */`,
`  /* ---------- 動詞の見出し ---------- */
  .v-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
  .v-word {
    font-family: var(--font-en); font-size: 1.45rem; font-weight: 700;
    color: var(--accent); letter-spacing: .01em;
  }
  .v-cat {
    font-size: .72rem; padding: 2px 9px; border-radius: 999px;
    background: var(--accent-tint); color: var(--accent);
  }
  .v-mean { margin: 0 0 6px; font-size: 1rem; font-weight: 700; }
  .v-note {
    margin: 0 0 10px; font-size: .86rem; color: var(--muted); line-height: 1.7;
    padding-left: 10px; border-left: 2px solid var(--rule-soft);
  }
  .v-note b { color: var(--amber); font-weight: 700; }
  .ex-label {
    display: inline-block; font-size: .68rem; letter-spacing: .1em;
    color: var(--faint); margin-bottom: 2px;
  }

  /* ---------- 語をクリックしてそこから聞く ---------- */`);

/* ---------- 1件の組み立て ---------- */
rep('buildItem-head', `    var el = document.createElement('article');
    el.className = 'item';
    el.dataset.id = item.id;
    el.dataset.ep = item.ep;
`,
`    var el = document.createElement('article');
    el.className = 'item';
    el.dataset.id = item.id;
    el.dataset.ep = item.sec;

    var vh = document.createElement('div');
    vh.className = 'v-head';
    var vw = document.createElement('span');
    vw.className = 'v-word';
    vw.textContent = item.verb;
    vh.appendChild(vw);
    if (item.cat) {
      var vc = document.createElement('span');
      vc.className = 'v-cat';
      vc.textContent = item.cat;
      vh.appendChild(vc);
    }
    el.appendChild(vh);

    var vm = document.createElement('p');
    vm.className = 'v-mean';
    vm.textContent = item.mean;
    el.appendChild(vm);

    if (item.note) {
      var vn = document.createElement('p');
      vn.className = 'v-note';
      vn.innerHTML = '<b>使う場面</b>　' + esc(item.note);
      el.appendChild(vn);
    }

    var exl = document.createElement('span');
    exl.className = 'ex-label';
    exl.textContent = 'EXAMPLE';
    el.appendChild(exl);
`);

/* note は「使う場面」として上に出したので、下の ※メモ と ctx は要らない */
rep('drop-ctx-memo', `    if (item.ctx) {
      var c = document.createElement('p');
      c.className = 'ctx';
      c.textContent = item.ctx;
      el.appendChild(c);
    }
    if (item.note) {
      var m = document.createElement('p');
      m.className = 'memo';
      m.textContent = '※ ' + item.note;
      el.appendChild(m);
    }
`, '');

/* ---------- 見出しなどの文言 ---------- */
rep('hint-text', `    hint.textContent = seekable
      ? '語を押すと、そこから読み上げます。'
      : 'この項目は語ごとの頭出しに対応していません。';`,
`    hint.textContent = seekable
      ? '語を押すと、そこから読み上げます。'
      : 'この例文は語ごとの頭出しに対応していません。';`);

/* ---------- まとめかたを「回」から「セクション＋カテゴリ」へ ---------- */
const oldGroup = s.slice(s.indexOf('  /* データを回ごとにまとめる */'),
                         s.indexOf('  var first = document.createElement(\'option\');'));
if (!oldGroup) { console.error('FAIL grouping block'); process.exit(1); }
const newGroup = `  /* データをセクション → カテゴリ の順にまとめる */
  var groups = [], bySec = {};
  for (var i = 0; i < DATA.length; i++) {
    var d = DATA[i];
    d.id = 'v' + i;
    d.say = d.en;
    d.tok = tokens(d.say);
    if (!bySec[d.sec]) {
      bySec[d.sec] = { sec: d.sec, title: d.secTitle, desc: d.secDesc, cats: [], byCat: {} };
      groups.push(bySec[d.sec]);
    }
    var g = bySec[d.sec];
    if (!g.byCat[d.cat]) { g.byCat[d.cat] = { cat: d.cat, items: [] }; g.cats.push(g.byCat[d.cat]); }
    g.byCat[d.cat].items.push(d);
  }
  groups.sort(function (a, b) { return a.sec - b.sec; });

  document.getElementById('totalN').textContent =
    DATA.length + ' 語 / ' + groups.length + ' 構文';

  for (var gi = 0; gi < groups.length; gi++) {
    var grp = groups[gi];
    var sec = document.createElement('section');
    sec.className = 'ep';
    sec.id = 'sec' + grp.sec;
    sec.dataset.ep = grp.sec;

    var head = document.createElement('div');
    head.className = 'ep-head';
    var no = document.createElement('span');
    no.className = 'ep-no';
    no.textContent = grp.sec + '.';
    head.appendChild(no);
    var th = document.createElement('span');
    th.className = 'ep-theme';
    th.textContent = grp.title;
    head.appendChild(th);
    var cnt = document.createElement('span');
    cnt.className = 'ep-count';
    var total = 0;
    for (var ci = 0; ci < grp.cats.length; ci++) total += grp.cats[ci].items.length;
    cnt.textContent = total + ' 語';
    head.appendChild(cnt);
    sec.appendChild(head);

    if (grp.desc) {
      var dsc = document.createElement('p');
      dsc.className = 'sec-desc';
      dsc.textContent = grp.desc;
      sec.appendChild(dsc);
    }

    var og = document.createElement('optgroup');
    og.label = grp.sec + '. ' + grp.title;

    for (var c = 0; c < grp.cats.length; c++) {
      var cg = grp.cats[c];
      var cid = 'sec' + grp.sec + '-cat' + c;
      var ch = document.createElement('h3');
      ch.className = 'cat-head';
      ch.id = cid;
      ch.textContent = cg.cat + '  （' + cg.items.length + '語）';
      sec.appendChild(ch);
      for (var n = 0; n < cg.items.length; n++) sec.appendChild(buildItem(cg.items[n]));

      var op2 = document.createElement('option');
      op2.value = cid;
      op2.textContent = '　' + cg.cat + ' (' + cg.items.length + ')';
      og.appendChild(op2);
    }

    listEl.appendChild(sec);
    jumpEl.appendChild(og);
  }

`;
s = s.replace(oldGroup, newGroup);
console.log('ok  グループ化をセクション＋カテゴリへ');

/* jump の先頭 option 文言 */
rep('jump-first', "  first.textContent = '回へ移動…';", "  first.textContent = 'カテゴリへ移動…';");

/* セクション説明とカテゴリ見出しのCSS */
rep('css-sec', `  .ep-count { margin-left: auto; font-size: .76rem; color: var(--faint); font-variant-numeric: tabular-nums; }`,
`  .ep-count { margin-left: auto; font-size: .76rem; color: var(--faint); font-variant-numeric: tabular-nums; }
  .sec-desc { margin: 0 0 14px; font-size: .88rem; color: var(--muted); }
  .cat-head {
    margin: 20px 0 8px; font-size: .82rem; font-weight: 700; color: var(--amber);
    letter-spacing: .04em; scroll-margin-top: 64px;
  }`);

/* 記録の保存先を分ける。同じ origin なので、そのままだと
   聞き取りページの記録まで「通過」に数えてしまう。
   伏字の設定と端末の同時実行可否は、共有のままでよい。 */
rep('store-key', "  var KEY = 'english-powerup-v1';", "  var KEY = 'english-powerup-verbs-v1';");

/* 集計の文言 */
rep('tally', "      '　／　通過 ' + countOk() + ' / ' + DATA.length;",
             "      '　／　通過 ' + countOk() + ' / ' + DATA.length + ' 語';");

fs.writeFileSync(path.join(here, 'tmpl-verbs.html'), s, 'utf8');
console.log('tmpl-verbs.html を書きました: ' + Buffer.byteLength(s, 'utf8') + ' bytes');
