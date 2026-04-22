/**
 * SessionSidebar - リポジトリ別にグルーピングしたセッション一覧サイドバー
 *
 * セッション一覧（SessionCard） + 新規作成「+」ボタンを提供。
 * リポジトリごとにヘッダーで区切って表示する。
 * worktree中心のイテレーション: セッション未起動のworktreeも表示する。
 */

import { FolderOpen, Globe, Plus, Terminal, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGroupedWorktreeItems } from "@/hooks/useGroupedWorktreeItems";
import { getBaseName } from "@/utils/pathUtils";
import type { ManagedSession, Worktree } from "../../../shared/types";
import { SessionCard } from "./SessionCard";

interface SessionSidebarProps {
  sessions: Map<string, ManagedSession>;
  worktrees: Worktree[];
  repoList: string[];
  selectedSessionId: string | null;
  sessionPreviews: Map<string, string>;
  sessionActivityTexts: Map<string, string>;
  onSelectSession: (sessionId: string) => void;
  /** セッション削除（停止 + メイン以外のWorktree削除） */
  onDeleteSession: (sessionId: string, worktree: Worktree | undefined) => void;
  onStartSession: (worktree: Worktree) => void;
  onNewSession: () => void;
  /** リポジトリをサイドバー一覧から除外する */
  onRemoveRepo?: (repoPath: string) => void;
  /** ブラウザ選択コールバック（リモートアクセス時のみ使用） */
  onSelectBrowser?: () => void;
  /** ブラウザが選択中か */
  isBrowserSelected?: boolean;
  /** リモートアクセス中か */
  isRemote?: boolean;
}

export function SessionSidebar({
  sessions,
  worktrees,
  repoList,
  selectedSessionId,
  sessionPreviews,
  sessionActivityTexts,
  onSelectSession,
  onDeleteSession,
  onStartSession,
  onNewSession,
  onRemoveRepo,
  onSelectBrowser,
  isBrowserSelected = false,
  isRemote = false,
}: SessionSidebarProps) {
  const { groupedItems } = useGroupedWorktreeItems(
    worktrees,
    sessions,
    repoList
  );

  // basename → repoPath の対応表（同名repoは衝突する点に注意。既存ロジックも同前提）
  const repoPathByName = useMemo(
    () => new Map(repoList.map(p => [getBaseName(p), p])),
    [repoList]
  );

  const [removeTargetRepoPath, setRemoveTargetRepoPath] = useState<
    string | null
  >(null);

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* ヘッダー */}
      <div className="h-12 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <h1 className="font-semibold text-sm text-sidebar-foreground">Ark</h1>
        </div>
        <div className="flex items-center gap-1">
          {isRemote && onSelectBrowser && (
            <Button
              variant={isBrowserSelected ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={onSelectBrowser}
              aria-label={
                isBrowserSelected ? "ブラウザを選択中" : "ブラウザを開く"
              }
              aria-pressed={isBrowserSelected}
              title="ブラウザ"
            >
              <Globe className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNewSession}
            aria-label="新規セッション"
            title="新規セッション"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* セッション一覧 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sessions.size === 0 && worktrees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Terminal className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>セッションがありません</p>
              <p className="text-xs mt-1">「+」から新規作成</p>
            </div>
          ) : (
            Array.from(groupedItems.entries()).map(([repoName, items]) => {
              const repoPath = repoPathByName.get(repoName);
              const canRemove = !!onRemoveRepo && !!repoPath;
              return (
                <div key={repoName} className="mb-3">
                  {/* リポジトリヘッダー */}
                  <div className="sticky left-0 flex items-center gap-1.5 px-2 py-1.5">
                    <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {repoName}
                    </span>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/15"
                        onClick={() => setRemoveTargetRepoPath(repoPath)}
                        aria-label={`${repoName} をサイドバーから除外`}
                        title="サイドバーから除外"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {/* アイテム一覧 */}
                  <div className="space-y-1">
                    {items.map(({ worktree: wt, session }) => (
                      <SessionCard
                        key={session?.id ?? wt?.id ?? "unknown"}
                        session={session}
                        worktree={wt ?? undefined}
                        repoList={repoList}
                        isSelected={
                          session ? selectedSessionId === session.id : false
                        }
                        previewText={
                          session ? sessionPreviews.get(session.id) || "" : ""
                        }
                        activityText={
                          session
                            ? sessionActivityTexts.get(session.id) || ""
                            : ""
                        }
                        onClick={() => session && onSelectSession(session.id)}
                        onDelete={() =>
                          session &&
                          onDeleteSession(session.id, wt ?? undefined)
                        }
                        onStart={() => (wt ? onStartSession(wt) : undefined)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <AlertDialog
        open={removeTargetRepoPath !== null}
        onOpenChange={open => {
          if (!open) setRemoveTargetRepoPath(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>リポジトリをサイドバーから除外</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTargetRepoPath
                ? `「${getBaseName(removeTargetRepoPath)}」をサイドバー一覧から非表示にします。Worktreeやセッション、リポジトリ自体は削除されません。再度リポジトリを選択すれば復元できます。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTargetRepoPath && onRemoveRepo) {
                  onRemoveRepo(removeTargetRepoPath);
                }
                setRemoveTargetRepoPath(null);
              }}
            >
              除外
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
