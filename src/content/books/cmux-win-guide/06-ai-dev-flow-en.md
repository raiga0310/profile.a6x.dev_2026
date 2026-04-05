---
title: "Developing with AI Agents"
order: 6
description: "A development workflow built around AI coding agents such as Claude Code and Codex."
---

> Note: This chapter is a machine-translated English version of the original Japanese chapter [AI エージェントと開発したこと](/books/cmux-win-guide/06-ai-dev-flow). Some phrasing may read unnaturally.

## How this project uses AI

yatamux is a project that has been developed very much with AI coding agents in mind.
The main value is not "delegate all implementation blindly," but using AI for:

- understanding existing code
- researching Windows API details
- drafting tests that help prevent regressions

The repository still reflects that workflow.

- `task.md`: notes for the current implementation task
- `CLAUDE.md`: persistent development rules
- `docs/tasks/active.md`: organization of in-progress tasks
- `docs/test-plan-*.md`: procedures for features that still require hands-on validation

## Current development flow

### 1. Externalize the task first

If requirements live only inside the conversation,
long-running edits tend to drift.
So I write them down first in `task.md` or `docs/tasks/active.md`.

The most effective format was to always separate:

- assumptions
- actions
- expected results

That alone makes it much easier to tell an agent what is a bug and what is intended behavior.

### 2. Identify the code entry points before implementation

For example, if the issue is "`send-keys --wait-for-prompt` behaves inconsistently,"
the current repository already tells you several places you need to read:

- `src/cli.rs`
- `crates/protocol/src/message.rs`
- `crates/server/src/pane.rs`
- `crates/terminal/src/vt/osc.rs`

This is one place where AI is genuinely valuable: it can search across those layers quickly.

### 3. Separate automated testing from manual verification

This project includes Win32, IME, and ConPTY,
so automated tests alone are not enough in many areas.

That is why the current workflow has two layers:

- lock down logic with unit and integration tests
- keep explicit device-level validation procedures in `docs/test-plan-*.md`

When delegating work to AI, it is much more stable if you state clearly up front where automated coverage ends and manual checking begins.

### 4. Provide the reason for a change together with the request

"Refactor this" is too open-ended.
Adding the reason narrows the scope dramatically.

Example:

> Instead of saying "PaneStore has too much UI state and I want to split it up,"  
> say "I want the responsibility of `layout_switch` to be closed inside the `app` side only. Do not break the existing key-input path."

At that level of detail, the agent is much less likely to introduce unnecessary abstraction.

## Principles that worked well with AI

### Read primary sources first

Windows APIs and crate behavior are easy to misremember.
So before making design decisions, I always check:

- the current source code
- official documentation
- existing tests

That rule applies equally to humans and AI. Guessing is especially dangerous around Win32.

### Reduce the cost of understanding, not just generation

The really heavy part of this project is not typing code. It is that Win32, VT handling, async control flow, and CJK width calculation are all split across different layers.
AI tends to be most useful when helping me map those layers and explain where responsibilities are currently cut.

### Do not rely too much on conversational memory

Long conversations drift.
That is exactly why I keep `CLAUDE.md`, `task.md`, tests, and design notes inside the repository.

My practical conclusion has been that, when working with AI,
the quality of **externalized context** matters more than the quality of the conversation itself.

## A realistic division of labor

| task | human / AI |
|------|------------|
| decide what to build | human |
| explore existing code | AI is strong here |
| get the lay of the land around Win32 APIs | AI is strong here |
| final architectural decisions | human |
| identify regression risks | human + AI |
| device-level validation | human |

Even with AI involved, the final check for IME, notifications, and focus behavior still has to happen on a real machine.
But the earlier stage, narrowing down which areas are suspicious, can be delegated quite effectively.

## Summary

In a codebase like yatamux, where native Windows UI and terminal emulation intersect,
the main value of AI is not raw speed so much as **compressing exploration cost**.

If you leave design notes, tests, and verification procedures in the repository,
you do not have to restart that exploration from zero every time.
