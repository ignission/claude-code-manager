# Claude Code Manager

ローカルで稼働する複数のClaude Codeインスタンスを管理するWebUIアプリケーションです。

## 機能

- **Git Worktree管理**: WebUI上でgit worktreeの作成・一覧表示・削除が可能
- **複数セッション管理**: 各worktreeに対してClaude Codeセッションを起動・管理
- **チャットUI**: ターミナルインスパイアのダークモードデザインでClaude Codeと対話
- **リアルタイム通信**: Socket.IOによるリアルタイムなメッセージストリーミング

## 前提条件

- Node.js 18以上
- pnpm
- Git
- Claude Code CLI（`claude`コマンドがPATHに通っていること）

## インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd claude-code-manager

# 依存関係をインストール
pnpm install
```

## 開発

### フロントエンドのみ（UIプレビュー）

```bash
pnpm dev
```

### フルスタック開発（フロントエンド + バックエンド）

```bash
pnpm dev:full
```

これにより、以下が同時に起動します：
- Vite開発サーバー（フロントエンド）: http://localhost:5173
- Express + Socket.IOサーバー（バックエンド）: http://localhost:3000

## ビルド

```bash
pnpm build
```

## 本番環境での実行

```bash
pnpm build
pnpm start
```

## 使い方

1. アプリケーションを起動
2. 左サイドバーの「Select Repository」をクリックしてGitリポジトリのパスを入力
3. Worktree一覧が表示される
4. 「+」ボタンで新しいworktreeを作成、または既存のworktreeを選択
5. Playボタン（▶）をクリックしてClaude Codeセッションを開始
6. チャットエリアでClaude Codeと対話

## 技術スタック

- **フロントエンド**: React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **バックエンド**: Express, Socket.IO
- **ビルドツール**: Vite, esbuild
- **デザイン**: Terminal-Inspired Dark Mode

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    React Frontend                        ││
│  │  ┌─────────────┐  ┌─────────────────────────────────┐  ││
│  │  │  Sidebar    │  │         Chat Panel               │  ││
│  │  │  - Repo     │  │  - Messages                      │  ││
│  │  │  - Worktrees│  │  - Streaming                     │  ││
│  │  │  - Sessions │  │  - Input                         │  ││
│  │  └─────────────┘  └─────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                     Socket.IO (WebSocket)                    │
└──────────────────────────────┼───────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                         Server                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Express + Socket.IO                    ││
│  │  ┌─────────────────┐  ┌─────────────────────────────┐  ││
│  │  │   Git Module    │  │   Claude Process Manager    │  ││
│  │  │  - list         │  │  - spawn process            │  ││
│  │  │  - add          │  │  - stream-json parsing      │  ││
│  │  │  - remove       │  │  - session management       │  ││
│  │  └─────────────────┘  └─────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                    child_process.spawn                       │
└──────────────────────────────┼───────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │    Claude Code CLI   │
                    │  (stream-json mode)  │
                    └─────────────────────┘
```

## ライセンス

MIT
