---
name: merge-and-cleanup
description: PRマージ→main最新化→ブランチ削除を一括実行
allowed-tools: Bash, Read, Agent
argument-hint: [PR番号]
---

## PRマージ後のクリーンアップ

PR $0 をマージし、ローカルブランチを最新化する。

## 手順

以下の順序で実行すること:

### 1. PRマージ

```bash
gh pr merge $0 --squash --delete-branch
```

### 2. ローカルブランチ最新化

```bash
git checkout main && git pull
```

マージ元のローカルブランチが残っている場合は削除:

```bash
git branch -vv | grep '\[origin/.*: gone\]' | awk '{print $$1}' | xargs -r git branch -d
```

## 完了報告

全ステップ完了後、以下を報告:

- PR #$0 マージ完了
- ブランチ: main (最新)
