# Claude Code Manager - 開発引き継ぎ資料

このドキュメントはClaude Codeが開発を引き継ぐための資料です。

## プロジェクト概要

**Claude Code Manager**は、ローカルで稼働する複数のClaude Codeインスタンスを管理するWebUIアプリケーションです。ユーザーがgit worktreeを選択し、各worktreeに対してClaude Codeセッションを起動・管理できます。

## 現在の実装状況

### 完了している機能

| 機能 | 状態 | 説明 |
|------|------|------|
| Git Worktree管理 | ✅ 完了 | 一覧表示、作成、削除 |
| セッション管理 | ✅ 完了 | 起動、停止、状態管理 |
| チャットUI | ✅ 完了 | メッセージ表示、入力フォーム |
| Socket.IO通信 | ✅ 完了 | リアルタイムストリーミング |
| Claude Agent SDK統合 | ⚠️ 部分的 | 基本動作するが会話継続に課題 |

### 未完了・改善が必要な機能

1. **会話の継続性**: 現在は各メッセージごとに新しい`query()`を作成しているため、会話コンテキストが維持されない
2. **ユーザーメッセージの表示**: ChatPaneでユーザーメッセージが表示されない問題がある
3. **マルチペインビュー**: 複数セッションを同時に表示する機能
4. **セッション履歴の永続化**: localStorage または ファイルベースでの保存

## 技術スタック

```
フロントエンド:
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Socket.IO Client
- Wouter (ルーティング)

バックエンド:
- Express
- Socket.IO
- Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- nanoid

ビルドツール:
- Vite
- esbuild
- tsx (開発時)
```

## ディレクトリ構造

```
claude-code-manager/
├── client/                    # フロントエンド
│   ├── src/
│   │   ├── components/        # UIコンポーネント
│   │   │   ├── Dashboard.tsx  # メインダッシュボード
│   │   │   ├── ChatPane.tsx   # チャットUI
│   │   │   ├── Sidebar.tsx    # サイドバー
│   │   │   └── ui/            # shadcn/ui コンポーネント
│   │   ├── hooks/
│   │   │   └── useSocket.ts   # Socket.IO フック
│   │   ├── pages/
│   │   │   └── Home.tsx       # ホームページ
│   │   └── App.tsx            # ルート
│   └── index.html
├── server/                    # バックエンド
│   ├── index.ts               # Expressサーバー
│   └── lib/
│       ├── claude.ts          # Claude Agent SDK統合
│       └── git.ts             # Git worktree操作
├── shared/                    # 共有型定義
│   └── types.ts
└── package.json
```

## 重要なファイル

### server/lib/claude.ts

Claude Agent SDKを使用してClaude Codeプロセスを管理します。

**現在の実装の問題点:**
```typescript
// 各メッセージごとに新しいquery()を作成している
const queryInstance = query({
  prompt: message,
  options,
});
```

**改善案: ストリーミング入力モードを使用**
```typescript
// AsyncIterableを使用して1つのセッションで複数メッセージを送信
async function* messageGenerator(): AsyncIterable<SDKUserMessage> {
  while (true) {
    const message = await waitForNextMessage();
    yield { type: "user", content: message };
  }
}

const queryInstance = query({
  prompt: messageGenerator(),
  options,
});
```

### client/src/hooks/useSocket.ts

Socket.IO接続とメッセージ状態を管理するReactフック。

**既知の問題:**
- `messages`ステートが更新されてもChatPaneが再レンダリングされない場合がある
- デバッグログでは状態更新が確認できるが、UIに反映されない

### shared/types.ts

フロントエンドとバックエンドで共有する型定義。

## 開発コマンド

```bash
# 依存関係のインストール
pnpm install

# フロントエンドのみ起動
pnpm dev

# フルスタック開発（推奨）
pnpm dev:full

# 型チェック
pnpm check

# ビルド
pnpm build

# 本番実行
pnpm start
```

## 優先度の高いタスク

### 1. 会話継続の実装（高優先度）

**目標**: 1つのセッション内で複数のメッセージを送信し、会話コンテキストを維持する

**アプローチ**:
1. `AsyncIterable<SDKUserMessage>`を使用したストリーミング入力モード
2. または `resume` オプションでセッションIDを指定して継続

**参考ドキュメント**: https://platform.claude.com/docs/en/agent-sdk/typescript

### 2. メッセージ表示の修正（高優先度）

**問題**: ユーザーメッセージがChatPaneに表示されない

**調査ポイント**:
- `useSocket.ts`の`messages`ステート管理
- `ChatPane.tsx`への`messages`プロップの受け渡し
- Reactの再レンダリングトリガー

### 3. マルチペインビュー（中優先度）

**目標**: 複数のClaude Codeセッションを同時に表示・操作

**実装案**:
- `react-resizable-panels`を使用（既にインストール済み）
- 各ペインに独立したChatPaneを配置

### 4. セッション永続化（低優先度）

**目標**: ブラウザをリロードしてもセッション履歴を保持

**実装案**:
- localStorageにメッセージ履歴を保存
- または、サーバー側でファイルに保存

## Socket.IOイベント一覧

### クライアント → サーバー

| イベント | データ | 説明 |
|----------|--------|------|
| `repo:select` | `path: string` | リポジトリを選択 |
| `worktree:list` | `repoPath: string` | worktree一覧を取得 |
| `worktree:create` | `{ repoPath, branchName, baseBranch? }` | worktreeを作成 |
| `worktree:delete` | `{ repoPath, worktreePath }` | worktreeを削除 |
| `session:start` | `{ worktreeId, worktreePath }` | セッションを開始 |
| `session:stop` | `sessionId: string` | セッションを停止 |
| `session:send` | `{ sessionId, message }` | メッセージを送信 |

### サーバー → クライアント

| イベント | データ | 説明 |
|----------|--------|------|
| `repo:set` | `path: string` | リポジトリが設定された |
| `repo:error` | `error: string` | リポジトリエラー |
| `worktree:list` | `Worktree[]` | worktree一覧 |
| `worktree:created` | `Worktree` | worktreeが作成された |
| `worktree:error` | `error: string` | worktreeエラー |
| `session:created` | `Session` | セッションが作成された |
| `session:updated` | `Session` | セッション状態が更新された |
| `session:stopped` | `sessionId: string` | セッションが停止した |
| `session:error` | `{ sessionId, error }` | セッションエラー |
| `message:received` | `Message` | メッセージを受信 |
| `message:stream` | `{ sessionId, chunk }` | ストリーミングチャンク |
| `message:complete` | `{ sessionId, messageId }` | メッセージ完了 |

## デザインガイドライン

**テーマ**: Terminal-Inspired Dark Mode

| 要素 | 値 |
|------|-----|
| 背景色 | `#0D1117` |
| アクセント（緑） | `#00FF88` |
| アクセント（シアン） | `#00D4FF` |
| フォント | JetBrains Mono |

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `3001` | バックエンドサーバーのポート |
| `CLAUDE_PATH` | 自動検出 | Claude CLIの実行パス |
| `ANTHROPIC_API_KEY` | - | Anthropic APIキー（SDK使用時） |

## 既知の問題

1. **TypeScriptエラー**: `this.sessions`が`this.processes`と混在している箇所がある（修正済み）
2. **unbuffer依存**: 以前はunbufferコマンドが必要だったが、SDK移行により不要に
3. **権限プロンプト**: `--dangerously-skip-permissions`フラグで回避中

## 参考リンク

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [GitHub Repository](https://github.com/shomatan/claude-code-manager)

## 連絡先

質問や不明点があれば、このリポジトリのIssueで報告してください。
