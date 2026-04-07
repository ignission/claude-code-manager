# ファイルビューワー & ローカルポートブラウザ 設計書

## 概要

Claudeのターミナル出力に含まれるファイルパスやlocalhost URLを自動検出し、クリッカブルリンクとして機能させる。クリック時にメインエリアのタブとしてファイルビューワーまたはローカルポートブラウザを開く。

## スコープ

### 今回のスコープ
- ターミナル出力からファイルパス/localhost URLを自動検出しリンク化
- ファイルビューワー（Markdown レンダリング、コードのシンタックスハイライト）
- ローカルポートブラウザ（localhost URLをiframe表示）
- ターミナル領域にタブとして統合（PC・モバイル両対応）

### スコープ外
- ディレクトリツリー表示（将来対応）
- 列の表示/非表示切替（別機能）
- Beacon/worktreeの表示切替（別機能）

## アーキテクチャ

### 全体フロー

```
ttyd iframe (xterm.js)
  │ registerLinkProvider()でリンク検出
  │ クリック時
  ▼
window.parent.postMessage({ type: 'ark:open-file', path, line })
  or
window.parent.postMessage({ type: 'ark:open-url', url })
  │
  ▼
親ウィンドウ (React)
  │ message eventをリスン
  │ タブ追加
  ▼
ファイルの場合: socket.emit('file:read', { worktreePath, filePath })
  │
  ▼
サーバー: FileManager.readFile() → パス検証 → ファイル読み取り
  │
  ▼
socket.emit('file:content', { filePath, content, mimeType })
  │
  ▼
FileViewerPane: mimeTypeに応じてレンダリング
  - .md → react-markdown (GFM + Shikiコードブロック)
  - .ts/.tsx/.js/.json等 → Shiki シンタックスハイライト + 行番号
  - 画像 → <img>タグ
  - その他テキスト → プレーンテキスト + 行番号
  - バイナリ → 「プレビュー不可」メッセージ

localhost URLの場合:
  → BrowserPane: iframe でlocalhost URLを表示
```

## セクション1: リンク検出とクリックハンドリング

### ttyd iframe内へのJSインジェクト

ttydは同一オリジン（http-proxyでプロキシ）なので、iframe.contentWindowにアクセス可能。

**インジェクトタイミング:**
- iframe の `load` イベント後
- ttyd再接続時にも再インジェクト

**xterm.js Terminalインスタンス取得:**
- ttydはグローバル変数 `term` としてTerminalインスタンスを公開
- `iframe.contentWindow.term` でアクセス

### 検出パターン

| パターン | 正規表現 | 例 |
|---------|---------|-----|
| Claude Code ファイル参照 | `(?:file:)?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)(:\d+)?` | `file:src/App.tsx:42`, `src/App.tsx:10` |
| localhost URL | `https?://(?:localhost\|127\.0\.0\.1)(?::\d+)?[/\w.-]*` | `http://localhost:3000/api` |

### クリックハンドラ

```
xterm.js registerLinkProvider() {
  provideLinks(lineNumber, callback) {
    // 行テキストからパターンマッチ
    // マッチ → Link オブジェクトを返す
  }
}

Link.activate = () => {
  if (isFileLink) {
    window.parent.postMessage({
      type: 'ark:open-file',
      path: matchedPath,
      line: matchedLine || null
    }, '*')
  } else if (isLocalhostUrl) {
    window.parent.postMessage({
      type: 'ark:open-url',
      url: matchedUrl
    }, '*')
  }
}
```

### 親ウィンドウ側のメッセージリスナー

- `window.addEventListener('message', handler)` で受信
- `event.origin` を検証（同一オリジンのみ許可）
- メッセージタイプに応じてタブ追加

### worktreePathの特定

ファイルリンククリック時、どのworktreeのファイルかを特定する必要がある:
- 各TerminalPaneは対応するセッション（=worktree）を持つ
- postMessage受信時、現在アクティブなセッションのworktreePathを使用
- ファイルパスはworktree相対パスとして解決

## セクション2: サーバー側ファイルAPI

### 新規ファイル: `server/lib/file-manager.ts`

```typescript
class FileManager {
  readFile(worktreePath: string, filePath: string): {
    content: string;
    mimeType: string;
    size: number;
  }

  private resolveSafePath(worktreePath: string, filePath: string): string {
    // 1. path.resolve()で絶対パス化
    // 2. realpath()でシンボリックリンク解決
    // 3. startsWith(worktreePath)でworktreeルート外アクセスを拒否
    // 4. 違反時はエラー
  }

  private detectMimeType(filePath: string): string {
    // 拡張子ベースのMIMEタイプ判定
  }
}
```

### Socket.IOイベント

