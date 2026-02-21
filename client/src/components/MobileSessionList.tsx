/**
 * MobileSessionList - モバイル用セッション一覧画面
 *
 * ワークツリーをカード形式で表示し、セッションの開始・停止・オープンを操作する。
 * タップターゲットは最低48pxを確保。
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { GitBranch, Play, Square } from "lucide-react";
import type { ManagedSession, Worktree } from "../../../shared/types";

interface MobileSessionListProps {
  sessions: Map<string, ManagedSession>;
  worktrees: Worktree[];
  repoName: string | null;
  onOpenSession: (sessionId: string) => void;
  onStartSession: (worktree: Worktree) => void;
  onStopSession: (sessionId: string) => void;
}

export function MobileSessionList({
  sessions,
  worktrees,
  repoName,
  onOpenSession,
  onStartSession,
  onStopSession,
}: MobileSessionListProps) {
  const sessionByWorktreeId = useMemo(() => {
    const map = new Map<string, ManagedSession>();
    sessions.forEach((session) => {
      map.set(session.worktreeId, session);
    });
    return map;
  }, [sessions]);

  const getSessionForWorktree = (worktreeId: string) => {
    return sessionByWorktreeId.get(worktreeId);
  };

  return (
    <div className="flex-1 flex flex-col safe-area-x">
      {/* リポジトリ名表示 */}
      {repoName && (
        <div className="px-4 py-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-mono">{repoName}</span>
        </div>
      )}

      {/* ワークツリーリスト */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {worktrees.map((worktree) => {
          const session = getSessionForWorktree(worktree.id);
          return (
            <div
              key={worktree.id}
              className="bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {session && (
                    <div className={`status-indicator ${session.status}`} />
                  )}
                  <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm truncate">
                    {worktree.branch}
                  </span>
                  {worktree.isMain && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase">
                      main
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {session ? (
                    <>
                      <Button
                        size="sm"
                        className="h-10 px-4"
                        onClick={() => onOpenSession(session.id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-10 px-3"
                        onClick={() => onStopSession(session.id)}
                      >
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 px-4"
                      onClick={() => onStartSession(worktree)}
                    >
                      <Play className="w-4 h-4 mr-1" /> Start
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {worktrees.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            ワークツリーがありません
          </div>
        )}
      </div>
    </div>
  );
}
