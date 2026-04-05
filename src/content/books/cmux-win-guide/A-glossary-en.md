---
title: "Appendix A: Glossary"
order: 99
description: "Short explanations of the Win32, VT, and yatamux-specific terms used throughout this book."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [付録A: 用語集](/books/cmux-win-guide/a-glossary). Some phrasing may read unnaturally.

This appendix briefly summarizes only the terms that appear frequently in the main text, using meanings aligned with the current implementation.

**Index by category**

- **Win32 / Windows**: [BitBlt](#bitblt) · [ConPTY](#conpty) · [GDI](#gdi) · [IME](#ime) · [IMM32](#imm32) · [Named Pipe](#named-pipe) · [WM_CHAR / WM_KEYDOWN](#wm_char--wm_keydown) · [WM_PAINT](#wm_paint) · [WM_TIMER](#wm_timer) · [WndProc](#wndproc)
- **Rust / tokio**: [Arc](#arc) · [Arc<[u8]>](#arcu8) · [mpsc](#mpsc) · [spawn_blocking](#spawn_blocking) · [tokio::Mutex and std::sync::Mutex](#tokiomutex-and-stdsyncmutex)
- **VT / terminal**: [ANSI escape sequence](#ansi-escape-sequence) · [CSI](#csi) · [CJK](#cjk) · [DECAWM](#decawm) · [LCF](#lcf) · [OSC](#osc) · [OSC 52](#osc-52) · [OSC 133;D](#osc-133d) · [PTY](#pty) · [Scrollback Buffer](#scrollback-buffer) · [Continuation](#continuation)
- **yatamux-specific**: [AppearanceConfig](#appearanceconfig) · [FocusAwareBackend](#focusawarebackend) · [LayoutSnapshot](#layoutsnapshot) · [PaneCapture](#panecapture) · [PaneStore](#panestore) · [Theme file](#theme-file)

---

## Win32 / Windows

### BitBlt

A GDI bit-block transfer function. yatamux draws into an off-screen backbuffer first and then copies it to the screen with `BitBlt` to reduce flicker.

### ConPTY

Windows' pseudo-terminal API. yatamux uses it through `portable-pty`.
ConPTY has existed since Windows 10 v1809, but this book assumes v1903 or later for stable behavior.

### GDI

Windows' 2D drawing API. yatamux uses GDI rather than GPU rendering for text, backgrounds, borders, the status bar, and popup UI.

### IME

The input-conversion mechanism for Japanese and similar languages. yatamux handles `WM_IME_COMPOSITION`, draws the preedit string itself, and sends only committed text to the PTY as UTF-8.

### IMM32

The group of Win32 APIs used for IME control. `ImeHandler` uses it to access preedit strings and candidate-window positioning.

### Named Pipe

A Windows IPC mechanism such as `\\.\pipe\yatamux-default`.
yatamux uses it for communication between the CLI and the running GUI process.

### WM_CHAR / WM_KEYDOWN

Win32 keyboard-input messages.
`WM_KEYDOWN` is used for shortcuts and mode control,
while `WM_CHAR` is used to send ordinary text input to the PTY.

### WM_PAINT

The repaint-request message. yatamux handles full-window drawing by calling `paint()` here and rendering into the backbuffer.

### WM_TIMER

The periodic timer message. yatamux fires it every 16 ms and uses it to request redraws when dirty rows, IME composition, or notifications are active.

### WndProc

The Win32 window message handler.
In yatamux, `ClientState` is stored in `GWLP_USERDATA` and accessed from there.

---

## Rust / tokio

### Arc

A reference-counted pointer for sharing values across threads.
It appears frequently in yatamux for things like `PaneStore` and notification queues.

### Arc<[u8]>

A shared byte slice. `ServerMessage::Output` uses this so the same PTY output can be fanned out to both the GUI and IPC clients with fewer copies.

### mpsc

`tokio::sync::mpsc`. Nearly all communication between GUI, server, IPC, and the bridge uses this.

### spawn_blocking

The tokio mechanism for moving blocking work off the async runtime.
yatamux uses it for the Win32 message loop and for waiting on `child.wait()`.

### tokio::Mutex and std::sync::Mutex

The current code uses them for different purposes:

- `tokio::Mutex`: heavy state such as `Grid`, updated in async contexts
- `std::sync::Mutex`: lightweight state such as `title` and `size`, which should be read quickly

---

## VT / terminal

### ANSI escape sequence

Byte sequences used for terminal control: cursor movement, colors, erase operations, notifications, and more.

### CSI

Control Sequence Introducer sequences beginning with `ESC [`.
These include SGR, cursor movement, and scroll-region settings.

### CJK

A collective label for Chinese, Japanese, and Korean characters.
yatamux treats width handling and input for these scripts as first-class requirements.

### DECAWM

Auto-wrap mode. When the cursor is at the last column, the next character causes a wrap to the next line.

### LCF

Last Column Flag. An internal flag meaning the cursor has reached the last column, but the actual wrap is deferred until the next character arrives.

### OSC

Operating System Command sequences beginning with `ESC ]`.
They are used for title changes, clipboard writes, notifications, and similar side effects.

### OSC 52

A clipboard-write sequence.
yatamux receives it and reflects it into the Windows clipboard.

### OSC 133;D

A shell-command completion notification.
`send-keys --wait-for-prompt` uses it as a wait condition.

### PTY

A pseudo terminal. On Windows, ConPTY is the corresponding mechanism.

### Scrollback Buffer

A buffer holding lines that have scrolled off-screen.
In yatamux it is capped at 50,000 lines and does not collect output while the alternate screen is active.

### Continuation

A dummy cell used to occupy the right half of a full-width grapheme.
Rendering skips these cells so that one grapheme can still behave like a two-cell unit.

---

## yatamux-specific

### AppearanceConfig

The config structure representing `[appearance]` in `%APPDATA%\yatamux\config.toml`.
It contains background color, foreground color, cursor color, selection color, status-bar color, and font settings.

### FocusAwareBackend

A notification backend that switches destination depending on focus state:

- when focused: in-app toast notifications
- when unfocused: Windows balloon notifications

### LayoutSnapshot

The snapshot type used for session persistence.
Instead of storing `LayoutNode` directly, it stores the serializable mirror type `LayoutNodeDef`.

### PaneCapture

The structured metadata returned by `capture-pane --json`.
It includes not just visible text, but also size, cursor position, and the tail of scrollback.

### PaneStore

The aggregation point for client-side UI state.
It stores the layout, active pane, launcher states, copy state, floating-pane state, and more.

### Theme file

A TOML file stored under `%APPDATA%\yatamux\themes\<name>.toml`.
When switching themes at runtime, only the color-related fields under `[appearance]` are applied.
Font settings are not changed live.
