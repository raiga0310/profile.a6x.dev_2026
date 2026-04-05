---
title: "Architecture in Detail"
order: 2
description: "A current-code walkthrough of the startup flow, channel topology, and IPC format after the workspace split."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [アーキテクチャ詳解](/books/cmux-win-guide/02-architecture). Some phrasing may read unnaturally.

## Startup flow

The entry point is `src/main.rs`.
`clap` parses CLI subcommands, and GUI startup eventually flows into `app::run()`.

```typst
#import "./_diagram.typ": accent-node, code-node, soft-node, column, row, down, rarrow, centered

#centered(column(
  accent-node("main()"),
  down(),
  row(
    column(
      soft-node("CLI subcommands"),
      code-node("src/cli.rs"),
    ),
    rarrow(label: "GUI startup"),
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
            soft-node("apply --layout <name>"),
            soft-node("restore session.toml"),
            soft-node("fall back to one pane on failure"),
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

`bootstrap_runtime()` creates the initial Workspace, Surface, and Pane. After that, the current implementation applies restored layouts or declarative layouts.

## Component boundaries

### Server side

- `yatamux-server::Server`
- `Workspace` / `Surface` / `PaneTree`
- PTY tasks per `Pane`
- named-pipe IPC server

### Client side

- the Win32 message loop owned by `run_window()`
- UI state stored in `PaneStore`
- GDI drawing, IME, and notification UI

### Bridge layer

One characteristic part of the current implementation is `src/app/bridge.rs`.
The GUI does not consume `ServerMessage` directly. Instead, messages are normalized into `BridgeEvent`, and then the bridge handles:

- applying PTY output into `TerminalSink`
- updating layout state in `PaneStore`
- routing to the notification backend
- running hooks
- applying layout switches in stages

## Channel layout

The main channels are:

| channel | type | direction |
|---------|------|-----------|
| `merged_tx` | `mpsc::Sender<ClientMessage>` | GUI / IPC / internal app code → Server |
| `server_out_tx` | `mpsc::Sender<ServerMessage>` | Server → fan-out |
| `ipc_out_tx` | `mpsc::Sender<ServerMessage>` | fan-out → IPC clients |
| `bridge_rx` | `mpsc::Receiver<BridgeEvent>` | fan-out → app bridge |
| `msg_tx` | `mpsc::Sender<ClientMessage>` | Win32 → Server |
| `split_tx` | `mpsc::Sender<(PaneId, SplitDirection)>` | Win32 → bridge |
| `float_tx` | `mpsc::Sender<()>` | Win32 → bridge |
| `layout_tx` | `mpsc::Sender<String>` | Win32 → bridge |

`ServerMessage::Output.data` is `Arc<[u8]>` so the same PTY output can be fanned out to both IPC and GUI without unnecessary copies.

## Responsibility of `Server::run()`

In `crates/server/src/session/mod.rs`,
`Server::run()` uses a single `tokio::select!` loop to process:

1. incoming `ClientMessage`
2. PTY output from every pane
3. internal events from every pane

The internal event type `PaneEvent` is not a stringly typed control message. It is a typed event used only between `pane.rs` and the session layer.

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

Those are later translated into outward-facing `ServerMessage::Notification`, `ServerMessage::CommandFinished`, and so on.

## Task layout inside `Pane`

In `crates/server/src/pane.rs`, each pane effectively owns three jobs:

1. **Child-process exit monitoring**
   wait for `child.wait()` inside `spawn_blocking` and send `ProcessExited`
2. **PTY writes and resizes**
   handle `PtyCmd::Input` and `PtyCmd::Resize`
3. **PTY reads and VT application**
   feed `Vec<u8>` into `vte::Parser`, then update `Grid`, notifications, title, and completion events

On drop, `Pane` uses `ChildKiller` to stop the process. This avoids leaving orphaned shells behind after tests or abnormal shutdowns.

## IPC protocol

The named pipe path is `\\.\pipe\yatamux-<session>`.
Messages are JSON Lines, with `ClientMessage` and `ServerMessage`
serialized using `#[serde(tag = "type", rename_all = "snake_case")]`.

Examples:

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

The enhanced part of the current implementation is the `capture` field, which is usable not only for CLI clients but also for structured reading by AI agents.

## Configuration files

### `config.toml`

`%APPDATA%\yatamux\config.toml` currently has two sections:

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

Only `on_pane_created` and `on_pane_closed` exist as hooks for now.
When they run, `YATAMUX_PANE_ID` and `YATAMUX_SESSION` are provided as environment variables.

### Theme files

Themes live in `%APPDATA%\yatamux\themes\<name>.toml`.
Only the color-related fields under `[appearance]` are applied at runtime.
In the current implementation, `font_family` and `font_size` are ignored during live switching.

### Layout files

Declarative layouts live in `%APPDATA%\yatamux\layouts\<name>.toml`
and create panes by processing a sequence of `[[panes]]`.

```toml
[[panes]]
command = "nvim ."

[[panes]]
split = "vertical"
command = "cargo watch -x test"
ratio = 0.6
```

## How shared state is divided

Not everything is simply thrown into one `Arc<Mutex<_>>`.
The implementation uses different strategies for different roles:

- `Arc<tokio::sync::Mutex<Grid>>`
  heavy state updated asynchronously by PTY readers and the client renderer
- `Arc<std::sync::Mutex<Arc<str>>>`
  lightweight metadata such as `Pane.title`
- `Arc<std::sync::Mutex<TermSize>>`
  size information that `list-panes` reads synchronously
- `Arc<Mutex<PaneStore>>`
  aggregated UI state on the client side

That separation avoids forcing fast metadata reads and heavy async state into the same lock strategy.
