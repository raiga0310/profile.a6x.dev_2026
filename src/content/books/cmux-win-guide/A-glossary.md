---
title: "付録A: 用語集"
order: 99
description: "本書で登場する Rust・Win32 API・VT シーケンス関連の用語を五十音順にまとめる。"
---

本書を書き終えて見返すと、Win32 API・Rust の非同期プリミティブ・VT シーケンスという、普段は別々に語られる3つの分野の用語が一冊に混在していた。「当たり前に使っている言葉」ほど説明しにくいことを実感したので、本文を読みながらつまずいた順番でまとめてみた。

**カテゴリ別索引:**

- **Win32 / Windows**: [BitBlt](#bitblt) · [ConPTY](#conpty) · [DC](#dc-device-context) · [DWMWA_USE_IMMERSIVE_DARK_MODE](#dwmwa_use_immersive_dark_mode) · [GDI](#gdi-graphics-device-interface) · [HGDIOBJ](#hgdiobj) · [IME](#ime-input-method-editor) · [IMM32](#imm32) · [InvalidateRect](#invalidaterect) · [Named Pipe](#named-pipename付きパイプ) · [WM_CHAR/WM_KEYDOWN](#wm_char--wm_keydown) · [WM_PAINT](#wm_paint) · [WM_TIMER](#wm_timer) · [WndProc](#wndprocwindow-procedure)
- **Rust / tokio**: [Arc](#arctatomic-reference-counted) · [Arc\<\[u8\]\>](#arcu8) · [Box\<dyn Trait\>](#boxdyn-trait) · [mpsc](#mpscmultiple-producer-single-consumer) · [Mutex](#mutex) · [select!](#select) · [spawn_blocking](#spawn_blocking) · [trait](#traitトレイト) · [tokio](#tokio)
- **VT / ターミナル**: [ANSIエスケープシーケンス](#ansi-エスケープシーケンス) · [CSI](#csicontrol-sequence-introducer) · [CJK](#cjkchinese-japanese-korean) · [DECAWM](#decawmdec-auto-wrap-mode) · [DCS](#dcsdevice-control-string) · [East Asian Ambiguous](#east-asian-ambiguous東アジア曖昧幅) · [LCF](#lcflast-column-flag) · [OSC](#oscoperating-system-command) · [OSC 52](#osc-52) · [PTY](#ptypseudo-terminal) · [vte](#vte--vte-クレート) · [Continuation](#continuation継続セル) · [Scrollback Buffer](#scrollback-bufferスクロールバックバッファ)
- **yatamux 固有**: [AppearanceConfig](#appearanceconfig) · [Chain of Responsibility](#chain-of-responsibility) · [テーマファイル](#テーマファイル)

---

## 1. Win32 API / Windows 固有の用語

### BitBlt

`BitBlt`（Bit Block Transfer）は GDI の描画関数で、あるデバイスコンテキスト（DC）の矩形領域を別の DC へ高速コピーする。yatamux ではバックバッファ（オフスクリーン）に描画を完成させてから `BitBlt` でフロントバッファへ転送し、ちらつきを防ぐダブルバッファリングに使用している。

### ConPTY（Console Pseudo Terminal）

Windows 10 v1809 から導入された仮想端末 API。従来の `CreateProcess` + コンソールウィンドウに代わり、入出力を通常のパイプで扱えるようにした。UNIX の `pty` に相当し、`CreatePseudoConsole` / `ResizePseudoConsole` / `ClosePseudoConsole` の3関数で操作する。yatamux では `portable-pty` クレート経由で利用する。v1809 で導入されたが不安定な箇所が多く、yatamux が動作確認している安定バージョンは **v1903 (Build 18362) 以降**（index.md の動作環境要件と対応）。

### DC（Device Context）

GDI の描画先を抽象化したハンドル。画面・プリンタ・ビットマップなど異なる出力先を同一 API で操作できる。`GetDC` / `CreateCompatibleDC` で取得し、描画後に `ReleaseDC` / `DeleteDC` で解放する。

### DWMWA_USE_IMMERSIVE_DARK_MODE

DWM（Desktop Window Manager）の属性値（番号 `20`）。`DwmSetWindowAttribute` に渡すとタイトルバーをダークテーマに切り替えられる。Windows 10 1903 以降で有効。yatamux はこれを使ってウィンドウ全体をダークに統一する。

### GDI（Graphics Device Interface）

Windows の2D描画 API。テキスト描画（`TextOutW`）、線描画（`MoveToEx` / `LineTo`）、矩形塗りつぶし（`FillRect`）、ビットマップ転送（`BitBlt`）などを提供する。yatamux のセル描画・罫線文字・カーソル描画はすべて GDI を使用する。

### HGDIOBJ

GDI オブジェクト（フォント・ペン・ブラシ等）の汎用ハンドル型。`SelectObject` / `DeleteObject` の引数型。`windows` クレート 0.62 以降では `HFONT` などの具体型から明示的に変換が必要になった。

### IME（Input Method Editor）

日本語・中国語・韓国語などの多バイト文字を入力するためのソフトウェア。物理キーの入力（ローマ字等）を文字候補に変換し確定する仕組み。Win32 では `WM_IME_COMPOSITION`・`WM_IME_STARTCOMPOSITION`・`WM_IME_ENDCOMPOSITION` などのメッセージで扱う。yatamux は `crates/client/src/ime.rs` で IMM32 API を直接操作して候補ウィンドウを制御する。

### IMM32

Windows の IME 管理 API ライブラリ。`ImmGetContext` でコンテキストを取得し、`ImmGetCompositionStringW` で変換中の文字列を読み出す。`ImmSetCandidateWindow` で候補ウィンドウの位置を指定する。

### InvalidateRect

ウィンドウの矩形領域を「再描画が必要」とマークする Win32 関数。yatamux では `WM_TIMER`（16ms）で `has_dirty_rows()` が `true` のとき `InvalidateRect` を呼び、OS に `WM_PAINT` メッセージを発行させる。

### Named Pipe（名前付きパイプ）

`\\.\pipe\<name>` という形式でアクセスできる IPC 機構。プロセス間の双方向通信に使う。yatamux では `\\.\pipe\yatamux-{session}` を作成し、外部 CLI（`yatamux split-pane` 等）が接続して JSON 改行区切りのメッセージをやりとりする。

### WM_CHAR / WM_KEYDOWN

Win32 ウィンドウへのキー入力メッセージ。`WM_KEYDOWN` は仮想キーコード（`VK_LEFT` 等）を受け取り、`WM_CHAR` は `TranslateMessage` によって変換された文字コードを受け取る。yatamux はノーマルモードでは `WM_CHAR` → PTY へ送信、`WM_KEYDOWN` で特殊キー（Ctrl 組み合わせ等）を処理する。

### WM_PAINT

ウィンドウの再描画が必要なときに OS が発行するメッセージ。`BeginPaint` / `EndPaint` で囲んだ中で GDI 描画を行う。yatamux はここで `paint()` を呼び出し、グリッドの内容を GDI でレンダリングする。

### WM_TIMER

`SetTimer` で設定した定期タイマーが発火するメッセージ。yatamux では 16ms（≈60fps）に設定し、Dirty 行があれば `InvalidateRect` を呼ぶ軽量なポーリングループとして使用する。

### WndProc（Window Procedure）

Win32 ウィンドウのメッセージハンドラ関数。`WNDCLASSW.lpfnWndProc` に登録し、OS から各種ウィンドウメッセージ（`WM_PAINT`・`WM_KEYDOWN` 等）を受け取る。`spawn_blocking` の中でブロッキング的に動作するため、tokio の非同期タスクとは `mpsc` チャネルで通信する。

---

## 2. Rust / tokio 関連の用語

### Arc（Atomic Reference Counted）

`std::sync::Arc<T>` はスレッド間で安全に共有できる参照カウントポインタ。クローンしてもデータはコピーされず参照カウントが増えるだけなので、大きなデータを複数タスクから参照するコストが低い。yatamux では `Grid` を `Arc<tokio::Mutex<Grid>>` で包んでサーバーとクライアントが共有する。

### Arc\<\[u8\]\>

`Arc<[u8]>` はバイト列のスライスを参照カウントで管理する型。`Arc<Vec<u8>>` と違いファットポインタで長さも持つ。複数の受信者に同じバイト列を配布（fan-out）するとき clone してもデータコピーが発生しないため、yatamux の `ServerMessage::Output.data` に使用している。

### Box\<dyn Trait\>

トレイトオブジェクト。コンパイル時に具体型が決まらない場合に使う動的ディスパッチのポインタ。`PtyHandle`・`ProcessKiller`・`ExitWaiter` など、本番実装とモック実装を差し替え可能にするために使用する。

### mpsc（Multiple Producer Single Consumer）

`tokio::sync::mpsc` はマルチプロデューサ・シングルコンシューマの非同期チャネル。送信側（`Sender`）は複数クローンでき、受信側（`Receiver`）は1つ。yatamux のコンポーネント間通信はほぼすべてこのチャネルを介する。

### Mutex

相互排他ロック。`std::sync::Mutex` はロック取得が即座（ブロッキング）で、`tokio::sync::Mutex` はロック取得を `.await` で待機する（非同期）。yatamux では `handle_client_message` 内では `std::sync::Mutex` を使う。理由は、`tokio::sync::Mutex` の `lock().await` を `select!` ループ内で保持すると他のブランチが実行されなくなりデッドロックが発生するため（T-01）。

### select!

`tokio::select!` マクロ。複数の非同期操作を同時に待ち、最初に完了したものを処理する。yatamux の `Server::run()` と `app.rs` のメインループはどちらも `select!` で複数のチャネル受信を並行処理している。

### spawn_blocking

CPU ブロッキングな処理を tokio のスレッドプール外で実行するための関数。Win32 メッセージループは `GetMessageW` でブロッキング待機するため、tokio の非同期スレッドで直接実行するとランタイムが詰まる。そのため yatamux は `tokio::task::spawn_blocking` に Win32 メッセージループを渡している。

### trait（トレイト）

Rust のインターフェース機構。共通の振る舞いを定義し、異なる型に実装できる。yatamux では `PtyHandle` トレイトを定義して本番実装（`PtySession`）とテスト用モック（`MockPty`）を差し替え可能にしている。`vte::Perform` トレイトを `VtProcessor` に実装することで VT シーケンスのコールバックを受け取る。

### tokio

Rust の非同期ランタイム。`async/await` の実行環境を提供し、非同期 I/O・タイマー・チャネル・タスクスポーンをまとめて提供する。yatamux はシングルプロセスで PTY 読み書き・IPC・メッセージルーティングを並行実行するために全面的に tokio を使用している。

---

## 3. VT シーケンス / ターミナル関連の用語

### ANSI エスケープシーケンス

`ESC [` で始まる制御シーケンス（CSI）を中心とした、ターミナルの表示制御プロトコル。カーソル移動・色設定・消去などを文字列として PTY に流し込む。yatamux は `vte` クレートでこれをパースし `VtProcessor` に渡す。

### CSI（Control Sequence Introducer）

`ESC [` で始まるエスケープシーケンスの総称。引数 + 終端文字の組み合わせで意味が決まる（例: `ESC [ A` = カーソル上移動）。`csi_dispatch` コールバックで処理する。

### CJK（Chinese-Japanese-Korean）

漢字・仮名・ハングルなど東アジア文字の総称。多くが全角（2セル幅）を占めるが、Unicode の East Asian Ambiguous カテゴリはフォントや設定によって幅が変わり、ターミナルとの不一致が起きやすい。yatamux は `CjkWidthConfig` でこの幅を独自計算し ConPTY の報告に頼らない。

### DECAWM（DEC Auto Wrap Mode）

`ESC [ ? 7 h` で有効になるカーソルの自動折り返しモード。行末に達した次の文字入力でカーソルが次行の先頭に移動する。折り返しのタイミングに関係する LCF（Last Column Flag）と組み合わせて制御する。

### DCS（Device Control String）

`ESC P` で始まる制御シーケンス。tmux のパススルーシーケンス（`ESC Ptmux;...ST`）など、デバイス固有のコマンドに使用される。yatamux は `hook` / `put` コールバックで受け取る。

### East Asian Ambiguous（東アジア曖昧幅）

Unicode の文字幅カテゴリ。文脈によって1セル幅にも2セル幅にもなりうる文字（例: ギリシャ文字・罫線の一部）。ターミナルエミュレータによって解釈が異なり、yatamux では `CjkWidthConfig` で独自の幅テーブルを持ち、実行環境のフォントに合わせて調整できる。

### LCF（Last Column Flag）

DECAWM 動作における内部フラグ。カーソルが行の最終列に達したとき次の文字入力まで折り返しを保留するためのフラグ。このフラグがなければ全角文字が行末に来たとき2セル目が次行に正しく収まらない。

### OSC（Operating System Command）

`ESC ]` で始まるエスケープシーケンス。ターミナルのタイトル設定（OSC 2）・クリップボード書き込み（OSC 52）・シェル統合通知（OSC 133）などに使う。yatamux は `osc_dispatch` コールバックで受け取り、OSC 52 はクリップボードへの書き込みとして処理する。

### OSC 52

SSH 越しなどリモート環境からローカルクリップボードへデータを書き込むシーケンス。`ESC ] 52 ; c ; <base64データ> BEL` の形式。yatamux は `VtProcessor` でこれを受け取り、Win32 の `SetClipboardData` でクリップボードに反映する。

### PTY（Pseudo Terminal）

疑似端末。シェルやプログラムに「本物のターミナルに接続されている」と思わせるデバイスペア（master / slave）。master 側からデータを書き込むと slave 側のプロセスが受け取り、逆も同様。Windows では ConPTY が同等の機能を提供する。

### VTE / vte クレート

VT シーケンスのステートマシンパーサーライブラリ。バイト列を入力として受け取り、`Perform` トレイトのコールバック（`print` / `execute` / `csi_dispatch` / `osc_dispatch` 等）を呼び出す。VT 解釈の状態管理を自前で実装せずに済む。

### Continuation（継続セル）

全角文字（幅2）の右側を埋めるダミーセル。`Grid` が全角文字を描画するとき左セルに `Grapheme { width: 2 }` を書き、右隣のセルに `Continuation` を置く。レンダリング時に `Continuation` をスキップすることで、全角文字が2セル分として正しく表示される。

### Scrollback Buffer（スクロールバックバッファ）

画面からはみ出た過去の出力行を保持するリングバッファ。yatamux では `ScrollbackBuffer { rows: VecDeque<Vec<Cell>>, max_rows: 50_000 }` として実装し、マウスホイールで過去の出力を遡れる。オルタネートスクリーン（vim 等）では無効化される。

---

## 4. yatamux 固有の概念

### AppearanceConfig

`%APPDATA%\yatamux\config.toml` の `[appearance]` セクションから読み込む外観設定構造体。`font_family` / `font_size` / `background` / `foreground` / `cursor` / `selection_bg` / `status_bar_bg` の各フィールドを持つ。カラー値は `"#rrggbb"` 形式の16進数文字列で指定する。未指定の場合はデフォルト（Catppuccin Mocha 配色）が使われる。

### Chain of Responsibility

責任の連鎖パターン。yatamux では `WM_KEYDOWN` のキー処理に適用しており、`dispatch_wm_keydown` が複数の `handle_*` 関数を順番に試し、最初に `KeyConsumed::Yes` を返したハンドラで処理を終了する。各ハンドラは自分が担当するモード（セーブプロンプト・ランチャー・コピーモード等）のときのみ処理し、それ以外は `KeyConsumed::No` を返して次のハンドラへ委譲する。新機能追加時に既存ハンドラへ干渉しない拡張性が利点。

### テーマファイル

`%APPDATA%\yatamux\themes\<name>.toml` に配置するカラーテーマ定義ファイル。`config.toml` の `[appearance]` と同じフォーマットで色を記述する。`Ctrl+P` のテーマランチャーで選択・適用すると色がランタイムで即座に切り替わる（フォント変更のみ再起動が必要）。
