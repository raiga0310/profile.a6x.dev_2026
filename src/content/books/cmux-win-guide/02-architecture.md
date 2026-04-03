---
title: "アーキテクチャ詳解"
order: 2
description: "workspace 化後の起動フロー、チャネル構成、IPC 形式を現行コードに沿って整理する。"
---

## 起動フロー

エントリポイントは `src/main.rs`。
`clap` で CLI サブコマンドを解釈し、GUI 起動時は `app::run()` に流れる。

```typst
#import "./_diagram.typ": accent-node, code-node, soft-node, column, row, down, rarrow, centered

#centered(column(
  accent-node("main()"),
  down(),
  row(
    column(
      soft-node("CLI サブコマンド"),
      code-node("src/cli.rs"),
    ),
    rarrow(label: "GUI 起動"),
    column(
      code-node("app::run(layout_name, app_config)"),
      down(),
      row(
        column(
          accent-node("bootstrap_runtime()"),
          down(),
          column(
            code-node("Server::new()"),
            code-node("tokio spawn", "Server::run()"),
            code-node("tokio spawn", "run_ipc_server()"),
            code-node("CreateWorkspace", "CreateSurface", "CreatePane"),
          ),
        ),
        column(
          accent-node("load_initial_layout()"),
          down(),
          column(
            soft-node("--layout <name> を適用"),
            soft-node("session.toml を復元"),
            soft-node("失敗時は単一ペイン"),
          ),
        ),
        column(
          code-node("spawn_bridge_fanout()"),
          code-node("spawn_server_bridge()"),
          code-node("spawn_blocking", "run_window"),
        ),
      ),
    ),
  ),
))
```

`bootstrap_runtime()` が最初の Workspace / Surface / Pane を作り、
その後でレイアウト復元や宣言的レイアウト適用を行うのが現在の流れだ。

## コンポーネント境界

### サーバー側

- `yatamux-server::Server`
- `Workspace` / `Surface` / `PaneTree`
- `Pane` ごとの PTY タスク
- 名前付きパイプ IPC サーバー

### クライアント側

- `run_window()` が持つ Win32 メッセージループ
- `PaneStore` に入る UI 状態
- GDI 描画・IME・通知 UI

### 中継レイヤ

現行実装で特徴的なのは `src/app/bridge.rs` の存在だ。
サーバーから来る `ServerMessage` をそのまま GUI に食わせるのではなく、
`BridgeEvent` に正規化してから次を担当する。

- `TerminalSink` への PTY 出力適用
- `PaneStore` のレイアウト更新
- 通知バックエンドへのルーティング
- フック実行
- レイアウト切り替えの段階的適用

## チャネル構成

主要チャネルは次のとおり。

| チャネル | 型 | 向き |
|---------|-----|------|
| `merged_tx` | `mpsc::Sender<ClientMessage>` | GUI / IPC / app 内部 → Server |
| `server_out_tx` | `mpsc::Sender<ServerMessage>` | Server → fan-out |
| `ipc_out_tx` | `mpsc::Sender<ServerMessage>` | fan-out → IPC クライアント |
| `bridge_rx` | `mpsc::Receiver<BridgeEvent>` | fan-out → app bridge |
| `msg_tx` | `mpsc::Sender<ClientMessage>` | Win32 → Server |
| `split_tx` | `mpsc::Sender<(PaneId, SplitDirection)>` | Win32 → bridge |
| `float_tx` | `mpsc::Sender<()>` | Win32 → bridge |
| `layout_tx` | `mpsc::Sender<String>` | Win32 → bridge |

`ServerMessage::Output.data` が `Arc<[u8]>` なのは、
IPC と GUI の両方へ同じ PTY 出力を配る fan-out でコピーを避けるためだ。

## `Server::run()` の責務

`crates/server/src/session/mod.rs` の
`Server::run()` は 1 本の `tokio::select!` で次を並行処理する。

1. `ClientMessage` の受信
2. 各 Pane からの PTY 出力
3. 各 Pane からの内部イベント

