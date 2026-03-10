# profile.a6x.dev

個人ポートフォリオサイト。制作物・スライド・ブログ記事をまとめたサイトです。

**サイト URL**: https://profile.a6x.dev
**English**: [docs/README.en.md](docs/README.en.md)

## 技術スタック

| 領域 | 技術 |
|------|------|
| フレームワーク | [Astro](https://astro.build) v5 |
| ホスティング | Cloudflare Workers (`@astrojs/cloudflare` adapter) |
| スライドビルド | [Typst](https://typst.app)（CI 上でコンパイル） |
| PDF 表示 | pdf.js (cdnjs CDN v4.4.168) |
| コンテンツ管理 | Astro Content Collections (Markdown + frontmatter) |
| 外部記事取得 | Zenn / Qiita / PR TIMES / sizu.me RSS・API（ビルド時 fetch） |
| OG 画像生成 | Typst（CI 上で自動生成） |
| CI/CD | GitHub Actions → Cloudflare Pages |

## コマンド

```bash
npm run dev           # 開発サーバー起動 (localhost:4321)
npm run build         # 本番ビルド → dist/
npm run preview       # ビルド後 wrangler でローカルプレビュー
npm run deploy        # wrangler でビルド・デプロイ
npm run slides:build  # Typst スライドをローカルでコンパイル → public/slides/*.pdf
npm run og:build      # Typst で各コンテンツの OG 画像生成 → public/og/
npm run cf-typegen    # Cloudflare Workers の型定義生成
```

## ページ構成

| URL | 内容 |
|-----|------|
| `/` | トップ（Hero / Profile / History / Skills / Products / Contact） |
| `/products`, `/products/[slug]` | 制作物一覧・詳細 |
| `/slides`, `/slides/[slug]` | スライド一覧・pdf.js ビューア |
| `/blogs`, `/blogs/posts/[slug]` | 記事一覧・サイト内記事詳細 |

## ディレクトリ構成

```
profile.a6x.dev/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      共通レイアウト（ナビ・フッター）
│   │   ├── LandingLayout.astro   トップページ LP 用
│   │   ├── DarkLayout.astro      /slides 用ダークテーマ
│   │   └── PostLayout.astro      ブログ記事用
│   ├── pages/
│   │   ├── index.astro
│   │   ├── products/[slug].astro
│   │   ├── slides/[slug].astro
│   │   └── blogs/posts/[slug].astro
│   ├── components/               UI コンポーネント群
│   ├── content/
│   │   ├── products/*.md         制作物データ
│   │   ├── slides/*.md           スライドメタデータ
│   │   └── posts/*.md            サイト内ブログ記事
│   ├── lib/
│   │   └── fetchArticles.ts      外部記事取得（Zenn / Qiita / PR TIMES / sizu.me）
│   └── styles/
│       ├── global.css            共通スタイル（抹茶カラーパレット）
│       └── slides-dark.css       /slides 専用ダークテーマ
├── typst/
│   ├── og_images/                OG 画像テンプレート
│   ├── a6x-dark-theme/           スライドテーマライブラリ
│   ├── fonts/                    HackGen Console フォント
│   └── yoyakugo.typ              スライド本体
├── scripts/
│   └── gen-og.mjs               OG 画像生成スクリプト
├── public/
│   ├── slides/                   ビルド済み PDF（CI 生成、gitignore）
│   ├── og/                       OG 画像（CI 生成、gitignore）
│   └── _headers                  Cloudflare セキュリティヘッダー
├── astro.config.mjs
├── wrangler.jsonc
└── .github/workflows/deploy.yml
```

## コンテンツの追加方法

### 制作物

`src/content/products/` に Markdown ファイルを追加:

```yaml
---
title: "プロジェクト名"
description: "説明文"
tags: ["Rust", "WebAssembly"]
github: "https://github.com/..."
url: "https://..."
featured: false
---
本文（Markdown）
```

### スライド

1. `typst/` に `.typ` ファイルを追加
2. `src/content/slides/` にメタデータファイルを追加:

```yaml
---
title: "タイトル"
date: "2026-01-01"
event: "イベント名"
pdf: "/slides/slug.pdf"
tags: ["tag"]
speakerdeck: "https://speakerdeck.com/..."
---
```

### ブログ記事（サイト内）

`src/content/posts/` に Markdown ファイルを追加:

```yaml
---
title: "記事タイトル"
description: "概要"
publishedAt: "2026-01-01"
tags: ["tag"]
draft: false
aiInvolvement:
  planning: none   # none / human / ai
  writing: human
  review: ai
  proofreading: none
---
本文
```

## 環境変数

`.env` ファイルをプロジェクトルートに作成:

```env
ZENN_USERNAME=your_zenn_username
QIITA_USERNAME=your_qiita_username
```

CI では GitHub Actions Variables (`vars.ZENN_USERNAME`, `vars.QIITA_USERNAME`) を参照。未設定の場合はデフォルト値を使用。

## CI/CD

`.github/workflows/deploy.yml` の処理順:

1. Typst スライドのコンパイル → `public/slides/*.pdf`
2. `npm ci` + OG 画像生成 (`npm run og:build`)
3. Astro ビルド（外部記事の fetch もこの中で実行）
4. Cloudflare Pages へデプロイ

必要なシークレット: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## ローカル開発

```bash
git clone https://github.com/raiga0310/profile.a6x.dev
cd profile.a6x.dev
npm install
cp .env.example .env  # 環境変数を設定
npm run dev
```

PDF を表示したい場合は Typst をインストールし `npm run slides:build` を実行。
