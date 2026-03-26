---
title: "レンダリングパイプライン"
order: 3
description: "VT パーサーから GDI 描画までのデータフローを追う。"
---

## データフロー概観

```
PTY 出力（バイト列）
  → TerminalSink::feed()
  → vte::Parser（VT シーケンス解釈）
  → VtProcessor::perform()
  → Grid 更新（dirty フラグ立て）
  → WM_TIMER（16ms）→ has_dirty_rows() → InvalidateRect
  → WM_PAINT → paint()
  → BitBlt（バックバッファ → フロントバッファ）
```

## Grid の構造

`Grid` は `Vec<Vec<Cell>>` の2次元バッファ。各 `Cell` は `content` と `style` の2フィールドで構成される。

```
Cell
  content: CellContent --- Grapheme { ch: String, width: u8 }  <- 通常文字（全角は width=2）
                       +-- Continuation                         <- 全角文字の右側（描画スキップ）
                       \-- Empty                                <- 空白
  style: CellStyle     --- fg, bg, bold, italic, underline, ...
```

`content` と `style` を分離しているのは、スタイルだけ変わって文字は同じというセルの差分更新をシンプルに扱えるため。

`dirty: Vec<bool>` で行単位の変更フラグを管理し、変更のない行の再描画を省く。

## VT シーケンス処理

`vte` クレートの `Perform` トレイトを `VtProcessor` に実装する。主なハンドラ:

| コールバック | 処理 |
|------------|------|
| `print(c)` | 文字をカーソル位置に書き込む |
| `execute(byte)` | CR / LF / BS / BEL 等の制御文字 |
| `csi_dispatch` | カーソル移動・消去・カラー設定 |
| `osc_dispatch` | タイトル設定・OSC 52（クリップボード）|
| `hook` / `put` | DCS シーケンス（tmux パススルー等）|

OSC 52 受信時は `clipboard_data: Option<Vec<u8>>` にデコード済みバイト列を格納し、`TerminalSink::feed()` の戻り値として呼び出し元へ返す。

## CJK 全角文字の扱い

[**他ターミナルで日本語入力中にカーソルがずれている状態（左）と yatamux で正しく揃っている状態（右）の比較スクリーンショットを差し込む予定**]

ConPTY のカーソル位置はプログラムによってずれることがある。そのため `CjkWidthConfig` で East Asian Ambiguous 幅を独自計算し、ConPTY の報告には頼らない。

全角文字は `Grapheme { width: 2 }` + `Continuation` のペアで格納する。行末での折り返しは DECAWM + LCF（Last Column Flag）で制御する。

## GDI 描画

`paint()` は以下の順序で描画する。

1. `PaneStore` を短時間ロックして `layout.compute_rects()` と `Grid` の `Arc` を取得（即座にロック解除）
2. 各ペインの `Grid` を個別にロックしてセル描画
3. 罫線文字（U+2500–259F）を `MoveToEx`/`LineTo`/`FillRect` で直描画
4. セパレーター線を描画
5. `BitBlt` でバックバッファを転送

罫線文字を GDI プリミティブで直描きするのは、フォントに任せると環境によって線幅が変わるからだ。最初は `TextOutW` で描いていたが、HackGen と Consolas でグリフの幅が異なり、ペインの仕切り線が「フォントによって太い日もあれば細い日もある」状態になった。GDI プリミティブで描けば環境に関わらず 1px 固定になる。

[**フォントによって罫線幅がバラバラになっている状態（左）と GDI 直描画で 1px 固定になっている状態（右）の比較スクリーンショットを差し込む予定**]

## フォントフォールバック

フォントは以下の優先順位で選択する。

```
HackGen Console NF -> HackGen Console -> HackGen35 Console NF
-> HackGen35 Console -> HackGen NF -> HackGen
-> Cascadia Mono -> Cascadia Code -> Consolas -> MS Gothic
```

日本語グリフを持つフォントを上位に配置し、Nerd Fonts アイコンにも対応する。
