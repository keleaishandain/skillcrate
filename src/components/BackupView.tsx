import React, { useState } from 'react';
import { CircleAlert, Clock3, FolderOpen, GitBranch, HardDrive, RefreshCw, Save } from 'lucide-react';
import type { AuditEntry, GitStatus } from '../types';

interface BackupViewProps {
  status: GitStatus | null;
  activity: AuditEntry[];
  onRefresh: () => Promise<void>;
  onSnapshot: (message: string) => Promise<void>;
  onOpenPath: (path: string) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ status, activity, onRefresh, onSnapshot, onOpenPath, onShowToast }) => {
  const [message, setMessage] = useState('chore: snapshot skills');
  const [saving, setSaving] = useState(false);
  const snapshot = async () => {
    setSaving(true);
    try { await onSnapshot(message); onShowToast('本地快照已创建', 'Skills 文件已提交并创建带时间戳的标签。', 'success'); }
    catch (error) { onShowToast('创建快照失败', String(error), 'error'); }
    finally { setSaving(false); }
  };
  return <div className="h-full overflow-y-auto bg-[#0d1117] px-5 py-5 md:px-7"><div className="mx-auto max-w-[1200px] space-y-5">
    <div className="flex items-end justify-between border-b border-slate-800 pb-5"><div><h1 className="text-lg font-bold text-slate-100">备份与活动</h1><p className="mt-1 text-xs text-slate-400">Git 只管理中央 `skills/` 内容；项目列表、设置、同步目标和本机审计状态不进入快照。</p></div><button onClick={() => void onRefresh()} title="刷新 Git 状态" className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><RefreshCw size={15} /></button></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <section className="rounded-lg border border-slate-800 bg-[#161b22] p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><GitBranch size={16} className="text-indigo-400" />Git 仓库</div><span className={`rounded px-2 py-1 font-mono text-[10px] ${status?.initialized ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{status?.initialized ? status.branch || 'initialized' : 'not initialized'}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="未提交变更" value={`${status?.changed_files ?? 0} 项`} /><Info label="远程仓库" value={status?.remote || '未配置'} /><Info label="最近提交" value={status?.last_commit || '暂无提交'} /><Info label="最近快照" value={status?.last_snapshot || '暂无快照'} /></div>
        {!status?.remote && <div className="mt-4 flex gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[11px] leading-5 text-amber-200"><CircleAlert size={14} className="mt-0.5 shrink-0" /><span>当前只支持创建可恢复的本地 Git 快照。远程尚未配置，因此不会显示“已云端备份”。</span></div>}
        <div className="mt-5 border-t border-slate-800 pt-4"><label className="text-[11px] text-slate-400">快照说明<input value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500" /></label><div className="mt-3 flex flex-wrap justify-between gap-2"><button onClick={() => status && onOpenPath(status.repo_path)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"><FolderOpen size={13} />打开仓库</button><button onClick={() => void snapshot()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"><Save size={13} />{saving ? '创建中' : '创建本地快照'}</button></div></div>
      </section>
      <section className="rounded-lg border border-slate-800 bg-[#161b22] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><HardDrive size={16} className="text-cyan-400" />数据边界</div><div className="mt-4 space-y-3 text-xs"><Boundary label="进入 Git" value="Skills 文件、仓库内可移植元数据" /><Boundary label="仅保留本机" value="项目、设置、同步落点、活动记录" /><Boundary label="恢复后动作" value="重新扫描并显式同步 Agent" /></div></section>
    </div>
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#161b22]"><div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Clock3 size={15} className="text-slate-400" />最近活动</div><span className="font-mono text-[10px] text-slate-500">保留最近 200 条</span></div>{activity.length === 0 ? <div className="py-12 text-center text-xs text-slate-500">尚无 Preset、标签或快照活动</div> : <div className="divide-y divide-slate-800/70">{activity.map((entry) => <div key={entry.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[140px_1fr_180px]"><span className={entry.success ? 'text-emerald-400' : 'text-rose-400'}>{entry.action}</span><span className="min-w-0"><span className="font-medium text-slate-200">{entry.target}</span><span className="ml-2 text-[11px] text-slate-500">{entry.detail}</span></span><span className="font-mono text-[10px] text-slate-600 sm:text-right">{new Date(entry.created_at).toLocaleString('zh-CN')}</span></div>)}</div>}</section>
  </div></div>;
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="min-w-0 rounded-md border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 truncate font-mono text-[11px] text-slate-200" title={value}>{value}</div></div>;
const Boundary: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="border-b border-slate-800 pb-3"><div className="text-[10px] font-semibold text-slate-500">{label}</div><div className="mt-1 leading-5 text-slate-300">{value}</div></div>;
