// ============================================================
// a6x-dark-theme / slides.typ
// スライドレイアウト・エンディングスライド
// ============================================================

#import "colors.typ": *
#import "components.typ": heading-bar, caption

// ── スライドレイアウト ──────────────────────────────────────

// セクション区切りスライド（中央に大きなテキスト）
#let section-slide(t, size: 1.7em) = {
  v(1fr)
  align(center, text(size: size, weight: "bold", fill: accent-cyan, t))
  v(1fr)
  pagebreak()
}

// タイトルスライド
#let title-slide(title, subtitle: none, event: none, author: none) = {
  v(1fr)
  align(center,
    stack(dir: ttb, spacing: 16pt,
      text(size: 2.3em, weight: "bold", fill: accent-cyan, title),
      if subtitle != none {
        text(size: 1.15em, fill: accent-cyan, subtitle)
      },
      if event != none or author != none {
        v(12pt)
      },
      if event != none {
        text(size: 0.93em, fill: text-muted, event)
      },
      if author != none {
        text(size: 0.93em, fill: text-muted, author)
      },
    )
  )
  v(1fr)
  pagebreak()
}

// コンテンツスライド（見出し＋本文）
#let content-slide(title, body) = {
  heading-bar(title)
  v(16pt)
  body
  pagebreak()
}

// 2カラムスライド（見出し＋左右分割）
#let two-col-slide(title, left, right, ratio: (1fr, 1fr)) = {
  heading-bar(title)
  v(16pt)
  grid(
    columns: ratio,
    gutter: 20pt,
    left, right,
  )
  pagebreak()
}

// フッターキャプション（スライド下部の説明文）
#let footer-caption(t) = {
  v(1fr)
  align(center, caption(t))
}

// スライド下部のトピックセンテンス（v(1fr) で底部に配置）
// 単体:       #topic-sentence[エラーを「例外」と見るか「値」と見るか]
// 強調+本文: #topic-sentence(highlight: [「キーワード」])[説明テキスト]
#let topic-sentence(body, highlight: none) = {
  v(1fr)
  if highlight != none {
    align(center, text(size: 1.15em)[
      #text(weight: "bold", fill: accent-cyan, highlight)#text(fill: text-white, body)
    ])
  } else {
    align(center, text(size: 1.15em, weight: "bold", fill: accent-cyan, body))
  }
}

// アジェンダスライド（章立て + 現在セクションのハイライト）
// items:   項目テキストの配列
// current: ハイライトするインデックス（0始まり）。省略時は全項目ノーマル
// title:   スライドタイトル（省略時 "おしながき"）
//
// 使い方:
//   #agenda-slide(items)              // 全項目ノーマル（冒頭）
//   #agenda-slide(items, current: 0)  // 0番目をハイライト（セクション前）
#let agenda-slide(items, current: none, title: "おしながき", item-size: 1.4em) = {
  heading-bar(title)
  v(16pt)
  list(
    ..range(items.len()).map(i => {
      text(
        size: item-size,
        fill: if current != none and i == current { accent-hl } else { text-white },
        items.at(i),
      )
    })
  )
  pagebreak()
}

// ── ページ番号フッター ─────────────────────────────────────
// 使い方: #set page(..., footer: slide-numbering())
#let slide-numbering() = context align(right,
  text(size: 16pt, fill: text-muted,
    str(counter(page).get().first()) + " / " + str(counter(page).final().first())
  )
)

// ── QRコード・エンディング用 ──────────────────────────────

// QRコード風のプレースホルダー（実際はimage()で差し替え）
#let qr-placeholder(size: 120pt) = block(
  width: size, height: size,
  fill: white,
  stroke: 3pt + accent-cyan,
  radius: 10pt,
  align(center + horizon,
    text(size: 0.7em, fill: text-muted)[QR Code]
  )
)

// エンディングスライド
#let ending-slide(title, article-title: none, source: none) = {
  v(1fr)
  align(center,
    stack(dir: ttb, spacing: 16pt,
      text(size: 1.7em, weight: "bold", fill: accent-cyan, title),
      if article-title != none {
        text(size: 1.15em, weight: "bold", fill: text-white, article-title)
      },
      if source != none {
        text(size: 0.85em, fill: text-muted, source)
      },
    )
  )
  v(1fr)
  pagebreak()
}
