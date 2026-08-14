import React from 'react';
import {
  Search,
  RefreshCw,
  Zap,
  Terminal,
  Check,
  Copy,
  Sliders,
  SlidersHorizontal,
  Command,
  HelpCircle,
  FolderSync
} from 'lucide-react';
import { EnvironmentHealth } from '../types';

interface TopHeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenCommandPalette: () => void;
  onOpenMcpModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenHealthModal: () => void;
  onSyncAll: () => void;
  isSyncingAll: boolean;
  environmentHealth: EnvironmentHealth;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenCommandPalette,
  onOpenMcpModal,
  onOpenSettingsModal,
  onOpenHealthModal,
  onSyncAll,
  isSyncingAll,
  environmentHealth
}) => {
  return (
    <header className="hidden h-14 items-center justify-between border-b border-slate-800/80 bg-[#0d1117]/90 px-6 backdrop-blur-md md:flex z-10 select-none">
      {/* Left: Quick Search with Cmd+K hint */}
      <div className="flex items-center space-x-3 w-96 max-w-md">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-[#161b22] hover:bg-[#1c2128] border border-slate-800 hover:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition group shadow-inner"
        >
          <div className="flex items-center space-x-2">
            <Search size={14} className="text-slate-500 group-hover:text-slate-400" />
            <span className="text-slate-400 group-hover:text-slate-300">
              {searchQuery ? searchQuery : '全局搜索技能、来源、指令 (Ctrl+K)...'}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <kbd className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right: Actions, MCP Status, Full Sync */}
      <div className="flex items-center space-x-3">
        {/* MCP Status Capsule */}
        <button
          onClick={onOpenMcpModal}
          className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800/90 border border-indigo-500/20 hover:border-indigo-500/40 rounded-full px-3 py-1 text-xs text-slate-300 transition shadow-sm"
          title="点击查看并复制 MCP 配置代码块"
        >
          <span className="relative flex h-2 w-2">
            {environmentHealth.mcpServer.running && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${environmentHealth.mcpServer.running ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
          </span>
          <span className="text-[11px] font-mono text-indigo-300 font-medium">
            {environmentHealth.mcpServer.port > 0 ? `MCP :${environmentHealth.mcpServer.port}` : 'MCP stdio'}
          </span>
          <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-1.5 font-medium">
            {environmentHealth.mcpServer.running ? `${environmentHealth.mcpServer.activeConnections} 客户端已连接` : '按需启动'}
          </span>
        </button>

        {/* Sync All Button */}
        <button
          onClick={onSyncAll}
          disabled={isSyncingAll}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            isSyncingAll
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/30 cursor-wait'
              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 active:scale-[0.98]'
          }`}
          title="重新读取中央库与各工具目录的同步状态"
        >
          <RefreshCw size={13} className={isSyncingAll ? 'animate-spin text-indigo-400' : 'text-slate-400'} />
          <span>{isSyncingAll ? '正在刷新...' : '刷新同步状态'}</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettingsModal}
          className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition"
          title="偏好与算法阈值设置"
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>
    </header>
  );
};
