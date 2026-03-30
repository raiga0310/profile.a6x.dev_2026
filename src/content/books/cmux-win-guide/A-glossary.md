---
title: "付録A: 用語集"
order: 99
description: "本書で出てくる Win32 / VT / yatamux 固有用語の要点。"
---

本文で頻出する用語だけを、現行実装に沿って短くまとめる。

**カテゴリ別索引**

- **Win32 / Windows**: [BitBlt](#bitblt) · [ConPTY](#conpty) · [GDI](#gdi) · [IME](#ime) · [IMM32](#imm32) · [Named Pipe](#named-pipe) · [WM_CHAR / WM_KEYDOWN](#wm_char--wm_keydown) · [WM_PAINT](#wm_paint) · [WM_TIMER](#wm_timer) · [WndProc](#wndproc)
- **Rust / tokio**: [Arc](#arc) · [Arc<[u8]>](#arcu8) · [mpsc](#mpsc) · [spawn_blocking](#spawn_blocking) · [tokio::Mutex と std::sync::Mutex](#tokio::mutex-と-stdsyncmutex)
- **VT / ターミナル**: [ANSI エスケープシーケンス](#ansi-エスケープシーケンス) · [CSI](#csi) · [CJK](#cjk) · [DECAWM](#decawm) · [LCF](#lcf) · [OSC](#osc) · [OSC 52](#osc-52) · [OSC 133;D](#osc-133d) · [PTY](#pty) · [Scrollback Buffer](#scrollback-buffer) · [Continuation](#continuation)
- **yatamux 固有**: [AppearanceConfig](#appearanceconfig) · [FocusAwareBackend](#focusawarebackend) · [LayoutSnapshot](#layoutsnapshot) · [PaneCapture](#panecapture) · [PaneStore](#panestore) · [テーマファイル](#テーマファイル)

---

## Win32 / Windows

### BitBlt

GDI のビットブロック転送関数。yatamux はオフスクリーンのバックバッファに描いてから
`BitBlt` で画面へ転送し、ちらつきを抑えている。

### ConPTY

Windows の擬似端末 API。yatamux では `portable-pty` 経由で使う。
Windows 10 v1809 から存在するが、本書では安定動作前提として v1903 以降を対象にしている。

### GDI

Windows の 2D 描画 API。yatamux は GPU ではなく GDI ベースで
文字、背景、罫線、ステータスバー、ポップアップを描いている。

### IME

日本語などの入力変換機構。yatamux は `WM_IME_COMPOSITION` を受けて
プリエディット文字列を自前描画し、確定文字列だけを UTF-8 で PTY に流す。

### IMM32

IME 制御の Win32 API 群。`ImeHandler` がこれを使って、変換中文字列や候補位置を扱う。

### Named Pipe

`\\.\pipe\yatamux-default` のような Windows の IPC 機構。
CLI と実行中 GUI の間の通信に使っている。

### WM_CHAR / WM_KEYDOWN

Win32 のキー入力メッセージ。
`WM_KEYDOWN` はショートカットやモード制御、
`WM_CHAR` は通常文字の PTY 送信に使う。

### WM_PAINT

再描画要求メッセージ。yatamux ではここで `paint()` を呼び、
バックバッファを作って全 UI を描く。

### WM_TIMER

定期タイマー通知。yatamux は 16ms ごとに発火させ、
dirty 行、IME 合成中、通知表示中などを見て再描画を促す。

### WndProc

Win32 ウィンドウのメッセージハンドラ。
yatamux では `ClientState` を `GWLP_USERDATA` にぶら下げて参照している。

---

## Rust / tokio

### Arc

複数スレッドから共有するための参照カウントポインタ。
yatamux では `PaneStore` や通知キューの共有によく出てくる。

### Arc<[u8]>

共有バイト列。`ServerMessage::Output` がこれを使うのは、
同じ PTY 出力を GUI と IPC クライアントへ fan-out するときのコピー削減のため。

### mpsc

`tokio::sync::mpsc`。GUI、サーバー、IPC、bridge の間のほぼ全通信がこれ。

### spawn_blocking

ブロッキング処理を tokio から切り離して実行する仕組み。
Win32 メッセージループや `child.wait()` の監視に使っている。

### tokio::Mutex と std::sync::Mutex

現行コードでは用途で使い分けている。

- `tokio::Mutex`: `Grid` のような async 文脈で更新する重い状態
- `std::sync::Mutex`: `title` や `size` のように素早く読みたい軽量状態

---

## VT / ターミナル

### ANSI エスケープシーケンス

端末制御のためのバイト列。カーソル移動、色、消去、通知などを表す。

### CSI

`ESC [` で始まる制御シーケンス群。SGR、カーソル移動、スクロール領域設定など。

### CJK

中国語・日本語・韓国語文字の総称。
yatamux はこの幅計算と入力を第一級の要件として扱っている。

### DECAWM

自動折り返しモード。行末に達した次の文字入力で改行する。

### LCF

Last Column Flag。行末に達したが、次文字が来るまで折り返しを保留する内部フラグ。

### OSC

`ESC ]` で始まる制御シーケンス群。タイトル変更、クリップボード、通知などに使う。

### OSC 52

クリップボード書き込みシーケンス。
yatamux はこれを受けて Windows クリップボードへ反映する。

### OSC 133;D

シェルコマンド完了通知。`send-keys --wait-for-prompt` はこれを待機条件に使う。

### PTY

擬似端末。Windows では ConPTY が該当する。

### Scrollback Buffer

画面外に押し出された行を保持するバッファ。
yatamux では最大 50,000 行で、オルタネートスクリーン中は積まない。

### Continuation

全角文字の右側を埋めるダミーセル。
描画時はここをスキップすることで、1 書記素を 2 セルとして扱う。

---

## yatamux 固有

### AppearanceConfig

`%APPDATA%\yatamux\config.toml` の `[appearance]` を表す設定構造体。
背景色、前景色、カーソル色、選択色、ステータスバー色、フォント設定を持つ。

### FocusAwareBackend

フォーカス状態に応じて通知先を切り替えるバックエンド。

- フォーカス中: アプリ内トースト
- 非フォーカス: Windows バルーン通知

### LayoutSnapshot

セッション保存用のスナップショット。
`LayoutNode` そのものではなく、シリアライズ可能な `LayoutNodeDef` に変換して持つ。

### PaneCapture

`capture-pane --json` が返す構造化メタデータ。
表示テキストだけでなく、サイズ、カーソル位置、スクロールバック末尾も含む。

### PaneStore

client crate 側の UI 状態集約。
レイアウト、アクティブペイン、ランチャー、コピー状態、フローティング状態などを持つ。

### テーマファイル

`%APPDATA%\yatamux\themes\<name>.toml` に置く TOML ファイル。
ランタイム切り替え時は `[appearance]` の色項目だけが反映され、
フォント設定はその場では切り替わらない。
