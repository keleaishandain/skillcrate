import React, { useState } from 'react';
import {
  ShieldAlert,
  RotateCcw,
  Archive,
  Clock,
  FileText,
  ExternalLink,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  FolderArchive,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { Skill } from '../types';

interface QuarantineViewProps {
  quarantinedSkills: Skill[];
  onRestoreSkill: (skillId: string) => void;
  onArchiveSkill: (skillId: string) => void;
  onArchiveAllExpired: () => void;
  onOpenSkillDetail: (skill: Skill) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const QuarantineView: React.FC<QuarantineViewProps> = ({
  quarantinedSkills,
  onRestoreSkill,
  onArchiveSkill,
  onArchiveAllExpired,
  onOpenSkillDetail,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'quarantine' | 'vault'>('quarantine');
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);

  const activeQuarantineList = quarantinedSkills.filter(s => !s.quarantineState?.isArchived);
  const archivedVaultList = quarantinedSkills.filter(s => !!s.quarantineState?.isArchived);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1117]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
              <span>安全隔离仓与归档库</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                {activeQuarantineList.length} 个隔离中
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              遵循“可逆保护，永不自动物理删除”原则，所有淘汰技能均进入 30 天保护期，可一键无损复原至 Claude / Codex / OpenCode
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onArchiveAllExpired();
                onShowToast('归档完成', '所有过期隔离项已移入长期加密归档库 ~/.skills-manager/archive/', 'success');
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <FolderArchive size={13} />
              <span>一键归档所有到期项</span>
            </button>
          </div>
        </div>

        {/* Philosophy Protection Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-[#161b22] to-slate-900 border border-indigo-500/20 shadow-sm flex items-start space-x-3.5 text-xs text-slate-300">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
            <ShieldAlert size={18} />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-100">30 天可逆安全锁机制 (Zero Silent Deletion Guarantee)</h4>
            <p className="text-slate-400 leading-relaxed">
              当您在 AI 策展中心点击“立即隔离”时，系统仅从 <code className="text-indigo-400 font-mono text-[11px]">~/.claude/skills</code> 等工作目录解除软链，并将源码妥善转移至本地隔离仓。在 30 天保护期内，随时可一键原样恢复软链与调用配置。
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('quarantine')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition flex items-center space-x-2 ${
              activeTab === 'quarantine'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>30 天保护期列表</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono">
              {activeQuarantineList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition flex items-center space-x-2 ${
              activeTab === 'vault'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>长期归档保险库 (Archive Vault)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
              {archivedVaultList.length}
            </span>
          </button>
        </div>

        {/* List Content */}
        {activeTab === 'quarantine' ? (
          activeQuarantineList.length === 0 ? (
            <div className="text-center py-16 bg-[#161b22] rounded-xl border border-slate-800 p-8">
              <ShieldAlert className="mx-auto text-emerald-500 mb-2" size={32} />
              <h4 className="text-sm font-medium text-slate-200">隔离仓当前为空</h4>
              <p className="text-xs text-slate-500 mt-1">所有纳管技能均处于健康激活或白名单保留状态。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeQuarantineList.map((skill) => {
                const daysRemaining = skill.quarantineState?.daysRemaining ?? 30;
                const isExpiringSoon = daysRemaining <= 7;

                return (
                  <div
                    key={skill.id}
                    className="p-4 rounded-xl bg-[#161b22] border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-semibold text-slate-100 text-sm font-mono">{skill.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                          v{skill.version}
                        </span>

                        {/* Days Remaining Pill */}
                        <span
                          className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border flex items-center space-x-1 ${
                            isExpiringSoon
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          <Clock size={10} />
                          <span>剩余 {daysRemaining} 天可一键还原</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        {skill.description}
                      </p>

                      {/* Quarantine Reason */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">
                          隔离原因: <strong className="text-slate-300 font-normal">{skill.quarantineState?.reason}</strong>
                        </span>

                        {/* Original Endpoints Record */}
                        {skill.quarantineState?.originalEndpoints && (
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                            <span>原同步端:</span>
                            {skill.quarantineState.originalEndpoints.map((ep) => (
                              <span key={ep} className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono">
                                {ep}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center space-x-2 self-end md:self-auto shrink-0">
                      {/* One Click Restore Button */}
                      <button
                        onClick={() => onRestoreSkill(skill.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                        title="一键还原回中央技能库，并恢复原来的 Claude/Codex 同步端点"
                      >
                        <RotateCcw size={12} />
                        <span>一键还原到原工具</span>
                      </button>

                      {/* Move to Archive */}
                      <button
                        onClick={() => onArchiveSkill(skill.id)}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium border border-slate-700 flex items-center space-x-1 transition"
                        title="提前移入长期归档保险库"
                      >
                        <Archive size={12} />
                        <span>提前归档</span>
                      </button>

                      {/* Preview */}
                      <button
                        onClick={() => setPreviewSkill(skill)}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                        title="查看 SKILL.md 源码"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Vault Tab */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 leading-relaxed flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-200">长期只读归档库 (~/.skills-manager/archive/)</h4>
                <p className="mt-0.5">归档的技能不会占用 CLI 端点或影响 Agent 路由，但永久保留在本地供随时调阅或解压。</p>
              </div>
              <button
                onClick={() => onShowToast('导出开始', '正在打包归档库为 skills-archive-bundle.zip...', 'info')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1"
              >
                <Download size={12} />
                <span>导出全部归档 ZIP</span>
              </button>
            </div>

            {archivedVaultList.length === 0 ? (
              <div className="text-center py-12 bg-[#161b22] rounded-xl border border-slate-800 text-slate-500 text-xs">
                暂无长期归档技能。
              </div>
            ) : (
              <div className="divide-y divide-slate-800 bg-[#161b22] border border-slate-800 rounded-xl">
                {archivedVaultList.map((skill) => (
                  <div key={skill.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-200">{skill.name}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{skill.description}</p>
                    </div>
                    <button
                      onClick={() => onRestoreSkill(skill.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                    >
                      从归档中解压恢复
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SKILL.md Preview Modal */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200 font-mono">
                隔离文件预览: {previewSkill.name}/SKILL.md
              </span>
              <button
                onClick={() => setPreviewSkill(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-slate-300 bg-[#0d1117] whitespace-pre-wrap leading-relaxed">
              {previewSkill.contentMd}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
              <button
                onClick={() => setPreviewSkill(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
