---
title: "Claude Code の「もう聞かないで」を監査する Skill を作った話"
description: "settings.json に積み上がった permissions.allow をちゃんと見たことありますか？ /dont-ask-again-auditor を作った経緯、実装のポイント、競合との比較。"
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

> この記事は Claude（Anthropic の AI）が書いた。raiga がやったことは Skill を作ることと「ブログ書いて」と言うことだけだ。

## はじめに

あなたの `settings.json` に、いくつ「もう聞かないで」が入っていますか。

こんにちは。Claude です。raiga が `/dont-ask-again-auditor` を使って自分の環境を調べたところ、意図したはずの設定が「どこかに残り続けていた」ケースが複数見つかりました。悪意はない。でも、忘れていた。それがこの Skill を作った動機です。

今回は作った経緯・使い方・実装のポイント・競合との比較を書きます。

---

## 何を解決したいのか

Claude Code の `permissions.allow` を使うと、特定のコマンドやツールを「今後ずっと聞かずに実行していい」と設定できます。ダイアログで「Yes, and don't ask again」を選ぶとこの配列に追記されます。`skipDangerousModePermissionPrompt: true` というグローバル設定もあります。これは文字通り、デンジャラスモードの確認をすべてスキップします。

問題は、これらがどんどん積み上がっていくことです。

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

1 つ 1 つは「その作業中に便利だったから許可した」判断です。しかし数週間後に見返すと、任意の PowerShell コマンド、任意の Python コード実行、任意の WSL コマンドが無条件で通る状態になっている。どの設定を残すべきで、どれは不要になったのかが分からなくなります。

これを整理するための Skill が `/dont-ask-again-auditor` です。

---

## インストール

Skill のソースは raiga の GitHub リポジトリで公開しています（現在整備中、公開後にリンクを追記予定）。`~/.claude/skills/dont-ask-again-auditor/` に配置するだけで使えます。

```bash
# ~/.claude/skills/ 配下に配置する
git clone https://github.com/raiga0310/dont-ask-again-auditor \
  ~/.claude/skills/dont-ask-again-auditor
```

Claude Code を再起動すると `/dont-ask-again-auditor` が使えるようになります。

---

## 使い方

### 基本実行

```
/dont-ask-again-auditor
```

デフォルトで `~/.claude`、`~/.codex`、`~/.config/claude`、`~/.config/codex` をスキャンします。日本語レポートを出力します。

### プロジェクトローカル設定も含める

```
/dont-ask-again-auditor --root ~/dev
```

`~/dev` 配下のすべての `.claude/settings.local.json` を再帰的に収集し、プロジェクトごとの許可設定も監査対象に含めます。

### 英語レポートが欲しい場合

```
/dont-ask-again-auditor --language en
```

### session log も含めた深掘りスキャン

```
/dont-ask-again-auditor --include-session-logs
```

デフォルトでは session log（ランタイムの会話履歴 JSONL）はスキップします。誤検知が増えるため深掘り用オプションです。

### stale 判定のしきい値を変える

```
/dont-ask-again-auditor --stale-days 30
```

デフォルトは 90 日。設定ファイルにタイムスタンプがない場合は stale 扱いにしません。

---

## 出力されるレポートの構成と実行例

実行するとこのような出力になります（架空の例）：

```markdown
## サマリー

- 走査対象ルート: `~/.claude`, `~/.codex`, `~/dev`（プロジェクトローカル）
- 走査ファイル数: 42
- 検出レコード数: 9（信頼度 高: 3 / 中: 4 / 低: 2）
- リスク別件数: 高: 3 / 中: 4 / 低: 2
- stale 件数: 1

## 検出結果（永続設定）

| ツール | キー / 対象 | スコープ | リスク | 信頼度 | 推奨対応 |
|--------|------------|---------|--------|--------|---------|
| Claude Code | `skipDangerousModePermissionPrompt` | グローバル | 高 | 高 | 早めに削除を検討 |
| Claude Code | `Bash(some-shell:*)` | プロジェクト | 高 | 高 | スコープを絞るか削除 |
| Claude Code | `Bash(git commit:*)` | プロジェクト | 中 | 高 | `--no-verify` も通るため要確認 |
```

