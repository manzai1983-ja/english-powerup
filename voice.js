/* 声の特徴（MFCC 12個＋声の高さ）を取り、登録した人と比べる部品。speak.html と talk.html で使う
   すべて端末内で計算する（外に音は送らない） */
'use strict';
/* ============================================================
   声で人を見分ける（端末内だけで計算・無料）
     マイクの音から 0.03 秒ごとに「声の特徴」（MFCC 12個＋声の高さ）を取り、
     登録した人ごとの特徴の平均・ばらつきと比べて、いちばん近い人を選ぶ。
     声が出ている（音が大きく、高さが取れる）瞬間だけを使う。
   ============================================================ */
var Voice = (function () {
  var ctx = null, node = null, stream = null, frames = [], on = false, noise = 0.004, voicedN = 0;
  var FFT = 1024, NM = 24, NC = 12, D = NC + 1, melW = null, dct = null, spec;
  function build(sr) {
    var mel = function (f) { return 2595 * Math.log10(1 + f / 700); }, inv = function (m) { return 700 * (Math.pow(10, m / 2595) - 1); };
    var lo = mel(80), hi = mel(Math.min(7600, sr / 2 - 100)), pts = [];
    for (var i = 0; i < NM + 2; i++) pts.push(inv(lo + (hi - lo) * i / (NM + 1)) / (sr / FFT));
    melW = [];
    for (var m = 0; m < NM; m++) {
      var w = new Float32Array(FFT / 2), a = pts[m], b = pts[m + 1], c = pts[m + 2];
      for (var k = Math.floor(a); k <= Math.ceil(c) && k < FFT / 2; k++) w[k] = k < a || k > c ? 0 : (k <= b ? (k - a) / (b - a) : (c - k) / (c - b));
      melW.push(w);
    }
    dct = [];
    for (var n = 1; n <= NC; n++) { var row = new Float32Array(NM); for (var j = 0; j < NM; j++) row[j] = Math.cos(Math.PI * n * (j + 0.5) / NM); dct.push(row); }
  }
  function pitch(x, sr) {                     /* 自己相関で声の高さ（70〜400Hz）。取れなければ 0 */
    var N = x.length, minL = Math.floor(sr / 400), maxL = Math.min(Math.floor(sr / 70), N - 200), best = 0, bestL = 0;
    for (var L = minL; L <= maxL; L += 2) {
      var s = 0, e1 = 0, e2 = 0;
      for (var i = 0; i + L < N; i += 2) { s += x[i] * x[i + L]; e1 += x[i] * x[i]; e2 += x[i + L] * x[i + L]; }
      var r = s / Math.sqrt(e1 * e2 + 1e-12); if (r > best) { best = r; bestL = L; }
    }
    return best > 0.55 ? sr / bestL : 0;
  }
  /* 1024点 FFT（ハン窓）。パワースペクトルを返す */
  var fftCos = null, fftSin = null, rev = null, hann = null;
  function fftInit() {
    fftCos = new Float32Array(FFT / 2); fftSin = new Float32Array(FFT / 2); rev = new Uint16Array(FFT); hann = new Float32Array(FFT);
    for (var i = 0; i < FFT / 2; i++) { fftCos[i] = Math.cos(2 * Math.PI * i / FFT); fftSin[i] = -Math.sin(2 * Math.PI * i / FFT); }
    var bits = Math.log2(FFT); for (var j = 0; j < FFT; j++) { var r = 0; for (var b = 0; b < bits; b++) r |= ((j >> b) & 1) << (bits - 1 - b); rev[j] = r; }
    for (var k = 0; k < FFT; k++) hann[k] = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (FFT - 1));
  }
  var re = new Float32Array(FFT), im = new Float32Array(FFT);
  function power(x, out) {
    for (var i = 0; i < FFT; i++) { re[rev[i]] = x[i] * hann[i]; im[rev[i]] = 0; }
    for (var size = 2; size <= FFT; size <<= 1) {
      var half = size >> 1, step = FFT / size;
      for (var s = 0; s < FFT; s += size) for (var k = 0; k < half; k++) {
        var a = s + k, b = a + half, c = fftCos[k * step], d = fftSin[k * step];
        var tr = re[b] * c - im[b] * d, ti = re[b] * d + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    for (var m = 0; m < FFT / 2; m++) out[m] = re[m] * re[m] + im[m] * im[m];
  }
  /* 音の処理側から 1024 サンプルずつ受け取る（画面が裏に回ってもタイマーのように間引かれない） */
  var blockN = 0;
  function onBlock(x) {
    blockN++;
    if (api.onRaw) api.onRaw(x, blockN);       /* 会話記録用: 音そのもの（1024サンプルずつ全部） */
    if (!on || (blockN & 1)) return;           /* 声の特徴は1つおきで十分 */
    var e = 0; for (var i = 0; i < FFT; i++) e += x[i] * x[i];
    var rms = Math.sqrt(e / FFT);
    if (rms < noise * 2) noise = Math.max(0.0015, noise * 0.97 + rms * 0.03);   /* 周りの雑音の大きさを追う */
    if (rms < Math.max(noise * 3.5, 0.006)) return;
    var f0 = pitch(x, ctx.sampleRate); if (!f0) return;
    power(x, spec);
    var lm = new Float32Array(NM);
    for (var m = 0; m < NM; m++) { var w = melW[m], s = 0; for (var k = 0; k < FFT / 2; k++) if (w[k]) s += w[k] * spec[k]; lm[m] = Math.log(s + 1e-10); }
    var f = new Float32Array(D);
    for (var n = 0; n < NC; n++) { var c = 0; for (var j = 0; j < NM; j++) c += dct[n][j] * lm[j]; f[n] = c; }
    f[NC] = 12 * Math.log2(f0 / 100) / 3;      /* 声の高さ（半音を3で割って他と桁をそろえる） */
    f.b = blockN;                              /* どの音の塊から取ったか（話者の切れ目を探すのに使う） */
    frames.push(f); voicedN++;
    if (api.onVoiced) api.onVoiced();
    if (frames.length > 4000) frames.splice(0, 1000);
  }
  var WORKLET = "class P extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.i=0;this.k=0}" +
    "process(inp){var x=inp[0]&&inp[0][0];if(x){for(var j=0;j<x.length;j++){this.b[this.i++]=x[j];if(this.i===1024){this.port.postMessage(this.b.slice());this.i=0}}}return true}}" +
    "registerProcessor('voice-feat',P);";
  async function open() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) {} }
    spec = new Float32Array(FFT / 2); build(ctx.sampleRate); fftInit();
    var src = ctx.createMediaStreamSource(stream), sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
    if (ctx.audioWorklet) {
      var url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, 'voice-feat');
      node.port.onmessage = function (e) { onBlock(e.data); };
    } else {                                    /* 古いブラウザ向け */
      node = ctx.createScriptProcessor(1024, 1, 1);
      node.onaudioprocess = function (e) { onBlock(e.inputBuffer.getChannelData(0)); };
    }
    src.connect(node); node.connect(sink);
    return stream;
  }
  function close() { if (node) { try { node.disconnect(); } catch (e) {} node = null; } if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; if (ctx) ctx.close(); ctx = null; frames = []; }
  function take() { var f = frames; frames = []; return f; }
  function stats(fr) {
    var s = new Array(D).fill(0), q = new Array(D).fill(0);
    fr.forEach(function (f) { for (var d = 0; d < D; d++) { s[d] += f[d]; q[d] += f[d] * f[d]; } });
    var r = function (a) { return a.map(function (v) { return Math.round(v * 1000) / 1000; }); };
    return { n: fr.length, s: r(s), q: r(q) };
  }
  function model(st, pooled) {
    var mu = [], v = [];
    for (var d = 0; d < D; d++) { mu[d] = st.s[d] / st.n; var x = st.q[d] / st.n - mu[d] * mu[d]; v[d] = Math.max(0.02, 0.8 * x + 0.2 * (pooled ? pooled[d] : x)); }
    return { mu: mu, v: v };
  }
  function score(fr, md) {
    var tot = 0;
    fr.forEach(function (f) { var l = 0; for (var d = 0; d < D; d++) { var z = f[d] - md.mu[d]; l += z * z / md.v[d] + Math.log(md.v[d]); } tot += -0.5 * l; });
    return tot / fr.length;
  }
  function pooledVar(people) {
    var n = 0, s = new Array(D).fill(0), q = new Array(D).fill(0);
    people.forEach(function (p) { n += p.st.n; for (var d = 0; d < D; d++) { s[d] += p.st.s[d]; q[d] += p.st.q[d]; } });
    return n ? s.map(function (_, d) { var m = s[d] / n; return Math.max(0.02, q[d] / n - m * m); }) : null;
  }
  /* いちばん近い人。声が短すぎる・誰にも似ていないときは sp:null */
  /* force: 似ていなくても一番近い人を返す */
  function classify(fr, people, force) {
    people = people.filter(function (p) { return p.st; });
    if (fr.length < (force ? 4 : 12) || !people.length) return { sp: null, conf: 0 };
    var pv = pooledVar(people), rs = people.map(function (p) { return { p: p, s: score(fr, model(p.st, pv)) }; }).sort(function (a, b) { return b.s - a.s; });
    var best = rs[0], gap = rs.length > 1 ? best.s - rs[1].s : 9;
    if (!force && best.s < best.p.thr) return { sp: null, conf: 0, s: best.s };
    return { sp: best.p.id, conf: Math.round(Math.min(1, gap / 2) * 100) / 100, s: best.s };
  }
  /* 登録した声で「自分らしさ」の下限を決める（0.6秒ずつに区切って一番低い点より少し下） */
  function threshold(fr, st) {
    var md = model(st), lows = [];
    for (var i = 0; i + 20 <= fr.length; i += 20) lows.push(score(fr.slice(i, i + 20), md));
    lows.sort(function (a, b) { return a - b; });
    return (lows.length ? lows[0] : score(fr, md)) - 6;
  }
  function add(a, b, sign) { return { n: a.n + sign * b.n, s: a.s.map(function (v, d) { return v + sign * b.s[d]; }), q: a.q.map(function (v, d) { return v + sign * b.q[d]; }) }; }
  var api = { onVoiced: null, onRaw: null, sampleRate: function () { return ctx ? ctx.sampleRate : 48000; }, open: open, close: close, track: function () { return stream ? stream.getAudioTracks()[0] : null; }, setOn: function (b) { on = b; if (!b) frames = []; },
           take: take, voiced: function () { return voicedN; }, stats: stats, classify: classify, threshold: threshold, add: add, isOpen: function () { return !!stream; } };
  return api;
})();
