#import "a6x-dark-theme/lib.typ": *
#import "assets/yoyakugo/async_timeline.typ": async-timeline


// ── ページ設定 ────────────────────────────────────────────
#set page(
  width: 1080pt,
  height: 608pt,
  fill: bg-dark,
  margin: (x: 52pt, y: 36pt),
  footer: slide-numbering(),
)
#set text(size: 26pt, fill: text-white)
#set list(
  marker: text(fill: accent-cyan, "•"),
  indent: 0.8em,
  body-indent: 0.5em,
)
// コードブロックは固定サイズ・フォント指定（比例拡大するとはみ出るため）
#show raw: set text(font: font-mono)
#show raw.where(block: true): set text(size: 18pt)

#title-slide(
  "予約語で見る\nプログラミング言語",
  event: "Matsuriba Max 2026",
  author: "ライガー",
)

#section-slide[Q. 予約語って？]

#content-slide("予約語って？")[
  - ユーザーが再定義できない文字列 #text(fill: text-muted, size: 10pt)[（記号を除く）]
    - ＝識別子（変数名・関数名）として使えない
  - 例：Pythonの `for` `if` `while` など
  - 言語の「制御構造」「型」「宣言」「実行制約」など
  #v(6pt)
  #image("assets/yoyakugo/slide8_img.jpeg", width: 100%)
]

#content-slide("予約語って？")[
  - なぜその文字列を予約語にするのか
    - → 組み込み関数でも良くない？
  - 予約語＝プログラマに意味を#text(fill: accent-cyan)[上書きされたくない]
    - 単純な関数の場合（言語によるが）オーバーライドされる
  - `if-else` は分岐処理しか許さない
  - `while` はループ処理しか許さない
  - #underline[言語の設計思想]が出やすい要素の一つ

  #topic-sentence(highlight: [予約語をテーマに言語の世界を見てみよう])[]
]

#let agenda-items = ("言語の設計思想に触れることができる", "業界トレンドと予約語の変更", "予約語戦略から見るソフトウェア設計")

#agenda-slide(agenda-items, current: 0)

#section-slide[言語の設計思想に触れることができる]

#content-slide("言語の設計思想に触れることができる")[
  - プログラミングは計算モデルを実行命令に変換する
  - 「計算モデル」ー「実行命令」のギャップを埋める
  - 予約語は言語がやりたいことを#text(fill: accent-cyan)[端的に表す]要素
    - その言語が何を大事にしているか、予約語にも表れる
  #topic-sentence(highlight: [予約語に設計思想が顕れる])[]
]

#two-col-slide("予約語と設計思想 defer と mut",
  compare-card("Go: `defer`", [
    #code-file-window("assets/yoyakugo/defer_go.go", lang: "go")
  ], border-color: accent-cyan),
  compare-card("Rust: `mut`", [
    #code-file-window("assets/yoyakugo/mut_rs.rs", lang: "rust")
  ], border-color: accent-yellow),
)

#agenda-slide(agenda-items, current: 1)

#section-slide[業界トレンドと予約語の変更]

#content-slide("コールバック地獄と非同期構文の需要")[
  - 2010年代〜: Web API・DB・ファイル I/O など「待ち」が当たり前に
  - 「C10K問題」の解決策として非同期処理が注目される
  - 従来のコールバック方式では可読性が急激に低下
  #v(8pt)
  #code-file-window("assets/yoyakugo/callback_hell.js", lang: "javascript")
  #topic-sentence(highlight: [より直感的な非同期構文])[「async/await」を使いたい！]
]

#content-slide("async/await が予約語になるまで")[
  #async-timeline()
  #topic-sentence[C\# 5.0（2012）を皮切りに主要言語へ次々と伝播]
]

#content-slide("予約語への昇格が引き起こしたこと")[
  #grid(
    columns: (1fr, 1fr),
    gutter: 16pt,
    compare-card("Before: Python 3.7 未満", [
      #code-file-window("assets/yoyakugo/celery_old.py", lang: "python")
    ], border-color: accent-green),
    compare-card("After: Python 3.7 以降", [
      #code-file-window("assets/yoyakugo/celery_new.py", lang: "python")
    ], border-color: accent-red),
  )
  #topic-sentence(highlight: [引数名 1 語の変更])[でエコシステム全体が揺れた]
]

