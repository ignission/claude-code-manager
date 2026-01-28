import type { TtydSession } from "../hooks/useSocket";

/**
 * セッションが指定されたリポジトリに属するかどうかを判定する
 *
 * @param session - 判定対象のセッション
 * @param repoPath - リポジトリのパス
 * @returns セッションがリポジトリに属する場合はtrue
 */
export function isSessionBelongsToRepo(
  session: TtydSession,
  repoPath: string
): boolean {
  const worktreePath = session.worktreePath;

  // メインworktree（パスが完全一致）
  if (worktreePath === repoPath) return true;

  // 派生worktree（同じ親ディレクトリで、リポジトリ名で始まる）
  const repoParent = repoPath.substring(0, repoPath.lastIndexOf("/"));
  const repoName = repoPath.substring(repoPath.lastIndexOf("/") + 1);
  const worktreeParent = worktreePath.substring(
    0,
    worktreePath.lastIndexOf("/")
  );
  const worktreeName = worktreePath.substring(
    worktreePath.lastIndexOf("/") + 1
  );

  return worktreeParent === repoParent && worktreeName.startsWith(repoName + "-");
}
