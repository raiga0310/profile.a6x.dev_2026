---
title: "yatamux Technical Guide"
description: "A walkthrough of the current yatamux implementation, a Windows terminal multiplexer written in Rust."
publishedAt: "2026-03-26"
tags: ["Rust", "Windows", "Terminal", "yatamux"]
draft: false
aiInvolvement:
  planning: human
  writing: ai
  review: human
  proofreading: ai
---

> Note: This page is a machine-translated English version of the original Japanese page [yatamux 技術解説](/books/cmux-win-guide). Some phrasing may read unnaturally.

yatamux is a terminal multiplexer implemented in Rust for Windows.
Inspired by tmux and Zellij, it directly uses ConPTY, Win32 GDI, and IMM32 so that CJK rendering and IME support on Windows are first-class concerns.

This book describes the implementation of `../cmux-win` as of 2026-03-30, covering the workspace structure, startup flow, rendering, pane management, and IPC integration in sequence.

**Target reader:** someone comfortable reading basic Rust syntax. Even if you are not familiar with Win32 or VT sequences, I collected the key terms in [Appendix A](./A-glossary).

## Runtime environment

- **OS**: Windows 10 v1903 (Build 18362) or later
- **Rust**: stable with the MSVC toolchain
- Main libraries: `tokio` / `portable-pty` / `vte` / `windows` / `serde` / `toml`

## Repository

- Repository: https://github.com/raiga0310/cmux-win
- Binary name: `yatamux`

The repository name is still `cmux-win`, but the app name and executable name are both standardized as `yatamux`.

## Current implementation scope

**UI / Interaction**
- pane splitting and focus movement with arrow-key and Tab-style commands
- pane mode, copy mode, and standard mouse selection
- floating panes, scrollback, and opening content in `$EDITOR`
- layout save prompts, layout launcher, and theme launcher

**Data / Persistence**
- session save and restore using `%APPDATA%\yatamux\session.toml`
- declarative layouts under `%APPDATA%\yatamux\layouts\*.toml`
- runtime theme switching via `%APPDATA%\yatamux\themes\*.toml`
- IPC CLI including `capture-pane --json`

**Integration**
- OSC 52 clipboard support
- notifications driven by OSC 9/99/777, BEL, and OSC 133;D
- command-completion waiting via `send-keys --wait-for-prompt`
- external command hooks through `[hooks] on_pane_created / on_pane_closed`

[**A screenshot of a three-pane layout with a status bar and toast notifications will be inserted here later**]

## Structure covered by this guide

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("yatamux (bin)"),
  down(),
  row(
    code-node("src/", "startup, CLI, config", "layout restoration"),
    column(
      accent-node("crates/"),
      down(),
      row(
        column(
          code-node("client/", "Win32 window", "GDI drawing and IME", "layout UI"),
          code-node("server/", "PTY lifecycle", "session hierarchy", "IPC server"),
          code-node("terminal/", "VT parser", "Grid", "width calculation", "ConPTY wrapper"),
        ),
        column(
          code-node("protocol/", "ClientMessage", "ServerMessage", "shared types"),
          code-node("renderer/", "reserved for future", "renderer separation"),
        ),
      ),
    ),
  ),
))
```

## Current roadmap

- [ ] WebSocket bridge for read-only remote monitoring
- [ ] helper tools for AI-agent workflows
- [ ] tab UI built on top of multiple-surface support
- [ ] investigation into a future GPU renderer

## Build and launch

```powershell
git clone https://github.com/raiga0310/cmux-win
cd cmux-win
cargo install --path .
yatamux
```

To start it in development with logs enabled:

```powershell
$env:RUST_LOG="info"; cargo run
```
