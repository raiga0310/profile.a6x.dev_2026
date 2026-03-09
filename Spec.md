# profile.a6x.dev リニューアル設計書

## 概要

VitePress → Astro への移行を伴うポートフォリオサイトのリニューアル。

### 方針決定事項

| 項目 | 決定 |
|------|------|
| SSG | **Astro** |
| Typstスライド表示 | PDF埋め込み（pdf.js） |
| Zenn/Qiita記事取得 | ビルド時API自動取得 |
| プロフィール系ページ | トップページに統合 |
| Typstソース管理 | 同リポジトリ内、CIでPDFビルド |
| `/slides` デザイン | ダーク背景・モノスペース（Typstスライドのトンマナ準拠） |
| 他ページデザイン | シンプル・ミニマル（現行の延長線） |

---

## サイト構造

```
profile.a6x.dev/
├── /                     トップページ（LP風・セクション統合）
├── /products/            制作物一覧・詳細（現状移植）
├── /slides/              スライド一覧（ダークテーマ）
│   └── /slides/[slug]    個別スライド（pdf.jsビューア）
├── /blogs/               記事一覧（Zenn/Qiita + サイト内）
│   └── /blogs/posts/[slug]  サイト内独自記事
```

**ナビバー**: `Home | Products | Slides | Blog`

---

## ディレクトリ構成

```
profile.a6x.dev/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro          共通レイアウト（ナビ・フッター）
│   │   ├── LandingLayout.astro       トップページLP用
│   │   ├── DarkLayout.astro          /slides 用ダークテーマ
│   │   └── PostLayout.astro          ブログ記事用
│   │
│   ├── pages/
│   │   ├── index.astro               トップ（LP統合）
│   │   ├── products/
│   │   │   ├── index.astro           制作物一覧
│   │   │   └── [slug].astro          制作物詳細
│   │   ├── slides/
│   │   │   ├── index.astro           スライド一覧
│   │   │   └── [slug].astro          個別スライド（PDFビューア）
│   │   └── blogs/
│   │       ├── index.astro           記事一覧
│   │       └── posts/[slug].astro    サイト内記事詳細
│   │
│   ├── components/
│   │   ├── Nav.astro                 グローバルナビゲーション
│   │   ├── Footer.astro              フッター
│   │   ├── SlideViewer.astro         pdf.js ラッパー（ページ送りUI）
│   │   ├── SlideCard.astro           スライド一覧のカード
│   │   ├── BlogCard.astro            ブログリンクカード
│   │   ├── ExternalArticleCard.astro Zenn/Qiita 外部記事カード
│   │   ├── SectionHero.astro         トップ：ヒーローセクション
│   │   ├── SectionProfile.astro      トップ：プロフィール
│   │   ├── SectionHistory.astro      トップ：経歴
│   │   ├── SectionSkills.astro       トップ：スキル
│   │   ├── SectionContact.astro      トップ：連絡先
│   │   └── SectionProducts.astro     トップ：制作物プレビュー
│   │
│   ├── content/
│   │   ├── products/                 制作物データ（.md / frontmatter）
│   │   ├── slides/                   スライドメタデータ（.md / frontmatter）
│   │   └── posts/                    ブログ記事（.md）
│   │
│   ├── lib/
│   │   └── fetchArticles.ts          Zenn/Qiita API 取得ロジック
│   │
│   └── styles/
│       ├── global.css                グローバルスタイル
│       └── slides-dark.css           /slides 専用ダークテーマ
│
├── public/
│   └── slides/                       ビルド済み PDF
│
├── typst/                            Typst ソースファイル
│   ├── slide-a.typ
│   └── slide-b.typ
│
├── astro.config.mjs
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml                Typst ビルド + Astro ビルド + デプロイ
```

---

## 各機能の詳細設計

### 1. トップページ（`/`）

**レイアウト**: `LandingLayout.astro`（BaseLayoutを継承）

**セクション構成**（スクロールで遷移）:
1. **Hero** — 名前・一言紹介・アイコン
2. **Profile** — 自己紹介テキスト（プログラミング/創作/散歩など現行の内容）
3. **History** — 経歴タイムライン
4. **Skills** — スキル・経験（言語/フレームワーク等）
5. **Products** — 制作物プレビュー（カードで数件、「もっと見る → /products」）
6. **Contact** — 連絡先・SNSリンク

**データソース**: 静的に `.astro` 内に記述 or `content/` 配下のYAML/JSONで管理

---

### 2. スライドページ（`/slides`）

**デザイン**: ダーク背景 + モノスペースフォント（Typstスライドに合わせる）

