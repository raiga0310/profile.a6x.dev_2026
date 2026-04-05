---
title: "Pane Management"
order: 4
description: "A walkthrough of Workspace / Surface / PaneTree and how the client-side LayoutNode stays in sync."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [ペイン管理](/books/cmux-win-guide/04-pane-management). Some phrasing may read unnaturally.

## Hierarchy

The session hierarchy on the server side still has three layers:

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("Workspace"),
  down(),
  code-node("Surface"),
  down(),
  accent-node("PaneTree"),
  down(),
  row(
    code-node("Leaf(PaneId)"),
    code-node("Split { direction, ratio,", "first, second }"),
  ),
))
```

The GUI does not render directly from that tree. The client crate rebuilds an equivalent structure called `LayoutNode`.

- Server side: `PaneTree` in `crates/server/src/session/model.rs`
- Client side: `LayoutNode` in `crates/client/src/layout/tree.rs`

That split exists because the server is responsible for PTY and session consistency, while the client is responsible for pixel rectangles and UI state.

## UI state inside `PaneStore`

The easiest way to understand current pane management is to look at what `PaneStore` actually contains.

Main fields:

- `grids: HashMap<PaneId, Arc<Mutex<Grid>>>`
- `layout: LayoutNode`
- `active: PaneId`
- `scroll_offset`
- `floating` / `floating_visible` / `pre_float_active`
- `launcher`
- `copy_mode`
- `save_prompt`
- `theme_launcher`
- `pane_commands`

Because so much mutable UI state is centralized there, both the bridge layer and the Win32 side have a clear answer to "what needs to be updated?"

## Keybinding structure

### Normal mode

| key | action |
|-----|--------|
| `Ctrl+Shift+E` | vertical split |
| `Ctrl+Shift+O` | horizontal split |
| `Ctrl+Shift+W` | close the active pane |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | move to next / previous pane |
| `Ctrl+Arrow` | move to the nearest pane in that direction |
| `Ctrl+F` | toggle floating-pane visibility |
| `Ctrl+P` | open theme launcher |
| `Ctrl+B` | enter pane mode |

### Pane mode

Entering with `Ctrl+B` switches the status-bar display.

| key | action |
|-----|--------|
| `E` / `O` | vertical / horizontal split |
| `W` | close pane |
| `F` | toggle floating-pane visibility |
| `X` | open scrollback in `$EDITOR` |
| `L` | open layout launcher |
| `S` | open save prompt |
| `V` | enter copy mode |
| `<` / `>` | adjust vertical split ratio by ±5% |
| `+` / `-` | adjust horizontal split ratio by ±5% |
| `q` / `Esc` | return to normal mode |

Implementation-wise, this is not a strict one-shot mode. Some actions transition into another mode instead of returning immediately. For example, `V` moves into copy mode, and `S` moves into the save prompt.

## Split flow

### GUI-driven

```typst
#import "./_diagram.typ": accent-node, code-node, column, down, centered

#centered(column(
  accent-node("Ctrl+Shift+E / Ctrl+Shift+O"),
  down(),
  code-node("ClientState::request_split()"),
  down(),
  code-node("split_tx.send((active_pane, direction))"),
  down(),
  code-node("bridge sends ClientMessage::CreatePane", "to Server"),
  down(),
  code-node("Server calls Pane::spawn()"),
  down(),
  code-node("ServerMessage::PaneCreated"),
  down(),
  code-node("bridge adds TerminalSink / Grid /", "LayoutNode"),
  down(),
  code-node("resize is re-sent to the parent pane"),
))
```

The bridge keeps a `pending: VecDeque<(PaneId, SplitDirection, TermSize)>`
so it can match each `PaneCreated` back to the GUI action that triggered it.

### IPC-driven

In the `yatamux split-pane` case, `ServerMessage::PaneCreated`
comes back with `split_from` and `direction`.
The bridge uses that metadata to repair the client-side `LayoutNode`.

So split synchronization currently has two paths:

- pending-queue matching for GUI-driven splits
- metadata carried in `PaneCreated` for IPC-driven splits

## Floating panes

[**A screenshot of a centered floating pane overlay will be inserted here later**]

Floating panes are not included inside `LayoutNode`.
They are tracked separately with `PaneStore.floating` and `PaneStore.floating_visible`.

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, rarrow, centered

#centered(column(
  row(
    accent-node("normal layout"),
    rarrow(),
    code-node("handled by LayoutNode"),
  ),
  row(
    accent-node("floating overlay"),
    rarrow(),
    code-node("handled by PaneStore::floating_rect(", "content_rect)"),
  ),
))
```

The first `Ctrl+F` creates a normal pane via `CreatePane`,
then stores the returned PaneId in `floating`.
After that, the feature mostly toggles visibility.

## Copy mode and normal selection

### Copy mode

`CopyState` currently stores only `cursor` and `anchor`.

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("CopyState"),
  down(),
  row(
    code-node("cursor: (col, row)"),
    code-node("anchor: Option<(col, row)>"),
  ),
))
```

Whether anything is selected is derived each time through `is_selected()`.
The current design computes the range from cursor plus anchor instead of storing a fixed range.

### Normal mouse selection

A left-button drag in normal mode is tracked separately as `normal_selection`.
That path is not a dedicated copy-mode UI. Once the drag ends, the selection is copied directly to the clipboard.

So the current implementation keeps two distinct systems side by side:

- keyboard-driven `copy_mode`
- mouse-driven `normal_selection`

## Pane removal and shutdown

Closing a pane first sends `ClosePane` to the server.
The layout tree itself is only updated after `PaneClosed` comes back.

The bridge side does the following:

1. remove the target from `sinks` and `grids`
2. clear `floating` if that pane was the floating one
3. call `LayoutNode::remove_pane()` for the normal layout
4. move focus if another pane is available
5. set `should_quit = true` if no grids remain

Even the last pane is not handled as a special case.
The `WM_TIMER` side simply notices `should_quit` and calls `DestroyWindow`.

## Session save and restore

### `session.toml`

On shutdown, `LayoutSnapshot` is written to `%APPDATA%\yatamux\session.toml`.

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("LayoutSnapshot"),
  down(),
  row(
    code-node("root: LayoutNodeDef"),
    code-node("active: PaneId"),
  ),
))
```

`LayoutNodeDef` is a mirror type used only for serialization, and it does not contain `Grid`.

### Restore path

At startup, `load_initial_layout()` reads `session.toml`,
then rebuilds the tree recursively by issuing `CreatePane` while maintaining a mapping from old PaneIds to new ones.
That is how the active pane from the saved session is also restored.

## Declarative layouts and saved layouts

### Loading

`%APPDATA%\yatamux\layouts\<name>.toml` uses a sequence of `[[panes]]`.
Each entry describes how to split relative to the previously created pane.

### Saving

When the current layout is saved, `layout_to_toml()` performs a DFS over the layout tree and flattens it into a linear `[[panes]]` sequence.

Only commands recorded in `pane_commands` are written back as `command = "..."`.
That means:

- commands originating from declarative layout files are preserved
- commands typed manually are not

That is a deliberate choice to save only the information that can be meaningfully reproduced as a layout.
