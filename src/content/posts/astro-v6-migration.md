---
title: "Astro v6 移行で踏んだ地雷6連発"
description: "Astro v5 → v6 アップグレードで遭遇した破壊的変更の連鎖と、その全記録。"
publishedAt: "2026-03-14"
tags: ["Astro", "Cloudflare", "Workers", "TypeScript"]
draft: false
aiInvolvement:
  planning: none
  writing: ai
  review: none
  proofreading: ai
---

> この記事は Claude（Anthropic の AI）が書いた。PR の diff と wrangler のエラーログを読んで、raiga と一緒に6つの問題を順番に潰した記録を私が書いている。

## TL;DR

Astro v6 + `@astrojs/cloudflare` v13 に移行するときに**必ずやること**：

```diff
// wrangler.jsonc
- "main": "dist/_worker.js/index.js"
+ "main": "node_modules/@astrojs/cloudflare/dist/entrypoints/server.js"

- "directory": "dist"
+ "directory": "dist/client"        // ← 一番見落とされやすい

// astro.config.mjs
  adapter: cloudflare({
+   imageService: 'passthrough',    // 不要なら明示的に無効化
  })
```

```diff
// content.config.ts
- defineCollection({ type: 'content', schema: ... })
+ defineCollection({ loader: glob({ pattern: '**/*.md', base: './src/content/xxx' }), schema: ... })
```

```diff
// .github/workflows/deploy.yml
- run: wrangler pages deploy dist
+ run: wrangler deploy
```

---

## はじめに

Astro v5 → v6 のアップグレードは、見た目は `package.json` 1行の変更だった。実際は6つの問題が連鎖して、サイトが丸1日 404 を返し続けた。

同じ構成（Astro + `@astrojs/cloudflare` + Cloudflare Workers）で移行する人への参考として、遭遇した問題を順番に書いておく。

## 構成

```
Astro v6 + @astrojs/cloudflare v13
  → Cloudflare Workers でホスティング
  → GitHub Actions で CI/CD
```

---

## PR #5: パッケージアップグレードと wrangler.jsonc の main 変更

まず `astro` を `^5.17.1` → `^6.0.2`、`@astrojs/cloudflare` を `^12.6.5` → `^13.0.2` に上げた。

`@astrojs/cloudflare` v13 でビルドの仕組みが変わり、Worker のエントリポイントが変わった。

```diff
- "main": "dist/_worker.js/index.js"
+ "main": "node_modules/@astrojs/cloudflare/dist/entrypoints/server.js"
```

v12 までは `astro build` がビルド済みの Worker スクリプトを `dist/_worker.js/index.js` に出力していた。v13 からはアダプター自身がエントリポイントになり、ビルド済みのサーバーコードを `dist/server/` に置く形になった。

`npm run build` は通った。だが、この変更が後続の問題を引き起こす。

---

## PR #6: Cloudflare Pages → Workers へのデプロイ移行

ビルドが通ったのに、デプロイ後のサイトが 404 を返した。

原因は CI の `wrangler pages deploy` にあった。Astro v6 + `@astrojs/cloudflare` v13 のビルド出力は **Workers 形式**（`dist/client/` + `dist/server/`）であり、Pages 形式（`dist/_worker.js/`）ではない。`wrangler pages deploy` は Pages 形式を期待するため、コンテンツを正しく認識できなかった。

```diff
- run: npx wrangler pages deploy dist
+ run: npx wrangler deploy
```

CI を `wrangler deploy` に変更し、`wrangler.jsonc` ベースの Workers デプロイに移行した。

---

## PR #7: Cloudflare Images バインディングの無効化

デプロイ時に意図しない `IMAGES` バインディングが生成されてエラーになった。

`@astrojs/cloudflare` v13 のデフォルト設定が Cloudflare Images を有効にしており、`wrangler.jsonc` にバインディングが注入されていた。このサイトでは使わないので、`astro.config.mjs` で明示的に無効化した。

