# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # 開発サーバー起動 (localhost:4321)
npm run build         # 本番ビルド → dist/
npm run preview       # ビルド後 wrangler でローカルプレビュー
npm run deploy        # wrangler でビルド・デプロイ
npm run slides:build  # Typst スライドをローカルでコンパイル → public/slides/*.pdf
npm run og:build      # Typst で各コンテンツの OG 画像生成 → public/og/
npm run cf-typegen    # Cloudflare Workers の型定義生成
```

Typst ファイルを単体でコンパイルする場合:
```bash
# スライド PDF
typst compile --font-path typst/fonts typst/yoyakugo.typ public/slides/yoyakugo.pdf

# OG 画像（sys.inputs でタイトル等を渡す）
typst compile --format png --ppi 72 --font-path typst/fonts \
  --input title="タイトル" --input description="説明" --input kind="Slide" \
  typst/og_images/og-page.typ public/og/slides/slug.png
```

## Architecture

### デプロイメント構成

- **Cloudflare Workers** で動作する Astro アプリ（`@astrojs/cloudflare` adapter 使用）
- サイト URL: `https://profile.a6x.dev`（`astro.config.mjs` で設定）
- `npm run preview` は Wrangler の開発サーバーを使用（Astro 標準プレビューではない）

### ページルーティング

| URL | ファイル | レイアウト |
|-----|---------|-----------|
| `/` | `src/pages/index.astro` | `LandingLayout` |
| `/products`, `/products/[slug]` | `src/pages/products/` | `BaseLayout` |
| `/slides`, `/slides/[slug]` | `src/pages/slides/` | `DarkLayout` |
| `/blogs`, `/blogs/posts/[slug]` | `src/pages/blogs/` | `BaseLayout` / `PostLayout` |

### Content Collections

`src/content.config.ts` で3コレクションを定義:
- **products** — `src/content/products/*.md` (frontmatter: title, description, tags, github, url, featured)
- **slides** — `src/content/slides/*.md` (frontmatter: title, date, event, pdf, tags, speakerdeck)
- **posts** — `src/content/posts/*.md` (frontmatter: title, publishedAt, tags, draft)

`[slug].astro` 側では `p.id.replace(/\.md$/, '')` でスラッグを生成している（Astro 5 では `id` に拡張子が含まれるため）。

### テーマ構成

- **通常ページ**: `BaseLayout` + `src/styles/global.css`（CSS変数 `--bg`, `--accent` 等）
  - ライト/ダーク切り替えは `localStorage('theme')` + `data-theme` 属性（`Nav.astro` の inline script が管理）
  - カラーパレット（抹茶系）: `--accent: #3a6e47`, `--accent-hover: #2d5538`, `--text-muted: #555`
  - コントラスト比は WCAG AA 基準（4.5:1）を満たしている
- **/slides**: `DarkLayout` + `src/styles/slides-dark.css`（`html.slides-theme` スコープ）
  - カラーパレットは `typst/a6x-dark-theme/colors.typ` の値に対応（`--slides-bg: #1E2030`, `--slides-accent: #4DD9EF` 等）

### OG 画像生成

`scripts/gen-og.mjs` がビルド前に実行され、各コンテンツの OG 画像を Typst で生成する:
- テンプレート: `typst/og_images/og-page.typ`（`sys.inputs` で title/description/kind を受け取る）
- 出力先: `public/og/{slides|posts|products}/{slug}.png`（`public/og/` は `.gitignore` 対象、CI が生成）
- 各スラッグページが `/og/{collection}/{slug}.png` を `ogImage` prop としてレイアウトに渡す
- サイトデフォルト OG 画像: `typst/og_images/og.typ`（パラメータなし）

### スライドビューア

`src/components/SlideViewer.astro` は pdf.js CDN (4.4.168, cdnjs.cloudflare.com) を使用。PDF URL は `data-pdf` 属性で渡す。キーボード（←→）・スワイプ・フルスクリーン対応。

### 外部記事取得

`src/lib/fetchArticles.ts` がビルド時に Zenn / Qiita API を叩く。ユーザー名は環境変数 `ZENN_USERNAME` / `QIITA_USERNAME`（`.env` ファイルで設定）。

### Typst 管理

```
typst/
├── og_images/
│   ├── og.typ           サイトデフォルト OG 画像
│   └── og-page.typ      ページ別 OG テンプレート（sys.inputs 使用）
├── a6x-dark-theme/      スライドテーマライブラリ（共有）
├── assets/yoyakugo/     yoyakugo.typ の依存ファイル（画像・コードスニペット等）
│   └── async_timeline.typ   ← テーマは ../../a6x-dark-theme/ を参照
├── fonts/               HackGen Console フォント（CI / ローカルビルド用）
└── yoyakugo.typ         スライド本体
```

PDF・PNG は `.gitignore` 対象。CI が `typst compile --font-path typst/fonts` で自動生成し、Astro ビルド前に配置する。

### セキュリティヘッダー

`public/_headers` で Cloudflare Pages 向けにセキュリティヘッダーを設定（X-Frame-Options, HSTS, COOP, CSP 等）。CSP は Google Fonts・pdf.js (cdnjs) への外部参照と `BaseLayout` の inline script (`unsafe-inline`) を許可している。

### CI/CD

`.github/workflows/deploy.yml`: Typst スライドビルド → OG 画像生成 (`og:build`) → Astro ビルド（Zenn/Qiita API fetch 含む）→ Cloudflare Pages デプロイ。必要なシークレット: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`。

`.github/dependabot.yml`: npm・GitHub Actions を週1回（月曜9時JST）自動更新。
