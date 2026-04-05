---
title: "Map of Core Types and Traits"
order: 5
description: "A bird's-eye view of the main types across the workspace, aligned with the current module split."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [型・トレイト関係図](/books/cmux-win-guide/05-struct-trait-map). Some phrasing may read unnaturally.

This chapter is meant to work as a reference index for the current codebase.
The focus is on where frequently used types live, which crate owns them, and what they contain.

## Three things to keep in mind first

1. the communication boundary lives in the `protocol` crate through `ClientMessage` / `ServerMessage`
2. the rendering boundary lives in the `terminal` crate through `Grid`
3. the UI-state boundary lives in the `client` crate through `PaneStore`

If you keep just those three in mind first, the rest of the types become much easier to place.

## `yatamux-protocol`

This crate contains only the types that travel over the wire.

```text
WorkspaceId(u32)
SurfaceId(u32)
PaneId(u32)

TermSize { cols, rows }
SplitDirection { Horizontal | Vertical }

PaneInfo {
  id,
  surface,
  title,
  cols,
  rows,
}

CursorInfo {
  col,
  row,
  visible,
}

PaneCapture {
  title,
  cols,
  rows,
  lines_requested,
  scrollback_len,
  cursor,
  visible_text,
  scrollback_tail,
}
```

### `ClientMessage`

```text
CreateWorkspace { name }
CreateSurface { workspace }
CreatePane { surface, split_from, direction, size, working_dir }
Input { pane, data }
Resize { pane, size }
ClosePane { pane }
RequestScreen { pane }
Detach
ListPanes
CapturePane { pane, lines, plain_text }
```

### `ServerMessage`

```text
WorkspaceCreated { id, name }
SurfaceCreated { id, workspace }
PaneCreated { id, surface, split_from?, direction? }
Output { pane, data: Arc<[u8]> }
TitleChanged { pane, title }
Notification { pane, body }
ClipboardWrite { pane, data }
PaneClosed { pane }
CommandFinished { pane, exit_code? }
Error { message }
PanesListed { panes }
PaneContent { pane, content, capture? }
```

## `yatamux-terminal`

This is the core of terminal emulation.

```text
CjkWidthConfig

TerminalSink
  grid: Arc<Mutex<Grid>>
  parser: vte::Parser
  fn feed(&mut self, data) -> Option<Vec<u8>>

Grid
  cols / rows
  cells
  cursor: CursorPos
  dirty
  saved_main
  scroll_top / scroll_bottom
  scrollback
  width_config

CursorPos { col, row }

Cell
  content: CellContent
  style: CellStyle

CellContent
  Grapheme { text, width }
  Continuation
  Empty

CellStyle
  fg, bg, bold, italic, underline, reverse, dim ...
```

### PTY-related types

```text
PtySession
  fn spawn(size, shell, output_tx, working_dir)
  fn write(&mut self, data)
  fn resize(&mut self, size)
  fn take_child()
  fn clone_child_killer()
```

### VT-related types

```text
VtProcessor<'a>
  grid: &'a mut Grid
  current_style
  title
  notification
  clipboard_data
  command_finished
  bell
  → impl vte::Perform
```

The notable part here is that the terminal crate extracts notifications and clipboard events too, not just visible characters.

## `yatamux-server`

This crate manages the session hierarchy and the PTY lifecycle.

```text
Server
  workspaces: HashMap<WorkspaceId, Workspace>
  surfaces: HashMap<SurfaceId, Surface>
  panes: HashMap<PaneId, Pane>
  next_*_id
  width_config: CjkWidthConfig
  client_tx: Sender<ServerMessage>
  pane_output_rx / tx
  pane_event_rx / tx
```

### Session model

```text
Workspace
  id
  name: Arc<str>
  surfaces: Vec<SurfaceId>
  active_surface

Surface
  id
  workspace
  pane_tree: Option<PaneTree>
  active_pane

PaneTree
  Leaf(PaneId)
  Split { direction, ratio, first, second }
```

### Pane types

