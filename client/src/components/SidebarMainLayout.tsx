/**
 * SidebarMainLayout - PC用3カラムレイアウト
 *
 * サイドバー（セッション一覧） + メイン（ttyd 1ペイン） + Beacon（チャット）
 * の3カラム構成。MultiPaneLayoutを置き換える。
 */

import type { ReactNode } from "react";

interface SidebarMainLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  beacon: ReactNode;
}

export function SidebarMainLayout({
  sidebar,
  main,
  beacon,
}: SidebarMainLayoutProps) {
  return (
    <div className="h-[100dvh] flex">
      {/* サイドバー */}
      <div className="w-[250px] shrink-0 border-r border-border">{sidebar}</div>

      {/* メインエリア */}
      <div className="flex-1 min-w-0 flex flex-col">{main}</div>

      {/* Beacon */}
      <div className="w-[350px] shrink-0 border-l border-border">{beacon}</div>
    </div>
  );
}
