import React from 'react';
import {
  FolderGit2,
  Cpu,
  ShieldAlert,
  FolderKanban,
  Compass,
  Plus,
  Activity,
  Terminal,
  Boxes,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Flame,
  LayoutDashboard,
  Layers3,
  Server,
  GitBranch
} from 'lucide-react';
import { ActiveTab, EnvironmentHealth } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  skillCount: number;
  presetCount: number;
  quarantineCount: number;
  overlapCount: number;
  projectCount: number;
  environmentHealth: EnvironmentHealth;
  onOpenImportModal: () => void;
  onOpenHealthModal: () => void;
  onOpenMcpModal: () => void;
  onOpenSettingsModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  skillCount,
  presetCount,
  quarantineCount,
  overlapCount,
  projectCount,
  environmentHealth,
  onOpenImportModal,
  onOpenHealthModal,
  onOpenMcpModal,
  onOpenSettingsModal
}) => {
  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-800/80 bg-[#0d1117] md:flex select-none z-20">
      {/* Top Section */}
      <div className="flex min-h-0 flex-col space-y-4 overflow-y-auto p-3.5">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
              <Boxes size={16} />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-slate-100 tracking-wide">SkillCurator</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">v1.2</span>
              </div>
              <p className="text-[10px] text-slate-500">Agent 技能智能策展与同步</p>
            </div>
          </div>
          <button
            onClick={onOpenSettingsModal}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-800/60 transition"
            title="偏好设置"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Quick Ingest Button */}
        <button
          onClick={onOpenImportModal}
          className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-md text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm shadow-indigo-600/30 active:scale-[0.99]"
        >
          <Plus size={14} className="stroke-[2.5]" />
          <span>导入 / 新建技能</span>
        </button>

        {/* Navigation Section */}
        <div className="space-y-1 pt-1">
          <div className="px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            管理中心
          </div>

          <NavItem
            icon={<LayoutDashboard size={15} />}
            label="运行面板"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />

          <NavItem
            icon={<FolderGit2 size={15} />}
            label="中央技能库"
            count={skillCount}
            active={activeTab === 'hub'}
            onClick={() => setActiveTab('hub')}
          />

          <NavItem
            icon={<Layers3 size={15} />}
            label="Preset 场景"
            count={presetCount}
            active={activeTab === 'presets'}
            onClick={() => setActiveTab('presets')}
          />

          <NavItem
            icon={<Server size={15} />}
            label="Agent 工作区"
            active={activeTab === 'agents'}
            onClick={() => setActiveTab('agents')}
          />

          <NavItem
            icon={<Cpu size={15} />}
            label="AI 策展中心"
            badge={overlapCount > 0 ? `${overlapCount} 组重叠` : undefined}
            badgeType="warning"
            active={activeTab === 'curate'}
            onClick={() => setActiveTab('curate')}
          />

          <NavItem
            icon={<ShieldAlert size={15} />}
            label="安全隔离仓"
            count={quarantineCount}
            badgeType="neutral"
            active={activeTab === 'quarantine'}
            onClick={() => setActiveTab('quarantine')}
          />

          <NavItem
            icon={<FolderKanban size={15} />}
            label="项目工作区"
            count={projectCount}
            active={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
          />

          <NavItem
            icon={<Compass size={15} />}
            label="探索与发现"
            badge="HOT"
            badgeType="hot"
            active={activeTab === 'discover'}
            onClick={() => setActiveTab('discover')}
          />

          <NavItem
            icon={<GitBranch size={15} />}
            label="备份与活动"
            active={activeTab === 'backup'}
            onClick={() => setActiveTab('backup')}
          />
        </div>
      </div>

      {/* Bottom Status & Diagnostics */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0b0e14] space-y-2.5">
        {/* Environment Health Section Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-400">
            <Activity size={12} className="text-slate-400" />
            <span>环境健康探测</span>
          </div>
          <button
            onClick={onOpenHealthModal}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            诊断
          </button>
        </div>

        {/* Status Pills */}
        <div className="space-y-1.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800/70 text-[11px]">
          {/* Claude CLI */}
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Terminal size={11} className="text-slate-500" />
              <span>Claude CLI</span>
            </span>
            <span className={`flex items-center font-mono text-[10px] ${environmentHealth.claudeCli.installed ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${environmentHealth.claudeCli.installed ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              {environmentHealth.claudeCli.version}
            </span>
          </div>

          {/* Codex */}
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Terminal size={11} className="text-slate-500" />
              <span>Codex CLI</span>
            </span>
            <span className={`flex items-center font-mono text-[10px] ${environmentHealth.codex.installed ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${environmentHealth.codex.installed ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              {environmentHealth.codex.version}
            </span>
          </div>

          {/* OpenCode */}
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Terminal size={11} className="text-slate-500" />
              <span>OpenCode</span>
            </span>
            <span className={`flex items-center font-mono text-[10px] ${environmentHealth.openCode.installed ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${environmentHealth.openCode.installed ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              {environmentHealth.openCode.version}
            </span>
          </div>

          {/* MCP Server */}
          <div
            onClick={onOpenMcpModal}
            className="flex justify-between items-center pt-1 mt-1 border-t border-slate-800/60 cursor-pointer hover:text-slate-200 transition text-slate-400"
          >
            <span className="flex items-center space-x-1.5">
              <span className="text-amber-400">⚡</span>
              <span className="text-slate-300 font-medium">MCP Server</span>
            </span>
            <span className="flex items-center text-indigo-400 font-mono text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
              {environmentHealth.mcpServer.port > 0 ? `:${environmentHealth.mcpServer.port}` : 'stdio'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  badge?: string;
  badgeType?: 'warning' | 'hot' | 'neutral';
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  count,
  badge,
  badgeType = 'neutral',
  active,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition duration-150 group ${
        active
          ? 'bg-indigo-600/15 text-indigo-300 font-medium border border-indigo-500/30'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <span className={active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition'}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      <div className="flex items-center space-x-1">
        {count !== undefined && (
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
              active
                ? 'bg-indigo-500/25 text-indigo-300'
                : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
            }`}
          >
            {count}
          </span>
        )}
        {badge && badgeType === 'warning' && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1 animate-pulse"></span>
            {badge}
          </span>
        )}
        {badge && badgeType === 'hot' && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-medium flex items-center">
            <Flame size={10} className="mr-0.5" />
            {badge}
          </span>
        )}
      </div>
    </button>
  );
};
