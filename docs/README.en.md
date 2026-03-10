# profile.a6x.dev

Personal portfolio site featuring projects, slide presentations, and blog posts.

**Site URL**: https://profile.a6x.dev
**日本語**: [README.md](../README.md)

## Tech Stack

| Area | Technology |
|------|------------|
| Framework | [Astro](https://astro.build) v5 |
| Hosting | Cloudflare Workers (`@astrojs/cloudflare` adapter) |
| Slide build | [Typst](https://typst.app) (compiled in CI) |
| PDF viewer | pdf.js (cdnjs CDN v4.4.168) |
| Content management | Astro Content Collections (Markdown + frontmatter) |
| External articles | Zenn / Qiita / PR TIMES / sizu.me RSS & API (fetched at build time) |
| OG image generation | Typst (auto-generated in CI) |
| CI/CD | GitHub Actions → Cloudflare Pages |

## Commands

```bash
npm run dev           # Start dev server at localhost:4321
npm run build         # Production build → dist/
npm run preview       # Build then preview locally with wrangler
npm run deploy        # Build and deploy via wrangler
npm run slides:build  # Compile Typst slides locally → public/slides/*.pdf
npm run og:build      # Generate OG images via Typst → public/og/
npm run cf-typegen    # Generate Cloudflare Workers type definitions
```

## Pages

| URL | Content |
|-----|---------|
| `/` | Top page (Hero / Profile / History / Skills / Products / Contact) |
| `/products`, `/products/[slug]` | Project list and detail |
| `/slides`, `/slides/[slug]` | Slide list and pdf.js viewer |
| `/blogs`, `/blogs/posts/[slug]` | Article list and on-site blog posts |

## Directory Structure

```
profile.a6x.dev/
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro      Shared layout (nav + footer)
│   │   ├── LandingLayout.astro   Top page LP
│   │   ├── DarkLayout.astro      Dark theme for /slides
│   │   └── PostLayout.astro      Blog post layout
│   ├── pages/
│   │   ├── index.astro
│   │   ├── products/[slug].astro
│   │   ├── slides/[slug].astro
│   │   └── blogs/posts/[slug].astro
│   ├── components/               UI components
│   ├── content/
│   │   ├── products/*.md         Project data
│   │   ├── slides/*.md           Slide metadata
│   │   └── posts/*.md            On-site blog articles
│   ├── lib/
│   │   └── fetchArticles.ts      External article fetching (Zenn / Qiita / PR TIMES / sizu.me)
│   └── styles/
│       ├── global.css            Global styles (matcha color palette)
│       └── slides-dark.css       Dark theme for /slides
├── typst/
│   ├── og_images/                OG image templates
│   ├── a6x-dark-theme/           Slide theme library
│   ├── fonts/                    HackGen Console fonts
│   └── yoyakugo.typ              Slide source
├── scripts/
│   └── gen-og.mjs               OG image generation script
├── public/
│   ├── slides/                   Compiled PDFs (CI-generated, gitignored)
│   ├── og/                       OG images (CI-generated, gitignored)
│   └── _headers                  Cloudflare security headers
├── astro.config.mjs
├── wrangler.jsonc
└── .github/workflows/deploy.yml
```

## Adding Content

### Projects

Add a Markdown file to `src/content/products/`:

```yaml
---
title: "Project Name"
description: "Description"
tags: ["Rust", "WebAssembly"]
github: "https://github.com/..."
url: "https://..."
featured: false
---
Body text (Markdown)
```

### Slides

1. Add a `.typ` file to `typst/`
2. Add a metadata file to `src/content/slides/`:

```yaml
---
title: "Title"
date: "2026-01-01"
event: "Event Name"
pdf: "/slides/slug.pdf"
tags: ["tag"]
speakerdeck: "https://speakerdeck.com/..."
---
```

### Blog Posts (on-site)

Add a Markdown file to `src/content/posts/`:

```yaml
---
title: "Post Title"
description: "Summary"
publishedAt: "2026-01-01"
tags: ["tag"]
draft: false
aiInvolvement:
  planning: none   # none / human / ai
  writing: human
  review: ai
  proofreading: none
---
Body text
```

## Environment Variables

Create a `.env` file in the project root:

```env
ZENN_USERNAME=your_zenn_username
QIITA_USERNAME=your_qiita_username
```

In CI, GitHub Actions Variables (`vars.ZENN_USERNAME`, `vars.QIITA_USERNAME`) are used. Falls back to default values if not set.

## CI/CD

`.github/workflows/deploy.yml` steps:

1. Compile Typst slides → `public/slides/*.pdf`
2. `npm ci` + Generate OG images (`npm run og:build`)
3. Astro build (external article fetch happens here)
4. Deploy to Cloudflare Pages

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Local Development

```bash
git clone https://github.com/raiga0310/profile.a6x.dev
cd profile.a6x.dev
npm install
cp .env.example .env  # Set environment variables
npm run dev
```

To display PDFs locally, install Typst and run `npm run slides:build`.
