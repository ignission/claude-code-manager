/**
 * SessionDashboard Component - Overview of all active sessions
 * 
 * Design: Terminal-Inspired Dark Mode
 * - Grid layout showing all active sessions
 * - Session cards with status and quick actions
 * - Click to expand into full chat view
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  Play,
  Square,
  MessageSquare,
  GitBranch,
  Clock,
  Zap,
  AlertCircle,
} from "lucide-react";
import type { Session, Worktree, Message } from "../../../shared/types";

interface SessionDashboardProps {
  sessions: Map<string, Session>;
  worktrees: Worktree[];
  messages: Map<string, Message[]>;
  streamingContent: Map<string, string>;
  onSelectSession: (sessionId: string) => void;
  onStopSession: (sessionId: string) => void;
}

export function SessionDashboard({
  sessions,
  worktrees,
  messages,
  streamingContent,
  onSelectSession,
  onStopSession,
}: SessionDashboardProps) {
  const sessionsArray = Array.from(sessions.values());

  const getWorktreeForSession = (session: Session): Worktree | undefined => {
    return worktrees.find((w) => w.id === session.worktreeId);
  };

  const getLastMessage = (sessionId: string): Message | undefined => {
    const sessionMessages = messages.get(sessionId) || [];
    return sessionMessages[sessionMessages.length - 1];
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "active":
        return "text-primary";
      case "idle":
        return "text-accent";
      case "error":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: Session["status"]) => {
    switch (status) {
      case "active":
        return <Zap className="w-4 h-4 animate-pulse" />;
      case "idle":
        return <Clock className="w-4 h-4" />;
      case "error":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Terminal className="w-4 h-4" />;
    }
  };

  if (sessionsArray.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No Active Sessions</h2>
          <p className="text-muted-foreground">
            Start a session from the sidebar to begin working with Claude Code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          Active Sessions
          <span className="text-sm font-normal text-muted-foreground">
            ({sessionsArray.length})
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sessionsArray.map((session) => {
          const worktree = getWorktreeForSession(session);
          const lastMessage = getLastMessage(session.id);
          const isStreaming = streamingContent.has(session.id);
          const messageCount = (messages.get(session.id) || []).length;

          return (
            <div
              key={session.id}
              className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onSelectSession(session.id)}
            >
              {/* Card Header */}
              <div className="p-3 border-b border-border bg-sidebar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`status-indicator ${session.status}`} />
                    <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-sm truncate">
                      {worktree?.branch || "Unknown"}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 ${getStatusColor(session.status)}`}>
                    {getStatusIcon(session.status)}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-3">
                {/* Last Message Preview */}
                <div className="mb-3 min-h-[60px]">
                  {isStreaming ? (
                    <div className="flex items-start gap-2">
                      <Terminal className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground line-clamp-3">
                        <span className="text-primary">Processing...</span>
                        <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse ml-1" />
                      </div>
                    </div>
                  ) : lastMessage ? (
                    <div className="flex items-start gap-2">
                      {lastMessage.role === "user" ? (
                        <MessageSquare className="w-3 h-3 text-accent mt-0.5 shrink-0" />
                      ) : (
                        <Terminal className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {lastMessage.content}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No messages yet
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{messageCount} messages</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSession(session.id);
                      }}
                    >
                      <Play className="w-3 h-3 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopSession(session.id);
                      }}
                    >
                      <Square className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default SessionDashboard;