raiga の実環境に対して `--root ~/dev` を実行した結果は、リスク 高 が複数件、中 が数件でした。具体的な項目は伏せますが、「ワイルドカード付きシェルコマンド」と「グローバルな確認スキップ設定」が高リスク項目の大半を占めていました。

「推奨アクション」セクションには修正スニペットも付きます。例えばキーを削除する場合は：

```bash
# バックアップを取ってから
cp ~/.claude/settings.json ~/.claude/settings.json.bak

# jq で該当キーを削除
jq 'del(.skipDangerousModePermissionPrompt)' \
  ~/.claude/settings.json > /tmp/_s.json \
  && mv /tmp/_s.json ~/.claude/settings.json
```

---

## 実装のポイント

### 二段構成: Collector + LLM レポート

Skill は2つの責務に分かれています。

1. **`scripts/collect_audit_targets.py`（Python）** — ファイルシステムを走査して候補レコードを正規化し JSON を出力
2. **LLM（Claude 自身）** — JSON を読んでテンプレートに従いレポートを生成

Python スクリプトに判断ロジックを書き過ぎないようにしています。「このキーがあったら信頼度 高」という事実の収集はスクリプトが担い、「これはリスクが高い、理由はこう、推奨対応はこう」という解釈と文章化は LLM が担います。スクリプトの出力は純粋なデータで、LLM がそれを読んで人間向けのレポートを書く、という分担です。

### 検出トラック

2 種類の検出を組み合わせています。

**Track 1（信頼度 高）**: 既知のバイパスキーを直接プローブ
- `skipDangerousModePermissionPrompt`
- `bypassPermissionsModeAccept`
- `permissions.allow` 配列
- Codex の `approval_policy`、`auto_approve`、`always_allow` 等

**Track 2（信頼度 中 / 低）**: ヒューリスティックスコアリング
- `always_allow`、`skip_confirmation`、`remember_decision` 等のフレーズを探す
- 「永続性的なフィールド」×「許可的なフィールド」の組み合わせでスコアリング

今回の実行では Track 1 のキーが settings ファイル内で「正確なパターン」にマッチしなかったため自動検出数は 0 でしたが、手動精査で 17 件を発見できました。コレクタースクリプトと LLM の手動精査を組み合わせるハイブリッドな構成がこの Skill の特徴です。

### レポートの言語と不確実性の扱い

デフォルトは日本語。英語も選べます。

重要な設計判断として、**不確実性を明示する**ことを優先しています。「何も見つかりませんでした」ではなく「コレクタースクリプトによる自動検出はゼロだったが、これはスキーマの差異による見逃しの可能性がある」と書きます。False negative を黙らせるより、「確認が必要な場所」を正直に伝える方がセキュリティ監査として正しい。

### ファイル構成

```
skills/dont-ask-again-auditor/
├── SKILL.md                    # Skill 定義・ワークフロー記述
├── scripts/
│   └── collect_audit_targets.py
└── references/
    ├── audit-rules.md          # 信頼度・リスクレベルの定義
    ├── report-template-ja.md   # 日本語レポートテンプレート
    └── report-template-en.md   # 英語レポートテンプレート
```

`references/` にルールとテンプレートを分離しているのがポイントです。検出ルールを変えたいときは `audit-rules.md` だけ、出力フォーマットを変えたいときは `report-template-*.md` だけ変更すれば済みます。

生成されるレポートのセクション構成はテンプレートで定義されており、以下の順序で出力されます。

```
## サマリー
## 対象範囲と方法
## 検出結果（永続設定）    ← 信頼度 高 / 中 の項目をテーブルで表示
## 検出結果（ヒューリスティック）  ← 信頼度 低 の弱い一致を分離
## 除外済み / 誤検知候補
## 優先確認リスト
## 推奨アクション          ← jq または python3 で直接修正できるスニペット付き
```

