import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Copy,
  Check,
  Pin,
  Trash2,
  RefreshCw,
  Layers,
  Sparkles,
  Clock,
  Terminal,
  Save,
  AlertTriangle,
  Code2,
  Eye,
  CheckCircle2,
  Share2,
  Tag
} from 'lucide-react';
import { Skill, EndpointType } from '../types';

interface SkillDetailDrawerProps {
  skill: Skill | null;
  onClose: () => void;
  onToggleEndpoint: (skillId: string, endpoint: EndpointType) => void;
  onToggleWhitelist: (skillId: string) => void;
  onQuarantineSkill: (skillId: string) => void;
  onSaveContent: (skillId: string, newContent: string) => Promise<void>;
  onSyncSkill: (skillId: string) => Promise<void>;
  onSetTags: (skillId: string, tags: string[]) => Promise<void>;
  onLaunchEditor: (skill: Skill, app: 'vscode' | 'explorer') => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SkillDetailDrawer: React.FC<SkillDetailDrawerProps> = ({
  skill,
  onClose,
  onToggleEndpoint,
  onToggleWhitelist,
  onQuarantineSkill,
  onSaveContent,
  onSyncSkill,
  onSetTags,
  onLaunchEditor,
  onShowToast
}) => {
  if (!skill) return null;

  const [activeTab, setActiveTab] = useState<'preview' | 'editor' | 'frontmatter'>('preview');
  const [editedContent, setEditedContent] = useState(skill.contentMd);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tagInput, setTagInput] = useState(skill.userTags.join(', '));
  const [isSavingTags, setIsSavingTags] = useState(false);

  // Sync editedContent when skill changes
  React.useEffect(() => {
    setEditedContent(skill.contentMd);
    setTagInput(skill.userTags.join(', '));
  }, [skill.id, skill.contentMd, skill.userTags]);

