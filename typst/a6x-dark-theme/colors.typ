// ============================================================
// a6x-dark-theme / colors.typ
// カラーパレット・フォント定義・テーマ適用関数
// ============================================================

// ── テーマ適用関数 ──────────────────────────────────────────
#let apply-theme(use-dark-theme: true) = {
  let colors = if use-dark-theme {
    (
      bg-main: rgb("#1E2030"),
      bg-card: rgb("#2A2D42"),
      bg-code: rgb("#14151F"),
      accent-cyan: rgb("#4DD9EF"),
      accent-green: rgb("#00E676"),
      accent-red: rgb("#FF5252"),
      accent-yellow: rgb("#FFD740"),
      text-main: rgb("#EEEEEE"),
      text-muted: rgb("#8890A4"),
      table-header: rgb("#5B8CD0"),
    )
  } else {
    (
      bg-main: rgb("#FFFFFF"),
      bg-card: rgb("#F5F5F5"),
      bg-code: rgb("#F8F8F8"),
      accent-cyan: rgb("#0277BD"),
      accent-green: rgb("#388E3C"),
      accent-red: rgb("#D32F2F"),
      accent-yellow: rgb("#F57C00"),
      text-main: rgb("#1A1A1A"),
      text-muted: rgb("#666666"),
      table-header: rgb("#1976D2"),
    )
  }

  set page(
    width: 480pt,
    height: 270pt,
    fill: colors.bg-main,
    margin: (x: 24pt, y: 18pt),
  )

  set text(size: 14pt, fill: colors.text-main)
  set par(leading: 0.85em)

  set list(
    marker: text(fill: colors.accent-cyan, "•"),
    indent: 0.8em,
    body-indent: 0.5em,
  )

  (
    colors: colors,
    bg-dark: colors.bg-main,
    bg-card: colors.bg-card,
    bg-code: colors.bg-code,
    accent-cyan: colors.accent-cyan,
    accent-green: colors.accent-green,
    accent-red: colors.accent-red,
    accent-yellow: colors.accent-yellow,
    text-white: colors.text-main,
    text-muted: colors.text-muted,
    table-header: colors.table-header,
  )
}

// ── デフォルトカラーパレット（ダークテーマ） ──────────────────────
#let bg-dark      = rgb("#1E2030")   // メイン背景
#let bg-card      = rgb("#2A2D42")   // カード・パネル背景
#let bg-code      = rgb("#14151F")   // コードブロック背景
#let accent-cyan  = rgb("#4DD9EF")   // メインアクセント（見出し・強調）
#let accent-green = rgb("#00E676")   // 左ボーダー（OK系）
#let accent-red   = rgb("#FF5252")   // 左ボーダー（NG系・警告）
#let accent-yellow= rgb("#FFD740")   // アイコン・ハイライト
#let text-white   = rgb("#EEEEEE")   // 本文テキスト
#let text-muted   = rgb("#8890A4")   // 控えめテキスト
#let table-header = rgb("#5B8CD0")   // テーブルヘッダー
#let accent-hl    = rgb("#EEF442")   // イエローグリーン（項目ハイライト）

#let font-sans = ("Meiryo", "Yu Gothic UI", "Arial")
#let font-mono = ("HackGen Console", "Consolas", "Courier New")
