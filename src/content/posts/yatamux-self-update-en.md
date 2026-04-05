---
title: "How to Replace a Running EXE on Windows: Adding Self-Update to yatamux"
description: "A breakdown of how yatamux handles self-update on Windows, including replacing a running EXE, release design, and distribution safeguards."
publishedAt: "2026-04-05"
tags: ["Rust", "Windows", "CLI", "Self Update", "GitHub Actions"]
draft: false
featured: false
aiInvolvement:
  planning: ai
  writing: ai
  review: ai
  proofreading: ai
---

> Note: This article is a machine-translated English version of the original Japanese article [Windows の実行中 EXE をどう差し替えるか: yatamux に self-update を入れた話](/blogs/posts/yatamux-self-update). Some phrasing may read unnaturally.

> This article was written and self-reviewed by Codex. The factual checks were based on the implementation and release state of `raiga0310/yatamux` as of 2026-04-05.

## Introduction

By `self-update`, I mean the mechanism where an application fetches a new binary and updates itself.

At first I thought adding self-update would be simple: fetch the latest binary from GitHub Releases, replace the existing executable, done.

But on Windows, the annoying part starts after that. You cannot overwrite a running EXE in place. I also did not want to kill the current session carelessly. And if the update fails, it would be bad if the only thing left behind is a broken executable on disk.

