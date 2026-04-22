/**
 * useGroupedWorktreeItems - worktreeをリポジトリ別にグルーピングするカスタムフック
 *
 * SessionSidebarとMobileSessionListで共通のグルーピングロジックを提供する。
 */

import { useMemo } from "react";
import { getBaseName } from "@/utils/pathUtils";
import { findRepoForSession } from "@/utils/sessionUtils";
import type { ManagedSession, Worktree } from "../../../shared/types";

export type GroupedItem = {
  worktree: Worktree | null;
  session: ManagedSession | null;
};

export function useGroupedWorktreeItems(
  worktrees: Worktree[],
  sessions: Map<string, ManagedSession>,
  repoList: string[]
) {
  const sessionByWorktreeId = useMemo(() => {
    const map = new Map<string, ManagedSession>();
    sessions.forEach(session => {
      map.set(session.worktreeId, session);
    });
    return map;
  }, [sessions]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, GroupedItem[]>();
    const worktreeSessionIds = new Set<string>();

    // repoListに含まれるrepoのworktree/sessionのみ表示する。
    // repoListが空の場合は何も表示しない（「全件表示」にフォールバックすると、
    // 最後の1件を除外した直後に除外対象が再表示されてしまう）。
    const repoListEmpty = repoList.length === 0;

    // worktreePath昇順で処理することでリロード間の並び順を安定させる
    const sortedWorktrees = [...worktrees].sort((a, b) =>
      a.path.localeCompare(b.path)
    );
    for (const wt of sortedWorktrees) {
      if (repoListEmpty) break;
      const session = sessionByWorktreeId.get(wt.id) ?? null;
      const matchedRepo = repoList.find(repo => wt.path.startsWith(repo));
      const sessionRepoMatched = session?.repoPath
        ? repoList.includes(session.repoPath)
        : false;
      if (!matchedRepo && !sessionRepoMatched) continue;
      if (session) worktreeSessionIds.add(session.id);
      const repoName = (() => {
        if (session?.repoPath) return getBaseName(session.repoPath);
        if (matchedRepo) return getBaseName(matchedRepo);
        return getBaseName(wt.path.split("/.worktrees/")[0] || wt.path);
      })();
      const existing = groups.get(repoName) || [];
      existing.push({ worktree: wt, session });
      groups.set(repoName, existing);
    }

    const sortedSessions = Array.from(sessions.values()).sort((a, b) =>
      a.worktreePath.localeCompare(b.worktreePath)
    );
    for (const session of sortedSessions) {
      if (repoListEmpty) break;
      if (worktreeSessionIds.has(session.id)) continue;
      const repo = session.repoPath ?? findRepoForSession(session, repoList);
      if (!repo || !repoList.includes(repo)) continue;
      const repoName = getBaseName(repo);
      const existing = groups.get(repoName) || [];
      existing.push({ worktree: null, session });
      groups.set(repoName, existing);
    }

    // リポジトリ名でも安定ソートする
    return new Map(
      Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [worktrees, sessions, sessionByWorktreeId, repoList]);

  return { groupedItems, sessionByWorktreeId };
}
