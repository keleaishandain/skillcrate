import React from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  FolderKanban,
  Layers3,
  RefreshCw,
  ShieldAlert,
  Waypoints,
} from 'lucide-react';
import type { ActiveTab, GitStatus, Preset, Skill, ToolWorkspaceStatus } from '../types';

interface DashboardViewProps {
  skills: Skill[];
  presets: Preset[];
  workspaces: ToolWorkspaceStatus[];
  projectCount: number;
  isolationCount: number;
  gitStatus: GitStatus | null;
  onNavigate: (tab: ActiveTab) => void;
  onSyncAll: () => void;
  isSyncing: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  skills,
  presets,
  workspaces,
  projectCount,
  isolationCount,
  gitStatus,
  onNavigate,
  onSyncAll,
  isSyncing,
}) => {
  const syncedSkills = skills.filter((skill) => Object.values(skill.endpoints).some(Boolean)).length;
  const unmanaged = workspaces.reduce((total, workspace) => total + workspace.unmanaged_skills, 0);
  const trackedSources = skills.filter((skill) => Boolean(skill.source_ref)).length;

  return (
    <div className="h-full overflow-y-auto bg-[#0d1117] px-5 py-5 md:px-7">
      <div className="mx-auto max-w-[1420px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              本地中央仓库已接入
            </div>
            <h1 className="text-xl font-bold text-slate-100">技能运行面板</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              从中央库检查技能资产，再通过 Preset 分发到 Agent。目录状态来自本机实时扫描。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate('presets')} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700">
              <Layers3 size={14} className="text-cyan-400" /> 管理 Preset
            </button>
            <button onClick={onSyncAll} disabled={isSyncing} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70">
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? '同步中' : '刷新已启用副本'}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 lg:grid-cols-4">
          <Metric label="中央 Skills" value={skills.length} detail={`${syncedSkills} 个已分发`} icon={<Boxes size={15} />} onClick={() => onNavigate('hub')} />
          <Metric label="Preset" value={presets.length} detail={presets.length ? '可按场景批量切换' : '尚未创建'} icon={<Layers3 size={15} />} onClick={() => onNavigate('presets')} />
          <Metric label="项目工作区" value={projectCount} detail="按项目隔离技能" icon={<FolderKanban size={15} />} onClick={() => onNavigate('projects')} />
          <Metric label="待处理" value={unmanaged + isolationCount} detail={`${unmanaged} 未收编 · ${isolationCount} 隔离`} icon={<CircleAlert size={15} />} onClick={() => onNavigate(unmanaged ? 'agents' : 'quarantine')} warning={unmanaged + isolationCount > 0} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="border-y border-slate-800 py-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Waypoints size={15} className="text-indigo-400" />同步轨道</h2>
                <p className="mt-1 text-[11px] text-slate-500">中央内容是真相源，Agent 节点展示实际目录落点。</p>
              </div>
              <button onClick={() => onNavigate('agents')} className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300">进入工作区 <ArrowRight size={12} /></button>
            </div>
            <div className="relative grid gap-3 md:grid-cols-[1fr_54px_2fr] md:items-center">
              <button onClick={() => onNavigate('hub')} className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4 text-left hover:bg-indigo-500/15">
                <div className="text-[10px] font-semibold uppercase text-indigo-400">Source of truth</div>
                <div className="mt-1 text-base font-bold text-slate-100">{skills.length} Skills</div>
                <div className="mt-1 truncate font-mono text-[10px] text-slate-500">~/.skills-manager/skills</div>
              </button>
              <div className="hidden items-center md:flex">
                <div className="h-px flex-1 bg-indigo-500/50" />
                <ArrowRight size={14} className="text-indigo-400" />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {workspaces.map((workspace) => (
                  <button key={workspace.tool} onClick={() => onNavigate('agents')} className="rounded-lg border border-slate-800 bg-[#161b22] p-3 text-left hover:border-slate-700">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      {workspace.label}
                      <span className={`h-1.5 w-1.5 rounded-full ${workspace.exists ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    </div>
                    <div className="mt-3 text-xl font-bold text-slate-100">{workspace.managed_skills}</div>
                    <div className="mt-1 text-[10px] text-slate-500">已纳管 / 共 {workspace.total_skills}</div>
                    {workspace.unmanaged_skills > 0 && <div className="mt-2 text-[10px] font-medium text-amber-400">{workspace.unmanaged_skills} 个待收编</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-y border-slate-800 py-5">
            <h2 className="text-sm font-semibold text-slate-100">仓库与来源</h2>
            <div className="mt-4 space-y-3 text-xs">
              <StatusRow label="来源可追踪" value={`${trackedSources} / ${skills.length}`} ok={trackedSources === skills.length && skills.length > 0} />
              <StatusRow label="Git 仓库" value={gitStatus?.initialized ? (gitStatus.branch || '已初始化') : '未初始化'} ok={Boolean(gitStatus?.initialized)} />
              <StatusRow label="远程备份" value={gitStatus?.remote ? '已配置' : '未配置'} ok={Boolean(gitStatus?.remote)} />
              <StatusRow label="未提交变更" value={`${gitStatus?.changed_files ?? 0} 项`} ok={(gitStatus?.changed_files ?? 0) === 0} />
            </div>
            <button onClick={() => onNavigate('backup')} className="mt-5 flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-slate-800">
              <span>查看备份与活动记录</span><ArrowRight size={13} className="text-slate-500" />
            </button>
          </div>
        </section>

        {(unmanaged > 0 || isolationCount > 0) && (
          <section className="flex flex-col gap-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div><div className="text-xs font-semibold text-amber-200">有需要确认的本地状态</div><p className="mt-1 text-[11px] text-amber-100/60">未收编 Skill 不会自动进入中央库；隔离项不会参与 Preset 分发。</p></div>
            </div>
            <button onClick={() => onNavigate(unmanaged ? 'agents' : 'quarantine')} className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-amber-300 hover:text-amber-200">现在处理 <ArrowRight size={12} /></button>
          </section>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; detail: string; icon: React.ReactNode; onClick: () => void; warning?: boolean }> = ({ label, value, detail, icon, onClick, warning }) => (
  <button onClick={onClick} className="bg-[#161b22] p-4 text-left hover:bg-[#1b2129]">
    <div className={`flex items-center gap-2 text-[11px] font-medium ${warning ? 'text-amber-400' : 'text-slate-400'}`}>{icon}{label}</div>
    <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
    <div className="mt-1 text-[10px] text-slate-500">{detail}</div>
  </button>
);

const StatusRow: React.FC<{ label: string; value: string; ok: boolean }> = ({ label, value, ok }) => (
  <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
    <span className="text-slate-400">{label}</span>
    <span className={`flex items-center gap-1.5 font-mono text-[10px] ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
      {ok ? <CheckCircle2 size={11} /> : <CircleAlert size={11} />}{value}
    </span>
  </div>
);
