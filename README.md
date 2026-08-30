# English PowerUp

英語の音読・発音チェック用のページ。どちらも1ファイルで完結し、外部への通信はブラウザ内蔵の音声認識のみ。

| ページ | 中身 |
|---|---|
| **[聞き取れなかった英文](https://manzai1983-ja.github.io/english-powerup/)** | NHKラジオ英会話2026で「（全然聞こえない）」と印を付けた **277文 / 76回ぶん** |
| **[動詞の文型リファレンス](https://manzai1983-ja.github.io/english-powerup/verbs.html)** | S+V+O+C / V 構文をとる **91語 / 3構文 / 16カテゴリ**。意味・使う場面・例文つき |

読み上げ・発音チェック・録音・伏字・記録のしくみは2つで共通（`build/tmpl.html`）。

## できること

| | |
|---|---|
| 読み上げ | 端末の音声で。ゆっくり／ふつう／はやいの3段階 |
| 頭出し | 文中の語を押すとそこから読み直す。「◀ 少し戻る」で3語ぶん戻る |
| 発音チェック | 何と聞き取られたかと、通らなかった語を返す |
| 録音・聞き比べ | 「▶ 自分の声」と「▶ お手本」を交互に |
| 伏字 | 英文と日本語訳を別々に隠せる。全体切り替えと1件ずつの切り替え |
| 記録 | ○△×が端末に残る。「未クリア」「要練習」で絞り込み |
| マイク確認 | 入力レベルの棒。認識が通らないときの切り分け用 |

## 使うときの注意

- **発音チェックにはHTTPSが必要**。上の公開URLか `http://localhost` から開くこと。
  ファイルを直接開いた `file://` では、ブラウザがマイクの許可を出せない。
  読み上げ・訳・伏字・記録は `file://` でも動く。
- 音声認識は**通信が必要**。オフラインでは動かない。
- スマホでは**録音と音声認識を同時に使えない**ため、マイクを認識に譲る。
  自分の声は判定のあとの「録って聞き比べる」で録る。
- 記録はブラウザごと。パソコンとスマホで別々になる。
- **日本語訳は教科書の訳例ではなく、英文から起こした参考訳**。

## 作り直しかた（動詞ページ）

出典は `build/verb_patterns_reference-v4.pdf`。PDFはサブセットフォントの16進文字列で
書かれているので、ToUnicode CMap でグリフ番号を戻してからテキストにする。

```
node build/pdf-text.js build/verb_patterns_reference-v4.pdf > build/vp.txt
node build/verbs-parse.js build/vp.txt   # → build/verbs.json
node build/build-verbs.js                # → verbs.html（テンプレートも作り直す）
node build/test-verbs.js                 # 78件
```

`build/tmpl-verbs.html` は `build/tmpl.html` から `make-tmpl-verbs.js` が毎回作る生成物なので
コミットしない。**ページの見た目や機能に手を入れるときは `build/tmpl.html` を編集する** —
2つのページ両方に反映される。

## 作り直しかた（聞き取りページ）

元データは `C:\Users\user\Documents\ラジオ英会話_2026.xlsx`（このリポジトリには含めない）。
回を追加で転記したら、この順に流す。

```
node build/extract.js     # xlsx → build/sentences.json
node build/merge-ja.js    # ja_a.js / ja_b.js の訳を統合
node build/build.js       # tmpl.html + sentences.json → index.html
node build/test.js        # DOM代役でページを実際に動かして確認
```

`extract.js` は 2026年度_main-part シートを直接読む。抽出の決まりは3つ。

1. **印は直前の文に付く。** 1行に複数あれば印ごとに区切って別々の文にする。
2. 印の後ろの `※…` はメモ。**印の付いていない末尾は対象外**（そこは聞き取れている）。
3. **Main part (without repeat) は除外。** 本人の書き取りメモで誤字を含むため、
   練習対象にすると誤った英語を覚えてしまう。

新しい回の訳は `build/ja_b.js` に索引番号で足す。番号は `sentences.json` の並び順。

## ファイル

```
index.html            聞き取りページ（build.js が生成する。直接編集しない）
verbs.html            動詞ページ（build-verbs.js が生成する。直接編集しない）
build/tmpl.html       ページのテンプレート。手を入れるならここ（両ページ共通）
build/make-tmpl-verbs.js  tmpl.html を動詞ページ用に作り替える
build/pdf-text.js     PDFのテキストを ToUnicode CMap 経由で取り出す
build/verbs-parse.js  テキストを動詞1語＝1項目に構造化する
build/build-verbs.js  動詞ページを組み立てる
build/test-verbs.js   動詞ページのテスト（78件）
build/verbs.json      動詞の抽出結果
build/extract.js      xlsx から対象の英文を抜き出す
build/xl.js           xlsx を直接読むための最小実装
build/ja_a.js         参考訳 0〜137
build/ja_b.js         参考訳 138〜
build/merge-ja.js     訳を sentences.json に統合する
build/build.js        テンプレートにデータを流し込む
build/test.js         DOM の代役でページのスクリプトを実際に走らせる（78件）
build/sentences.json  抽出結果
```
