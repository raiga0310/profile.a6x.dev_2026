// ============================================================
// a6x-dark-theme / code.typ
// コードブロック・シンタックスカラー・ファイル読み込みコンポーネント
// ============================================================

#import "colors.typ": *

// ── コードブロック ──────────────────────────────────────────

// macOS風ウィンドウドット付きコードブロック
#let code-window(body) = block(
  width: 100%,
  fill: bg-code,
  radius: 8pt,
  clip: true,
  stroke: 0.5pt + rgb("#3A3D50"),
  {
    block(
      width: 100%,
      inset: (x: 12pt, y: 7pt),
      fill: rgb("#1A1C2A"),
      stack(dir: ltr, spacing: 6pt,
        circle(radius: 4.5pt, fill: rgb("#FF5F56")),
        circle(radius: 4.5pt, fill: rgb("#FFBD2E")),
        circle(radius: 4.5pt, fill: rgb("#27C93F")),
      )
    )
    block(
      width: 100%,
      inset: (x: 16pt, y: 12pt),
      text(font: font-mono, size: 0.85em, fill: rgb("#CDD6F4"), body)
    )
  }
)

// シンプルコードブロック（ドットなし）
#let code-block(body) = block(
  width: 100%,
  fill: bg-code,
  inset: (x: 16pt, y: 12pt),
  radius: 8pt,
  stroke: 0.5pt + rgb("#3A3D50"),
  text(font: font-mono, size: 0.85em, fill: rgb("#CDD6F4"), body)
)

// ── シンタックスカラーヘルパー ──────────────────────────────
#let kw(t)  = text(fill: rgb("#C792EA"), t)   // キーワード（紫）
#let fn_(t) = text(fill: rgb("#82AAFF"), t)   // 関数名（青）
#let str(t) = text(fill: rgb("#C3E88D"), t)   // 文字列（緑）
#let err(t) = text(fill: rgb("#FF5370"), t)   // エラー（赤）
#let cm(t)  = text(fill: rgb("#676E95"), t)   // コメント（灰）

// ── ファイルパス指定コードスニペット ──────────────────────────────

// macOS 風ウィンドウ形式でファイルを表示（タイトルバーにファイル名）
// path:  ファイルパス文字列（例: "src/main.rs"）
// lang:  シンタックスハイライト言語（例: "rust"。省略時はテーマ色で表示）
// lines: 表示行範囲のタプル（例: (5, 20) で 5〜20行目のみ。省略時は全行）
#let code-file-window(path, lang: none, lines: none) = {
  let filename = path.split("/").last()
  let raw-content = read("../" + path)
  let content = if lines != none {
    raw-content.split("\n").slice(lines.at(0) - 1, lines.at(1)).join("\n")
  } else {
    raw-content
  }
  block(
    width: 100%,
    fill: bg-code,
    radius: 8pt,
    clip: true,
    stroke: 0.5pt + rgb("#3A3D50"),
    {
      block(
        width: 100%,
        inset: (x: 12pt, y: 7pt),
        fill: rgb("#1A1C2A"),
        stack(dir: ltr, spacing: 6pt,
          circle(radius: 4.5pt, fill: rgb("#FF5F56")),
          circle(radius: 4.5pt, fill: rgb("#FFBD2E")),
          circle(radius: 4.5pt, fill: rgb("#27C93F")),
          h(4pt),
          align(horizon, text(size: 0.7em, fill: text-muted, filename)),
        )
      )
      block(
        width: 100%,
        inset: (x: 16pt, y: 12pt),
        if lang != none {
          raw(content, lang: lang, block: true)
        } else {
          text(font: font-mono, size: 0.85em, fill: rgb("#CDD6F4"), content)
        }
      )
    }
  )
}

// シンプルブロック形式でファイルを表示（上部にファイル名ラベル）
// path, lang, lines は code-file-window と同じ
#let code-file-block(path, lang: none, lines: none) = {
  let filename = path.split("/").last()
  let raw-content = read("../" + path)
  let content = if lines != none {
    raw-content.split("\n").slice(lines.at(0) - 1, lines.at(1)).join("\n")
  } else {
    raw-content
  }
  block(
    width: 100%,
    fill: bg-code,
    inset: (x: 16pt, y: 12pt),
    radius: 8pt,
    stroke: 0.5pt + rgb("#3A3D50"),
    {
      text(size: 0.7em, fill: text-muted, filename)
      v(8pt)
      if lang != none {
        raw(content, lang: lang, block: true)
      } else {
        text(font: font-mono, size: 0.85em, fill: rgb("#CDD6F4"), content)
      }
    }
  )
}
