---
title: "概要と設計思想"
order: 1
description: "yatamux が解決しようとした課題と、設計上の選択について。"
---

## なぜ作ったか

Windows で tmux を使いたい。ただそれだけの動機で始まった。

WSL2 経由で tmux を動かす方法はあるが、ネイティブ Windows プロセス（`cmd.exe`、`pwsh`）を
同一のターミナルで並べたいという需要があった。また、Claude Code などの AI エージェントを
複数ペインで並列実行する「オーケストレーション用途」も見据えていた。

ただし「動けばいい」では解決しない問題が実際に存在した。macOS / Linux 向けに開発されたモダンな
ターミナルアプリを Windows で使うと、以下の問題が顕在化する。

- **CJK 文字幅の誤計算**: 漢字・かな・ハングルが 1 セル幅として扱われカーソルがずれる
- **IME 未対応・不完全対応**: プリエディット文字列（変換中の文字）の表示が崩れる
- **半角カタカナ濁点（U+FF9E / U+FF9F）の誤認識**: 結合マークと見なされ幅計算が狂う
- **罫線文字のフォント依存**: neovim 等のボックスボーダーがフォントによって描画崩れを起こす

これらを Windows ネイティブの実装（ConPTY / Win32 GDI / IMM32）で根本解決するのが yatamux の出発点だ。

## シングルプロセス構成

yatamux は **シングルプロセス・インプロセス** 構成を採用している。

```
main process
+-- tokio runtime
|   +-- Server::run()        <- ペイン管理・PTY I/O
|   +-- IPC server           <- 外部 CLI 受け付け
|   \-- app.rs のルーターループ
\-- spawn_blocking
    \-- Win32 メッセージループ  <- GUI
```

外部プロセスを立ち上げず、tokio の `mpsc` チャネルで Server と GUI を直結するシンプルな構成だ。
外部 CLI（`yatamux split-pane` 等）からは Named Pipe IPC で接続できる。

## クレート分割

| クレート | 役割 |
|---------|------|
| `yatamux-protocol` | メッセージ型定義のみ |
| `yatamux-terminal` | VT パーサー・グリッド・PTY セッション・CJK 幅計算 |
| `yatamux-server` | ペイン/セッション管理 |
| `yatamux-client` | Win32 ウィンドウ・GDI レンダリング・IME |
| `yatamux-renderer` | デバッグ用テキストレンダラー（将来的に wgpu 移行予定）|

依存の方向は一方向：`yatamux-client` → `yatamux-server` → `yatamux-terminal` → `yatamux-protocol`。

## 現時点の制限

- **Windows 専用**: ConPTY API の制約により macOS / Linux では動作しない
- **マルチタブ UI 未実装**: Surface（タブ）を複数持てる設計だが、タブ切り替え UI は未実装
- **GPU レンダリング未対応**: 描画は GDI のみ（`yatamux-renderer` クレートへの wgpu 移行は将来のロードマップ）
- **スクロールバックは全画面のみ**: サブリージョン（ペイン内だけ）のスクロールは未対応

## 技術選定

- **tokio 1.50**: 非同期 I/O。PTY 読み書き・IPC・メッセージルーターを並行実行する
- **portable-pty 0.8**: ConPTY ラッパー。Windows の仮想端末を抽象化する
- **vte 0.15**: VT シーケンスパーサー。ANSI エスケープシーケンスを解釈する
- **windows 0.62**: Win32 API バインディング。GDI で描画し、IME・クリップボードを扱う
- **unicode-width / unicode-segmentation**: CJK 文字幅・書記素クラスタの計算に使用する
