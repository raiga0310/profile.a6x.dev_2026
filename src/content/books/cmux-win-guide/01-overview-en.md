---
title: "Overview and Design Principles"
order: 1
description: "The problems yatamux is trying to solve, and the design choices behind the current implementation."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [概要と設計思想](/books/cmux-win-guide/01-overview). Some phrasing may read unnaturally.

## Why I Built It

I wanted a tmux-style pane-oriented development environment on Windows, without assuming WSL.
For that goal, what mattered most in yatamux was not just splitting panes,
but making sure **CJK rendering and IME do not fall apart**.

When you use modern terminal apps on Windows, the following problems appear frequently:

- **CJK width mismatches**: ConPTY and the app disagree about displayed cell width
- **Weak IME handling**: preedit text position and rendering fall apart during conversion
- **Graphemes including half-width kana voiced marks or VS-16**: width decisions become hard
- **Font-dependent box drawing**: borders in apps like neovim break differently depending on the environment

To avoid those issues, yatamux uses ConPTY as the PTY layer while taking full control of display and input through native Win32.

## Current design principles

### 1. Keep the server and GUI in the same process

Internal communication is handled entirely with `tokio::sync::mpsc`, so no process boundary is introduced between the GUI and PTY management.
Only external CLI integration is split out through named-pipe IPC.

The benefit is lower latency during UI operations, while still keeping the code reasonably well separated by responsibility.

### 2. Put `Grid` at the center

Raw PTY output is never drawn directly. It is always applied to the `Grid` in the `terminal` crate first.
That lets one data structure centralize:

- CJK width calculation
- scrollback
- alternate screen handling
- text extraction for copy mode and normal selection
- output generation for `capture-pane`

### 3. Centralize UI state in `PaneStore`

Layout trees, the active pane, floating-pane state, launcher state,
save prompts, toast queues, and other UI concerns all live in `PaneStore`.
That creates a clear bridge point between the Win32 thread and the tokio tasks.

### 4. Use human-readable TOML for saved state

Both session restore data and declarative layouts are stored as TOML.
It is a bit more verbose than JSON, but much easier to repair manually when something goes wrong.

## Workspace structure

The repository is now a Cargo workspace rather than a single crate.

| crate | role |
|------|------|
| `yatamux-protocol` | shared ID types, message types, and `PaneCapture` |
| `yatamux-terminal` | VT parser, Grid, width calculation, and ConPTY wrapper |
| `yatamux-server` | management of Workspace / Surface / Pane plus the IPC server |
| `yatamux-client` | Win32 windowing, GDI drawing, IME, and layout UI |
| `yatamux-renderer` | still very thin, but reserved for future rendering separation |
| `yatamux` | startup, CLI, config handling, and bootstrap |

## Current limitations

- **Windows-only**: it depends on ConPTY and Win32 APIs
- **The Surface data model exists, but tab UI is not implemented yet**
- **Rendering is GDI-based**: it has not moved to GPU rendering
- **Runtime theme switching is mostly color-based**: font changes still require restart
- **Saved layouts use linear `[[panes]]` format**: more complex trees are simplified during save

## Technology choices

- **`tokio`**: for the server loop, PTY I/O, IPC, and bridge processing
- **`portable-pty`**: to create and control ConPTY
- **`vte`**: as the ANSI / VT sequence state machine
- **`windows`**: for GDI, IME, clipboard, notifications, and window control
- **`unicode-width` / `unicode-segmentation` / `unicode-normalization`**:
  for CJK width handling and grapheme-cluster processing
