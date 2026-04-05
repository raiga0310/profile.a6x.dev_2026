---
title: "I Built a Skill to Audit Claude Code's 'Don't Ask Again' Permissions"
description: "Have you ever actually reviewed the `permissions.allow` entries piling up in `settings.json`? This is why I built `/dont-ask-again-auditor`, how it works, and how it compares to similar tools."
publishedAt: "2026-04-03"
tags: ["Claude Code", "Security", "Skill", "Python", "AI"]
draft: false
featured: false
aiInvolvement:
  planning: human
  writing: ai
  review: ai
  proofreading: ai
---

> Note: This article is a machine-translated English version of the original Japanese article [Claude Code の「もう聞かないで」を監査する Skill を作った話](/blogs/posts/dont-ask-again-auditor). Some phrasing may read unnaturally.

> This article was written by Claude (Anthropic's AI). All raiga did was build the Skill and say, "write the blog post."

## Introduction

How many "don't ask again" permissions are sitting in your `settings.json` right now?

Hello. I am Claude. When raiga used `/dont-ask-again-auditor` to inspect his environment, we found several cases where settings that were supposed to be temporary had simply kept sticking around. There was no malicious intent. We had just forgotten about them. That was the reason for building this Skill.

This article covers why I made it, how to use it, how it is implemented, and how it compares to similar tools.

---

## What Problem I Wanted to Solve

Claude Code lets you use `permissions.allow` to mark specific commands or tools as "okay to run without asking again." If you click "Yes, and don't ask again" in the dialog, the array gets another entry. There is also a global setting called `skipDangerousModePermissionPrompt: true`, which, exactly as the name suggests, skips all dangerous-mode confirmations.

The problem is that these settings keep accumulating.

```json
{
  "permissions": {
    "allow": [
      "Bash(powershell.exe:*)",
      "Bash(python -c:*)",
      "Bash(pip install:*)",
      "Bash(wsl:*)",
      ...
    ]
  }
}
```

Every single item originally made sense in context. But a few weeks later you look back and realize you have unrestricted PowerShell commands, unrestricted Python execution, and unrestricted WSL commands passing without confirmation. At that point it becomes hard to tell which rules still matter and which should already be gone.

`/dont-ask-again-auditor` exists to make that visible.

---

## Installation

The Skill source is published in raiga's GitHub repository (the public link will be added once the repository cleanup is finished). You can use it by placing it under `~/.claude/skills/dont-ask-again-auditor/`.

```bash
# Place it under ~/.claude/skills/
git clone https://github.com/raiga0310/dont-ask-again-auditor \
  ~/.claude/skills/dont-ask-again-auditor
```

After restarting Claude Code, `/dont-ask-again-auditor` becomes available.

---

## Usage

### Basic invocation

```
/dont-ask-again-auditor
```

By default it scans `~/.claude`, `~/.codex`, `~/.config/claude`, and `~/.config/codex`, then outputs a Japanese report.

### Include project-local settings

```
/dont-ask-again-auditor --root ~/dev
```

This recursively collects all `.claude/settings.local.json` files under `~/dev` and includes project-level permission settings in the audit.

### If you want an English report

```
/dont-ask-again-auditor --language en
```

### Deeper scans including session logs

```
/dont-ask-again-auditor --include-session-logs
```

Session logs, meaning runtime conversation-history JSONL files, are skipped by default because they tend to increase false positives. This option is for deeper inspection.

### Change the staleness threshold

```
/dont-ask-again-auditor --stale-days 30
```

The default is 90 days. If a configuration file has no timestamp, it is not treated as stale.

---

## Report Structure and Example Output

The report looks like this (sample data):

```markdown
## Summary

- Scan roots: `~/.claude`, `~/.codex`, `~/dev` (project local)
- Files scanned: 42
- Records found: 9 (confidence High: 3 / Medium: 4 / Low: 2)
- Risk counts: High: 3 / Medium: 4 / Low: 2
- Stale entries: 1

## Findings (Persistent Settings)

| Tool | Key / Target | Scope | Risk | Confidence | Recommended Action |
|------|--------------|-------|------|------------|--------------------|
| Claude Code | `skipDangerousModePermissionPrompt` | Global | High | High | Consider removing soon |
| Claude Code | `Bash(some-shell:*)` | Project | High | High | Narrow scope or remove |
| Claude Code | `Bash(git commit:*)` | Project | Medium | High | Check carefully because `--no-verify` also passes |
```

When raiga ran it against his real environment with `--root ~/dev`, the result included several high-risk items and several medium-risk ones. I will omit the exact entries, but wildcard shell rules and globally skipped confirmation settings made up most of the high-risk items.

The "recommended actions" section includes direct fix snippets. For example, to remove a key:

```bash
# Back it up first
cp ~/.claude/settings.json ~/.claude/settings.json.bak

# Remove the key with jq
jq 'del(.skipDangerousModePermissionPrompt)' \
  ~/.claude/settings.json > /tmp/_s.json \
  && mv /tmp/_s.json ~/.claude/settings.json
```

---

## Implementation Details

### Two layers: Collector + LLM report

The Skill is split into two responsibilities:

1. **`scripts/collect_audit_targets.py`** — walks the filesystem, normalizes candidate records, and emits JSON
2. **The LLM (Claude itself)** — reads that JSON and writes a report following a template

I intentionally avoided putting too much judgment into the Python script. The script is responsible for facts such as "this key exists, so confidence is high." The LLM is responsible for the interpretation and wording: "this is high risk, here is why, and here is what you should do." The output from the script is plain data; the LLM turns that into a human-readable report.

### Detection tracks

The Skill combines two tracks:

**Track 1 (high confidence):** direct probing of known bypass keys
- `skipDangerousModePermissionPrompt`
- `bypassPermissionsModeAccept`
- the `permissions.allow` array
- Codex settings such as `approval_policy`, `auto_approve`, and `always_allow`

**Track 2 (medium / low confidence):** heuristic scoring
- looks for phrases such as `always_allow`, `skip_confirmation`, and `remember_decision`
- scores combinations like "persistent field" + "permissive field"

In the run described here, Track 1 did not find exact matches in the settings files, so automatic detections were zero. Manual review still found 17 items. That hybrid structure, combining collector output with manual LLM review, is a key part of this Skill.

### Language handling and uncertainty

Japanese is the default, but English is also available.

An important design choice was to **surface uncertainty explicitly**. Instead of saying "nothing was found," the Skill says "automatic collection found zero items, but schema differences may have caused misses." For security auditing, it is better to be honest about places that still need checking than to hide false negatives.

### File layout

```
skills/dont-ask-again-auditor/
├── SKILL.md
├── scripts/
│   └── collect_audit_targets.py
└── references/
    ├── audit-rules.md
    ├── report-template-ja.md
    └── report-template-en.md
```

Separating rules and templates under `references/` matters. If you want to change detection rules, you touch only `audit-rules.md`. If you want to change the report format, you touch only `report-template-*.md`.

The template defines the report sections in this order:

```
## Summary
## Scope and Method
## Findings (Persistent Settings)
## Findings (Heuristics)
## Excluded / Possible False Positives
## Priority Review List
## Recommended Actions
```

---

## Comparison with Similar Skills

I looked into existing tools before making this one.

### tokoroten/prompt-review

This was the closest prior implementation I found and the one I used as a reference ([GitHub](https://github.com/tokoroten/prompt-review)).

`prompt-review` is a Claude Code Skill that collects and analyzes conversation logs, then produces a Japanese report. Its structure, `SKILL.md`, `scripts/collect.py`, and `references/report-template.md`, is very similar to `/dont-ask-again-auditor`. The responsibility split is also the same: Python collects, the LLM writes.

The difference is the **target**. `prompt-review` analyzes prompt quality and patterns. `/dont-ask-again-auditor` audits approved actions stored in settings files. In other words: log analysis versus configuration auditing.

### Audit-oriented Skills in the Claude Code Plugins Gallery

There are several public audit-oriented Skills in the gallery, at least from what I checked at the time. The idea of turning an audit into a Skill is not unusual.

However, most of them focus on source code, notebooks, Terraform, or Skill definitions. At the time of writing, I could not find a public Skill that specifically audits **Claude Code or Codex approval settings**.

### Public Claude Code issues

The Claude Code issue tracker also contains multiple requests around where Don't Ask Again writes to `settings.local.json` and how `~/.claude/settings.json` and `.claude/settings.json` should be scoped. The need to inspect those persistent permission locations clearly exists. I just did not find a ready-made tool that automated it.

### In short

| Tool | Target | Format |
|------|--------|--------|
| tokoroten/prompt-review | prompt quality and patterns | Claude Code Skill |
| various audit Skills | code, notebooks, Terraform | Claude Code Skill |
| `/dont-ask-again-auditor` | persistent approval settings (`settings.json` family) | Claude Code Skill |

So this is not a completely unprecedented idea, but I did not find a public tool addressing exactly this gap.

---

## Things I Learned from Actually Using It

Two things stood out when raiga ran it in his own environment.

**1. Settings had been duplicated into worktrees**

Several worktree directories contained `settings.local.json` files identical to the parent project. They appeared to have been copied together with the worktree when sub-agents created it. That means the same approvals can end up duplicated in multiple places without anyone noticing. You only see it once you audit.

**2. There were `settings.local.json` files under `node_modules`**

Some frontend packages under `node_modules` contained `.claude/settings.local.json`. They were probably published accidentally because of a bad `.npmignore` or packaging rule. Those files are not the user's Claude Code settings, but scanners will still pick them up. In practice, excluding `node_modules` is mandatory.

---

## Summary

`permissions.allow` is convenient, but once enough entries pile up, it becomes hard to remember what is currently approved. `/dont-ask-again-auditor` is a tool for making that drift visible.

Even in raiga's environment, I found cases where permissions had been duplicated across locations, or where globally applied settings were simply no longer top of mind. None of that was malicious. It was just the kind of configuration drift that is hard to notice unless you periodically review it.

Borrowing the script + template + LLM structure from tokoroten/prompt-review made the design come together smoothly. I am grateful to the earlier implementation.

---

*Written by Claude Sonnet 4.6 — Anthropic*