#two-col-slide("Python の対応：予約語の段階的昇格",
  compare-card("Python 3.5（2015）ソフトキーワード", [
    - 変数名・引数名としても使用可能
    - `async def` 構文が使えるようになる
    - 既存コードへの影響なし
    - ライブラリが対応期間を確保
  ], border-color: accent-yellow),
  compare-card("Python 3.7（2018）厳格な予約語", [
    - 変数名・引数名として使用不可
    - `async=True` のようなコードが構文エラー
    - Celery・Kombu などが対応を余儀なくされる
    - `is_async=True` などへのリネームが必要
  ], border-color: accent-red),
)

#content-slide("async/await の予約語対応から見えること")[
  - 業界トレンドの変化は言語を変える#text(fill: accent-hl)[圧力]になる
  - 予約語 1 語の変更 = 既存コード全体への影響
  - 各言語はそれぞれの戦略でこれに対処した
  #v(6pt)
  #dark-table(
    ("言語", "戦略", "破壊的変更"),
    ("Python", "ソフトKW → ハードKWの段階移行", "あり（3.7）"),
    ("JavaScript", "strict mode（オプトイン）", "最小限"),
    ("Rust", "エディション制（プロジェクト単位）", "エディション内のみ"),
    ("C#", "コンテキストキーワードとして追加", "なし"),
  )
  #topic-sentence(highlight: [「いつ・どう変えるか」])[が言語設計の本質的な問い]
]

#agenda-slide(agenda-items, current: 2)
#section-slide[予約語戦略から見るソフトウェア設計]

#content-slide("「使われていない」予約語")[
  - 将来使うかもしれない語を#text(fill: accent-hl)[初期段階で先行確保]する戦略
    - 後から追加するほど既存コードへの影響が大きくなるため
  - このような予約語を *Future Reserved Words* と呼ぶ
  - Java の `const` / `goto`：Java 25 現在も機能しないまま残り続けている
  - JavaScript ES5 は逆に、予測外れのFRWを#text(fill: accent-hl)[大量に削除]する決断
  #topic-sentence(highlight: [「負債として受容」するか「破壊的変更を行う」か])[]
]

#two-col-slide("予約語は先行確保？  必要な時に追加？",
  compare-card("先行確保（Java スタイル）", [
    - 将来の需要に備えて早めに確保
    - 予測が当たれば後の破壊的変更を回避
    - 予測が外れると
      - → #text(fill: accent-red)[未使用の負債]に
  ], border-color: accent-yellow),
  compare-card("必要になったら追加", [
    - 今必要なものだけ実装する
    - 後から追加するほど
      - → #text(fill: accent-red)[既存コードへの影響大]
  ], border-color: accent-cyan),
)

#content-slide("Rust エディション制：第三の道")[
  - プロジェクト単位で言語仕様のバージョンを選択できる
  - *エディション内*は互換性を保つ方針
  #v(8pt)
  #code-file-window("assets/yoyakugo/rust_edition.toml", lang: "toml")
  #topic-sentence[「プロジェクトごとにルールを選ぶ」柔軟な戦略]
]

#content-slide("予約語戦略から得られる教訓")[
  - 拡張性のための先行設計か、YAGNI か
    - → 予測精度 × 変更コストで判断が変わる
  - 互換性維持の#text(fill: accent-hl)[コストを誰が払うか]
    - Java: 言語が払う（負債として保持）
    - JavaScript: 生態系が払う（大量の修正）
    - Rust: 開発者が選ぶ（エディション移行）
  - 変更の影響範囲を#text(fill: accent-hl)[仕組みで制御]する
  #topic-sentence(highlight: [「変更とどう向き合うか」])[は言語設計もプロダクト開発も同じ問い]
]

#content-slide("今日から試せること")[
  - Pythonなら `import keyword; print(keyword.kwlist)` を叩いてみる
    - 手元で予約語一覧がすぐ確認できる
  - 新しい言語を学ぶとき「何が予約語か」から入ってみる
    - 設計思想の輪郭がつかめる
  - 自分のコードでも「この名前を上書きされたくない」か考える
  #topic-sentence(highlight: [予約語は言語設計者のメッセージ])[……かもしれない]
]

#content-slide("記事も公開しています")[
  #align(center, image("assets/yoyakugo/article_thumbnail.png", width: 70%))
  #topic-sentence(highlight: [Zenn にて公開中])[です！ぜひ読んでみてください]
]

#ending-slide("ご清聴ありがとうございました", source: image("assets/yoyakugo/icons/twitter.png"))
