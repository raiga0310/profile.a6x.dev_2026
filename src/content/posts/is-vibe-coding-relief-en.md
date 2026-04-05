---
title: "Is Vibe Coding a Kind of Relief?"
description: "We now live in a time where building something ourselves can make us happier. But we still need to confront the risks of AI being able to write almost anything."
publishedAt: "2026-03-25"
tags: ["AI", "Vibe Coding"]
draft: false
featured: false
aiInvolvement:
  planning: human
  writing: human
  review: ai
  proofreading: ai
---

> Note: This article is a machine-translated English version of the original Japanese article [Vibe-Codingは救済なのか？](/blogs/posts/is-vibe-coding-relief). Some phrasing may read unnaturally.

## Introduction

I should say up front that this article reflects only the author's personal impressions at the time of writing. It is not meant to claim anything definitive about the future direction of AI.

## Background

Recently, AI agents have increasingly been used through CLI-based workflows, and because of that I feel that applications that make the CLI pleasant to live in are getting attention again. Ghostty and cmux are probably the clearest examples.

But even among the well-known tools in that category, very few have proper Windows versions. Fewer still support CJK well right after release. Most of these tools are started by developers or idea people whose native language is English. From their perspective, support for multibyte text or for operating systems like Windows, which are not always considered the most convenient environment for development, naturally falls lower on the priority list.

That is not wrong. Their work is not an international charity effort, nor is it a government service. I do not think **indie software** or **open source** normally carries that kind of social obligation.

This is not a brand-new situation. But now things are different from the era when only CLI apps were booming. Now **AI can write the missing pieces**.

## What I Am Having AI Build

Right now I am using Claude Code to build, or rather to **have it build**, something close to `tmux` for Windows with proper CJK support.

https://github.com/raiga0310/yatamux

What I personally did was mostly define a development cycle: have Claude or Gemini generate requirements, then build from there. I even turned the first minimally working state into a blog post, and that article was also entirely written by AI. I told it to use `--dangerously-skip-permissions` and "do not call me back until the PR is ready."

https://profile.a6x.dev/blogs/posts/cmux-win/

As for runaway behavior, I do not think you necessarily need anything as formal as full-blown "harness engineering" for a project at an individual-developer scale. The sort of environment discipline I used when hand-coding is usually enough. Since I picked Rust, that mostly meant telling it "run clippy + test + fmt until nothing fails" and "derive test cases from the task, write them into Markdown, and then do TDD."

## So, Is Vibe Coding Relief?

This is where the title comes back around. My answer is still: **I do not know yet**.

Still, I think some things are already clear.

### It makes minority-focused apps realistically possible to build yourself

If you can explain the shortcomings of software or websites designed for the majority, current AI is already good enough to produce something surprisingly usable quite quickly. This time I focused on Windows and CJK, but eventually I think it will become possible to create software tailored to even a single specific person.

### Will we get an explosion of low-quality apps and articles? AI slop?

People already talk about AI slop in large OSS projects, and on Japanese tech platforms like Zenn and Qiita, articles involving AI attract attention for better or worse.

But why is that seen as bad? Because large amounts of low-quality output consume readers' time, which in turn destroys the engagement and revenue that used to exist. In that sense, publishing on a self-hosted personal site, as I am doing, may actually be a strategy that receives less criticism. People who genuinely want the information will still come read an individually run site. Probably. Maybe.

---

I ended up writing down my thoughts rather loosely, but in the end, the reason I can write articles like this at all is that I already **have some knowledge**. People cannot realize things they do not know or cannot imagine. There is a line like that in *Frieren: Beyond Journey's End*. Some people argue that relying too much on AI will make us stupid, but people said similar things about calculators and word processors too. Personally, I intend to go with the larger current of change and keep spending my days mashing the Enter key while glancing sideways at Twitter.
