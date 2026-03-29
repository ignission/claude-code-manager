# gh_exec Tool 設計仕様

## 概要

Beacon（Agent SDK）のMCPツールに `gh_exec` を追加し、任意の `gh` CLIコマンドを実行可能にする。

## 動機

Beaconチャットからgh CLIを直接実行する手段がなく、PR状態確認等でWebFetchにフォールバックしていた。既存の `get_pr_url` tool は `gh pr view --json url` のみで汎用性が低い。

## 設計

### Tool定義

| 項目        | 値                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------- |
| tool名      | `gh_exec`                                                                                           |
| 説明        | `gh` CLIコマンドを実行する                                                                          |
| inputSchema | `args: z.array(z.string())` — ghサブコマンドと引数, `cwd: z.string().optional()` — 実行ディレクトリ |
| 返り値      | `{ content: [{ type: "text", text: stdout }] }`                                                     |

### セキュリティ

- `args[0]` が `auth` の場合はブロック（認証操作防止）
- `execFile` で `gh` を直接実行（シェル経由なし、インジェクション不可）
- 引数は配列渡し

### 変更ファイル

| ファイル                       | 変更内容                                         |
| ------------------------------ | ------------------------------------------------ |
| `server/lib/beacon-manager.ts` | tool定義に `gh_exec` 追加、`allowedTools` に追加 |

### 実装パターン

既存toolと同じパターンで、`execFile` を使用してghコマンドを安全に実行する。

### allowedTools 追加

`mcp__ark-beacon__gh_exec` を `allowedTools` リストに追加する。
