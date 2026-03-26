---
title: "アーキテクチャ詳解"
order: 2
description: "チャネル構成・クレート間の依存・起動フローを図解する。"
---

## 起動フロー

`main.rs` がエントリポイント。clap でサブコマンドを解析し、GUI モードの場合は `app::run()` へ処理を委譲する。

```
main()
  \-- app::run(config)
        +-- Server::new() -> server_out_tx, server_rx
        +-- run_ipc_server(merged_tx.clone(), ipc_out_tx)
        +-- Workspace / Surface / Pane を作成
        \-- tokio::select! ループ
              +-- server_rx -> GUI 描画更新
              +-- split_rx -> ペイン分割
              +-- float_rx -> フローティング切り替え
              \-- spawn_blocking -> Win32 メッセージループ
```

## チャネル構成

コンポーネント間はすべて `tokio::mpsc` チャネルで接続する。共有状態は `Arc<Mutex<PaneStore>>` のみ。

| チャネル | 型 | 向き |
|---------|-----|------|
| `merged_tx` | `mpsc<ClientMessage>` | GUI / IPC → Server |
| `server_out_tx` | `mpsc<ServerMessage>` | Server → fan_out |
| `server_rx` | `mpsc<ServerMessage>` | fan_out → app.rs |
| `ipc_out_rx` | `mpsc<ServerMessage>` | fan_out → IPC |
| `msg_tx` | `mpsc<ClientMessage>` | Win32 → merged_tx |
| `split_tx` | `mpsc<(PaneId, SplitDirection)>` | Win32 → app.rs |

fan_out タスクは `server_out_tx` の出力を GUI と IPC の両方へ複製する。`ServerMessage::Output.data` が `Arc<[u8]>` 型なのはコピーレス配信のため。当初は `Vec<u8>` を clone していたが、ペイン数が増えると fan_out のコピーコストが積み上がるため `Arc<[u8]>` に変更した。

## クレート依存グラフ

```
yatamux (bin)
  +-- yatamux-client
  |     \-- yatamux-server
  |           \-- yatamux-terminal
  |                 \-- yatamux-protocol
  \-- yatamux-server (直接依存、IPC サーバー起動)
```

依存は一方向。`yatamux-terminal` は Win32 依存を持たず、単体テストが書きやすい。

## Server の処理ループ

`Server::run()` は単一の `tokio::select!` で以下を並行処理する。

1. `ClientMessage` 受信 → `handle_client_message()` へ委譲
2. 各 Pane の `pane_output_rx` → `ServerMessage::Output` としてファンアウト
3. `client_notification_rx` → `ServerMessage::Notification` に変換

`handle_client_message` 内で `Mutex` をロックするため、`tokio::sync::Mutex` ではなく `std::sync::Mutex` を使う。`tokio::sync::Mutex` を使った実装を試みたが、`lock().await` のホールド中に `select!` が他タスクを処理できず PTY タスクがグリッドロックを持ったままブロックするデッドロックが発生した。原因特定に半日かかった教訓として `docs/troubleshoot.md` T-01 に記録している。

## IPC プロトコル

Named Pipe `\\.\pipe\yatamux-{session}` を使用。メッセージは JSON 改行区切り（`serde_json` + `\n`）。

```
CLI → Pipe → IPC サーバー → merged_tx → Server
Server → server_out_tx → fan_out → ipc_out_tx → Pipe → CLI
```

送受信の例:

```json
// split-pane: 送信（CLI → Pipe）
{"CreatePane":{"surface":1,"split_from":2,"direction":"Horizontal","size":{"rows":24,"cols":80},"working_dir":null}}
// split-pane: 受信（Pipe → CLI）
{"PaneCreated":{"id":3,"surface":1,"split_from":2,"direction":"Horizontal"}}

// list-panes: 送信
{"ListPanes":null}
// list-panes: 受信
{"PanesListed":{"panes":[{"id":1,"title":"pwsh","size":{"rows":24,"cols":80},"surface":1},{"id":2,"title":"cmd","size":{"rows":24,"cols":80},"surface":1}]}}

// capture-pane: 送信
{"CapturePane":{"pane":1,"lines":50}}
// capture-pane: 受信
{"PaneContent":{"pane":1,"content":"PS C:\\Users\\raiga> cargo build\r\n   Compiling yatamux..."}}

// send-keys: 送信（\r は Enter キー）
{"Input":{"pane":1,"data":"cargo test\r"}}
// send-keys: 受信なし（PTY 出力は非同期に ServerMessage::Output として届く）
```

`list-panes` / `send-keys` / `capture-pane` / `split-pane` の4サブコマンドを実装する。

## フック設定

`%APPDATA%\yatamux\config.toml` の `[hooks]` セクションで、ペイン作成・終了時の外部コマンド実行を設定できる。

```toml
[hooks]
on_pane_created = "notify-send 'pane created'"
on_pane_closed  = ""
on_session_start = ""
on_session_end   = ""
```

使用できるフックは以下の4種類。コマンドが空文字列の場合は実行しない。

| フック名 | 発火タイミング |
|----------|--------------|
| `on_pane_created` | `Pane::spawn()` 完了後 |
| `on_pane_closed` | `PaneClosed` メッセージ送出後 |
| `on_session_start` | 起動時の初期ペイン生成完了後 |
| `on_session_end` | `WM_CLOSE` でセッション保存直前 |

エージェントオーケストレーションの自動化（ペイン生成時に別ツールへ通知する等）を想定した機能だ。