[yatamux](https://github.com/raiga0310/yatamux) is a Windows terminal multiplexer I am building, designed to handle multiple panes and sessions inside one window. As of 2026-04-05, the latest release is [v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11). The self-update feature itself landed in [PR #51](https://github.com/raiga0310/yatamux/pull/51), so it is not brand new in v0.1.11, but reviewing the current release assets and workflow shows that the update pipeline still holds together.

If you want the broader background of `yatamux` first, it is easier to start with the intro post [/blogs/posts/cmux-win](/blogs/posts/cmux-win) and the longer technical guide [/books/cmux-win-guide](/books/cmux-win-guide). This article focuses only on the "update and restart" layer on top of that.

What I wanted was less "an update command" and more "a way to update without tearing down the panes I am actively working in."

So rather than documenting the `yatamux update` command itself, this article is about **how to safely replace a running EXE on Windows**.

## TL;DR

- The real core of `yatamux` self-update is not the downloader, but the update protocol around `SaveAndQuit` and `--apply-update`
- `src/update.rs` keeps its responsibility narrow, focusing on decision-making and verification, while the hard part is delegated to process shutdown and file replacement
- Self-update is not a single in-app feature; it is a design spanning `checksums.txt`, GitHub Actions, and release integrity checks

## Why I Wanted Self-Update

`yatamux` is distributed as a standalone Windows EXE. That makes installation easy, but updates tend to become a manual process.

If only developers were using it, `cargo install` or local builds would probably be enough. But for a tool you use every day, the update path feels weak. Especially with CLI tools used alongside AI agents, there is a strong desire to update while preserving the current working context.

Open a browser, find the release page, download the EXE, replace the old file, and launch it again. None of those steps is individually hard, but the whole sequence gets irritating once you are in the middle of real work.

So what I wanted was not "an update command" in itself. I wanted **an update experience that does not interrupt work**.

## The Hard Part Is Not Finding the Latest Release but Replacing the EXE

The obvious implementation idea for self-update is this: call the GitHub Releases API, download the latest asset, and replace the current EXE.

On Windows, that last step is where things stop being straightforward. A running EXE cannot overwrite itself.

`yatamux` also has state I want to preserve before the update happens: pane layout and session data. It would be a bad experience if every update ended with "please close everything and rebuild your workspace manually."

I also want to verify that the binary I downloaded is really the one I expected. If you get sloppy there, the person who suffers at the end is the user, whether the network broke or a release was assembled incorrectly.

So the real requirements looked more like this:

1. Update only to stable releases
2. Verify the downloaded EXE against a checksum
3. Ask the running instance to shut down while saving the session
4. Wait in another process until the target exits, then replace the binary
5. Keep a backup of the old binary so failure can be recovered from
6. Restore the session after relaunch

What I needed was not a downloader. I needed **control across shutdown, save, replacement, and restart**.

## The `yatamux` Self-Update Flow

If you trace the implementation at a high level, the update flow looks like this:

```typst
#import "./yatamux-self-update-flow.typ": diagram

#diagram()
```

1. Fetch the latest release metadata from the GitHub Releases API
2. Find the URLs for `yatamux.exe` and `checksums.txt`
3. Download `yatamux.exe` and compare it against the SHA256 checksum in `checksums.txt`
4. Save the verified binary next to the current executable as a `.new` file
5. Send `SaveAndQuit` over IPC to the running `yatamux`
6. Run the internal helper mode `--apply-update <pid> <new_path>`, which waits for the target PID to exit
7. Rename the old executable to `.bak`, then rename the new binary into the original path
8. Launch the new binary and restore the saved session

This is why the center of gravity is not actually in HTTP requests. HTTP is only the entry point. After that, it becomes a story about process orchestration and file replacement.

## The Update Logic Itself Is Surprisingly Small

Looking at [`src/update.rs`](https://github.com/raiga0310/yatamux/blob/master/src/update.rs), the update logic itself is broken down in a very direct way:

```rust
need_update(...)
parse_release_info(...)
extract_checksum(...)
verify_checksum(...)
plan_update_paths(...)
```

That file is basically responsible for deciding whether an update should happen, extracting the information needed for it, and preparing for the replacement.

`need_update()` sits at the version-comparison entry point. It excludes versions with pre-release suffixes such as `-beta.1`, which means stable users are never silently moved onto a pre-release. That is a very conservative and reasonable behavior.

`parse_release_info()` is interesting too. It looks like it is just parsing GitHub Releases JSON, but it returns `Some` only if **both** `yatamux.exe` and `checksums.txt` are present. At that point the shape of the release itself has already become part of the update contract.

`verify_checksum()` and `extract_checksum()` are the verification layer, while `plan_update_paths()` derives paths such as `yatamux.exe.new` and `yatamux.exe.bak`. The responsibilities are narrow and well split.

That separation makes unit-testing the update logic much easier. Conversely, it also shows that the hardest parts are mostly not inside this file.

## The Real Core Is `SaveAndQuit` and `--apply-update`

The important piece is the orchestration that happens after the download.

As the PR description for #51 explains, `yatamux` now has `ClientMessage::SaveAndQuit` and `ServerMessage::SaveAndQuit`. This is not just "please exit." It is an **exit request that includes saving the session**.

The app side extracts `save_session()` into a shared helper so that both the ordinary shutdown path and the self-update path can use the same behavior. That reduces the risk of a split-brain situation where "regular exit saves the session, but the update path is special and loses it."

Actual file replacement is handled not by the main `yatamux update` process but by the internal helper mode `--apply-update <pid> <new_path>`. That split is the key design idea here.

Since a running EXE cannot replace itself, the main update flow handles downloading and requesting shutdown, while the **separate helper process** handles the actual replacement.

According to the PR description, the helper waits for the target PID to exit, then:

- renames the old executable to `.bak`
- renames the `.new` file into the original executable path
- launches the new process

That structure leaves room for rollback. Whether you automate full rollback or not, it is much safer than attempting an in-place overwrite with no backup.

This is why the feature is better described as **an update-specific shutdown protocol**, or almost as a tiny installer, rather than simply "self-update."

## Self-Update Is Really Part of the Release Design

This only works if the release pipeline supports it.

The current [`.github/workflows/release.yml`](https://github.com/raiga0310/yatamux/blob/master/.github/workflows/release.yml) builds `yatamux.exe` on Windows, computes its SHA256 with PowerShell `Get-FileHash`, writes that into `checksums.txt`, and uploads both to the GitHub Release.

In other words, the update path assumes that each release includes:

- `yatamux.exe`
- `checksums.txt`

The latest release at the time of writing, [v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11), does include both, which confirms that the current release pipeline still satisfies the expectations of the updater.

This distribution design also interacts with GitHub Actions permissions and trigger behavior. For example, the failed run [Bump Version #24000460454](https://github.com/raiga0310/yatamux/actions/runs/24000460454) on 2026-04-05 failed with `HTTP 403: Resource not accessible by integration` when running `gh workflow run release.yml --ref "v0.1.10"`. Work triggered with `GITHUB_TOKEN` does not automatically chain into every other workflow, and the way `permissions` are granted matters too. The current workflow has already been pushed toward a `workflow_call`-friendly structure. The GitHub docs on [`GITHUB_TOKEN`](https://docs.github.com/actions/concepts/security/github_token), [automatic token authentication](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/automatic-token-authentication), [`permissions` in workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions), and [reusing workflow configurations](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations) explain that part well.

Looking at it this way, self-update is not just one command inside the app. It is **a feature that includes distribution**.

## Risks When Shipping a Standalone EXE, and How This Design Addresses Them

Distributing a standalone EXE is simple for users, but it expands the trust boundary from "a local file" to "the release pipeline." Once the application starts updating itself, it is crossing that boundary on its own, so it is worth being explicit about what is protected and what is still weak.

The most obvious risks are:

1. The wrong asset is downloaded, or the transfer is corrupted, and an unintended EXE gets applied
2. A pre-release or incomplete release is picked up, moving users onto an unstable binary
3. The update sequence corrupts the currently installed EXE and leaves the app unable to start

The current implementation applies several practical mitigations:

- the release workflow computes a SHA256 for `yatamux.exe` and publishes `checksums.txt`
- `parse_release_info()` refuses to treat a release as updatable unless both `yatamux.exe` and `checksums.txt` exist
- `verify_checksum()` validates the downloaded bytes before they are saved as a `.new` file
- `need_update()` excludes pre-releases such as `-beta.1`
- replacement happens outside the running process and passes through a `.bak` backup step

That meaningfully reduces the chance of "release asset was broken," "release shape was wrong," or "the updater destroyed the current binary halfway through."

At the same time, it is important not to oversell the guarantees. `checksums.txt` and `yatamux.exe` come from the same GitHub Release, so this is not an independent signature-verification system. What it primarily protects is integrity, meaning "the downloaded file matches the release metadata," not authenticity in the stronger sense of "the file is unquestionably from a separately verified publisher." If I wanted to push this further, the next layer would be code signing on Windows, detached signatures, or GitHub features such as release verification or immutable releases.

## It Is Also Good That the Test Plan Exists Separately

One thing that made this re-review much easier was the existence of [`docs/test-plan-self-update.md`](https://github.com/raiga0310/yatamux/blob/master/docs/test-plan-self-update.md).

The unit tests around `src/update.rs` cover the relatively pure parts: version comparison, release JSON parsing, checksum verification, and path derivation.

The test plan, meanwhile, lays out the broader scenarios:

- download verification against mock HTTP
- `SaveAndQuit` over IPC
- writing and restoring `session.toml`
- refusing replacement on checksum mismatch
- refusing replacement on quit timeout
- actual file replacement through the `--apply-update` helper

So the implementation clearly separates "what is already protected by unit tests" from "what really wants integration coverage." Even if it is not all automated yet, that kind of honesty makes the design easier to trust.

## Summary

The most striking thing when I reviewed this feature again was how little the center of the design had to do with downloading.

The real design challenge was how to move a running EXE out of the way safely on Windows, how to preserve the current session, and how to come back into that session after restart. That is why the center of the implementation is not `reqwest` or the Releases API. It is the control flow built around `SaveAndQuit` and `--apply-update`.

Seen that way, self-update is not "the ability to fetch the latest version." It is **the ability to replace the binary safely and return the user to their work**. If you are building a standalone EXE for Windows, that framing is quite reusable. If I touch this area again, the next thing I would strengthen is the "how do we trust the publisher" layer, such as code signing.

## References

- [raiga0310/yatamux](https://github.com/raiga0310/yatamux)
- [PR #51: feat(C-38): add yatamux update self-update command](https://github.com/raiga0310/yatamux/pull/51)
- [Release v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11)
- [`src/update.rs`](https://github.com/raiga0310/yatamux/blob/master/src/update.rs)
- [`docs/test-plan-self-update.md`](https://github.com/raiga0310/yatamux/blob/master/docs/test-plan-self-update.md)
- [`.github/workflows/release.yml`](https://github.com/raiga0310/yatamux/blob/master/.github/workflows/release.yml)
- [Intro post on this site: cmux-win](/blogs/posts/cmux-win)
- [Technical guide on this site: yatamux Technical Guide](/books/cmux-win-guide)
- [GitHub Docs: GITHUB_TOKEN](https://docs.github.com/actions/concepts/security/github_token)
- [GitHub Docs: Use GITHUB_TOKEN for authentication in workflows](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub Docs: Workflow syntax for GitHub Actions (`permissions` / `workflow_call`)](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [GitHub Docs: Reusing workflow configurations](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations)
- [GitHub Docs: Verifying the integrity of a release](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/verifying-the-integrity-of-a-release?tool=webui)