**shared/types.ts に追加:**

```typescript
interface ClientToServerEvents {
  'file:read': (data: { worktreePath: string; filePath: string }) => void;
}

interface ServerToClientEvents {
  'file:content': (data: {
    filePath: string;
    content: string;
    mimeType: string;
    size: number;
    error?: string;
  }) => void;
}
```

### セキュリティ

- パストラバーサル防止: `../` や絶対パス指定をブロック
- シンボリックリンク解決後の再検証
- バイナリファイル: mimeTypeのみ返す（contentは空文字）
- 最大ファイルサイズ: 1MB（超過時はエラー）
- worktreeパス内のファイルのみアクセス許可

## セクション3: クライアント側ファイルビューワー

### 新規コンポーネント

#### `FileViewerPane.tsx`

ファイル内容を種類に応じてレンダリングするコンポーネント。

**レンダリング切替:**

| ファイル種類 | mimeType | レンダリング |
|-------------|----------|-------------|
| Markdown | `text/markdown` | react-markdown (remark-gfm + Shikiコードブロック) |
| TypeScript/JavaScript | `text/typescript`, `text/javascript` | Shiki + 行番号 |
| JSON | `application/json` | Shiki (json) + 行番号 |
| 画像 | `image/*` | `<img>` タグ |
| SVG | `image/svg+xml` | インラインSVG表示 |
| その他テキスト | `text/*` | プレーンテキスト + 行番号 |
| バイナリ | その他 | 「プレビュー不可」メッセージ |

**行番号とスクロール:**
- コードファイルは行番号表示
- `file:path:42` で開いた場合、42行目にスクロール＋ハイライト

**ヘッダー:**
- ファイル名
- ファイルパス（worktree相対）
- ファイルサイズ

#### `BrowserPane.tsx`

localhost URLをiframeで表示するシンプルなブラウザ。

- アドレスバー: URL表示 + リロードボタン + 戻る/進むボタン
- iframe本体: sandbox属性でセキュリティ制限
- リモートアクセス時: サーバー側プロキシ経由でアクセス（http-proxy活用）

### タブ管理

TerminalPaneにタブバーを追加:

```
[Terminal] [App.tsx ×] [README.md ×] [localhost:3000 ×]
```

**タブの種類:**
- `terminal`: 常時存在、閉じ不可
- `file`: ファイルビューワー、×で閉じられる
- `browser`: ローカルポートブラウザ、×で閉じられる

**タブ状態管理:**
- `useState` でタブ配列を管理
- 同じファイル/URLが既に開いている場合はそのタブにフォーカス
- タブの最大数: 制限なし（ただしスクロール可能なタブバー）

### 依存ライブラリ追加

- `shiki`: シンタックスハイライト（VSCode互換）
- 既存の `react-markdown` を活用（追加不要）
- 既存の `remark-gfm` を活用（追加不要、なければ追加）

## セクション4: モバイル対応

### 画面遷移パターン

モバイルでは既存のセッション一覧→詳細の画面遷移パターンに合わせる:

1. セッション選択 → ターミナル表示
2. ターミナル内リンクタップ → ファイルビューワー/ブラウザに遷移
3. 戻るボタン → ターミナルに戻る

### リンク検出

PC版と同じ仕組み（iframe内JSインジェクト）。タップでファイルビューワー/ブラウザに画面遷移。

### ローカルポートブラウザ（リモートアクセス時）

リモートアクセス（Cloudflare Tunnel経由）時はlocalhostに直接アクセスできないため、サーバー側プロキシが必要:

- 既存の `http-proxy` を活用（ttydプロキシと同じパターン）
- `/proxy/:port/*` エンドポイントで任意のlocalhostポートにプロキシ
- セキュリティ: localhostのみ転送可能（外部URLへのプロキシは拒否）

## 影響範囲

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `shared/types.ts` | `file:read`, `file:content` イベント型追加 |
| `server/index.ts` | file:read ハンドラー追加 |
| `server/lib/file-manager.ts` | **新規** ファイル読み取り管理 |
| `client/src/components/TerminalPane.tsx` | タブバー追加、postMessageリスナー |
| `client/src/components/FileViewerPane.tsx` | **新規** ファイルビューワー |
| `client/src/components/BrowserPane.tsx` | **新規** ローカルポートブラウザ |
| `client/src/components/MobileSessionView.tsx` | ファイルビューワー/ブラウザ遷移対応 |
| `client/src/hooks/useSocket.ts` | file:content ハンドラー追加 |
| `package.json` | shiki 依存追加 |

### 新規依存

- `shiki` (シンタックスハイライト)
- `remark-gfm` (Markdownの表・チェックリスト等対応、未導入の場合)