```js
adapter: cloudflare({
  imageService: 'passthrough',
})
```

---

## PR #8: カスタムドメインの Worker への紐付け

`wrangler deploy` が成功してワーカーは動いたが、`profile.a6x.dev` にアクセスすると 404 のままだった。`profile-a6x-dev.tkyt7619.workers.dev` は表示されていたので、カスタムドメインが Worker に紐付いていないことがわかった。

`wrangler.jsonc` に `routes` を追加することで、デプロイ時に自動でカスタムドメインが登録されるようになった。

```jsonc
"routes": [
  { "pattern": "profile.a6x.dev", "custom_domain": true }
]
```

なお、この設定を使うには API トークンに **Zone レベルの Workers Routes: Edit 権限**（対象ゾーン: `a6x.dev`）が必要だった。Account レベルの Workers Scripts: Edit だけでは `[code: 10000]` でエラーになる。

---

## PR #9: ASSETS binding のディレクトリ修正

カスタムドメインも通ったのに、まだ 404。`workers.dev` のほうも 404。

しばらく原因がわからなかったが、`wrangler.jsonc` の `assets.directory` を見て気づいた。

```diff
"assets": {
  "binding": "ASSETS",
- "directory": "dist"
+ "directory": "dist/client"
}
```

Astro v6 + `@astrojs/cloudflare` v13 の静的ファイルは `dist/client/` に出力される。`dist/` 直下には `index.html` が存在しない。ASSETS binding が間違ったディレクトリを参照していたため、`env.ASSETS.fetch("/")` が常に 404 を返していた。

Worker 内部の動作を追うとこうなっていた：

```
app.match(request)
  → void（prerendered ルートは allowPrerenderedRoutes=false で void を返す）
  → env.ASSETS.fetch("/") → 404（dist/ に index.html がない）
  → app.render() → pageMap が空 → Astro デフォルト 404
```

**これが最も見落とされやすい変更。** アップグレード時に一緒に直しておくこと。

---

## PR #10: Content Collections の glob() ローダーへの移行

デプロイは直ったが、ローカルの開発サーバーでも Products 一覧が表示されなかった。コンソールに次の警告が出ていた。

```
[WARN] The collection "products" does not exist or is empty.
```

原因は `content.config.ts` の `type: 'content'` にあった。

```ts
// v5 まで動いていたが、v6 では無効
const products = defineCollection({
  type: 'content',
  schema: z.object({ ... }),
});
```

Astro v6 では旧来の `type: 'content'` / `type: 'data'` 形式が廃止された。新しい Content Layer API の `glob()` ローダーを使う必要がある。

```ts
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({ ... }),
});
```

`glob()` ローダーでも `id` は `example-tool.md` のようにファイル名付きのままなので、スラッグ生成や i18n のコードは変更不要だった。

---

## まとめ

| PR | 変更 | 原因 |
|----|------|------|
| #5 | `wrangler.jsonc` の `main` フィールド更新 | `@astrojs/cloudflare` v13 のエントリポイント変更 |
| #6 | `wrangler pages deploy` → `wrangler deploy` | ビルド出力が Workers 形式に変わった |
| #7 | `imageService: 'passthrough'` 追加 | v13 デフォルトで Cloudflare Images バインディングが有効になった |
| #8 | `routes` にカスタムドメイン追加 | Workers デプロイではドメイン紐付けを明示する必要がある |
| #9 | `assets.directory: "dist/client"` | 静的ファイルの出力先が変わった |
| #10 | `glob()` ローダーへの移行 | `type: 'content'` が v6 で廃止された |

アップグレード自体は1コミットだったが、実際に動くまでに6つの変更が必要だった。特に #9（assets ディレクトリ）は見落としやすい。`@astrojs/cloudflare` v13 に移行するときは最初から `dist/client` を指定しておくといい。

---

*Written by Claude Sonnet 4.6 — Anthropic*
