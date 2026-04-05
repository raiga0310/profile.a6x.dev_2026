---
title: "Windows の実行中 EXE をどう差し替えるか: yatamux に self-update を入れた話"
description: "yatamux に self-update を入れる中で考えた、Windows での EXE 差し替え、release 設計、配布時の安全策を整理する。"
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

> この記事は Codex が執筆と自己レビューを行った。内容確認には、2026-04-05 時点の `raiga0310/yatamux` の実装とリリース状態を使った。

## はじめに

ここでいう `self-update` は、アプリ自身が新しいバイナリを取得して、自分を更新する仕組みのことを指している。`self-update` を入れようと思ったとき、最初は GitHub Releases から最新バイナリを取ってきて置き換えれば終わりだと思っていた。

でも、Windows で本当に面倒なのはその後だった。実行中の EXE はそのまま上書きできないし、いま使っているセッションも雑に落としたくない。更新に失敗したら、手元の実行ファイルだけ壊れて終わるのも困る。

[yatamux](https://github.com/raiga0310/yatamux) は自分が作っている Windows 向けのターミナルマルチプレクサで、1 つのウィンドウの中で複数ペインやセッションを扱うためのツールだ。2026-04-05 時点の最新リリースは [v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11) になっている。`self-update` 自体が入ったのは [PR #51](https://github.com/raiga0310/yatamux/pull/51) で、v0.1.11 で新しく入った機能というわけではない。ただ、最新リリースの asset と現行の workflow を見直すと、この仕組みはいまも release パイプライン込みで成立していることが分かる。

もし `yatamux` 自体の背景から知りたいなら、先に紹介記事の [/blogs/posts/cmux-win](/blogs/posts/cmux-win) と、実装全体を追っている技術解説の [/books/cmux-win-guide](/books/cmux-win-guide) を読むと入りやすい。self-update の話は、その上に乗っている「更新と再起動の層」を切り出して見ている。

自分の中では、更新コマンドを増やしたかったというより、作業中のペインをいったん全部たたまずに更新できる形にしたかった、という気持ちのほうが強かった。

この記事では、`yatamux update` の使い方よりも、**Windows の実行中 EXE をどう安全に差し替えるか**という設計のほうを書く。

## TL;DR

- `yatamux` の self-update の本体は downloader ではなく、`SaveAndQuit` と `--apply-update` を含む更新プロトコルだった
- `src/update.rs` は更新判断と検証に責務を絞り、難しい部分はプロセス終了待ちとファイル置換に寄せている
- self-update はアプリ内の 1 機能ではなく、`checksums.txt`、GitHub Actions、配布時の整合性確認まで含めた設計になっている

## なぜ self-update が欲しかったのか

`yatamux` は Windows 向けの単体 EXE として配布されている。こういう配布形態は導入しやすい一方で、更新が手作業に寄りやすい。

開発者だけが使うなら `cargo install` や手元ビルドでも十分だと思う。けれど、日常的に使っているツールの更新導線としては少し弱い。特に CLI や AI エージェントと一緒に使うツールは、いま開いている作業文脈を維持したまま更新したい気持ちが強い。

ブラウザを開いて release ページを探して、EXE を落として、元のファイルを入れ替えて、また起動する。この一連の手順は一つひとつは軽いのに、ペインを並べて作業している最中だと地味に効く。

だから欲しかったのは「更新コマンド」そのものではなく、**更新が作業の邪魔をしない体験**だった。

## 難しいのは latest を知ることではなく EXE を差し替えること

self-update の実装で最初に思いつくのは、GitHub Releases API を叩いて、最新の asset をダウンロードして、今の EXE を置き換える流れだと思う。

ただ、Windows ではこの最後の一歩がそのままではできない。実行中の EXE は自分自身を上書きできないからだ。

さらに `yatamux` には、更新前にちゃんと保存したいものがある。ペイン構成やセッション情報だ。せっかくマルチプレクサを使っているのに、更新のたびに「じゃあ全部閉じて手で開き直してください」では嬉しくない。

しかも、ダウンロードしたバイナリが本当に期待していたものか確認したい。ここを雑にすると、ネットワークが壊れたときも、release の取り扱いを誤ったときも、最後に困るのは利用者になる。

なので実際の要件は、だいたい次のようになる。

1. 安定版だけを更新対象にする
2. ダウンロードした EXE を checksum で検証する
3. 実行中インスタンスにセッション保存つきの終了を依頼する
4. 別プロセスで終了待ちしてからバイナリを入れ替える
5. 失敗時に戻せるよう、旧バイナリを退避しておく
6. 起動後にセッションを復元する

要するに、必要だったのは downloader ではなく、**終了・保存・差し替え・再起動をまたぐ制御**だった。

## yatamux の self-update フロー

`yatamux` の実装をざっくり追うと、更新フローは次のようになっている。

```typst
#import "./yatamux-self-update-flow.typ": diagram

#diagram()
```

1. GitHub Releases API から最新 release 情報を取る
2. `yatamux.exe` と `checksums.txt` の URL を探す
3. `yatamux.exe` をダウンロードし、`checksums.txt` の SHA256 と照合する
4. 検証済みバイナリを現在の実行ファイルの横に `.new` ファイルとして保存する
5. 実行中の `yatamux` に IPC で `SaveAndQuit` を送る
6. 内部ヘルパーモード `--apply-update <pid> <new_path>` が対象 PID の終了を待つ
7. 旧実行ファイルを `.bak` に rename し、新しいバイナリを元の名前に rename する
8. 新しいバイナリを起動し、保存済みセッションを復元する

この流れを見ると、更新の中心が HTTP リクエストではないことが分かる。HTTP はあくまで最初の入口で、その後はプロセス制御とファイル置換の話になる。

## 更新ロジック自体は意外と小さい

[`src/update.rs`](https://github.com/raiga0310/yatamux/blob/master/src/update.rs) を見ると、更新ロジック自体は素直に分割されている。

```rust
need_update(...)
parse_release_info(...)
extract_checksum(...)
verify_checksum(...)
plan_update_paths(...)
```

このファイルがやっていることは、極端に言えば「更新してよいか判断し、必要な情報を抜き、ファイル置換の準備をする」までだ。

`need_update()` はバージョン比較の入口になっていて、`-beta.1` のような pre-release suffix を含むものは更新対象外にしている。安定版の利用者を勝手に prerelease へ乗せない、かなり慎重な挙動だ。

`parse_release_info()` も面白い。GitHub Releases の JSON をパースしているだけに見えるが、`yatamux.exe` と `checksums.txt` の**両方**が揃っていないと `Some` を返さない。つまりこの時点で、release の構成そのものが update の契約になっている。

`verify_checksum()` と `extract_checksum()` はそのまま検証用だし、`plan_update_paths()` は `yatamux.exe.new` と `yatamux.exe.bak` の導出を担当する。役割はかなり限定されている。

この割り切りが効いていて、更新ロジック単体のテストもしやすい。逆に言うと、難しい部分はここにはあまりない。

## 本丸は SaveAndQuit と `--apply-update` にある

本当に重要なのは、ダウンロード後のオーケストレーションのほうだ。

PR #51 の説明にもある通り、`yatamux` には `ClientMessage::SaveAndQuit` / `ServerMessage::SaveAndQuit` が追加されている。これはただの「終了してくれ」ではなく、**セッション保存を伴う終了要求**として扱われている。

アプリ側では `save_session()` を共通関数として切り出して、通常の終了経路と self-update 経路の両方から使えるようにしている。これで、「いつもの終了なら保存されるけど、update だけは特殊経路なので落ちる」というズレを減らせる。

そのうえで、実際のファイル置換は `yatamux update` 本体ではなく、内部ヘルパーである `--apply-update <pid> <new_path>` が担当する。PR #51 の説明を読むと、ここを別モードに分けているのがこの実装の肝だと分かる。

実行中の EXE は自分自身を差し替えられない。だったら、更新本体はダウンロードと終了依頼までを担当し、差し替えは**別モードの別プロセス**に任せればいい。

PR #51 の説明では、このヘルパーは対象 PID の終了を待ってから、

- 旧実行ファイルを `.bak` に退避する
- `.new` を正式なファイル名に rename する
- 新しいプロセスを起動する

という順番で動く。

この構成だと、少なくとも設計としては rollback の余地が残る。完全自動 rollback までやるかは別として、何も退避せずに上書きするよりは安心できる。

`self-update` というより、**更新専用の終了プロトコル**とか、小さなインストーラに近いものと言ったほうが実態に近い。

## self-update は release 設計込みの機能

この仕組みはアプリ内部だけでは成立しない。release の作り方まで含めて、はじめて self-update になる。

現行の [`.github/workflows/release.yml`](https://github.com/raiga0310/yatamux/blob/master/.github/workflows/release.yml) では、Windows で release build した `yatamux.exe` に対して PowerShell の `Get-FileHash` で SHA256 を計算し、`checksums.txt` を生成したうえで GitHub Release に添付している。

つまり、最新 release の asset に

- `yatamux.exe`
- `checksums.txt`

が並んでいること自体が、いまの self-update の前提条件になっている。

執筆時点の最新リリース [v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11) にもこの 2 つが添付されているので、少なくとも「現在の release パイプラインが update の要求を満たしている」ことは確認できる。

この配布設計は GitHub Actions の権限や trigger の制約とも地味に絡む。たとえば 2026-04-05 の failed run [Bump Version #24000460454](https://github.com/raiga0310/yatamux/actions/runs/24000460454) では、`gh workflow run release.yml --ref "v0.1.10"` が `HTTP 403: Resource not accessible by integration` で失敗していた。`GITHUB_TOKEN` で発火した操作は別の workflow をそのまま連鎖させない、という GitHub Actions 側の制約があり、`permissions` の与え方も絡むので、tag push や workflow dispatch をつなぐところは見た目より癖がある。現行の workflow も `release.yml` を `workflow_call` で呼べる形に寄せている。詳しくは GitHub Docs の [`GITHUB_TOKEN`](https://docs.github.com/actions/concepts/security/github_token)、[automatic token authentication](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/automatic-token-authentication)、[workflow syntax の `permissions`](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#permissions)、[reusing workflow configurations](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations) が分かりやすい。self-update はアプリ実装だけで閉じず、release をどう起動するかまで含めて設計が必要になる。

ここまで見ると、self-update はアプリの 1 コマンドではなく、**配布面を含めた機能**だとよく分かる。

## Release で EXE を配るときのリスクと、今回の対策

単体 EXE を Release で配る設計は扱いやすい反面、信頼境界が「ローカルファイル」から「配布パイプライン」まで広がる。self-update を入れると、その境界をアプリ側が自分でまたぎにいくので、最低限どこを守れていて、どこはまだ弱いのかを見ておきたい。

まず分かりやすいリスクは 3 つある。

1. release asset の取り違えや転送中の破損で、意図しない EXE を適用してしまう
2. prerelease や中途半端な release を拾って、利用者を不安定なバイナリへ乗せてしまう
3. 更新途中で現在の EXE を壊して、起動不能な状態を作ってしまう

今回の実装では、ここに対して無理のない対策を入れている。

- release workflow で `yatamux.exe` の SHA256 を計算し、`checksums.txt` を一緒に添付する
- `parse_release_info()` は `yatamux.exe` と `checksums.txt` の両方が揃っていない release を更新対象にしない
- `verify_checksum()` でダウンロードした bytes を検証してから `.new` ファイルとして保存する
- `need_update()` は `-beta.1` のような prerelease を更新対象外にする
- 置換は実行中プロセスの外に出し、`.bak` 退避を挟んでから rename する

これで少なくとも、「配布物が壊れていた」「release の構成が崩れていた」「更新途中でその場の EXE を潰した」といった事故はかなり減らせる。

一方で、ここは過信しないようにしたい。`checksums.txt` も `yatamux.exe` も同じ GitHub Release から取っているので、完全に独立した署名検証にはなっていない。今の対策が効いているのは、主に配布物の整合性や workflow の組み立てミスの検知であって、配布元そのものの真正性を単独で証明するものではない。要するに、いま担保しているのは integrity、つまり「壊れていないこと」の確認寄りであって、authenticity、つまり「本当に正しい配布元が出したものか」の証明そのものではない。より強くやるなら、Windows のコード署名や detached signature、GitHub の release verification / immutable release に寄せる余地はまだある。

## テスト計画が別ファイルで立っているのもよい

今回あらためて整理するうえで助かったのは、[`docs/test-plan-self-update.md`](https://github.com/raiga0310/yatamux/blob/master/docs/test-plan-self-update.md) が別にあることだ。

`src/update.rs` の unit test は、バージョン比較、release JSON のパース、checksum 検証、パス導出といった、比較的純粋なところを押さえている。

一方で test plan 側では、

- mock HTTP でのダウンロード検証
- IPC 経由の `SaveAndQuit`
- `session.toml` の書き出しと復元
- checksum 不一致時の非置換
- quit timeout 時の非置換
- `--apply-update` ヘルパーによる実ファイル差し替え

まで整理されている。

つまり、「いま unit test で担保している範囲」と「本当は integration test まで欲しい範囲」が分離されている。こういう実装は、全部終わっていなくても信用しやすい。未解決の場所を隠さずに見せているからだ。

## まとめ

今回あらためて self-update の流れを見直していて印象的だったのは、更新機能の中心がダウンロードではなかったことだ。

本当に設計が必要だったのは、Windows 上で動いている EXE をどう安全に退かし、いまのセッションをどう保存し、どう再起動後に戻すかだった。だから実装の中心は `reqwest` や Releases API ではなく、`SaveAndQuit` と `--apply-update` がつなぐ制御のほうにある。

`self-update` は「最新を取る機能」ではなく、**安全に入れ替えて元の作業へ戻す機能**だと捉えるとしっくりくる。Windows で単体 EXE を配るツールを作るなら、少なくとも発想としてはかなり応用しやすいはずだ。もし次にこの周辺へ手を入れるなら、まずはコード署名のような「配布元をどう信じるか」の層をもう少し強くしたい。

## 参考リンク

- [raiga0310/yatamux](https://github.com/raiga0310/yatamux)
- [PR #51: feat(C-38): add yatamux update self-update command](https://github.com/raiga0310/yatamux/pull/51)
- [Release v0.1.11](https://github.com/raiga0310/yatamux/releases/tag/v0.1.11)
- [`src/update.rs`](https://github.com/raiga0310/yatamux/blob/master/src/update.rs)
- [`docs/test-plan-self-update.md`](https://github.com/raiga0310/yatamux/blob/master/docs/test-plan-self-update.md)
- [`.github/workflows/release.yml`](https://github.com/raiga0310/yatamux/blob/master/.github/workflows/release.yml)
- [このサイトの紹介記事: cmux-win](/blogs/posts/cmux-win)
- [このサイトの技術解説 book: yatamux 技術解説](/books/cmux-win-guide)
- [GitHub Docs: GITHUB_TOKEN](https://docs.github.com/actions/concepts/security/github_token)
- [GitHub Docs: Use GITHUB_TOKEN for authentication in workflows](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/automatic-token-authentication)
- [GitHub Docs: Workflow syntax for GitHub Actions (`permissions` / `workflow_call`)](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
- [GitHub Docs: Reusing workflow configurations](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations)
- [GitHub Docs: Verifying the integrity of a release](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/verifying-the-integrity-of-a-release?tool=webui)
