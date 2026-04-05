#let ink = rgb("#3A6E47")
#let ink-soft = rgb("#66756D")
#let paper = rgb("#F8FCF9")
#let paper-soft = rgb("#F3F6FA")
#let paper-accent = rgb("#EDF7F1")
#let paper-note = rgb("#FFF7E6")
#let mono-ink = rgb("#24302B")

#let render-node(lines, fill, stroke, mono: false) = box(
  inset: (x: 10pt, y: 8pt),
  radius: 10pt,
  fill: fill,
  stroke: 1pt + stroke,
)[
  #stack(
    dir: ttb,
    spacing: 2pt,
    ..lines.map(line => align(center, text(
      font: "HackGen Console",
      size: 8.4pt,
      fill: if mono { mono-ink } else { rgb("#1A1A1A") },
      line,
    ))),
  )
]

#let node(..lines) = render-node(lines.pos(), paper, ink)
#let accent-node(..lines) = render-node(lines.pos(), paper-accent, ink)
#let soft-node(..lines) = render-node(lines.pos(), paper-soft, rgb("#8594A1"))
#let note-node(..lines) = render-node(lines.pos(), paper-note, rgb("#C58A16"))
#let code-node(..lines) = render-node(lines.pos(), rgb("#F4F4F4"), rgb("#96A3A0"), mono: true)

#let down(label: none) = if label == none {
  align(center, text(font: "HackGen Console", size: 11pt, weight: "bold", fill: ink, "↓"))
} else {
  stack(
    dir: ttb,
    spacing: 2pt,
    align(center, text(font: "HackGen Console", size: 7.2pt, fill: ink-soft, label)),
    align(center, text(font: "HackGen Console", size: 11pt, weight: "bold", fill: ink, "↓")),
  )
}

#let rarrow(label: none) = if label == none {
  align(center, text(font: "HackGen Console", size: 11pt, weight: "bold", fill: ink, "→"))
} else {
  stack(
    dir: ttb,
    spacing: 2pt,
    align(center, text(font: "HackGen Console", size: 7.2pt, fill: ink-soft, label)),
    align(center, text(font: "HackGen Console", size: 11pt, weight: "bold", fill: ink, "→")),
  )
}

#let centered(body) = align(center, body)
#let row(..items) = stack(dir: ltr, spacing: 12pt, ..items.pos())
#let column(..items) = stack(dir: ttb, spacing: 8pt, ..items.pos())