  const handleCopyPath = () => {
    navigator.clipboard?.writeText(skill.localPath);
    setCopiedPath(true);
    onShowToast('路径已复制', skill.localPath, 'info');
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveContent(skill.id, editedContent);
      onShowToast('保存成功', `已更新 ${skill.name} 的本地 SKILL.md 文件并刷新启用中的同步副本`, 'success');
    } catch (error) {
      onShowToast('保存失败', String(error), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncSkill(skill.id);
      onShowToast('同步完成', `${skill.name} 已刷新到所有当前启用的 CLI 端点`, 'success');
    } catch (error) {
      onShowToast('同步失败', String(error), 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveTags = async () => {
    const tags = tagInput.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    setIsSavingTags(true);
    try {
      await onSetTags(skill.id, tags);
      onShowToast('标签已保存', `${skill.name} 现在有 ${tags.length} 个自定义标签`, 'success');
    } catch (error) {
      onShowToast('保存标签失败', String(error), 'error');
    } finally {
      setIsSavingTags(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] md:w-[600px] bg-[#161b22] border-l border-slate-800 shadow-2xl z-40 flex flex-col justify-between animate-in slide-in-from-right-6 duration-200">
      {/* 1. Header Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-[#0d1117]/80 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-1.5">
              <span>{skill.name}</span>
            </span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
              v{skill.version}
            </span>
            {skill.isDerived && (
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded">
                {skill.derivedPackageName}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Whitelist Toggle */}
            <button
              onClick={() => onToggleWhitelist(skill.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center space-x-1 transition ${
                skill.isWhitelisted
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title={skill.isWhitelisted ? '已设为永久白名单 (AI 不会建议隔离)' : '设为白名单豁免 (防止被 AI 建议隔离)'}
            >
              <Pin size={12} className={skill.isWhitelisted ? 'fill-amber-400 text-amber-400' : ''} />
              <span>{skill.isWhitelisted ? '白名单豁免中' : '设为白名单'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#0d1117] p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="min-w-0 flex-1 text-[11px] font-medium text-slate-300">
              <span className="mb-1.5 flex items-center gap-1.5"><Tag size={12} className="text-cyan-400" />自定义标签</span>
              <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="例如：研究, 前端, 常用" className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500" />
            </label>
            <button onClick={() => void handleSaveTags()} disabled={isSavingTags} className="mt-5 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60">{isSavingTags ? '保存中' : '保存标签'}</button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">用逗号分隔，最多 12 个；来源与领域标签由系统维护。</p>
        </div>

        {/* Path & Fast Actions Bar */}
        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
          <div
            onClick={handleCopyPath}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 font-mono text-[11px] cursor-pointer bg-slate-900/80 px-2 py-1 rounded border border-slate-800 transition max-w-[280px] truncate"
            title="点击复制绝对路径"
          >
            <span className="text-slate-500">路径:</span>
            <span className="truncate">{skill.localPath}</span>
            {copiedPath ? <Check size={11} className="text-emerald-400 shrink-0" /> : <Copy size={11} className="text-slate-500 shrink-0" />}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onLaunchEditor(skill, 'vscode')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium border border-slate-700 flex items-center space-x-1 transition shadow-sm"
              title="在本地 VSCode 中打开并编辑 SKILL.md"
            >
              <FileCode2 size={12} className="text-sky-400" />
              <span>在 VSCode 编辑</span>
            </button>
            <button
              onClick={() => onLaunchEditor(skill, 'explorer')}
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition"
              title="在系统文件管理器中打开"
            >
              <FolderOpen size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Description & Metadata */}
        <div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {skill.description}
          </p>
          {skill.repoUrl && (
            <a
              href={skill.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 text-[11px] text-indigo-400 hover:underline mt-1.5"
            >
              <ExternalLink size={11} />
              <span>查看上游源仓库: {skill.repoUrl}</span>
            </a>
          )}
        </div>

        {/* 3-Endpoint Sync Controller */}
        <div className="bg-[#0d1117] p-3.5 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <Layers size={13} className="text-indigo-400" />
              <span>目标端点同步开关 (Target Sync Endpoints)</span>
            </span>
            <span className="text-[10px] text-slate-500">复制式分发</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Claude Code Switch */}
            <div className={`p-2.5 rounded-lg border transition ${skill.endpoints.claude ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-200">Claude Code</span>
                <input
                  type="checkbox"
                  checked={skill.endpoints.claude}
                  onChange={() => onToggleEndpoint(skill.id, 'claude')}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                {skill.endpoints.claude ? '已复制到 ~/.claude' : '未同步'}
              </p>
            </div>

            {/* Codex CLI Switch */}
            <div className={`p-2.5 rounded-lg border transition ${skill.endpoints.codex ? 'bg-sky-500/10 border-sky-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-200">Codex CLI</span>
                <input
                  type="checkbox"
                  checked={skill.endpoints.codex}
                  onChange={() => onToggleEndpoint(skill.id, 'codex')}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                {skill.endpoints.codex ? '已复制到 ~/.codex' : '未同步'}
              </p>
            </div>

            {/* OpenCode Switch */}
            <div className={`p-2.5 rounded-lg border transition ${skill.endpoints.opencode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-200">OpenCode</span>
                <input
                  type="checkbox"
                  checked={skill.endpoints.opencode}
                  onChange={() => onToggleEndpoint(skill.id, 'opencode')}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                {skill.endpoints.opencode ? '已复制到 OpenCode' : '未同步'}
              </p>
            </div>
          </div>
        </div>

        {/* 90-Day Analytics Card */}
        <div className="bg-[#0d1117] p-3.5 rounded-xl border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <Clock size={13} className="text-indigo-400" />
              <span>最近 90 天调用统计 (Usage Telemetry)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">上次使用: {skill.callStats.lastUsedDate}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <div className="text-2xl font-bold text-slate-100 font-mono">{skill.callStats.totalCalls} <span className="text-xs font-normal text-slate-400">次调用</span></div>
              <p className="text-[10px] text-slate-400">
                Claude: {skill.callStats.callsByEndpoint.claude} 次 | Codex: {skill.callStats.callsByEndpoint.codex} 次
              </p>
            </div>

            {/* Sparkline */}
            <div className="flex items-end space-x-1 h-8 bg-slate-900/60 p-1.5 rounded border border-slate-800">
              {skill.callStats.trend.map((val, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.max(4, Math.min(24, val * 2))}px` }}
                  className={`w-2 rounded-t-sm ${val > 10 ? 'bg-indigo-500' : 'bg-slate-600'}`}
                  title={`周期 ${i + 1}: ${val} 次`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Markdown Source & Prompt Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-1 text-xs">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded font-medium transition flex items-center space-x-1.5 ${
                  activeTab === 'preview' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye size={12} />
                <span>渲染预览 (Preview)</span>
              </button>
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded font-medium transition flex items-center space-x-1.5 ${
                  activeTab === 'editor' ? 'bg-slate-800 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 size={12} />
                <span>SKILL.md 源码编辑</span>
              </button>
            </div>

            {activeTab === 'editor' && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold flex items-center space-x-1 transition shadow-sm"
              >
                <Save size={11} />
                <span>{isSaving ? '保存中...' : '保存更改'}</span>
              </button>
            )}
          </div>

          {activeTab === 'preview' ? (
            <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {editedContent}
            </div>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={14}
                className="w-full bg-[#0d1117] border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none leading-relaxed resize-none"
                placeholder="编写或修改 SKILL.md Prompt 规则..."
              />
              <p className="text-[10px] text-slate-500">
                支持编辑标准 Agent YAML Frontmatter、执行约束及工具调用契约。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Danger / Curation Actions */}
      <div className="p-4 border-t border-slate-800 bg-[#0d1117]/80 backdrop-blur flex items-center justify-between">
        <button
          onClick={() => onQuarantineSkill(skill.id)}
          className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-md text-xs font-medium flex items-center space-x-1.5 transition"
        >
          <Trash2 size={12} />
          <span>移入 30 天安全隔离仓</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
          >
            <RefreshCw size={12} />
            <span>{isSyncing ? '同步中...' : '同步变更'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
