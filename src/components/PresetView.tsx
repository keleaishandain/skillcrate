import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Layers3, Play, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { BatchResult, Preset, PresetPlan, Skill } from '../types';

interface PresetViewProps {
  presets: Preset[];
  skills: Skill[];
  onSave: (preset: Preset) => Promise<Preset>;
  onDelete: (id: string) => Promise<void>;
  onPreview: (id: string, tools: string[]) => Promise<PresetPlan>;
  onApply: (id: string, tools: string[]) => Promise<BatchResult>;
  onRemove: (id: string, tools: string[]) => Promise<BatchResult>;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const tools = [
  { id: 'claude_code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'opencode', label: 'OpenCode' },
];

function blankPreset(): Preset {
  return { id: `preset-${Date.now()}`, name: '', description: '', icon: 'layers', skill_dir_names: [], tools: ['claude_code', 'codex'], updated_at: '' };
}

export const PresetView: React.FC<PresetViewProps> = ({ presets, skills, onSave, onDelete, onPreview, onApply, onRemove, onShowToast }) => {
  const [selectedId, setSelectedId] = useState<string | null>(presets[0]?.id ?? null);
  const [draft, setDraft] = useState<Preset>(() => presets[0] ? { ...presets[0], skill_dir_names: [...presets[0].skill_dir_names], tools: [...presets[0].tools] } : blankPreset());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ mode: 'apply' | 'remove'; plan: PresetPlan } | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const selected = presets.find((item) => item.id === selectedId);
    if (selected) setDraft({ ...selected, skill_dir_names: [...selected.skill_dir_names], tools: [...selected.tools] });
  }, [presets, selectedId]);

  const filteredSkills = useMemo(() => skills.filter((skill) => `${skill.name} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [skills, query]);
  const isPersisted = presets.some((item) => item.id === draft.id);

  const selectPreset = (preset: Preset) => {
    setSelectedId(preset.id);
    setDraft({ ...preset, skill_dir_names: [...preset.skill_dir_names], tools: [...preset.tools] });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await onSave(draft);
      setSelectedId(saved.id);
      setDraft(saved);
      onShowToast('Preset 已保存', `${saved.name} 包含 ${saved.skill_dir_names.length} 个 Skills`, 'success');
    } catch (error) {
      onShowToast('保存 Preset 失败', String(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const prepare = async (mode: 'apply' | 'remove') => {
    if (!isPersisted) {
      onShowToast('请先保存 Preset', '执行前需要把当前配置写入本地状态。', 'warning');
      return;
    }
    try {
      setConfirm({ mode, plan: await onPreview(draft.id, draft.tools) });
    } catch (error) {
      onShowToast('无法生成执行计划', String(error), 'error');
    }
  };

  const execute = async () => {
    if (!confirm) return;
    setExecuting(true);
    try {
      const result = confirm.mode === 'apply' ? await onApply(draft.id, draft.tools) : await onRemove(draft.id, draft.tools);
      const title = result.failed ? 'Preset 执行部分失败' : confirm.mode === 'apply' ? 'Preset 已应用' : 'Preset 已移除';
      onShowToast(title, `成功 ${result.succeeded}，跳过 ${result.skipped}，未变化 ${result.unchanged}，失败 ${result.failed}`, result.failed ? 'warning' : 'success');
      setConfirm(null);
    } catch (error) {
      onShowToast('Preset 执行失败', String(error), 'error');
    } finally {
      setExecuting(false);
    }
  };

  const removeSkill = (dirName: string) => setDraft((current) => ({ ...current, skill_dir_names: current.skill_dir_names.filter((name) => name !== dirName) }));
  const addSkill = (dirName: string) => setDraft((current) => current.skill_dir_names.includes(dirName) ? current : ({ ...current, skill_dir_names: [...current.skill_dir_names, dirName] }));
  const moveSkill = (index: number, delta: number) => setDraft((current) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.skill_dir_names.length) return current;
    const next = [...current.skill_dir_names];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    return { ...current, skill_dir_names: next };
  });

  return (
    <div className="h-full overflow-y-auto bg-[#0d1117] p-5 lg:overflow-hidden md:p-7">
      <div className="mx-auto flex h-auto max-w-[1420px] flex-col gap-5 lg:h-full">
        <div className="flex items-end justify-between border-b border-slate-800 pb-5">
          <div><h1 className="text-lg font-bold text-slate-100">Preset 场景编排</h1><p className="mt-1 text-xs text-slate-400">编辑只保存配置；只有“预览并应用”才会改变 Agent 目录。</p></div>
          <button onClick={() => { const next = blankPreset(); setSelectedId(null); setDraft(next); }} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"><Plus size={14} />新建 Preset</button>
        </div>

        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          <aside className="overflow-y-auto border-r border-slate-800 pr-4">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase text-slate-500">已保存 · {presets.length}</div>
            <div className="space-y-1">{presets.map((preset) => <button key={preset.id} onClick={() => selectPreset(preset)} className={`w-full rounded-md border px-3 py-2.5 text-left ${preset.id === draft.id ? 'border-indigo-500/35 bg-indigo-500/10' : 'border-transparent hover:bg-slate-800/60'}`}><div className="flex items-center justify-between"><span className="truncate text-xs font-semibold text-slate-200">{preset.name}</span><span className="font-mono text-[10px] text-slate-500">{preset.skill_dir_names.length}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{preset.description || '未填写说明'}</p></button>)}</div>
            {presets.length === 0 && <div className="rounded-md border border-dashed border-slate-800 px-3 py-6 text-center text-[11px] text-slate-500">创建一个 Preset 来组合常用 Skills</div>}
          </aside>

          <section className="min-h-0 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
              <label className="text-[11px] text-slate-400">名称<input value={draft.name} maxLength={40} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：前端交付" className="mt-1.5 w-full rounded-md border border-slate-800 bg-[#161b22] px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500" /></label>
              <label className="text-[11px] text-slate-400">标识<select value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} className="mt-1.5 w-full rounded-md border border-slate-800 bg-[#161b22] px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"><option value="layers">分层</option><option value="code">开发</option><option value="search">研究</option><option value="shield">审查</option></select></label>
            </div>
            <label className="mt-4 block text-[11px] text-slate-400">用途说明<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} rows={2} placeholder="这组 Skills 在什么任务中使用" className="mt-1.5 w-full resize-none rounded-md border border-slate-800 bg-[#161b22] px-3 py-2.5 text-xs leading-5 text-slate-100 outline-none focus:border-indigo-500" /></label>

            <div className="mt-5 flex items-center justify-between"><div><div className="text-xs font-semibold text-slate-200">成员顺序</div><div className="mt-0.5 text-[10px] text-slate-500">顺序会保留在 Preset 配置中。</div></div><span className="font-mono text-[10px] text-slate-500">{draft.skill_dir_names.length} Skills</span></div>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-[#161b22]">
              {draft.skill_dir_names.length === 0 ? <div className="py-12 text-center"><Layers3 size={24} className="mx-auto text-slate-700" /><p className="mt-2 text-xs text-slate-500">从右侧技能库添加成员</p></div> : <div className="divide-y divide-slate-800/70">{draft.skill_dir_names.map((dirName, index) => {
                const skill = skills.find((item) => item.dir_name === dirName);
                return <div key={dirName} className="flex items-center gap-3 px-3 py-2.5"><span className="w-5 font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-slate-200">{skill?.name ?? dirName}</div><div className="truncate text-[10px] text-slate-500">{skill?.description ?? '中央库中已缺失'}</div></div><button onClick={() => moveSkill(index, -1)} disabled={index === 0} title="上移" className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20"><ArrowUp size={12} /></button><button onClick={() => moveSkill(index, 1)} disabled={index === draft.skill_dir_names.length - 1} title="下移" className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20"><ArrowDown size={12} /></button><button onClick={() => removeSkill(dirName)} title="移出 Preset" className="p-1 text-slate-500 hover:text-rose-300"><X size={13} /></button></div>;
              })}</div>}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">{isPersisted && <button onClick={async () => { if (!window.confirm(`删除 Preset“${draft.name}”？Skill 文件不会被删除。`)) return; try { await onDelete(draft.id); const next = blankPreset(); setSelectedId(null); setDraft(next); onShowToast('Preset 已删除', '中央 Skills 与 Agent 目录未被修改。', 'success'); } catch (error) { onShowToast('删除失败', String(error), 'error'); } }} className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/15"><Trash2 size={13} />删除</button>}</div>
              <div className="flex flex-wrap gap-2"><button onClick={() => void prepare('remove')} disabled={!isPersisted || draft.tools.length === 0} className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40">从目标移除</button><button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"><Save size={13} />{saving ? '保存中' : '保存配置'}</button><button onClick={() => void prepare('apply')} disabled={!isPersisted || draft.tools.length === 0} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"><Play size={13} />预览并应用</button></div>
            </div>
          </section>

          <aside className="min-h-0 overflow-hidden border-l border-slate-800 pl-4">
            <div className="text-xs font-semibold text-slate-200">目标 Agent</div>
            <div className="mt-2 grid grid-cols-3 gap-1">{tools.map((tool) => { const active = draft.tools.includes(tool.id); return <button key={tool.id} onClick={() => setDraft((current) => ({ ...current, tools: active ? current.tools.filter((item) => item !== tool.id) : [...current.tools, tool.id] }))} className={`rounded-md border px-2 py-2 text-[10px] font-medium ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-500'}`}>{active && <Check size={10} className="mr-1 inline" />}{tool.label.replace(' Code', '')}</button>; })}</div>
            <div className="mt-5 text-xs font-semibold text-slate-200">中央技能库</div>
            <div className="relative mt-2"><Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称、描述或标签" className="w-full rounded-md border border-slate-800 bg-[#161b22] py-2 pl-8 pr-3 text-[11px] text-slate-200 outline-none focus:border-indigo-500" /></div>
            <div className="mt-2 h-[calc(100%-116px)] min-h-[240px] overflow-y-auto rounded-md border border-slate-800 bg-[#161b22]">{filteredSkills.map((skill) => { const added = draft.skill_dir_names.includes(skill.dir_name); return <button key={skill.id} onClick={() => added ? removeSkill(skill.dir_name) : addSkill(skill.dir_name)} className="flex w-full items-start gap-2 border-b border-slate-800/60 px-3 py-2.5 text-left hover:bg-slate-800/50"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${added ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-700'}`}>{added && <Check size={11} />}</span><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-slate-200">{skill.name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{skill.description}</span></span></button>; })}</div>
          </aside>
        </div>
      </div>

      {confirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-lg border border-slate-700 bg-[#161b22] shadow-2xl"><div className="border-b border-slate-800 px-5 py-4"><h2 className="text-sm font-semibold text-slate-100">{confirm.mode === 'apply' ? '确认应用 Preset' : '确认从目标移除'}</h2><p className="mt-1 text-[11px] text-slate-400">{confirm.plan.preset_name} · {confirm.plan.target_tools.map((tool) => tools.find((item) => item.id === tool)?.label ?? tool).join('、')}</p></div><div className="space-y-3 px-5 py-4 text-xs"><div className="grid grid-cols-3 gap-2"><PlanMetric label="操作总数" value={confirm.plan.total_operations} /><PlanMetric label="已存在" value={confirm.plan.already_applied} /><PlanMetric label="待写入" value={confirm.plan.pending} /></div>{confirm.plan.missing_skills.length > 0 && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">中央库缺失：{confirm.plan.missing_skills.join('、')}</div>}{confirm.mode === 'remove' && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-200">移除会删除这些 Skill 在所选 Agent 中的目录副本。当前版本不记录多个 Preset 对同一落点的所有权，请先确认共享成员。</div>}</div><div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4"><button onClick={() => setConfirm(null)} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">取消</button><button onClick={() => void execute()} disabled={executing || confirm.plan.missing_skills.length > 0} className={`rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 ${confirm.mode === 'apply' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-rose-600 hover:bg-rose-500'}`}>{executing ? '执行中' : confirm.mode === 'apply' ? '确认应用' : '确认移除'}</button></div></div></div>}
    </div>
  );
};

const PlanMetric: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="rounded-md border border-slate-800 bg-slate-900 p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</div></div>;
