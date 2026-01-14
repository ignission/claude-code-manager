/**
 * Claude Code Process Manager
 * 
 * Manages Claude Code CLI processes for each session.
 * Uses node-pty for TTY emulation and stream-json output format.
 */

import { spawn as ptySpawn, IPty } from "node-pty";
import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import type { Session, Message, ClaudeStreamEvent } from "../../shared/types.js";

interface ProcessInfo {
  process: IPty | null;
  session: Session;
  buffer: string;
}

export class ClaudeProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();

  constructor() {
    super();
  }

  // Start a new Claude Code session
  startSession(worktreeId: string, worktreePath: string): Session {
    const sessionId = nanoid();
    
    const session: Session = {
      id: sessionId,
      worktreeId,
      worktreePath,
      status: "idle",
      createdAt: new Date(),
    };

    this.processes.set(sessionId, {
      process: null,
      session,
      buffer: "",
    });

    this.emit("session:created", session);
    return session;
  }

  // Send a message to Claude Code
  async sendMessage(sessionId: string, message: string): Promise<void> {
    const info = this.processes.get(sessionId);
    if (!info) {
      throw new Error("Session not found");
    }

    console.log(`[Claude] Sending message to session ${sessionId}: ${message.substring(0, 50)}...`);
    console.log(`[Claude] Working directory: ${info.session.worktreePath}`);

    // Update session status
    info.session.status = "active";
    this.emit("session:updated", info.session);

    // Create user message
    const userMessage: Message = {
      id: nanoid(),
      sessionId,
      role: "user",
      content: message,
      timestamp: new Date(),
      type: "text",
    };
    this.emit("message:received", userMessage);

    // Use CLAUDE_PATH env var or default to 'claude'
    const claudePath = process.env.CLAUDE_PATH || "claude";
    console.log(`[Claude] Using claude path: ${claudePath}`);

    // Build arguments array
    const args = [
      "-p", message,
      "--output-format", "stream-json",
      "--verbose",
    ];
    console.log(`[Claude] Spawning with PTY: ${claudePath} ${args.join(" ")}`);

    try {
      // Spawn Claude Code process with PTY
      const ptyProcess = ptySpawn(claudePath, args, {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: info.session.worktreePath,
        env: {
          ...process.env,
          CI: "true",
          TERM: "xterm-256color",
        } as { [key: string]: string },
      });

      info.process = ptyProcess;
      info.buffer = "";

      console.log(`[Claude] PTY process spawned with PID: ${ptyProcess.pid}`);

      // Handle data from PTY
      ptyProcess.onData((data: string) => {
        console.log(`[Claude] PTY data: ${data.substring(0, 100)}...`);
        info.buffer += data;

        // Process complete JSON lines
        const lines = info.buffer.split("\n");
        info.buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          // Remove ANSI escape codes
          const cleanLine = trimmedLine.replace(/\x1b\[[0-9;]*m/g, "");
          if (cleanLine) {
            this.processStreamEvent(sessionId, cleanLine);
          }
        }
      });

      // Handle process exit
      ptyProcess.onExit(({ exitCode }) => {
        console.log(`[Claude] PTY process exited with code: ${exitCode}`);
        
        // Process any remaining buffer
        if (info.buffer.trim()) {
          const cleanBuffer = info.buffer.trim().replace(/\x1b\[[0-9;]*m/g, "");
          if (cleanBuffer) {
            this.processStreamEvent(sessionId, cleanBuffer);
          }
        }

        info.session.status = exitCode === 0 ? "idle" : "error";
        this.emit("session:updated", info.session);
        this.emit("message:complete", { sessionId, messageId: nanoid() });
      });

    } catch (error) {
      console.error(`[Claude] Failed to spawn PTY process: ${error}`);
      const errorMessage: Message = {
        id: nanoid(),
        sessionId,
        role: "system",
        content: `Failed to start Claude Code: ${error}`,
        timestamp: new Date(),
        type: "error",
      };
      this.emit("message:received", errorMessage);
      
      info.session.status = "error";
      this.emit("session:updated", info.session);
    }
  }

  // Process a stream-json event
  private processStreamEvent(sessionId: string, line: string): void {
    try {
      const event: ClaudeStreamEvent = JSON.parse(line);
      
      // Handle different event types
      switch (event.type) {
        case "assistant":
          if (event.subtype === "text") {
            this.emit("message:stream", {
              sessionId,
              chunk: event.content || "",
              type: "text",
            });
          }
          break;

        case "tool_use":
          const toolMessage: Message = {
            id: nanoid(),
            sessionId,
            role: "assistant",
            content: `Using tool: ${event.tool_name}\n${JSON.stringify(event.tool_input, null, 2)}`,
            timestamp: new Date(),
            type: "tool_use",
          };
          this.emit("message:received", toolMessage);
          break;

        case "tool_result":
          const resultMessage: Message = {
            id: nanoid(),
            sessionId,
            role: "system",
            content: event.result || "",
            timestamp: new Date(),
            type: "tool_result",
          };
          this.emit("message:received", resultMessage);
          break;

        case "result":
          // Final result
          const finalMessage: Message = {
            id: nanoid(),
            sessionId,
            role: "assistant",
            content: event.content || "",
            timestamp: new Date(),
            type: "text",
          };
          this.emit("message:received", finalMessage);
          break;

        case "error":
          const errorMessage: Message = {
            id: nanoid(),
            sessionId,
            role: "system",
            content: event.error || "Unknown error",
            timestamp: new Date(),
            type: "error",
          };
          this.emit("message:received", errorMessage);
          break;
      }
    } catch (e) {
      // Not valid JSON, might be plain text output
      console.log(`[Claude] Non-JSON line: ${line.substring(0, 50)}...`);
      this.emit("message:stream", {
        sessionId,
        chunk: line,
        type: "text",
      });
    }
  }

  // Stop a session
  stopSession(sessionId: string): void {
    const info = this.processes.get(sessionId);
    if (!info) {
      return;
    }

    // Kill the process if running
    if (info.process) {
      try {
        info.process.kill();
      } catch (e) {
        console.error(`[Claude] Error killing process: ${e}`);
      }
    }

    info.session.status = "stopped";
    this.emit("session:stopped", sessionId);
    this.processes.delete(sessionId);
  }

  // Get session info
  getSession(sessionId: string): Session | undefined {
    return this.processes.get(sessionId)?.session;
  }

  // Get all sessions
  getAllSessions(): Session[] {
    return Array.from(this.processes.values()).map((info) => info.session);
  }

  // Cleanup all sessions
  cleanup(): void {
    const sessionIds = Array.from(this.processes.keys());
    for (const sessionId of sessionIds) {
      this.stopSession(sessionId);
    }
  }
}

// Singleton instance
export const claudeManager = new ClaudeProcessManager();
