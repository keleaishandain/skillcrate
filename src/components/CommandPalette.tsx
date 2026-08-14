import React, { useState, useEffect } from 'react';
import {
  Search,
  Command,
  FolderGit2,
  Cpu,
  ShieldAlert,
  FolderKanban,
  Compass,
  RefreshCw,
  Copy,
  Sliders,
  Plus,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Skill, ActiveTab } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  skills: Skill[];
  onSelectSkill: (skill: Skill) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onSyncAll: () => void;
  onOpenImportModal: () => void;
  onOpenMcpModal: () => void;
  onOpenHealthModal: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  skills,
  onSelectSkill,
  onNavigateTab,
  onSyncAll,
  onOpenImportModal,
  onOpenMcpModal,
  onOpenHealthModal
}) => {
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-800 flex items-center space-x-3 bg-[#0d1117]">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            type="text"
            placeholder="输入技能名称、命令或快速操作..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-96 overflow-y-auto space-y-3 text-xs">
          {/* Quick Actions */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              快捷指令 (QUICK COMMANDS)
            </div>

            <button
              onClick={() => { onSyncAll(); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-indigo-600/15 hover:text-indigo-300 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <RefreshCw size={14} className="text-indigo-400" />
                <span>全量同步技能至所有已连接端点 (Claude / Codex)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Sync All</span>
            </button>

            <button
              onClick={() => { onOpenImportModal(); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-indigo-600/15 hover:text-indigo-300 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Plus size={14} className="text-emerald-400" />
                <span>导入外部 Git 仓库或本地技能集合</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Ingest</span>
            </button>

            <button
              onClick={() => { onOpenMcpModal(); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-indigo-600/15 hover:text-indigo-300 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Copy size={14} className="text-amber-400" />
                <span>复制 MCP 配置代码块 (claude_desktop_config.json)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">MCP</span>
            </button>

            <button
              onClick={() => { onOpenHealthModal(); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-indigo-600/15 hover:text-indigo-300 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Sliders size={14} className="text-sky-400" />
                <span>运行环境健康诊断 (Claude CLI / Codex 探测)</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Health</span>
            </button>
          </div>

          {/* Navigation */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              页面跳转 (NAVIGATION)
            </div>
            <button
              onClick={() => { onNavigateTab('hub'); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <FolderGit2 size={14} className="text-slate-400" />
                <span>跳转到 中央技能库 (Skill Hub)</span>
              </div>
            </button>
            <button
              onClick={() => { onNavigateTab('curate'); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Cpu size={14} className="text-amber-400" />
                <span>跳转到 AI 智能策展中心</span>
              </div>
            </button>
            <button
              onClick={() => { onNavigateTab('quarantine'); onClose(); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition text-left"
            >
              <div className="flex items-center space-x-2.5">
                <ShieldAlert size={14} className="text-rose-400" />
                <span>跳转到 安全隔离仓与归档库</span>
              </div>
            </button>
          </div>

          {/* Matched Skills */}
          {filteredSkills.length > 0 && (
            <div className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                匹配的技能 (SKILLS)
              </div>
              {filteredSkills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onSelectSkill(s); onClose(); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-200 hover:bg-indigo-600/15 hover:text-indigo-300 transition text-left group"
                >
                  <div>
                    <div className="font-semibold font-mono text-xs text-slate-100 group-hover:text-indigo-300">
                      {s.name}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-sm">{s.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">v{s.version}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
