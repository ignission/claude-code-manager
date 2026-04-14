/**
 * MobileSessionView - モバイル用セッション詳細画面
 *
 * ターミナル全画面表示 + Quick Keys + 入力バー常時表示。
 * Opsドロップダウンで追加操作（Copy Buffer, Paste Image, Reload, スラッシュコマンド）。
 */

import {
  ChevronLeft,
  Copy,
  File as FileIcon,
  GitBranch,
  ImageIcon,
  MoreVertical,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ManagedSession,
  SpecialKey,
  Worktree,
} from "../../../shared/types";
import { fileToBase64, validateFile } from "../hooks/useFileUpload";
import { useTerminalLinkInjection } from "../hooks/useTerminalLinkInjection";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { FileViewerPane } from "./FileViewerPane";
import type { ViewerTab } from "./TerminalPane";
import { ViewerTabBar } from "./ViewerTabBar";

interface MobileSessionViewProps {
  session: ManagedSession;
  worktree: Worktree | undefined;
  onBack: () => void;
  onSendMessage: (message: string) => void;
  onSendKey: (key: SpecialKey) => void;
  /** セッション削除（停止 + メイン以外のWorktree削除） */
  onDeleteSession: () => void;
  onUploadFile?: (data: {
    base64Data: string;
    mimeType: string;
    originalFilename?: string;
  }) => void;
  fileUploadResult?: {
    path: string;
    filename: string;
    originalFilename?: string;
  } | null;
  fileUploadError?: string | null;
  onClearFileUploadState?: () => void;
  onCopyBuffer?: () => Promise<string | null>;
  tabs: ViewerTab[];
  activeTabIndex: number;
  onTabSelect: (index: number) => void;
  onTabClose: (index: number) => void;
}

