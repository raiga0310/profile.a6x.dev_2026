---
title: "Rendering Pipeline"
order: 3
description: "A walkthrough of how ConPTY byte streams travel through Grid and end up in GDI."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [レンダリングパイプライン](/books/cmux-win-guide/03-rendering). Some phrasing may read unnaturally.

## Overall flow

```typst
#import "./_diagram.typ": accent-node, code-node, column, down, centered

#centered(column(
  accent-node("ConPTY output"),
  down(),
  code-node("PTY read task in Pane"),
  down(),
  code-node("vte::Parser"),
  down(),
  code-node("VtProcessor"),
  down(),
  code-node("Grid update"),
  down(),
  code-node("ServerMessage::Output"),
  down(),
  code-node("app bridge"),
  down(),
  code-node("TerminalSink::feed()"),
  down(),
  code-node("Grid reflected in PaneStore"),
  down(),
  code-node("dirty rows detected by WM_TIMER"),
  down(),
  code-node("InvalidateRect"),
  down(),
  code-node("WM_PAINT"),
  down(),
  code-node("GDI backbuffer drawing"),
  down(),
  code-node("BitBlt"),
))
```

The server updates its own `Grid`, but the client also owns a drawing-only `TerminalSink`. It reapplies the received raw bytes locally and updates a separate Grid for rendering. That way, the drawing path does not depend on the server crate.

## What `Grid` is responsible for

`Grid` in `crates/terminal/src/grid/mod.rs` is not just a 2D character array.
It is a virtual screen buffer that combines:

- cell storage
- cursor position
- terminal flags such as DECAWM and LCF
- saved main-screen state for alternate screens
- DECSTBM scroll-region state
- scrollback
- dirty-row tracking

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("Grid"),
  down(),
  row(
    column(
      code-node("cols / rows"),
      code-node("cells: Vec<Vec<Cell>>"),
      code-node("cursor: CursorPos"),
      code-node("dirty: Vec<bool>"),
    ),
    column(
      code-node("saved_main: Option<MainScreenSnapshot>"),
      code-node("scroll_top / scroll_bottom"),
      code-node("scrollback: ScrollbackBuffer"),
      code-node("width_config: CjkWidthConfig"),
    ),
  ),
))
```

## Cell representation

Each `Cell` has content and style. Content is represented with `CellContent`, and the current implementation still uses `Continuation` to occupy the right-hand side of full-width graphemes.

```typst
#import "./_diagram.typ": accent-node, code-node, column, row, down, centered

#centered(column(
  accent-node("Cell"),
  down(),
  row(
    column(
      accent-node("content"),
      down(),
      row(
        code-node("Grapheme", "{ text, width }"),
        code-node("Continuation"),
        code-node("Empty"),
      ),
    ),
    column(
      accent-node("style"),
      down(),
      code-node("fg / bg / bold / italic", "underline / reverse / dim ..."),
    ),
  ),
))
```

That representation makes it easier to treat the following as "one grapheme = one drawing unit":

- full-width characters
- emoji sequences forced by VS-16
- composed emoji containing ZWJ

## VT sequence processing

`VtProcessor` implements `vte::Perform` and mainly updates:

| callback | purpose |
|----------|---------|
| `print` | writing regular characters |
| `execute` | CR / LF / BS / BEL |
| `csi_dispatch` | cursor movement, erase, scroll region, SGR |
| `osc_dispatch` | title changes, OSC 52, notifications, OSC 133;D |

The important point in the current implementation is that `VtProcessor` extracts more than visible text.
It also pulls out **notifications, clipboard writes, and command completion**:

- `notification: Option<String>`
- `clipboard_data: Option<Vec<u8>>`
- `command_finished: Option<Option<i32>>`
- `bell: bool`

Those are later turned into `PaneEvent` values or `pending_clipboard`.

## CJK and grapheme width

[**A comparison screenshot will be inserted here later, showing broken CJK cursor placement in another terminal and correct alignment in yatamux**]

Width calculation is controlled by `CjkWidthConfig`.
The guiding policy is very clear:
**do not trust the cursor position reported by ConPTY**.

The implementation explicitly handles:

- half-width katakana voiced marks `U+FF9E` / `U+FF9F`
- East Asian Ambiguous characters
- emoji sequences containing VS-16
- cases where NFD Korean text is normalized to NFC before measuring width

When a full-width character lands at the end of a line, the code wraps early using `DECAWM + LCF`.
Without that logic, a two-cell grapheme can spill into the next line in a half-broken state.

## Scrollback and alternate screen

`Grid::SCROLLBACK_MAX` is 50,000 lines,
but not every scroll is recorded.

- normal full-screen scrolls are pushed into scrollback
- subregion scrolls limited by DECSTBM are not
- alternate-screen activity is not

That preserves shell history without polluting scrollback with temporary full-screen views from vim or less.

## GDI drawing pipeline

`paint()` in `crates/client/src/window/mod.rs` uses a full backbuffer approach.

1. create the backbuffer with `CreateCompatibleDC` / `CreateCompatibleBitmap`
2. fill the background using theme colors
3. fetch the current layout and Grid references from `PaneStore`
4. draw each pane
5. draw separators, status bar, toast notifications, and launchers on top
6. copy the finished frame to the window with `BitBlt`

Dirty rows are mainly used by the `WM_TIMER` side to decide when a redraw is needed.
`paint()` itself currently redraws the whole visible area whenever it is called.

## Why box-drawing characters are drawn directly

[**A comparison screenshot will be inserted here later, showing font-dependent border glitches versus direct GDI drawing**]

I do not hand all box-drawing characters over to `ExtTextOutW`.
Some of them are drawn with `MoveToEx`, `LineTo`, and `FillRect`.
The reason is simple: when those characters are left entirely to the font, border rendering in neovim and similar apps stops being stable.

By treating them as shapes rather than glyphs,
the current design prioritizes UI consistency over font fidelity.

## Font selection

At startup the app chooses the first available font from this priority list:

```typst
#import "./_diagram.typ": code-node, column, down, centered

#centered(column(
  code-node("HackGen Console NF"),
  down(),
  code-node("HackGen Console"),
  down(),
  code-node("HackGen35 Console NF"),
  down(),
  code-node("HackGen35 Console"),
  down(),
  code-node("HackGen NF"),
  down(),
  code-node("HackGen"),
  down(),
  code-node("Cascadia Mono"),
  down(),
  code-node("Cascadia Code"),
  down(),
  code-node("Consolas"),
  down(),
  code-node("MS Gothic"),
))
```

The order is a compromise between Japanese readability, Nerd Font glyph coverage, and reasonable fallback behavior on standard Windows environments.
