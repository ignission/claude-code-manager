/**
 * Account Login Manager
 *
 * Anthropic アカウントの追加ログインフローを管理する。
 * 流れ:
 *   1. profile.configDir を作成（無ければ）
 *   2. tmux ログインセッション (`arklogin-*`) を `claude /login` 起動コマンドで作成
 *   3. ttyd を起動してブラウザから iframe で操作可能にする
 *   4. CredentialsWatcher で `.credentials.json` の更新を監視
 *   5. 認証検知 → cleanup + `completed` event
 *   6. キャンセル / タイムアウト時は cleanup + `failed` event
 *
 * 設計上の重要事項:
 *   - tmux ログインセッションは `arklogin-` プレフィックスで通常の `ark-` セッションと
 *     名前空間を分離する（autoDiscover=false により SessionOrchestrator から不可視）
 *   - tmuxManager が autoDiscover=false の場合は `this.sessions` に登録しないため、
 *     killSession(sessionId) は使えない。代わりに spawnSync("tmux", ["kill-session", ...])
 *     をセッション名で直接実行する
 *   - startLogin の途中でエラーが起きた場合は逆順でロールバック（ttyd → tmux）
 */

import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AccountProfile } from "../../shared/types.js";
import { CredentialsWatcher } from "./credentials-watcher.js";
import type { TmuxManager } from "./tmux-manager.js";
import type { TtydLoginManager } from "./ttyd-login-manager.js";

/** ログイン失敗理由 */
export type LoginFailReason = "cancelled" | "timeout" | "error";

export interface AccountLoginManagerOptions {
  /** ログインタイムアウト (ms)。デフォルト: 10分 */
  timeoutMs?: number;
}

interface ActiveLogin {
  profileId: string;
  tmuxSessionName: string;
  ttydPort: number;
  watcher: CredentialsWatcher;
  timeoutHandle: NodeJS.Timeout;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export class AccountLoginManager extends EventEmitter {
  private readonly active = new Map<string, ActiveLogin>();
  private readonly timeoutMs: number;

  constructor(
    private readonly tmuxManager: TmuxManager,
    private readonly ttydLoginManager: TtydLoginManager,
    options: AccountLoginManagerOptions = {}
  ) {
    super();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * インタラクティブなログインフローを開始する。
   * 同一 profileId で既にアクティブなログインが存在する場合は throw する。
   */
  async startLogin(profile: AccountProfile): Promise<{ ttydUrl: string }> {
    if (this.active.has(profile.id)) {
      throw new Error("Login already in progress");
    }

    // configDir が存在しないと tmux の cwd 指定で失敗するため事前作成
    await fs.mkdir(profile.configDir, { recursive: true });

    const credentialsPath = path.join(profile.configDir, ".credentials.json");

    // ログイン前の mtime を取得（再ログイン時の旧ファイルとの判別用）
    let preLoginMtime: number | null = null;
    try {
      const stat = await fs.stat(credentialsPath);
      preLoginMtime = stat.mtimeMs;
    } catch {
      // ENOENT 等 → 初回ログイン
      preLoginMtime = null;
    }

    // ロールバック用フラグ
    let tmuxCreated = false;
    let ttydStarted = false;
    let tmuxSessionName = "";

    try {
      // 1. tmux ログインセッション作成
      const tmuxSession = await this.tmuxManager.createSession(
        profile.configDir,
        {
          namePrefix: "arklogin-",
          autoDiscover: false,
          env: { CLAUDE_CONFIG_DIR: profile.configDir },
          commandLine: "claude /login",
        }
      );
      tmuxSessionName = tmuxSession.tmuxSessionName;
      tmuxCreated = true;

      // 2. ttyd 起動
      const ttydInstance = await this.ttydLoginManager.startTtyd(
        tmuxSessionName,
        profile.id
      );
      ttydStarted = true;

      // 3. CredentialsWatcher 起動
      const watcher = new CredentialsWatcher(credentialsPath, preLoginMtime);
      watcher.on("authenticated", () => {
        this.handleCompleted(profile.id);
      });
      watcher.start();

      // 4. タイムアウト設定
      const timeoutHandle = setTimeout(() => {
        void this.cancelLogin(profile.id, "timeout");
      }, this.timeoutMs);

      // 5. アクティブログインに登録
      this.active.set(profile.id, {
        profileId: profile.id,
        tmuxSessionName,
        ttydPort: ttydInstance.port,
        watcher,
        timeoutHandle,
      });

      return { ttydUrl: ttydInstance.url };
    } catch (error) {
      // 逆順ロールバック: ttyd → tmux
      if (ttydStarted) {
        try {
          await this.ttydLoginManager.stopTtyd(tmuxSessionName);
        } catch {
          // クリーンアップ失敗は無視（元エラーを優先）
        }
      }
      if (tmuxCreated) {
        // autoDiscover=false のため tmuxManager.killSession は使えない。
        // tmux コマンドを直接呼んでセッション名で kill する
        spawnSync("tmux", ["kill-session", "-t", tmuxSessionName], {
          stdio: "pipe",
        });
      }
      throw error;
    }
  }

  /**
   * アクティブなログインをキャンセルする。対象が無ければ no-op。
   */
  async cancelLogin(
    profileId: string,
    reason: LoginFailReason = "cancelled"
  ): Promise<void> {
    await this.destroy(profileId, reason);
  }

  /** profileId が現在アクティブにログイン中か */
  isActive(profileId: string): boolean {
    return this.active.has(profileId);
  }

  /**
   * 全アクティブログインを停止する（graceful shutdown 用）。
   */
  async stopAll(): Promise<void> {
    const profileIds = Array.from(this.active.keys());
    for (const id of profileIds) {
      await this.cancelLogin(id, "cancelled");
    }
  }

  /**
   * 認証成功時のハンドラ。watcher の "authenticated" イベントから呼ばれる。
   */
  private handleCompleted(profileId: string): void {
    const record = this.active.get(profileId);
    if (!record) return;
    void this.destroy(profileId, "completed");
  }

  /**
   * リソース解放 + イベント emit を一元化する内部メソッド。
   */
  private async destroy(
    profileId: string,
    reason: LoginFailReason | "completed"
  ): Promise<void> {
    const record = this.active.get(profileId);
    if (!record) return;

    // 先にマップから外して二重解放を防ぐ
    this.active.delete(profileId);

    // watcher 停止
    try {
      record.watcher.stop();
    } catch {
      // ignore
    }

    // タイムアウト解除
    clearTimeout(record.timeoutHandle);

    // ttyd 停止
    try {
      await this.ttydLoginManager.stopTtyd(record.tmuxSessionName);
    } catch {
      // ignore（既に停止済み等）
    }

    // tmux セッション終了（autoDiscover=false のため名前指定で直接 kill）
    spawnSync("tmux", ["kill-session", "-t", record.tmuxSessionName], {
      stdio: "pipe",
    });

    // イベント emit
    if (reason === "completed") {
      this.emit("completed", profileId);
    } else {
      this.emit("failed", profileId, reason);
    }
  }
}
