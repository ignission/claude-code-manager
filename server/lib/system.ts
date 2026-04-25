/**
 * System Capability Detection
 *
 * 起動環境がマルチアカウント機能をサポートするか判定するヘルパー。
 *
 * 条件:
 *   - process.platform === "linux"
 *   - `claude` CLI が見つかる（PATH または既知の候補ディレクトリ）
 *
 * macOS / Windows は Keychain 依存のため非対応。
 *
 * 注: pm2 等のサービスマネージャ経由で起動された場合、ログインシェルと
 * PATH が異なるため `which claude` だけだと検知漏れする。`~/.local/bin`
 * 等の典型的な場所も直接チェックする。
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * `claude` コマンドが利用可能か。
 * 1. `which claude` (PATH チェック)
 * 2. 既知の候補ディレクトリ
 * 3. mise shims
 */
export function checkClaudeCommandExists(): boolean {
  try {
    const r = spawnSync("which", ["claude"], { stdio: "pipe" });
    if (r.status === 0) return true;
  } catch {
    // fallthrough
  }

  const home = os.homedir();
  const candidates = [
    path.join(home, ".local/bin/claude"),
    path.join(home, ".local/share/mise/shims/claude"),
    "/usr/local/bin/claude",
    "/opt/claude/bin/claude",
  ];
  return candidates.some(p => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  });
}

/**
 * 複数アカウント切替機能のサポート判定。
 * Linux + claude CLI が両方揃った時のみ true。
 */
export function detectMultiAccountSupported(): boolean {
  if (process.platform !== "linux") return false;
  return checkClaudeCommandExists();
}