```text
Pane
  id
  grid: Arc<tokio::sync::Mutex<Grid>>
  cmd_tx: Sender<PtyCmd>
  title: Arc<std::sync::Mutex<Arc<str>>>
  size: Arc<std::sync::Mutex<TermSize>>
  child_killer

PtyCmd
  Input(Vec<u8>)
  Resize(TermSize)

PaneEvent
  Notification(String)
  Bell
  ProcessExited
  CommandFinished(Option<i32>)
```

`Pane` is an internal server-side type. It does not appear in the protocol crate.

## `yatamux-client`

This crate owns the UI and rendering logic.

### Layout-related types

```text
LayoutNode
  Leaf(PaneId)
  Split { direction, ratio, first, second }

PaneRect { x, y, w, h }
Direction { Left, Right, Up, Down }

LayoutPreview
  node: LayoutNode
  commands: Vec<Option<String>>

LauncherState
  entries: Vec<(String, Option<LayoutPreview>)>
  selected

ThemeLauncherState
  entries: Vec<String>
  selected
```

### `PaneStore`

```text
PaneStore
  grids: HashMap<PaneId, Arc<Mutex<Grid>>>
  layout: LayoutNode
  active: PaneId
  pending_clipboard: Option<Vec<u8>>
  pending_toasts: VecDeque<Toast>
  scroll_offset: usize
  floating: Option<PaneId>
  floating_visible: bool
  pre_float_active: Option<PaneId>
  should_quit: bool
  launcher: Option<LauncherState>
  copy_mode: Option<CopyState>
  normal_selection: Option<(usize, usize, usize, usize)>
  save_prompt: Option<String>
  theme_launcher: Option<ThemeLauncherState>
  pane_commands: HashMap<PaneId, String>
```

### UI helper types

```text
CopyState
  cursor: (usize, usize)
  anchor: Option<(usize, usize)>

Toast
  pane_id
  message
  elapsed_ms
```

### Session persistence

```text
LayoutNodeDef
  Leaf { id }
  Split { direction, ratio, first, second }

LayoutSnapshot
  root: LayoutNodeDef
  active: PaneId
```

`LayoutNode` is the runtime structure used for drawing, while `LayoutNodeDef` is the mirrored type used for serialization.

### Win32-side runtime state

```text
ClientState
  panes: Arc<Mutex<PaneStore>>
  ime: ImeHandler
  msg_tx
  split_tx
  float_tx
  layout_tx
  active_toasts
  content_rect
  app_focused
  native_notif_queue
  mode: Cell<ClientMode>
  theme: Cell<WinTheme>

ClientMode
  Normal
  Pane
  Copy
```

## Root crate (`src/`)

The top-level orchestration types live here.

```text
AppConfig
  hooks: HooksConfig
  appearance: AppearanceConfig

HooksConfig
  on_pane_created
  on_pane_closed

AppearanceConfig
  font_family
  font_size
  background
  foreground
  cursor
  selection_bg
  status_bar_bg
```

### Startup and bridge

```text
BootstrapHandles
  client_tx
  server_rx
  ipc_out_tx
  surf_id
  pane_id

BridgeEvent
  PaneOutput
  PaneCreated
  PaneClosed
  UserNotification
  CommandFinished
```

## The most important ownership relation

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(row(
  column(
    accent-node("Server"),
    down(),
    code-node("Pane"),
    down(),
    code-node("Arc<tokio::Mutex<Grid>>"),
  ),
  column(
    accent-node("PaneStore"),
    down(),
    code-node("grids: HashMap<PaneId,", "Arc<Mutex<Grid>>>"),
  ),
  column(
    accent-node("ClientState"),
    down(),
    code-node("Arc<Mutex<PaneStore>>"),
  ),
))
```

The server-side `Grid` and client-side `Grid` are separate instances.
On the client side, `TerminalSink` keeps the display up to date by reapplying raw PTY data.
That is easy to confuse with earlier explanations from the period when the design looked closer to a monolith, so it is worth calling out explicitly.

## A practical reading order for the types

When reading the implementation, the following order tends to work well:

1. check the message types in `protocol`
2. look at the entry path in `server::handle_client_message()`
3. inspect `pane.rs` and the `terminal` crate for PTY and Grid updates
4. inspect `app/bridge.rs` for how the GUI side is updated
5. inspect `client::window` for drawing and input handling

Following that order makes the workspace split much easier to navigate.
