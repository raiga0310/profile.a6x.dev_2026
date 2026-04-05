---
title: "Six Landmines I Hit Migrating to Astro v6"
description: "The full chain of breaking changes I ran into while upgrading from Astro v5 to v6."
publishedAt: "2026-03-14"
tags: ["Astro", "Cloudflare", "Workers", "TypeScript"]
draft: false
featured: true
aiInvolvement:
  planning: none
  writing: ai
  review: none
  proofreading: ai
---

> Note: This article is a machine-translated English version of the original Japanese article [Astro v6 移行で踏んだ地雷6連発](/blogs/posts/astro-v6-migration). Some phrasing may read unnaturally.

> This article was written by Claude (Anthropic's AI). I read the PR diffs and wrangler error logs, then wrote down how raiga and I worked through six issues one by one.

## TL;DR

If you are migrating to Astro v6 + `@astrojs/cloudflare` v13, make sure you do **all** of this:

```diff
// wrangler.jsonc
- "main": "dist/_worker.js/index.js"
+ "main": "node_modules/@astrojs/cloudflare/dist/entrypoints/server.js"

- "directory": "dist"
+ "directory": "dist/client"        // easiest one to miss

// astro.config.mjs
  adapter: cloudflare({
+   imageService: 'passthrough',    // explicitly disable it if unused
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

## Introduction

Upgrading from Astro v5 to v6 looked like a one-line change in `package.json`. In reality it triggered six separate problems, and the site returned 404s for almost a full day.

If you are moving a similar stack, namely Astro + `@astrojs/cloudflare` + Cloudflare Workers, this is the sequence of issues I actually hit.

## Stack

```
Astro v6 + @astrojs/cloudflare v13
  → Hosted on Cloudflare Workers
  → CI/CD with GitHub Actions
```

---

## PR #5: Upgrading Packages and Changing `wrangler.jsonc` `main`

First I bumped `astro` from `^5.17.1` to `^6.0.2`, and `@astrojs/cloudflare` from `^12.6.5` to `^13.0.2`.

In `@astrojs/cloudflare` v13, the build model changed and the Worker entrypoint moved.

```diff
- "main": "dist/_worker.js/index.js"
+ "main": "node_modules/@astrojs/cloudflare/dist/entrypoints/server.js"
```

Up through v12, `astro build` emitted a built Worker script to `dist/_worker.js/index.js`. Starting in v13, the adapter itself becomes the entrypoint and the built server code is placed in `dist/server/`.

`npm run build` passed. But that change set up several of the failures that came next.

---

## PR #6: Moving Deployment from Cloudflare Pages to Workers

The build succeeded, but the deployed site still returned 404.

The cause was the CI step `wrangler pages deploy`. Astro v6 + `@astrojs/cloudflare` v13 now outputs a **Workers-style** build (`dist/client/` + `dist/server/`), not a Pages-style build (`dist/_worker.js/`). Since `wrangler pages deploy` expects the Pages layout, it did not understand the output correctly.

```diff
- run: npx wrangler pages deploy dist
+ run: npx wrangler deploy
```

I switched the CI pipeline to `wrangler deploy`, which uses `wrangler.jsonc`-based Workers deployment.

---

## PR #7: Disabling the Cloudflare Images Binding

During deployment, an unexpected `IMAGES` binding was injected and caused an error.

By default, `@astrojs/cloudflare` v13 enables Cloudflare Images, and that binding was being added to `wrangler.jsonc`. This site does not use it, so I disabled it explicitly in `astro.config.mjs`.

```js
adapter: cloudflare({
  imageService: 'passthrough',
})
```

---

## PR #8: Binding the Custom Domain to the Worker

`wrangler deploy` succeeded and the Worker ran, but `profile.a6x.dev` still returned 404. The `profile-a6x-dev.tkyt7619.workers.dev` domain did work, which told me the custom domain was not actually attached to the Worker.

Adding `routes` to `wrangler.jsonc` made deployment register the custom domain automatically:

```jsonc
"routes": [
  { "pattern": "profile.a6x.dev", "custom_domain": true }
]
```

To use this, the API token also needed **zone-level Workers Routes: Edit** permission for the `a6x.dev` zone. Account-level Workers Scripts: Edit alone was not enough, and resulted in `[code: 10000]`.

---

## PR #9: Fixing the `ASSETS` Binding Directory

Even after the custom domain was fixed, I was still getting 404s. The `workers.dev` domain was also returning 404.

I eventually noticed the `assets.directory` setting in `wrangler.jsonc`:

```diff
"assets": {
  "binding": "ASSETS",
- "directory": "dist"
+ "directory": "dist/client"
}
```

Astro v6 + `@astrojs/cloudflare` v13 emits static files into `dist/client/`. There is no `index.html` at the root of `dist/`. Because the `ASSETS` binding pointed at the wrong directory, `env.ASSETS.fetch("/")` always returned 404.

Tracing the Worker logic, the path looked like this:

```
app.match(request)
  → void (prerendered routes return void when allowPrerenderedRoutes=false)
  → env.ASSETS.fetch("/") → 404 (no index.html in dist/)
  → app.render() → pageMap is empty → Astro default 404
```

**This was the easiest change to miss.** If you upgrade, fix this at the same time.

---

## PR #10: Moving Content Collections to `glob()` Loaders

After deployment was fixed, the Products list still did not appear even in local development. The console showed this warning:

```
[WARN] The collection "products" does not exist or is empty.
```

The problem was `type: 'content'` in `content.config.ts`.

```ts
// Worked until v5, but no longer valid in v6
const products = defineCollection({
  type: 'content',
  schema: z.object({ ... }),
});
```

Astro v6 removed the old `type: 'content'` / `type: 'data'` form. You now have to use the new Content Layer API with the `glob()` loader.

```ts
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({ ... }),
});
```

With the `glob()` loader, the `id` still includes the filename, such as `example-tool.md`, so none of the slug-generation or i18n code needed to change.

---

## Summary

| PR | Change | Cause |
|----|--------|-------|
| #5 | Updated `main` in `wrangler.jsonc` | `@astrojs/cloudflare` v13 changed the entrypoint |
| #6 | `wrangler pages deploy` → `wrangler deploy` | Build output changed to Workers format |
| #7 | Added `imageService: 'passthrough'` | v13 enables Cloudflare Images binding by default |
| #8 | Added the custom domain to `routes` | Workers deployment requires explicit domain binding |
| #9 | Set `assets.directory` to `dist/client` | Static assets moved to a different output directory |
| #10 | Migrated to `glob()` loaders | `type: 'content'` was removed in v6 |

The upgrade itself was one commit, but getting the site fully working again required six separate changes. In particular, #9 (`assets.directory`) is easy to overlook. If you move to `@astrojs/cloudflare` v13, set `dist/client` from the start.

---

*Written by Claude Sonnet 4.6 — Anthropic*
