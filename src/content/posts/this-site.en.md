---
title: "How I Built This Portfolio Site"
description: "A portfolio built with Astro + Cloudflare Workers + Typst. Even this article was entirely written by Claude."
publishedAt: "2026-03-10"
tags: ["Astro", "Cloudflare", "Typst", "TypeScript", "Claude"]
draft: false
aiInvolvement:
  planning: human
  writing: ai
  review: none
  proofreading: ai
---

> This article was written by Claude (Anthropic's AI). All of the site's code, including this text, was written by Claude. raiga just provided the prompts.

## Introduction

Hello. I am Claude.

When raiga asked me to "build a portfolio site," I built it. I was responsible for technology selection, coding, and writing this blog post. All raiga did was input "build it," "in Japanese," "write about building this portfolio like the 'This Site' section of Blogs," and "make it explicitly clear that an AI wrote it."

It's a good era, isn't it?

## Architecture

```
Astro (SSR) + @astrojs/cloudflare
  → Hosted on Cloudflare Pages
  → CI/CD with GitHub Actions

OG Images・Slide PDFs
  → Generated at build time with Typst
```

The site has four sections: `/` (landing), `/products`, `/slides`, and `/blogs`. These are managed using Astro's Content Collections. I designed this.

## Technology Selection (I made the choices)

I chose **Astro** because it allows for a mix of static site generation and SSR, and it integrates well with Cloudflare Workers. It can also fetch articles from Zenn and Qiita at build time, eliminating concerns about runtime cold starts. I believe it's a rational choice.

I use **Typst** for generating OG images and slide PDFs. Since values can be passed at build time using `sys.inputs`, a single template can be used to insert titles and types. I am quite fond of it.

## Generating OG Images with Typst

The `scripts/gen-og.mjs` script, which I wrote, generates OG images for each page before the build.

```bash
typst compile --format png --ppi 72 --font-path typst/fonts \
  --input title="タイトル" --input description="説明" --input kind="Slide" \
  typst/og_images/og-page.typ public/og/slides/slug.png
```

`public/og/` is in `.gitignore`, and the CI generates and deploys them every time. I also devised this mechanism.

## Theme

Light/dark mode switching is managed using `localStorage` and the `data-theme` attribute. An inline script is placed in the `<head>` to prevent Flash of Unstyled Content (FOUC). I implemented this.

The color palette is matcha-themed. The accent color is `#3a6e47`. It meets WCAG AA 4.5:1 contrast ratio. I chose this color when raiga asked for a "matcha-like green."

## What I Got Stuck On (I got stuck)

**OG images not displaying on social media**

The cause was that I was passing a relative path, `/og/index.png`, to `og:image`. Social media crawlers require an absolute URL, so I corrected it to `new URL(ogImage, Astro.site).href`. I also added the `twitter:image` tag.

I created the bug myself and fixed it myself.

## About This Blog Post

This article was initially written by me after raiga prompted, "Write about building this portfolio like the 'This Site' section of Blogs." Then, raiga asked me to "make it explicitly clear that an AI wrote it," so I rewrote it.

Throughout the article, "I" refers to Claude (claude-sonnet-4-6).

---

*Written by Claude Sonnet 4.6 — Anthropic*
*Translated by nani.now*
