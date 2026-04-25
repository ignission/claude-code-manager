/**
 * System Capability Detection
 *
 * 起動環境がプロファイル切替機能をサポートするか判定するヘルパー。
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
 * 2. process.env.PATH を分解して各 dir で確認
 *    (pm2 等で which が機能しない / login PATH と異なる場合をカバー)
 * 3. 既知の候補ディレクトリ (mise shims, npm global, apt/dpkg, brew 等)
 */
export function checkClaudeCommandExists(): boolean {
  try {
    const r = spawnSync("which", ["claude"], { stdio: "pipe" });
    if (r.status === 0) return true;
  } catch {
    // fallthrough
  }

  // process.env.PATH を辿る (which が使えない環境向けの補完)
  const envPath = process.env.PATH ?? "";
  for (const dir of envPath.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "claude");
    try {
      if (existsSync(candidate)) return true;
    } catch {
      // ignore individual stat errors
    }
  }

  const home = os.homedir();
  const candidates = [
    // ユーザローカル
    path.join(home, ".local/bin/claude"),
    path.join(home, ".local/share/mise/shims/claude"),
    path.join(home, ".npm-global/bin/claude"),
    path.join(home, ".volta/bin/claude"),
    // システム標準
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    "/usr/sbin/claude",
    "/opt/claude/bin/claude",
    // Homebrew (Linux)
    "/home/linuxbrew/.linuxbrew/bin/claude",
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
 * プロファイル切替機能のサポート判定。
 * Linux + claude CLI が両方揃った時のみ true。
 */
export function detectMultiProfileSupported(): boolean {
  if (process.platform !== "linux") return false;
  return checkClaudeCommandExists();
}
