import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, CircleAlert, FolderOpen, Search, Server } from 'lucide-react';
import type { EndpointType, Skill, ToolWorkspaceStatus } from '../types';

interface AgentWorkspaceViewProps {
  workspaces: ToolWorkspaceStatus[];
  skills: Skill[];
  onToggleEndpoint: (skillId: string, endpoint: EndpointType) => void;
  onAdoptSkill: (dirName: string, tool: string) => Promise<void>;
  onOpenPath: (path: string) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const endpointForTool: Record<string, EndpointType> = { claude_code: 'claude', codex: 'codex', opencode: 'opencode' };

export const AgentWorkspaceView: React.FC<AgentWorkspaceViewProps> = ({ workspaces, skills, onToggleEndpoint, onAdoptSkill, onOpenPath, onShowToast }) => {
  const [selectedTool, setSelectedTool] = useState(workspaces[0]?.tool ?? 'claude_code');
  const [query, setQuery] = useState('');
  const [adopting, setAdopting] = useState<string | null>(null);
  const workspace = workspaces.find((item) => item.tool === selectedTool) ?? workspaces[0];
  const items = useMemo(() => (workspace?.skills ?? []).filter((item) => item.dir_name.toLowerCase().includes(query.toLowerCase())), [workspace, query]);

  const adopt = async (dirName: string) => {
    setAdopting(dirName);
    try {
      await onAdoptSkill(dirName, selectedTool);
      onShowToast('已收编到中央库', `${dirName} 保留在 ${workspace?.label} 并纳入中央管理`, 'success');
    } catch (error) {
      onShowToast('收编失败', String(error), 'error');
    } finally {
      setAdopting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0d1117] px-5 py-5 md:px-7">
      <div className="mx-auto max-w-[1420px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-lg font-bold text-slate-100">Agent 工作区</h1><p className="mt-1 text-xs text-slate-400">直接扫描各 Agent 实际读取的全局 Skills 目录。</p></div>
          <div className="flex rounded-md border border-slate-800 bg-slate-900 p-1">
            {workspaces.map((item) => <button key={item.tool} onClick={() => setSelectedTool(item.tool)} className={`px-3 py-1.5 text-xs font-medium ${selectedTool === item.tool ? 'rounded bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>{item.label}<span className="ml-1.5 font-mono text-[10px] text-slate-500">{item.total_skills}</span></button>)}
          </div>
        </div>

        {workspace && <>
          <section className="grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-3">
            <Summary label="目录 Skills" value={workspace.total_skills} tone="normal" />
            <Summary label="中央已纳管" value={workspace.managed_skills} tone="good" />
            <Summary label="待收编" value={workspace.unmanaged_skills} tone={workspace.unmanaged_skills ? 'warning' : 'good'} />
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1"><Search size={13} className="absolute left-3 top-2.5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选当前 Agent 的 Skills" className="w-full rounded-md border border-slate-800 bg-[#161b22] py-2 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-indigo-500" /></div>
            <button onClick={() => onOpenPath(workspace.path)} className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"><FolderOpen size={13} />打开目录</button>
          </div>

          {!workspace.exists ? (
            <div className="rounded-lg border border-dashed border-slate-700 py-14 text-center"><Server size={28} className="mx-auto text-slate-600" /><div className="mt-3 text-sm font-medium text-slate-300">目录尚未创建</div><p className="mt-1 font-mono text-[10px] text-slate-500">{workspace.path}</p><p className="mt-2 text-[11px] text-slate-500">首次向此 Agent 分发 Skill 时会自动创建。</p></div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 py-14 text-center text-xs text-slate-500">当前筛选下没有 Skill</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#161b22]">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 text-[10px] font-semibold text-slate-500"><span>目录名</span><span>管理状态</span><span className="text-right">操作</span></div>
              <div className="divide-y divide-slate-800/70">{items.map((item) => {
                const central = skills.find((skill) => skill.dir_name === item.dir_name);
                return <div key={item.dir_name} className="grid grid-cols-[minmax(0,1fr)_120px_120px] items-center px-4 py-3 text-xs">
                  <div className="min-w-0"><div className="truncate font-semibold text-slate-200">{central?.name ?? item.dir_name}</div><div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{item.dir_name}</div></div>
                  <div className={`flex items-center gap-1.5 text-[10px] ${item.managed ? 'text-emerald-400' : 'text-amber-400'}`}>{item.managed ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}{item.managed ? '中央已纳管' : '仅 Agent 存在'}</div>
                  <div className="text-right">{item.managed && central ? <button onClick={() => onToggleEndpoint(central.id, endpointForTool[selectedTool])} className="text-[11px] text-rose-300 hover:text-rose-200">从 Agent 移除</button> : <button onClick={() => void adopt(item.dir_name)} disabled={adopting === item.dir_name} className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-60"><ArrowDownToLine size={12} />{adopting === item.dir_name ? '收编中' : '收编'}</button>}</div>
                </div>;
              })}</div>
            </div>
          )}
        </>}
      </div>
    </div>
  );
};

const Summary: React.FC<{ label: string; value: number; tone: 'normal' | 'good' | 'warning' }> = ({ label, value, tone }) => <div className="bg-[#161b22] p-4"><div className={`text-[11px] ${tone === 'good' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-400' : 'text-slate-400'}`}>{label}</div><div className="mt-2 text-2xl font-bold text-slate-100">{value}</div></div>;