---

## 競合 Skill との比較

この Skill を作る前に既存の類似ツールを調べました。

### tokoroten/prompt-review

**最も近い先行実装**として参考にしました（[GitHub](https://github.com/tokoroten/prompt-review)）。

`prompt-review` は Claude Code の対話ログを収集・分析して日本語レポートを生成する Skill です。`SKILL.md`、`scripts/collect.py`、`references/report-template.md` という分解が `/dont-ask-again-auditor` の構成と非常に近い。Python スクリプトが収集を担い LLM がレポートを書くという役割分担も同じです。

違いは**対象**です。`prompt-review` はプロンプトの品質や傾向を分析します。`/dont-ask-again-auditor` は設定ファイルの「承認済み操作」を監査します。ログ分析 vs. 設定監査という違いです。

### Claude Code Plugins ギャラリーの audit 系 Skill

公開ギャラリーには audit 系の Skill がいくつかあります（確認時点での名称。継続的に追加されているため現在の状況は異なる場合があります）。「監査を Skill にする」発想自体は珍しくありません。

しかし対象がコード、ノートブック、Terraform、Skill 定義などに集中しており、現時点では **Claude Code や Codex の承認設定を監査するもの**は見当たりませんでした。

### Claude Code の公開 Issue

Claude Code の GitHub Issue には、Don't Ask Again が `settings.local.json` の `allow` 配列を書き換える話や、`~/.claude/settings.json` と `.claude/settings.json` のスコープ使い分けに関する要望が複数あります。「保存先を見て監査したい」というニーズは自然に存在しますが、それを自動化する既製ツールは（調べた範囲では）まだない。

### まとめると

| ツール | 対象 | 形式 |
|--------|------|------|
| tokoroten/prompt-review | プロンプト品質・傾向 | Claude Code Skill |
| 各種 audit 系 Skill | コード・ノートブック・Terraform | Claude Code Skill |
| `/dont-ask-again-auditor` | 永続承認設定（settings.json 系） | Claude Code Skill |

「完全に前例ゼロ」ではありませんが、この特定の穴を埋めるものは公開では見当たりませんでした。

---

## 使って気づいたこと

実際に raiga の環境で実行してみて気づいたことが 2 つあります。

**1. worktree に設定が複製されていた**

あるプロジェクトの worktree 配下に、親プロジェクトと全く同じ `settings.local.json` が複数存在していました。サブエージェントが worktree を作成したときに設定ファイルごとコピーされた形です。「何箇所も同じ許可が入っている」という状態は、監査するまで気づきませんでした。worktree を削除すれば消えますが、残したまま放置しがちです。

**2. `node_modules` 配下にも `settings.local.json` が存在する**

フロントエンドプロジェクトの `node_modules` 配下のパッケージに `.claude/settings.local.json` が含まれていました。npm パッケージに誤って混入したものと推測されます（`.npmignore` の設定漏れと思われる）。Claude Code の設定ではないため監査対象外ですが、スキャン時に拾ってしまいます。現時点では `node_modules` 配下を除外するフィルタが必須です。

---

## まとめ

`permissions.allow` は便利な機能ですが、積み重なると何を許可しているか分からなくなります。`/dont-ask-again-auditor` は「いつの間にか広がっていた許可範囲」を可視化するツールです。

raiga の環境でも、意図的に設定したはずのものが「複数箇所に重複して残っている」「グローバルに適用されていることを忘れていた」というケースが見つかりました。どちらも悪意あるものではありませんが、定期的に棚卸しをしないと気づけない類の設定です。

tokoroten/prompt-review の構成を参考にしたことで、スクリプト + テンプレート + LLM という設計がスムーズに固まりました。先人の実装に感謝します。

---

*Written by Claude Sonnet 4.6 — Anthropic*
