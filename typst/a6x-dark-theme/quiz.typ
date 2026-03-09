// ============================================================
// a6x-dark-theme / quiz.typ
// クイズスライドコンポーネント
// ============================================================

#import "colors.typ": *
#import "code.typ": code-block

#let _quiz-labels = ("A", "B", "C", "D")
#let _quiz-colors = (accent-cyan, accent-green, accent-yellow, accent-red)

// 選択肢カード（内部用）
// highlight: 正解ハイライト, dim: 不正解グレーアウト
#let _quiz-card(idx, answer-text, code: none, highlight: false, dim: false) = {
  let fill-color   = if highlight { rgb("#1A3028") } else { bg-card }
  let stroke-style = if highlight {
    (left: 4pt + accent-green, rest: 0.5pt + rgb("#3A3D50"))
  } else {
    0.5pt + rgb("#3A3D50")
  }
  let text-color = if dim { text-muted } else { text-white }

  block(
    width: 100%,
    fill: fill-color,
    inset: (x: 12pt, y: 10pt),
    radius: 8pt,
    stroke: stroke-style,
    stack(dir: ttb, spacing: 6pt,
      grid(
        columns: (22pt, 1fr, auto),
        gutter: 8pt,
        align: horizon,
        align(center,
          text(size: 1.4em, weight: "bold", fill: _quiz-colors.at(idx), _quiz-labels.at(idx))
        ),
        text(size: 0.7em, fill: text-color, answer-text),
        if highlight {
          text(size: 0.65em, weight: "bold", fill: accent-green, "✓ 正解！")
        },
      ),
      if code != none { code-block(code) },
    ),
  )
}

// 問題スライド
// question: 問題文
// options:  4つの選択肢テキストの配列
// correct:  正解の選択肢インデックス（0〜3）
// codes:    各選択肢のコード文字列の配列（省略時は非表示）
//           例: ("foo()", none, "bar()", none)
#let quiz-slide(
  question,
  options: ("A", "B", "C", "D"),
  correct: 0,
  codes: none,
) = {
  block(
    width: 100%,
    inset: (left: 14pt, y: 8pt),
    stroke: (left: 5pt + accent-cyan),
    text(size: 1.1em, weight: "bold", fill: text-white, question)
  )
  v(10pt)
  grid(
    columns: (1fr, 1fr),
    gutter: 10pt,
    ..range(4).map(i => {
      _quiz-card(i, options.at(i), code: if codes == none { none } else { codes.at(i) })
    }),
  )
  pagebreak()
}

// 正解発表スライド（quiz-slide と同じ引数）
// 正解カードをハイライト・不正解カードをグレーアウトして表示する
#let quiz-answer-slide(
  question,
  options: ("A", "B", "C", "D"),
  correct: 0,
  codes: none,
) = {
  block(
    width: 100%,
    inset: (left: 14pt, y: 8pt),
    stroke: (left: 5pt + accent-green),
    text(size: 1.1em, weight: "bold", fill: text-white, question)
  )
  v(10pt)
  grid(
    columns: (1fr, 1fr),
    gutter: 10pt,
    ..range(4).map(i => {
      _quiz-card(
        i,
        options.at(i),
        code: if codes == none { none } else { codes.at(i) },
        highlight: i == correct,
        dim: i != correct,
      )
    }),
  )
  pagebreak()
}
