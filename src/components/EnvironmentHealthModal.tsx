import React from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Info,
  Layers
} from 'lucide-react';
import { EnvironmentHealth } from '../types';

interface EnvironmentHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: EnvironmentHealth;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onRefresh: () => Promise<void>;
}

export const EnvironmentHealthModal: React.FC<EnvironmentHealthModalProps> = ({
  isOpen,
  onClose,
  health,
  onShowToast,
  onRefresh
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="text-emerald-400" size={18} />
            <h3 className="text-sm font-bold text-slate-100">开发环境健康探测报告 (Tool Health)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          <p className="text-slate-300">
            提前检测本机各 AI Agent CLI 工具安装与权限状态，避免在同步阶段发生因缺少 CLI 或路径错误导致的硬失败：
          </p>

          {/* Claude CLI Card */}
          <div className={`p-3.5 rounded-xl bg-[#0d1117] border space-y-2 ${health.claudeCli.installed ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 font-mono">Claude Code CLI</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                  {health.claudeCli.version}
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 flex items-center">
                <CheckCircle2 size={12} className="mr-1" />
                {health.claudeCli.installed ? '就绪 (Ready)' : '未检测到'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
              <p>可执行路径: {health.claudeCli.path}</p>
              <p>目标技能软链库: ~/.claude/skills/</p>
            </div>
            <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
              {health.claudeCli.message}
            </p>
          </div>

          {/* Codex CLI Card */}
          <div className={`p-3.5 rounded-xl bg-[#0d1117] border space-y-2 ${health.codex.installed ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 font-mono">Codex CLI</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                  {health.codex.version}
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 flex items-center">
                <CheckCircle2 size={12} className="mr-1" />
                {health.codex.installed ? '就绪 (Ready)' : '未检测到'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
              <p>可执行路径: {health.codex.path}</p>
              <p>目标技能软链库: ~/.codex/skills/</p>
            </div>
          </div>

          {/* OpenCode Card */}
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 font-mono">OpenCode</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                  {health.openCode.version}
                </span>
              </div>
              <span className="text-[11px] text-amber-400 flex items-center">
                <AlertCircle size={12} className="mr-1" />
                {health.openCode.installed ? '就绪 (Ready)' : '未安装在 PATH 中'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {health.openCode.message}
            </p>
          </div>

          {/* MCP Service Card */}
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 font-mono">SkillCurator MCP Server</span>
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.2 rounded font-mono">
                  {health.mcpServer.port > 0 ? `Port :${health.mcpServer.port}` : 'stdio'}
                </span>
              </div>
              <span className="text-[11px] text-indigo-300 flex items-center">
                <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                {health.mcpServer.running ? '在线监听中' : '由客户端按需启动'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              协议: {health.mcpServer.protocol} | 客户端活跃连接: {health.mcpServer.activeConnections}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">检测时间: {health.claudeCli.lastChecked}</span>
          <button
            onClick={async () => {
              try {
                await onRefresh();
                onShowToast('环境探测完成', 'CLI 可执行文件、版本和技能目录状态已刷新。', 'success');
              } catch (error) {
                onShowToast('环境探测失败', String(error), 'error');
              }
            }}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
          >
            重新运行环境探测
          </button>
        </div>
      </div>
    </div>
  );
};
