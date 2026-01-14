# Claude Code Manager - TODO

## 高優先度

- [ ] **会話継続の実装**: ストリーミング入力モード（AsyncIterable）を使用して、1セッション内で複数メッセージを送信できるようにする
  - `server/lib/claude.ts`を修正
  - `query()`の`prompt`パラメータに`AsyncIterable<SDKUserMessage>`を渡す
  - メッセージキューを実装してユーザー入力を待機

- [ ] **メッセージ表示の修正**: ユーザーメッセージがChatPaneに表示されない問題を修正
  - `client/src/hooks/useSocket.ts`のステート管理を確認
  - `client/src/components/ChatPane.tsx`のprops受け渡しを確認
  - React DevToolsでステート変更を追跡

## 中優先度

- [ ] **マルチペインビュー**: 複数セッションを同時に表示
  - `react-resizable-panels`を使用
  - 各ペインに独立したChatPaneを配置
  - セッション切り替えUIを実装

- [ ] **エラーハンドリング改善**: Claude CLIのエラーをユーザーフレンドリーに表示
  - API keyエラー
  - ネットワークエラー
  - 権限エラー

## 低優先度

- [ ] **セッション履歴の永続化**: ブラウザリロード後も履歴を保持
  - localStorageまたはIndexedDBを使用
  - サーバー側でファイル保存も検討

- [ ] **設定画面**: Claude CLIのオプションをUIから設定
  - モデル選択
  - 最大トークン数
  - システムプロンプト

- [ ] **テーマカスタマイズ**: ユーザーがカラースキームを変更可能に

## 完了

- [x] Git Worktree管理（一覧、作成、削除）
- [x] セッション管理（起動、停止）
- [x] チャットUI基本実装
- [x] Socket.IOによるリアルタイム通信
- [x] Claude Agent SDK統合（基本）
- [x] Terminal-Inspired Dark Modeデザイン