**カラーパレット案**:
```css
/* slides-dark.css */
:root {
  --slides-bg: #1a1a2e;         /* 深いダーク背景 */
  --slides-surface: #232340;     /* カード背景 */
  --slides-text: #e0e0e0;        /* メインテキスト */
  --slides-accent: #7c8cf5;      /* アクセントカラー */
  --slides-muted: #888;          /* サブテキスト */
  --slides-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

**一覧ページ（`/slides/index.astro`）**:
- Content Collections から `content/slides/*.md` を取得
- カード形式で表示（タイトル、日付、概要、タグ）
- 新しい順ソート

**スライドメタデータの例**（`content/slides/reserved-keywords.md`）:
```yaml
---
title: "Programming Viewing with Reserved Keywords"
date: 2026-03-07
event: "Matsuriba Max 2026"
description: "予約語をテーマにプログラミング言語の設計思想を読み解く"
pdf: "/slides/reserved-keywords.pdf"
tags: ["programming", "language-design"]
speakerdeck: "https://speakerdeck.com/raiga0310/..."
---
```

**個別ページ（`/slides/[slug].astro`）**:
- `<SlideViewer>` コンポーネントで PDF を表示
- pdf.js でページ送り（← →キー、ボタン、スワイプ対応）
- メタ情報（タイトル、イベント名、日付）表示
- SpeakerDeck への外部リンクボタン

**`<SlideViewer>` コンポーネント仕様**:
- pdf.js の CDN版 を使用
- ページ送りUI（現在ページ / 総ページ、前へ・次へボタン）
- キーボード操作対応（← →、フルスクリーン）
- レスポンシブ（モバイルでもスライド比率を維持）
- ダークテーマに統合された見た目

---

### 3. ブログページ（`/blogs`）

**一覧ページ（`/blogs/index.astro`）**:

3種類のソースをタブまたはセクションで表示:

#### Zenn 記事
- **API**: `https://zenn.dev/api/articles?username={ZENN_USERNAME}&order=latest`
- **取得タイミング**: ビルド時に `lib/fetchArticles.ts` で取得
- **表示**: リンクカード（タイトル、概要、公開日、Zennアイコン）
- **リンク先**: Zenn の記事ページ（外部リンク）

#### Qiita 記事
- **API**: `https://qiita.com/api/v2/users/{QIITA_USERNAME}/items`
- **取得タイミング**: ビルド時に `lib/fetchArticles.ts` で取得
- **レート制限**: 認証なしで60req/h（ビルド時1回なので問題なし）
- **表示**: リンクカード（タイトル、概要、公開日、Qiitaアイコン）
- **リンク先**: Qiita の記事ページ（外部リンク）

#### サイト内記事
- **ソース**: `content/posts/*.md`（Content Collections）
- **表示**: カード（タイトル、概要、公開日）
- **リンク先**: `/blogs/posts/[slug]`

**フィルタリングUI**: タブ切り替え `All | Zenn | Qiita | This Site`

**`lib/fetchArticles.ts` の構造**:
```typescript
interface ExternalArticle {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: 'zenn' | 'qiita';
  tags?: string[];
  thumbnail?: string;
}

export async function fetchZennArticles(username: string): Promise<ExternalArticle[]>;
export async function fetchQiitaArticles(username: string): Promise<ExternalArticle[]>;
export async function fetchAllExternalArticles(): Promise<ExternalArticle[]>;
```

---

### 4. 制作物ページ（`/products`）

現行VitePressの内容をそのまま移植。各制作物は `content/products/*.md` に frontmatter + Markdown で管理。

---

## CI/CD（GitHub Actions）

### ワークフロー: `deploy.yml`

```yaml
# 概要フロー
jobs:
  build:
    steps:
      # 1. Typst ビルド
      - uses: typst-community/setup-typst@v4
      - run: |
          for f in typst/*.typ; do
            typst compile "$f" "public/slides/$(basename "${f%.typ}").pdf"
          done

      # 2. Astro ビルド（Zenn/Qiita API取得もこの中で実行される）
      - run: npm ci
      - run: npm run build

      # 3. デプロイ（Cloudflare Pages / Vercel / GitHub Pages 等）
      - # デプロイステップ
```

**ポイント**:
- Typst ビルドを Astro ビルドより先に実行（PDFが `public/` にないとリンク切れになる）
- Zenn/Qiita API 取得はAstroビルド内で自動実行される
- mainブランチへのpush + 手動トリガーで起動

---

## 移行チェックリスト

### Phase 1: 基盤構築
- [ ] Astro プロジェクト初期化
- [ ] BaseLayout / Nav / Footer 作成
- [ ] グローバルCSS セットアップ
- [ ] デプロイパイプライン構築（Astro単体で動く状態）

### Phase 2: トップページ
- [ ] LandingLayout 作成
- [ ] 各セクションコンポーネント実装
- [ ] 既存の profile / history / skills / contacts の内容を統合
- [ ] レスポンシブ対応

### Phase 3: 制作物ページ移植
- [ ] Content Collections で products 定義
- [ ] 既存の制作物 Markdown を移植
- [ ] 一覧 / 詳細ページ作成

### Phase 4: スライドページ
- [ ] DarkLayout + slides-dark.css 作成
- [ ] SlideViewer コンポーネント実装（pdf.js）
- [ ] Content Collections で slides メタデータ定義
- [ ] 一覧 / 個別ページ作成
- [ ] GitHub Actions に Typst ビルドステップ追加
- [ ] `typst/` ディレクトリにソースファイル配置

### Phase 5: ブログページ
- [ ] fetchArticles.ts 実装（Zenn / Qiita API）
- [ ] ExternalArticleCard / BlogCard コンポーネント作成
- [ ] Content Collections で posts 定義
- [ ] 一覧ページ（タブ切り替え）作成
- [ ] サイト内記事の詳細ページ作成

### Phase 6: 仕上げ
- [ ] OGP / メタタグ設定
- [ ] favicon / サイトアイコン
- [ ] 404 ページ
- [ ] パフォーマンス確認（Lighthouse）
- [ ] 旧VitePressからのリダイレクト設定（必要に応じて）
- [ ] ドメイン切り替え

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| SSG | Astro |
| スタイリング | CSS（スコープ付き） + グローバルCSS |
| PDF表示 | pdf.js（CDN） |
| スライドビルド | Typst（CI上でコンパイル） |
| コンテンツ管理 | Astro Content Collections（Markdown + frontmatter） |
| 外部記事取得 | Zenn API / Qiita API（ビルド時fetch） |
| CI/CD | GitHub Actions |
| ホスティング | 現行と同じ（要確認） |
| フォント | JetBrains Mono / Fira Code（/slides）、システムフォント（他） |
