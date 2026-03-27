---
title: "yatamux 技術解説"
description: "Rustで自作したWindows向けターミナルマルチプレクサ yatamux（cmux-win）の設計・実装を解説する。"
publishedAt: "2026-03-26"
tags: ["Rust", "Windows", "Terminal", "yatamux"]
draft: false
aiInvolvement:
  planning: human
  writing: ai
  review: human
  proofreading: ai
---

yatamux は Windows 向けのターミナルマルチプレクサを Rust で自作したプロジェクト。
tmux / Zellij にインスパイアされた設計を、ConPTY・Win32 API・tokio を組み合わせて実現している。

このブックでは設計思想・アーキテクチャ・各コンポーネントの実装を順を追って解説する。

**想定読者:** Rust の基本文法を読める方。Windows アプリ開発の経験は問わない。Win32 API や ConPTY など Windows 固有の概念は[付録A](./A-glossary)で都度参照できる。

## 動作環境

- **OS**: Windows 10 v1903 (Build 18362) 以降（ConPTY API の要件）
- **Rust**: 1.93.0 stable、MSVC ツールチェーン
- 主要クレート: `tokio` 1.50.0 / `vte` 0.15.0 / `portable-pty` 0.8.1 / `windows` 0.62.2

## リポジトリ

https://github.com/raiga0310/cmux-win

## 実装済み機能

**UI / 操作**
- ペイン分割（垂直・水平）・フォーカス移動
- フローティングペイン・コピーモード・スクロールバック（50,000 行）
- レイアウトランチャー・テーマランチャー（`Ctrl+P`）・トースト通知

**外観設定**
- `config.toml` の `[appearance]` でフォント・カラーを設定
- `%APPDATA%\yatamux\themes\<name>.toml` でテーマファイルを管理
- テーマランチャーでランタイム切り替え（フォント変更のみ再起動が必要）

**データ / 統合**
- セッション永続化・宣言的レイアウト（コマンド付き保存に対応）
- OSC 52 クリップボード
- IPC CLI（`list-panes` / `send-keys` / `capture-pane` / `split-pane`）
- レイアウト管理 CLI（`layout list` / `layout delete` / `layout export`）
- プラグインフック（ペイン作成・終了時のコマンド実行）

[**3ペイン分割 + トースト通知が表示された起動後の全体スクリーンショットを差し込む予定**]

## ロードマップ

- [ ] マルチタブ UI（Surface の切り替え）
- [ ] GPU レンダリング（wgpu 移行）
- [ ] WebSocket ブリッジ（ブラウザ・モバイルからの読み取り専用リモート）
- [ ] Claude Code 連携スキル（MCP サーバー）

## ビルド・起動

```powershell
git clone https://github.com/raiga0310/cmux-win
cd cmux-win
cargo install --path .
yatamux
```

開発中の起動（ログあり）:

```powershell
$env:RUST_LOG="info"; cargo run
```
