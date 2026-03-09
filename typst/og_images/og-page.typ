#let title = sys.inputs.at("title", default: "raiga0310")
#let description = sys.inputs.at("description", default: "")
#let kind = sys.inputs.at("kind", default: "")

#let color-a = rgb("#f6d13b")
#let color-b = rgb("#5cf6dc")
#let theme-gradient = gradient.linear(color-a, color-b, angle: 45deg)

#set page(
  width: 1200pt,
  height: 630pt,
  margin: 0pt,
  fill: theme-gradient
)

#let base-white = rgb("#ffffff")
#let text-color = rgb("#1a1a1a")

#place(center + horizon)[
  #box(
    width: 1100pt,
    height: 530pt,
    fill: base-white,
    radius: 37.5pt,
    outset: 0pt,
    inset: 60pt,
  )[
    #set text(
      font: ("HackGen Console NF", "HackGen35 Console NF", "New Computer Modern"),
      weight: "medium",
      fill: text-color,
    )

    #align(center + horizon)[
      #stack(dir: ttb, spacing: 22pt)[
        // Kind label (Slide / Blog / Product)
        #if kind.len() > 0 [
          #text(size: 18pt, weight: "bold", fill: rgb("#9ca3af"))[
            #upper(kind)
          ]
        ]

        // Page title
        #text(size: 56pt, weight: "bold", tracking: 0.5pt)[
          #title
        ]

        // Gradient separator line
        #rect(
          width: 40%,
          height: 4pt,
          fill: theme-gradient,
          radius: 2pt,
        )

        // Description / event
        #if description.len() > 0 [
          #text(size: 28pt, fill: rgb("#4b5563"))[
            #description
          ]
        ]

        // Site attribution
        #text(size: 16pt, fill: rgb("#9ca3af"))[
          raiga0310 · a6x.dev
        ]
      ]
    ]
  ]
]
