---
title: "yatamux 技術解説"
description: "Rust で自作した Windows 向けターミナルマルチプレクサ yatamux の現行実装を追う。"
publishedAt: "2026-03-26"
tags: ["Rust", "Windows", "Terminal", "yatamux"]
draft: false
aiInvolvement:
  planning: human
  writing: ai
  review: human
  proofreading: ai
---

yatamux は Windows 向けに Rust で実装しているターミナルマルチプレクサだ。
tmux / Zellij に着想を得つつ、ConPTY・Win32 GDI・IMM32 を直接扱うことで、
Windows 上の CJK 表示と IME を優先して設計している。

このブックは、2026-03-30 時点の `../cmux-win` の実装を前提に、
workspace 構成・起動フロー・描画・ペイン管理・IPC 連携を順に解説する。

**想定読者:** Rust の基本文法を読める方。Win32 や VT シーケンスに不慣れでも読めるよう、
固有用語は[付録A](./A-glossary)にまとめている。

## 動作環境

- **OS**: Windows 10 v1903 (Build 18362) 以降
- **Rust**: stable / MSVC ツールチェーン
- 主要ライブラリ: `tokio` / `portable-pty` / `vte` / `windows` / `serde` / `toml`

## リポジトリ

- Repository: https://github.com/raiga0310/cmux-win
- Binary name: `yatamux`

リポジトリ名は `cmux-win` のままだが、アプリ本体の名称と実行ファイル名は `yatamux` で統一されている。

## 現在の実装範囲

**UI / 操作**
- ペイン分割・方向キー/Tab 系のフォーカス移動
- ペインモード、コピーモード、通常のマウス選択
- フローティングペイン、スクロールバック、`$EDITOR` での外部表示
- レイアウト保存プロンプト、レイアウトランチャー、テーマランチャー

**データ / 永続化**
- `%APPDATA%\yatamux\session.toml` へのセッション保存と起動時復元
- `%APPDATA%\yatamux\layouts\*.toml` による宣言的レイアウト
- `%APPDATA%\yatamux\themes\*.toml` によるランタイムテーマ切り替え
- `capture-pane --json` を含む IPC CLI

**統合機能**
- OSC 52 クリップボード
- OSC 9/99/777、BEL、OSC 133;D を使った通知
- `send-keys --wait-for-prompt` によるコマンド完了待機
- `[hooks] on_pane_created / on_pane_closed` による外部コマンド連携

[**3 ペイン分割 + ステータスバー + トースト通知のスクリーンショットを差し込む予定**]

## この記事で扱う構成

```text
yatamux (bin)
├── src/                     起動・CLI・設定・レイアウト復元
└── crates/
    ├── client/             Win32 ウィンドウ、GDI 描画、IME、レイアウト UI
    ├── server/             PTY ライフサイクル、セッション階層、IPC サーバー
    ├── terminal/           VT パーサ、Grid、文字幅計算、ConPTY ラッパー
    ├── protocol/           ClientMessage / ServerMessage / 共通型
    └── renderer/           将来拡張を見据えたレンダラー用 crate
```

## 現時点のロードマップ

- [ ] WebSocket ブリッジ（読み取り専用リモート監視）
- [ ] AI エージェント連携を補助する周辺ツール
- [ ] Surface を複数持てる設計を活かしたタブ UI
- [ ] GPU レンダリングへの移行検討

## ビルド・起動

```powershell
git clone https://github.com/raiga0310/cmux-win
cd cmux-win
cargo install --path .
yatamux
```

開発中にログ付きで起動する場合:

```powershell
$env:RUST_LOG="info"; cargo run
```
