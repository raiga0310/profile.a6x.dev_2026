---
title: "ペイン管理"
order: 4
description: "Pane / PaneTree / Workspace の階層構造と分割フローを解説する。"
---

## 階層構造

```
Workspace（セッション全体）
  └── Surface（タブ）
        └── PaneTree（二分木）
              ├── Leaf（Pane）
              └── Node { direction, ratio, left, right }
```

`PaneTree` はサーバー側のローカル型（`server/src/session.rs`）。クライアント側の `LayoutNode`（`client/src/layout.rs`）とは別物で、GUI 描画用の矩形計算に使う。

## Pane のライフサイクル

`Pane::spawn()` が呼ばれると以下が起動する。

1. `PtySession::spawn()` — ConPTY を開き、読み取りスレッドを起動
2. PTY 読み取りタスク — `output_rx` から受け取り `TerminalSink::feed()` でグリッド更新
3. 子プロセス終了監視タスク — `ExitWaiter::wait()` でブロック、終了時に `Notification` を送出

`Pane::Drop` で `ProcessKiller::kill()` を呼んで cmd.exe を終了させる（孤児プロセス防止。`docs/troubleshoot.md` T-03 参照）。

## ペイン操作

### キーバインド体系

yatamux のキー操作は **ノーマルモード** と **ペインモード** の2層になっている。

| モード | 入り方 | 用途 |
|--------|--------|------|
| ノーマルモード | 通常状態 | テキスト入力・直接操作 |
| ペインモード | `Ctrl+B` | ペイン管理の各操作 |
| コピーモード | ペインモード中に `V` | テキスト選択・ヤンク |

ペインモード中はステータスバーにキー一覧が表示される。

[**Ctrl+B を押してステータスバーにキー一覧が表示された状態のスクリーンショットを差し込む予定**]

**ノーマルモードの主要キーバインド:**

| キー | 動作 |
|------|------|
| `Ctrl+Shift+E` | 垂直分割（縦に並べる）|
| `Ctrl+Shift+O` | 水平分割（横に並べる）|
| `Ctrl+Shift+W` | アクティブペインを閉じる（最後の1ペインでもアプリ終了）|
| `Ctrl+→/↓/←/↑` | フォーカス移動 |
| `Ctrl+F` | フローティングペイン切り替え |
| `Ctrl+P` | テーマランチャーを開く |
| `Ctrl+B` | ペインモードへ |

**ペインモード（`Ctrl+B` 後）:**

| キー | 動作 |
|------|------|
| `E` / `O` | 垂直 / 水平分割 |
| `W` | アクティブペインを閉じる |
| `F` | フローティング切り替え |
| `X` | スクロールバックを `$EDITOR` で開く |
| `<` / `>` | ペイン幅を ±5% リサイズ |
| `L` | レイアウトランチャーを開く |
| `V` | コピーモードへ |
| `q` | ノーマルモードへ戻る |

### ペイン分割フロー

### GUI 起点（ノーマルモード: Ctrl+Shift+E/O、またはペインモード: Ctrl+B → E/O）

```
Win32 WndProc
  → split_tx.send((active_pane_id, direction))
  → app.rs の select! ループが受信
  → ClientMessage::CreatePane { split_from: Some(id), .. } を Server へ
  → Server が Pane::spawn() して ServerMessage::PaneCreated を返す
  → app.rs がレイアウトツリーに分割を反映（pending キューで照合）
```

### IPC CLI 起点（yatamux split-pane）

```
yatamux split-pane --target <id> --direction horizontal
  → Named Pipe 経由で ClientMessage::CreatePane
  → ServerMessage::PaneCreated { split_from: Some(id), direction: Some(dir) }
  → app.rs の PaneCreated ハンドラ（else 節）でレイアウトに追加
```

IPC 起点の場合は `split_from` / `direction` が確定しているため、GUI 起点の pending キュー照合とは別パスで処理する。

### フローティングペイン

[**Ctrl+F でペインがウィンドウ中央にオーバーレイ表示されている状態のスクリーンショットを差し込む予定**]

`Ctrl+F` で `float_tx` 経由のフローティング切り替えを要求する。`PaneStore.floating: Option<PaneId>` が設定されると、`compute_rects()` がそのペインをウィンドウ中央の固定サイズ矩形に配置する。`floating_visible: bool` で表示/非表示をトグルする。

### コピーモード

ペインモードで `V` を押すとコピーモードへ遷移する。

| キー | 動作 |
|------|------|
| `h/j/k/l` または矢印 | カーソル移動 |
| `v` | 選択開始 / 解除 |
| `y` または `Enter` | 選択範囲をクリップボードへ、コピーモード終了 |
| `q` または `Esc` | コピーモード終了 |

また、左ドラッグによるマウス選択も対応しており、ドラッグ終了時に自動的にクリップボードへコピーされる。

## 設定・永続化

### セッション永続化

終了時（`WM_CLOSE`）に `LayoutSnapshot` を `%APPDATA%\yatamux\session.toml` へ自動書き出しし、次回起動時にレイアウトを復元する。`LayoutNodeDef` は `LayoutNode` の serde 可能な鏡像型で、TOML にしたのは「万が一ファイルが壊れたとき人間が手で直せる形式」にしたかったからだ。JSON でも動くが、ネストした構造を目で追うには TOML の方が読みやすい。

`session.toml` が破損または存在しない場合は無視してデフォルトレイアウト（1ペイン）で起動する。

`YATAMUX_CONFIG_DIR` 環境変数でパスをオーバーライドでき、テスト時に本番設定を汚さずに済む。

### 宣言的レイアウト・コマンド保存

`%APPDATA%\yatamux\layouts\<name>.toml` に保存した宣言的レイアウトは、`Ctrl+B` → `L` のランチャーから適用できる。

`Ctrl+B` → `S` でレイアウトを TOML に保存するとき、レイアウトファイルから適用したコマンド（`cargo watch` 等）も `command = "..."` フィールドとして引き継がれる。手動で入力したコマンドは対象外。

```toml
# 保存例: 左ペインで cargo watch、右ペインは入力待ち
[[panes]]
command = "cargo watch"

[[panes]]
split = "vertical"
```

再適用するとコマンドが自動実行されるため、開発環境をワンキーで復元できる。