内部イベント `PaneEvent` は文字列ベースの制御メッセージではなく、
型付きイベントとして `pane.rs` と `session` の間だけで流している。

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("PaneEvent"),
  down(),
  row(
    code-node("Notification(String)"),
    code-node("Bell"),
    code-node("ProcessExited"),
    code-node("CommandFinished(Option<i32>)"),
  ),
))
```

ここから `ServerMessage::Notification` や `ServerMessage::CommandFinished` に変換する。

## `Pane` のタスク構成

`crates/server/src/pane.rs` の
1 ペインは、実質的には次の 3 つの仕事を持つ。

1. **子プロセス終了監視**
   `spawn_blocking` で `child.wait()` を待ち、終了時に `ProcessExited` を送る
2. **PTY 書き込み / リサイズ**
   `PtyCmd::Input` と `PtyCmd::Resize` を処理する
3. **PTY 読み取り / VT 適用**
   `Vec<u8>` を `vte::Parser` に流し、`Grid`・通知・タイトル・完了イベントを更新する

`Pane` は `Drop` 時に `ChildKiller` を使ってプロセスを止める。
これはテストや異常終了後に shell が孤児化するのを避けるためだ。

## IPC プロトコル

名前付きパイプは `\\.\pipe\yatamux-<session>`。
メッセージは JSON Lines で、`ClientMessage` / `ServerMessage` を
`#[serde(tag = "type", rename_all = "snake_case")]` で直列化している。

送受信例:

```json
{"type":"list_panes"}
{"type":"panes_listed","panes":[{"id":1,"surface":1,"title":"pwsh","cols":80,"rows":24}]}
```

```json
{"type":"create_pane","surface":1,"split_from":1,"direction":"vertical","size":{"cols":80,"rows":24}}
{"type":"pane_created","id":2,"surface":1,"split_from":1,"direction":"vertical"}
```

```json
{"type":"capture_pane","pane":1,"lines":50,"plain_text":true}
{"type":"pane_content","pane":1,"content":"PS C:\\Users\\raiga>","capture":{"title":"pwsh","cols":80,"rows":24,"lines_requested":50,"scrollback_len":0,"cursor":{"col":19,"row":0,"visible":true},"visible_text":["PS C:\\Users\\raiga>","",""],"scrollback_tail":[]}}
```

この `capture` フィールドが現行実装の強化点で、
CLI だけでなく AI エージェント向けの構造化読取にも使える。

## 設定ファイル

### `config.toml`

`%APPDATA%\yatamux\config.toml` は現状 2 セクション構成。

```toml
[hooks]
on_pane_created = "echo %YATAMUX_PANE_ID%"
on_pane_closed = ""

[appearance]
font_family = "HackGen Console NF"
font_size = 14
background = "#1e1e2e"
foreground = "#cdd6f4"
cursor = "#f5c2e7"
selection_bg = "#585b70"
status_bar_bg = "#181825"
```

フックは `on_pane_created` と `on_pane_closed` のみで、
実行時には `YATAMUX_PANE_ID` と `YATAMUX_SESSION` が環境変数として渡される。

### テーマファイル

テーマは `%APPDATA%\yatamux\themes\<name>.toml` に置き、
`[appearance]` の色項目だけを読み込んでランタイム適用する。
実装上、ランタイム切り替え時は `font_family` / `font_size` は無視される。

### レイアウトファイル

宣言的レイアウトは `%APPDATA%\yatamux\layouts\<name>.toml` に保存し、
`[[panes]]` の列で順次ペインを作る。

```toml
[[panes]]
command = "nvim ."

[[panes]]
split = "vertical"
command = "cargo watch -x test"
ratio = 0.6
```

## 共有状態の持ち方

共有状態は何でも `Arc<Mutex<_>>` に入れているわけではない。
役割ごとに分けている。

- `Arc<tokio::sync::Mutex<Grid>>`
  PTY 読み取りタスクとクライアント描画で共有する重い状態
- `Arc<std::sync::Mutex<Arc<str>>>`
  `Pane.title` のような軽量メタデータ
- `Arc<std::sync::Mutex<TermSize>>`
  `list-panes` が同期的に読むサイズ情報
- `Arc<Mutex<PaneStore>>`
  client crate 側の UI 状態集約

この分離のおかげで、`Grid` のような非同期更新対象と、
CLI 応答で素早く読みたいメタデータを同じロック戦略に押し込めずに済んでいる。
