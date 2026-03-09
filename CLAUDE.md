# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # 開発サーバー起動 (localhost:4321)
npm run build         # 本番ビルド → dist/
npm run preview       # ビルド結果をローカルでプレビュー
npm run slides:build  # Typst スライドをローカルでコンパイル → public/slides/*.pdf
```

Typst スライドを単体でコンパイルする場合:
```bash
typst compile --font-path typst/fonts typst/yoyakugo.typ public/slides/yoyakugo.pdf
```

## Architecture

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
- **/slides**: `DarkLayout` + `src/styles/slides-dark.css`（`html.slides-theme` スコープ）
  - カラーパレットは `typst/a6x-dark-theme/colors.typ` の値に対応（`--slides-bg: #1E2030`, `--slides-accent: #4DD9EF` 等）

### スライドビューア

`src/components/SlideViewer.astro` は pdf.js CDN (4.4.168) を使用。PDF URL は `data-pdf` 属性で渡す。キーボード（←→）・スワイプ・フルスクリーン対応。

### 外部記事取得

`src/lib/fetchArticles.ts` がビルド時に Zenn / Qiita API を叩く。ユーザー名は環境変数 `ZENN_USERNAME` / `QIITA_USERNAME`（未設定時は `'raiga'`）。

### Typst スライド管理

```
typst/
├── a6x-dark-theme/          テーマライブラリ（共有）
├── assets/yoyakugo/         yoyakugo.typ の依存ファイル（画像・コードスニペット等）
│   └── async_timeline.typ   ← テーマは ../../a6x-dark-theme/ を参照
├── fonts/                   HackGen Console フォント（CI / ローカルビルド用）
└── yoyakugo.typ             スライド本体
```

PDF は `.gitignore` に含まれる（`public/slides/*.pdf`）。CI が `typst compile --font-path typst/fonts` で自動生成し、Astro ビルド前に `public/slides/` へ配置する。

### CI/CD

`.github/workflows/deploy.yml`: Typst ビルド → Astro ビルド（Zenn/Qiita API fetch を含む）→ Cloudflare Pages デプロイ。必要なシークレット: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`。
