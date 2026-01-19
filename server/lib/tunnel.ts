/**
 * Cloudflare Tunnel Manager
 *
 * Manages cloudflared quick tunnel for remote access without configuration.
 * Uses `cloudflared tunnel --url` for instant public URL generation.
 */

import { spawn, type ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";

export interface TunnelManagerEvents {
  url: [url: string];
  error: [error: Error];
  close: [code: number | null];
}

export class TunnelManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private publicUrl: string | null = null;
  private localPort: number;

  constructor(localPort: number) {
    super();
    this.localPort = localPort;
  }

  /**
   * Start cloudflared tunnel
   */
  async start(): Promise<string> {
    if (this.process) {
      throw new Error("Tunnel already running");
    }

    return new Promise((resolve, reject) => {
      const cloudflaredPath = this.findCloudflared();
      if (!cloudflaredPath) {
        reject(
          new Error(
            "cloudflared not found. Install it:\n" +
              "  macOS: brew install cloudflared\n" +
              "  Linux: See https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
          )
        );
        return;
      }

      // Start cloudflared with quick tunnel
      this.process = spawn(cloudflaredPath, [
        "tunnel",
        "--url",
        `http://localhost:${this.localPort}`,
      ]);

      let outputBuffer = "";
      let urlFound = false;
      const timeout = setTimeout(() => {
        if (!urlFound) {
          reject(new Error("Timeout waiting for tunnel URL"));
          this.stop();
        }
      }, 30000);

      this.process.stderr?.on("data", (data: Buffer) => {
        outputBuffer += data.toString();
        // cloudflared outputs the URL to stderr
        // Look for: https://xxxxx.trycloudflare.com
        const urlMatch = outputBuffer.match(
          /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
        );
        if (urlMatch && !urlFound) {
          urlFound = true;
          clearTimeout(timeout);
          this.publicUrl = urlMatch[0];
          this.emit("url", this.publicUrl);
          resolve(this.publicUrl);
        }
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        // Also check stdout just in case
        outputBuffer += data.toString();
      });

      this.process.on("error", (error) => {
        clearTimeout(timeout);
        this.emit("error", error);
        reject(error);
      });

      this.process.on("close", (code) => {
        clearTimeout(timeout);
        this.process = null;
        this.publicUrl = null;
        this.emit("close", code);
        if (!urlFound) {
          reject(new Error(`cloudflared exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Stop the tunnel
   */
  stop(): void {
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
      this.publicUrl = null;
    }
  }

  /**
   * Get the public URL
   */
  getUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Check if tunnel is running
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Find cloudflared binary
   */
  private findCloudflared(): string | null {
    // Check common paths
    const paths = [
      "cloudflared", // In PATH
      "/usr/local/bin/cloudflared",
      "/opt/homebrew/bin/cloudflared",
      `${process.env.HOME}/.local/bin/cloudflared`,
    ];

    for (const path of paths) {
      try {
        execSync(`which ${path} 2>/dev/null || test -f ${path}`, {
          stdio: "ignore",
        });
        return path;
      } catch {
        continue;
      }
    }

    // Try which command
    try {
      const result = execSync("which cloudflared", { encoding: "utf-8" });
      return result.trim();
    } catch {
      return null;
    }
  }
}
