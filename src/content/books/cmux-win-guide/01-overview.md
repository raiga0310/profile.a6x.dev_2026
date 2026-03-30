---
title: "概要と設計思想"
order: 1
description: "yatamux が解決したい課題と、現行実装で採っている設計上の選択。"
---

## なぜ作ったか

Windows でも tmux 的なペイン指向の開発環境を、WSL 前提ではなくネイティブに使いたい。
その要求に対して yatamux が重視したのは、単に分割できることではなく
**CJK と IME が崩れないこと**だった。

既存のモダンなターミナルを Windows で使うと、次の問題が起こりやすい。

- **CJK 幅計算のずれ**: ConPTY やアプリ側の想定と表示幅が食い違う
- **IME の扱いの弱さ**: 変換中文字列の位置と描画が崩れる
- **半角カナ濁点や VS-16 を含む書記素**: 幅 0 / 1 / 2 の判定が難しい
- **罫線文字のフォント依存**: neovim などのボーダーが環境差で崩れる

yatamux はここを回避するために、ConPTY を PTY として使いつつ、
表示と入力は Win32 ネイティブに握る構成を採っている。

## いまの設計原則

### 1. サーバーと GUI を同一プロセスに置く

内部通信は `tokio::sync::mpsc` で完結させ、GUI と PTY 管理の間に
プロセス境界を持ち込まない。外部 CLI 連携だけを名前付きパイプ IPC に切り出す。

この構成の利点は、UI 操作時の待ち時間が少なく、実装上の責務分離も維持しやすいことだ。

### 2. Grid を中心に据える

生の PTY 出力をそのまま描かず、必ず `terminal` crate の `Grid` に反映してから描画する。
これにより次の機能が一つのデータ構造に集約される。

- CJK 幅計算
- スクロールバック
- オルタネートスクリーン
- コピーモード / 通常選択の文字列抽出
- `capture-pane` の出力生成

### 3. UI 状態は `PaneStore` に集約する

レイアウトツリー、アクティブペイン、フローティング状態、ランチャー状態、
保存プロンプト、トースト通知キューなどを `PaneStore` にまとめ、
Win32 スレッドと tokio タスクの橋渡し点を明確にしている。

### 4. 保存形式は人間が読める TOML を選ぶ

セッション復元も宣言的レイアウトも TOML にしている。
JSON より冗長さはあるが、壊れたときに手で直しやすい。

## workspace 構成

現在のリポジトリは単一 crate ではなく Cargo workspace になっている。

| crate | 役割 |
|------|------|
| `yatamux-protocol` | 共有 ID 型・メッセージ型・`PaneCapture` |
| `yatamux-terminal` | VT パーサ、Grid、文字幅計算、ConPTY ラッパー |
| `yatamux-server` | Workspace / Surface / Pane の管理、IPC サーバー |
| `yatamux-client` | Win32 ウィンドウ、GDI 描画、IME、レイアウト UI |
| `yatamux-renderer` | まだ薄いが、将来の描画分離先として確保 |
| `yatamux` | 起動、CLI、設定、ブートストラップ |

## 現時点の制限

- **Windows 専用**: ConPTY と Win32 API に依存する
- **Surface のデータモデルはあるがタブ UI は未実装**
- **描画は GDI ベース**: GPU レンダリングには移行していない
- **テーマのランタイム切り替えは色中心**: フォント変更は再起動前提
- **保存レイアウトの再構成は線形な `[[panes]]` 形式**: 複雑な木構造は保存時に表現が簡略化される

## 技術選定

- **`tokio`**: サーバーループ、PTY 入出力、IPC、ブリッジ処理を並行実行する
- **`portable-pty`**: ConPTY の生成と入出力を扱う
- **`vte`**: ANSI / VT シーケンスのステートマシン
- **`windows`**: GDI、IME、クリップボード、通知、ウィンドウ操作
- **`unicode-width` / `unicode-segmentation` / `unicode-normalization`**:
  CJK 幅計算と書記素クラスタ処理に使う
