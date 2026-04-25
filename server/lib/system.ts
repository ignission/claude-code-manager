/**
 * System Capability Detection
 *
 * 起動環境がマルチアカウント機能をサポートするか判定するヘルパー。
 *
 * 条件:
 *   - process.platform === "linux"
 *   - `claude` CLI が PATH に存在する
 *
 * macOS / Windows は Keychain 依存のため非対応。
 */

import { spawnSync } from "node:child_process";

/** PATH に `claude` コマンドが存在するか */
export function checkClaudeCommandExists(): boolean {
  try {
    const r = spawnSync("which", ["claude"], { stdio: "pipe" });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * 複数アカウント切替機能のサポート判定。
 * Linux + claude CLI が両方揃った時のみ true。
 */
export function detectMultiAccountSupported(): boolean {
  if (process.platform !== "linux") return false;
  return checkClaudeCommandExists();
}
