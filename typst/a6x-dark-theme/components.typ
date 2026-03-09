// ============================================================
// a6x-dark-theme / components.typ
// 基本コンポーネント・カード・テーブル・タイムライン・アクションアイテム
// ============================================================

#import "colors.typ": *

// ── 基本コンポーネント ──────────────────────────────────────

// セクション見出し（左シアンバー付き）
#let heading-bar(title) = block(
  inset: (left: 16pt, y: 8pt),
  stroke: (left: 5pt + accent-cyan),
  text(size: 1.7em, weight: "bold", fill: text-white, title)
)

// サブ見出し（シアン色テキスト）
#let sub-heading(title) = text(
  size: 1.3em, weight: "bold", fill: accent-cyan, title
)

// 太字ラベル（本文中の小見出し）
#let bold-label(t) = text(size: 1em, weight: "bold", fill: text-white, t)

// 控えめキャプション
#let caption(t) = text(size: 0.8em, style: "italic", fill: text-muted, t)

// ── カード・パネル ──────────────────────────────────────────

// 汎用カード（角丸パネル）
#let card(body, border: none) = block(
  width: 100%,
  fill: bg-card,
  inset: 16pt,
  radius: 10pt,
  stroke: if border != none { (left: 4pt + border) } else { 0.5pt + rgb("#3A3D50") },
  body
)

// 比較カード（左右並び用、色付きボーダー）
#let compare-card(title, body, border-color: accent-green) = block(
  width: 100%,
  fill: bg-card.lighten(5%),
  inset: 16pt,
  radius: 10pt,
  stroke: (left: 4pt + border-color, rest: 0.5pt + rgb("#3A3D50")),
  {
    text(size: 1.15em, weight: "bold", fill: accent-cyan, title)
    v(8pt)
    body
  }
)

// アイコンカード（3列レイアウト用）
#let icon-card(icon, title, subtitle, description) = block(
  width: 100%,
  fill: bg-card,
  inset: 14pt,
  radius: 10pt,
  stroke: 0.5pt + rgb("#3A3D50"),
  {
    text(size: 1.6em, icon)
    v(8pt)
    text(size: 1.15em, weight: "bold", fill: accent-cyan, title)
    v(4pt)
    bold-label(subtitle)
    v(4pt)
    text(size: 0.85em, fill: text-muted, description)
  }
)

// ── テーブル ──────────────────────────────────────────────

// ダークテーマテーブル（青ヘッダー＋交互色行）
// 使い方: dark-table(("列A","列B"), ("行1A","行1B"), ("行2A","行2B"))
#let dark-table(headers, ..rows) = {
  let col-count = headers.len()
  let data = rows.pos()
  align(center, table(
    columns: range(col-count).map(_ => auto),
    fill: (x, y) => {
      if y == 0 { table-header }
      else if calc.rem(y, 2) == 1 { rgb("#252840") }
      else { rgb("#1E2038") }
    },
    stroke: 0.5pt + rgb("#3A3D50"),
    inset: (x: 12pt, y: 8pt),
    ..headers.map(h => table.cell(text(size: 0.85em, weight: "bold", fill: text-white, h))),
    ..data.map(row => row.map(cell => table.cell(text(size: 0.85em, fill: text-white, cell)))).flatten(),
  ))
}

// ── タイムライン ──────────────────────────────────────────

// タイムラインの1イベント
#let tl-event(year, title, desc, above: true) = {
  stack(dir: ttb, spacing: 4pt,
    align(center, text(size: 1em, weight: "bold", fill: text-white, year)),
    align(center, circle(radius: 5pt, fill: accent-cyan)),
    align(center, text(size: 0.8em, weight: "bold", fill: text-white, title)),
    align(center, text(size: 0.7em, fill: text-muted, desc)),
  )
}

// ── アクションアイテム ──────────────────────────────────────

// アクション項目（アイコン＋タイトル＋説明）
#let action-item(icon, title, description) = {
  grid(
    columns: (28pt, 1fr),
    gutter: 12pt,
    align(top + center, text(size: 1.3em, icon)),
    stack(dir: ttb, spacing: 4pt,
      text(size: 1em, weight: "bold", fill: text-white, title),
      text(size: 0.85em, fill: text-muted, description),
    ),
  )
}
