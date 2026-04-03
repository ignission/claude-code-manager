import { useEffect, useRef, useState } from "react";
import type { ManagedSession, Worktree } from "../../../shared/types";

/** プレビュー無変化でアイドル判定するまでの秒数 */
const IDLE_THRESHOLD_MS = 10_000;

interface SessionCardProps {
  session: ManagedSession;
  worktree: Worktree | undefined;
  repoList: string[];
  isSelected: boolean;
  previewText: string;
  activityText: string;
  onClick: () => void;
  onStop: () => void;
}

export function SessionCard({
  session,
  worktree,
  isSelected,
  previewText,
  activityText,
  onClick,
  onStop,
}: SessionCardProps) {
  const branch =
    worktree?.branch ||
    session.worktreePath.substring(session.worktreePath.lastIndexOf("/") + 1);

  // プレビュー/アクティビティの変化を追跡してアイドル判定
  const prevTextRef = useRef(previewText);
  const prevActivityRef = useRef(activityText);
  const lastChangedRef = useRef(Date.now());
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (
      previewText !== prevTextRef.current ||
      activityText !== prevActivityRef.current
    ) {
      prevTextRef.current = previewText;
      prevActivityRef.current = activityText;
      lastChangedRef.current = Date.now();
      setIsIdle(false);
    }
  }, [previewText, activityText]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastChangedRef.current;
      setIsIdle(elapsed >= IDLE_THRESHOLD_MS);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // ✢✻はどちらもClaude Codeの動作中アニメーション記号
  const hasActivitySymbol = /[✢✻]/.test(activityText);

  // 緑: 動作中（✢✻+変化あり）、青: 起動直後//clear後（コンテンツなし）、赤: それ以外
  const dotColor =
    hasActivitySymbol && !isIdle
      ? "bg-green-500"
      : session.status === "idle" && !hasActivitySymbol
        ? "bg-blue-500"
        : "bg-red-500";

  // アイドル時はactivityText（✻ Baked for ...）、アクティブ時はコンテンツ行
  const idle = session.status === "idle" || isIdle;
  const displayText = idle && activityText ? activityText : previewText;

  return (
    <button
      type="button"
      className={`w-full text-left p-3 rounded-lg transition-colors group ${
        isSelected
          ? "bg-primary/15 border border-primary/30"
          : "hover:bg-sidebar-accent/50"
      }`}
      onClick={onClick}
      onContextMenu={e => {
        e.preventDefault();
        onStop();
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-sm font-mono truncate text-sidebar-foreground">
          {branch}
        </span>
        {isSelected && (
          <span className="ml-auto text-xs text-primary shrink-0">◀</span>
        )}
      </div>
      {displayText && (
        <p className="mt-1 text-xs text-muted-foreground truncate pl-4">
          {displayText}
        </p>
      )}
    </button>
  );
}