export function MobileSessionView({
  session,
  worktree,
  onBack,
  onSendMessage,
  onSendKey,
  onDeleteSession,
  onUploadFile,
  fileUploadResult,
  fileUploadError,
  onClearFileUploadState,
  onCopyBuffer,
  tabs,
  activeTabIndex,
  onTabSelect,
  onTabClose,
}: MobileSessionViewProps) {
  const { height: viewportHeight, isKeyboardVisible } = useVisualViewport();
  const [inputValue, setInputValue] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [pastedImage, setPastedImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);
  const [imageMessage, setImageMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // トンネル経由のアクセス時はURLのトークンをiframeにも付与
  const urlToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token")
      : null;
  const ttydBasePath = `/ttyd/${session.id}/`;
  // 常にプロキシ経由でアクセスし同一オリジンを維持する
  const ttydIframeSrc = urlToken
    ? `${ttydBasePath}?token=${urlToken}`
    : ttydBasePath;

  // メッセージ送信（空文字でもEnterとして送信 = ターミナルへの空行送信）
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendMessage(inputValue);
    setInputValue("");
  };

  // Enter送信（inputなのでShift+Enterチェック不要）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // iframeリロード
  const handleReloadIframe = () => {
    setIframeKey(prev => prev + 1);
  };

  // クリップボードから画像を読み取り
  const handlePaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      if (!onUploadFile) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const itemsArray = Array.from(items);
      for (const item of itemsArray) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = event => {
            const dataUrl = event.target?.result as string;
            const [header, base64] = dataUrl.split(",");
            const mimeType = header.match(/data:(.*?);/)?.[1] || "image/png";
            setPastedImage({ base64, mimeType, preview: dataUrl });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [onUploadFile]
  );

  // ペーストイベントのリスナー
  useEffect(() => {
    const handleDocumentPaste = (e: ClipboardEvent) => {
      if (document.activeElement === inputRef.current) {
        handlePaste(e);
      }
    };
    document.addEventListener("paste", handleDocumentPaste);
    return () => document.removeEventListener("paste", handleDocumentPaste);
  }, [handlePaste]);

  // クリップボードからの画像ペーストボタン
  const handlePasteButtonClick = async () => {
    if (!onUploadFile) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = event => {
            const dataUrl = event.target?.result as string;
            const [header, base64] = dataUrl.split(",");
            const mimeType = header.match(/data:(.*?);/)?.[1] || "image/png";
            setPastedImage({ base64, mimeType, preview: dataUrl });
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  // 画像貼り付け経路: pastedImage + fileUploadResult が揃ったら自動送信
  useEffect(() => {
    if (fileUploadResult && pastedImage) {
      const message = imageMessage.trim()
        ? `@${fileUploadResult.path} ${imageMessage}`
        : `@${fileUploadResult.path}`;
      onSendMessage(message);
      setPastedImage(null);
      setImageMessage("");
      onClearFileUploadState?.();
    }
  }, [
    fileUploadResult,
    pastedImage,
    imageMessage,
    onSendMessage,
    onClearFileUploadState,
  ]);

  // ファイル選択ハンドラ
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!onUploadFile) return;
      for (const file of files) {
        const v = validateFile(file);
        if (!v.ok) {
          console.warn(v.reason);
          continue;
        }
        const { base64, mimeType, filename } = await fileToBase64(file);
        onUploadFile({
          base64Data: base64,
          mimeType,
          originalFilename: filename,
        });
      }
    },
    [onUploadFile]
  );

  // file-upload 成功時: 入力欄のカーソル位置に @path を挿入（画像貼り付け経路とは別）
  useEffect(() => {
    if (fileUploadResult && !pastedImage) {
      const insert = ` @${fileUploadResult.path} `;
      const input = inputRef.current;
      if (input) {
        const start = input.selectionStart ?? inputValue.length;
        const end = input.selectionEnd ?? inputValue.length;
        const next =
          inputValue.slice(0, start) + insert + inputValue.slice(end);
        setInputValue(next);
      } else {
        setInputValue(prev => prev + insert);
      }
      onClearFileUploadState?.();
    }
  }, [fileUploadResult, pastedImage, inputValue, onClearFileUploadState]);

  // tmuxバッファコピー
  const handleCopyBuffer = async () => {
    if (!onCopyBuffer) return;
    try {
      const text = await onCopyBuffer();
      if (text) {
        await navigator.clipboard.writeText(text);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // ttyd iframe内のxterm.jsにリンク検出をインジェクト（共通フック）
  useTerminalLinkInjection(iframeRef, iframeKey);

  // スラッシュコマンド
  const slashCommands = [
    { label: "/resume", cmd: "/resume" },
    { label: "/help", cmd: "/help" },
    { label: "/status", cmd: "/status" },
    { label: "/clear", cmd: "/clear" },
    { label: "/compact", cmd: "/compact" },
  ];

  return (
    <div
      className="flex-1 flex flex-col min-h-0 safe-area-x"
      style={
        isKeyboardVisible
          ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
          : undefined
      }
    >
      {/* ヘッダー: 戻る、ブランチ名、Opsドロップダウン、Stopボタン */}
      <header className="h-12 border-b border-border flex items-center justify-between px-2 bg-sidebar shrink-0 safe-area-top">
        <div className="flex items-center gap-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onBack}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className={`status-indicator ${session.status} shrink-0`} />
          <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm truncate">
            {worktree?.branch ||
              session.worktreePath.substring(
                session.worktreePath.lastIndexOf("/") + 1
              )}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Opsドロップダウン */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onCopyBuffer && (
                <DropdownMenuItem onClick={handleCopyBuffer}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Buffer
                </DropdownMenuItem>
              )}
              {onUploadFile && (
                <DropdownMenuItem onClick={handlePasteButtonClick}>
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Paste Image
                </DropdownMenuItem>
              )}
              {onUploadFile && (
                <DropdownMenuItem asChild>
                  <label className="cursor-pointer flex items-center w-full">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={async e => {
                        const files = Array.from(e.target.files ?? []);
                        await handleFilesSelected(files);
                        e.target.value = "";
                      }}
                    />
                    <FileIcon className="mr-2 h-4 w-4" />
                    ファイルを添付
                  </label>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleReloadIframe}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {slashCommands.map(({ label, cmd }) => (
                <DropdownMenuItem
                  key={cmd}
                  onClick={() => onSendMessage(cmd)}
                  className="font-mono text-xs"
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* 削除ボタン（セッション停止 + メイン以外のWorktree削除） */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
            title="セッションを削除"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* タブバー（共通コンポーネント） */}
      <ViewerTabBar
        tabs={tabs}
        activeTabIndex={activeTabIndex}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
      />

      {/* ttyd iframe */}
      <div
        className="flex-1 min-h-0 bg-[#1a1b26] overflow-hidden relative"
        style={{
          display:
            tabs[activeTabIndex]?.type === "terminal" ? undefined : "none",
        }}
      >
        {session.ttydUrl || session.ttydPort ? (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={ttydIframeSrc}
            className="w-full h-full border-0"
            title={`Terminal - ${worktree?.branch || session.id}`}
            allow="clipboard-read; clipboard-write; keyboard-map"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>ターミナルを起動中...</p>
            </div>
          </div>
        )}
      </div>

      {/* ファイルビューワー / ブラウザ */}
      {tabs[activeTabIndex]?.type === "file" &&
        (() => {
          const tab = tabs[activeTabIndex] as ViewerTab & { type: "file" };
          return (
            <div className="flex-1 min-h-0">
              <FileViewerPane
                filePath={tab.filePath}
                content={tab.content}
                mimeType={tab.mimeType}
                size={tab.size}
                targetLine={tab.targetLine}
                error={tab.error}
              />
            </div>
          );
        })()}

      {/* 画像ペーストプレビュー */}
      {pastedImage && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold mb-3">画像を送信</h3>
            <div className="mb-3">
              <img
                src={pastedImage.preview}
                alt="Pasted"
                className="max-h-48 mx-auto rounded border border-border"
              />
            </div>
            <div className="mb-3">
              <Textarea
                value={imageMessage}
                onChange={e => setImageMessage(e.target.value)}
                placeholder="画像についてのメッセージ（任意）"
                className="min-h-[60px] resize-none text-sm"
                rows={2}
              />
            </div>
            {fileUploadError && (
              <p className="text-destructive text-xs mb-3">{fileUploadError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPastedImage(null);
                  setImageMessage("");
                  onClearFileUploadState?.();
                }}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onUploadFile?.({
                    base64Data: pastedImage.base64,
                    mimeType: pastedImage.mimeType,
                    originalFilename: "pasted-image",
                  });
                }}
              >
                送信
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Keys: ↑/↓/Esc/Ctrl+C/S-Tab 常時表示 */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/50 bg-sidebar overflow-x-auto select-none">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs shrink-0"
          onClick={() => onSendKey("Up")}
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs shrink-0"
          onClick={() => onSendKey("Down")}
        >
          ↓
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs shrink-0"
          onClick={() => onSendKey("Escape")}
        >
          Esc
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-destructive hover:text-destructive shrink-0"
          onClick={() => onSendKey("C-c")}
        >
          Ctrl+C
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs shrink-0"
          onClick={() => onSendKey("S-Tab")}
        >
          S-Tab
        </Button>
      </div>

      {/* 入力バー: 常時表示 */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-border bg-sidebar safe-area-bottom"
      >
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              enterKeyHint="send"
              placeholder="メッセージを入力... (Enter送信)"
              className="h-11 font-mono text-sm bg-input"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 glow-green shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </form>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card border-border w-[calc(100%-2rem)] max-w-md mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>セッションを削除</AlertDialogTitle>
            <AlertDialogDescription>
              {worktree === undefined
                ? "このセッションを削除しますか？"
                : worktree.isMain
                  ? "このセッションを削除しますか？メインWorktreeは削除されません。"
                  : "このセッションとWorktreeを削除しますか？関連するブランチも削除されます。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="h-12 md:h-10">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-12 md:h-10"
              onClick={() => {
                onDeleteSession();
                setShowDeleteDialog(false);
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
