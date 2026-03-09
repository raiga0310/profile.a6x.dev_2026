#import "../../a6x-dark-theme/lib.typ": *
#import "@preview/fletcher:0.5.5": diagram, node, edge

#let async-timeline() = {
  set text(size: 16pt)

  align(center, box(
    fill: gradient.radial(
      accent-cyan.transparentize(70%),
      accent-cyan.transparentize(100%),
      center: (15%, 50%),
      radius: 85%,
    ),
    diagram(
      spacing: (50pt, 20pt),

    // ── インフレーション: F# ─────────────────────────────────
    node((-1, 0),
      align(center)[
        #text(weight: "bold")[F\#]
        #linebreak()
        #text(size: 0.65em, fill: text-muted)[2007]
      ],
      fill: bg-card,
      stroke: 2pt + text-muted,
      inset: 9pt,
      name: <fs>,
    ),

    // ── ビッグバン: C# ───────────────────────────────────────
    node((0, 0),
      align(center)[
        #text(weight: "bold", size: 1.1em)[C\# 5.0]
        #linebreak()
        #text(size: 0.7em, fill: accent-cyan)[2012]
      ],
      fill: bg-card,
      stroke: 4pt + accent-cyan,
      inset: 15pt,
      name: <cs>,
    ),

    // ── 伝播した言語群（x: 年差比例、y: 時間とともに広がる）──
    node((2.5, -1),
      align(center)[
        #text(weight: "bold")[Python 3.5]
        #linebreak()
        #text(size: 0.7em, fill: accent-yellow)[2015]
      ],
      fill: bg-card,
      stroke: 2pt + accent-yellow,
      inset: 9pt,
      name: <py35>,
    ),

    node((4, 1),
      align(center)[
        #text(weight: "bold")[JavaScript]
        #linebreak()
        #text(size: 0.7em, fill: accent-green)[2017]
      ],
      fill: bg-card,
      stroke: 2pt + accent-green,
      inset: 9pt,
      name: <js>,
    ),

    node((5, -2),
      align(center)[
        #text(weight: "bold")[Python 3.7]
        #linebreak()
        #text(size: 0.7em, fill: accent-red)[2018]
      ],
      fill: bg-card,
      stroke: 2pt + accent-red,
      inset: 9pt,
      name: <py37>,
    ),

    node((6, 2),
      align(center)[
        #text(weight: "bold")[Rust]
        #linebreak()
        #text(size: 0.7em, fill: accent-cyan)[2019]
      ],
      fill: bg-card,
      stroke: 2pt + accent-cyan,
      inset: 9pt,
      name: <rust>,
    ),

    node((7.5, -2),
      align(center)[
        #text(weight: "bold")[C++20]
        #linebreak()
        #text(size: 0.7em, fill: accent-yellow)[2020]
      ],
      fill: bg-card,
      stroke: 2pt + accent-yellow,
      inset: 9pt,
      name: <cpp20>,
    ),

    node((8.5, 2),
      align(center)[
        #text(weight: "bold")[Swift 5.5]
        #linebreak()
        #text(size: 0.7em, fill: accent-hl)[2021]
      ],
      fill: bg-card,
      stroke: 2pt + accent-hl,
      inset: 9pt,
      name: <swift>,
    ),

    // ── エッジ ──────────────────────────────────────────────
    // F# → C# (理論的先行研究、破線)
    edge(
      vertices: ((name: "fs", anchor: "east"), (name: "cs", anchor: "west")),
      stroke: stroke(paint: text-muted, thickness: 2pt, dash: "dashed"),
      marks: "-|>",
    ),

    // ── ビッグバン膨張コーン（上下の境界曲線）─────────────
    // vertices の y を指数的に増やして「急膨張→緩やか」な曲線を近似
    edge(
      vertices: ((0, 0), (0.8, -0.15), (2, -3.2), (3.5, -3.4), (5.5, -3.6), (7, -3.9), (9, -4.3)),
      stroke: stroke(paint: text-muted, thickness: 3pt),
      marks: "-",
      corner-radius: 40pt,
    ),
    edge(
      vertices: ((0, 0), (0.8, 0.15), (2, 3.2), (3.5, 3.4), (5.5, 3.6), (7, 3.9), (9, 4.3)),
      stroke: stroke(paint: text-muted, thickness: 3pt),
      marks: "-",
      corner-radius: 40pt,
    ),
  )))
}
