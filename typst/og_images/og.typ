#let color-a = rgb("#f6d13b")
#let color-b = rgb("#5cf6dc")
#let theme-gradient = gradient.linear(color-a, color-b, angle: 45deg)

#set page(
  width: 1200pt,
  height: 630pt,
  margin: 0pt, // ページ全体の余白は不要
  // 背景全体をグラデーションにする（これが枠になる）
  fill: theme-gradient
)

// テーマ設定
#let base-white = rgb("#ffffff")
#let text-color = rgb("#1a1a1a")

// メインコンテンツを包む丸角の白ボックス
#place(center + horizon)[
  #box(
    width: 1100pt, // 1200pt - 50pt*2 (外側の余白)
    height: 530pt, // 630pt - 50pt*2 (外側の余白)
    fill: base-white,
    radius: 37.5pt, // 角の丸み。ここを調整します。
    outset: 0pt,
    inset: 60pt // ボックス内側のコンテンツ余白
  )[
    // フォント設定
    #set text(font: "New Computer Modern", weight: "medium", fill: text-color)

    // メインコンテンツ
    #align(center + horizon)[
      #stack(dir: ttb, spacing: 30pt)[
        // サイトタイトル
        #text(size: 80pt, weight: "bold", tracking: 1pt)[
          raiga0310
        ]
        
        // グラデーションの区切り線
        #rect(
          width: 40%,
          height: 4pt,
          fill: theme-gradient,
          radius: 2pt
        )
        
        #text(size: 36pt, fill: rgb("#4b5563"))[
          ポートフォリオ
        ]
      ]
    ]
  ]
]
