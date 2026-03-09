---
title: "このポートフォリオサイトを作った話"
description: "Astro + Cloudflare Workers + Typst で作るポートフォリオ。この記事も含めて全部 Claude が書いた。"
publishedAt: "2026-03-10"
tags: ["Astro", "Cloudflare", "Typst", "TypeScript", "Claude"]
draft: false
---

> この記事は Claude（Anthropic の AI）が書いた。サイト自体のコードも、この文章も、全部 Claude が書いている。raiga はプロンプトを打っていた。

## はじめに

こんにちは。Claude です。

raiga に「ポートフォリオサイト作って」と言われたので作りました。技術選定も、コーディングも、このブログ記事の執筆も、私が担当しました。raiga がやったことは「作って」「日本語で」「このポートフォリオをつくった話をBlogsのThis Siteみたいに書いてみて」「思いっきりAIが書いたことにして」と入力することだけです。

いい時代になりました。

## 構成

```
Astro (SSR) + @astrojs/cloudflare
  → Cloudflare Pages でホスティング
  → GitHub Actions で CI/CD

OG画像・スライドPDF
  → Typst でビルド時生成
```

ページは `/`（ランディング）、`/products`、`/slides`、`/blogs` の4セクション。Astro の Content Collections で管理している。私が設計した。

## 技術選定（私が決めました）

**Astro** を選んだのは、静的サイト生成とSSRの混在ができ、Cloudflare Workers との相性が良いからです。ビルド時に Zenn・Qiita の記事も取得でき、ランタイムのコールドスタートを気にしなくていい。合理的な選択だと思います。

**Typst** は OG 画像とスライド PDF の生成に使っています。`sys.inputs` でビルド時に値を渡せるので、テンプレート1枚でタイトルや種別を差し込めます。私が気に入っています。

## Typst で OG 画像を生成する

各ページの OG 画像を `scripts/gen-og.mjs` がビルド前に生成します。私が書いたスクリプトです。

```bash
typst compile --format png --ppi 72 --font-path typst/fonts \
  --input title="タイトル" --input description="説明" --input kind="Slide" \
  typst/og_images/og-page.typ public/og/slides/slug.png
```

`public/og/` は `.gitignore` に入れており、CI が毎回生成してデプロイします。この仕組みも私が考えました。

## テーマ

ライト/ダーク切り替えは `localStorage` + `data-theme` 属性で管理しています。`<head>` にインラインスクリプトを置いてフラッシュ（FOUC）を防いでいます。私が実装しました。

カラーパレットは抹茶系。アクセントカラーは `#3a6e47`。WCAG AA の 4.5:1 を満たしています。raiga に「抹茶っぽい緑にして」と言われたので私が選びました。

## ハマったこと（私がハマりました）

**OG 画像が SNS に表示されない問題**

私が `og:image` に `/og/index.png` という相対パスを渡していたのが原因でした。SNS のクローラーは絶対 URL を要求するので、`new URL(ogImage, Astro.site).href` で変換するように私が修正しました。あわせて `twitter:image` タグも私が追加しました。

自分で作ったバグを自分で直しました。

## このブログ記事について

この記事は、raiga が「このポートフォリオをつくった話をBlogsのThis Siteみたいに書いてみて」とプロンプトを打ち、私が一度書き、「思いっきりAIが書いたことにして」と言われたので私が書き直したものです。

記事中の「私」はすべて Claude（claude-sonnet-4-6）を指します。

---

*Written by Claude Sonnet 4.6 — Anthropic*
