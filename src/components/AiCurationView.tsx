import React, { useState } from 'react';
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Pin,
  FileCode,
  Layers,
  ArrowRight,
  Eye,
  HelpCircle,
  TrendingDown,
  Scale,
  Check
} from 'lucide-react';
import { OverlapGroup, Skill } from '../types';

interface AiCurationViewProps {
  overlapGroups: OverlapGroup[];
  skills: Skill[];
  onQuarantineSkill: (skillId: string, reason?: string) => void;
  onToggleWhitelist: (skillId: string) => void;
  onOpenSkillDetail: (skill: Skill) => void;
  onReanalyze: (threshold: number) => Promise<number>;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const AiCurationView: React.FC<AiCurationViewProps> = ({
  overlapGroups,
  skills,
  onQuarantineSkill,
  onToggleWhitelist,
  onOpenSkillDetail,
  onReanalyze,
  onShowToast
}) => {
  const [curationTab, setCurationTab] = useState<'pending' | 'observing' | 'whitelisted'>('pending');
  const [tfidfThreshold, setTfidfThreshold] = useState<number>(0.35);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [inspectingGroup, setInspectingGroup] = useState<OverlapGroup | null>(null);
  const [diffModalSkills, setDiffModalSkills] = useState<{ s1: Skill; s2: Skill; groupTitle: string } | null>(null);

  // Skill lookup helper
  const getSkill = (id: string) => skills.find(s => s.id === id);

  // Re-run semantic analysis handler
  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      const groupCount = await onReanalyze(tfidfThreshold);
      onShowToast('语义重叠分析完成', `已基于阈值 ${tfidfThreshold} 重新聚类，共识别出 ${groupCount} 组职责同质化技能`, 'success');
    } catch (error) {
      onShowToast('语义重叠分析失败', String(error), 'error');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Whitelisted skills
  const whitelistedSkills = skills.filter(s => s.isWhitelisted);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1117]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header with Title & TF-IDF Slider */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
              <span>AI 技能智能策展与冗余分析中心</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                TF-IDF + Claude CLI 裁决
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              自动识别功能重复、Prompt 冲突或长期无调用的冗余技能，提供基于 90 天真实使用率的无损淘汰建议
            </p>
          </div>

          {/* Algorithm Slider & Re-analyze Button */}
          <div className="flex items-center space-x-3 bg-[#161b22] p-2.5 rounded-lg border border-slate-800 self-start lg:self-auto">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <Sliders size={13} className="text-indigo-400" />
              <span className="text-slate-400">TF-IDF 灵敏度:</span>
              <span className="font-mono font-bold text-indigo-300">{tfidfThreshold}</span>
              <input
                type="range"
                min="0.15"
                max="0.75"
                step="0.05"
                value={tfidfThreshold}
                onChange={(e) => setTfidfThreshold(parseFloat(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
            </div>

            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className={`px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm ${
                isReanalyzing ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              <RefreshCw size={12} className={isReanalyzing ? 'animate-spin' : ''} />
              <span>{isReanalyzing ? '计算中...' : '重新运行语义分析'}</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-2 text-xs">
          <button
            onClick={() => setCurationTab('pending')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition flex items-center space-x-2 ${
              curationTab === 'pending'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>待处理重叠组</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 font-mono">
              {overlapGroups.length}
            </span>
          </button>

          <button
            onClick={() => setCurationTab('observing')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition flex items-center space-x-2 ${
              curationTab === 'observing'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>观察期保护技能</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
              2
            </span>
          </button>

          <button
            onClick={() => setCurationTab('whitelisted')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition flex items-center space-x-2 ${
              curationTab === 'whitelisted'
                ? 'bg-slate-800 text-slate-100 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>白名单豁免库</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
              {whitelistedSkills.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Pending Overlap Groups */}
        {curationTab === 'pending' && (
          <div className="space-y-6">
            {overlapGroups.map((group) => (
              <div
                key={group.id}
                className="bg-[#161b22] border border-slate-800/90 rounded-xl overflow-hidden shadow-sm"
              >
                {/* Group Card Header */}
                <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-medium">
                      职责重叠组 #{group.groupNumber}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {group.title}
                    </h3>
                    {group.claudeReviewConfirmed ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center">
                        <CheckCircle2 size={10} className="mr-1" />
                        Claude CLI 语义复核确认 (置信度 {group.confidenceScore}%)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        本地 TF-IDF 初筛 (置信度 {group.confidenceScore}%)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-400">
                    <span>组内 90 天总调用: <strong className="text-slate-200 font-mono">{group.totalCalls} 次</strong></span>
                    <button
                      onClick={() => setInspectingGroup(inspectingGroup?.id === group.id ? null : group)}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center space-x-1"
                    >
                      <Eye size={12} />
                      <span>{inspectingGroup?.id === group.id ? '收起语义分析' : '查看语义分析'}</span>
                    </button>
                  </div>
                </div>

                {/* Inspect Semantic Explanation Accordion */}
                {inspectingGroup?.id === group.id && (
                  <div className="p-4 bg-indigo-950/20 border-b border-indigo-500/20 text-xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300 flex items-center space-x-1.5">
                        <Sparkles size={13} className="text-indigo-400" />
                        <span>AI 语义重叠特征分析 (Semantic Analysis):</span>
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        Prompt 相似度: <strong className="text-indigo-300">{group.similarityAnalysis.promptOverlapPercent}%</strong>
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      {group.similarityAnalysis.detailedReason}
                    </p>

                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-slate-400 text-[11px]">提取共有意图关键词:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.similarityAnalysis.sharedKeywords.map((kw, i) => (
                          <span key={i} className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparison Table */}
                <div className="divide-y divide-slate-800/60 text-xs">
                  {group.skills.map((member) => {
                    const skill = getSkill(member.skillId);
                    if (!skill) return null;

                    const isCore = member.status === 'core';
                    const isObserve = member.status === 'observe';
                    const isQuarantineSuggested = member.status === 'quarantine_suggested';

                    return (
                      <div
                        key={member.skillId}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                          isQuarantineSuggested
                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                            : 'hover:bg-slate-800/20'
                        }`}
                      >
                        {/* Left: Skill name & badge */}
                        <div className="w-full md:w-5/12">
                          <div className="flex items-center space-x-2">
                            <span
                              onClick={() => onOpenSkillDetail(skill)}
                              className="font-semibold text-slate-100 hover:text-indigo-400 cursor-pointer transition"
                            >
                              {skill.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">v{skill.version}</span>

                            {/* Status recommendation pill */}
                            {isCore && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium flex items-center">
                                👑 核心保留 (最高频)
                              </span>
                            )}
                            {isObserve && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-medium flex items-center">
                                👀 观察中 (&gt;10%)
                              </span>
                            )}
                            {isQuarantineSuggested && (
                              <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded font-medium flex items-center">
                                ⚠️ 建议隔离 (&lt;15%)
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {member.reason}
                          </p>
                        </div>

                        {/* Mid 1: 90d Calls & Ratio */}
                        <div className="w-full md:w-2/12 text-left md:text-center">
                          <div className="font-mono text-xs text-slate-200">
                            <strong>{member.callCount} 次</strong> ({member.callRatio.toFixed(1)}%)
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 max-w-[100px] mx-auto">
                            <div
                              style={{ width: `${Math.min(100, member.callRatio)}%` }}
                              className={`h-full ${isCore ? 'bg-emerald-400' : isObserve ? 'bg-amber-400' : 'bg-rose-400'}`}
                            />
                          </div>
                        </div>

                        {/* Mid 2: Endpoints */}
                        <div className="flex space-x-1.5 items-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${skill.endpoints.claude ? 'bg-slate-800 text-emerald-400' : 'bg-slate-900 text-slate-600 line-through'}`}>
                            Claude
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${skill.endpoints.codex ? 'bg-slate-800 text-sky-400' : 'bg-slate-900 text-slate-600 line-through'}`}>
                            Codex
                          </span>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center space-x-2">
                          {isQuarantineSuggested ? (
                            <button
                              onClick={() => onQuarantineSkill(skill.id, `重叠组 #${group.groupNumber} 策展裁决：使用率仅 ${member.callRatio}%`)}
                              className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-semibold transition shadow-sm flex items-center space-x-1"
                            >
                              <ShieldAlert size={12} />
                              <span>立即隔离并撤下</span>
                            </button>
                          ) : isCore ? (
                            <span className="text-[11px] text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded">
                              ✓ 已保持全端同步
                            </span>
                          ) : null}

                          <button
                            onClick={() => onToggleWhitelist(skill.id)}
                            className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs rounded hover:bg-slate-800 transition flex items-center space-x-1"
                            title="设为白名单，永不被 AI 建议隔离"
                          >
                            <Pin size={11} className={skill.isWhitelisted ? 'fill-amber-400 text-amber-400' : ''} />
                            <span>{skill.isWhitelisted ? '已豁免' : '设为保留'}</span>
                          </button>

                          {/* Compare with core button */}
                          {group.skills[0].skillId !== skill.id && (
                            <button
                              onClick={() => {
                                const coreSkill = getSkill(group.skills[0].skillId);
                                if (coreSkill) {
                                  setDiffModalSkills({ s1: coreSkill, s2: skill, groupTitle: group.title });
                                }
                              }}
                              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                              title="对比 Prompt 与规则"
                            >
                              <Scale size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Observing protection skills */}
        {curationTab === 'observing' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
              <strong>💡 观察期保护机制（30-Day Probation Protection）：</strong>
              新导入未满 30 天或组内调用占比在 10%~30% 之间的探索型技能，系统会自动开启防护锁，默认不直接建议淘汰隔离，避免误杀探索中或特定领域技能。
            </div>

            <div className="bg-[#161b22] border border-slate-800 rounded-xl divide-y divide-slate-800 text-xs">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-100">css-in-js-gen</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                      导入第 12 天 (剩余 18 天保护期)
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    新导入的前端 Styled-Components 生成器，目前正在观察实际开发调用频次
                  </p>
                </div>
                <button
                  onClick={() => onToggleWhitelist('skill-css-in-js-gen')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                >
                  提前锁定为白名单
                </button>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-100">smart-git-commit</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
                      调用占比 16.0% (大于 10% 观察阈值)
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    仍有特定分支使用 Emoji commit 习惯，暂不触发强制淘汰
                  </p>
                </div>
                <button
                  onClick={() => onToggleWhitelist('skill-smart-git-commit')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs"
                >
                  设为白名单豁免
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Whitelisted skills */}
        {curationTab === 'whitelisted' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
              <strong>⭐ 白名单永久保留机制（Exemption Whitelist）：</strong>
              为解决“年终脚本”、“低频但关键的底座规则”被误判隔离的痛点，加入白名单的技能将获得永久豁免，AI 策展算法永不生成隔离建议。
            </div>

            <div className="bg-[#161b22] border border-slate-800 rounded-xl divide-y divide-slate-800 text-xs">
              {whitelistedSkills.map((skill) => (
                <div key={skill.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Pin size={12} className="text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-slate-100">{skill.name}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                        v{skill.version}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">{skill.description}</p>
                  </div>
                  <button
                    onClick={() => onToggleWhitelist(skill.id)}
                    className="px-2.5 py-1 text-slate-400 hover:text-rose-300 text-xs rounded hover:bg-slate-800 transition"
                  >
                    移出白名单
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-side Prompt Comparison Modal */}
      {diffModalSkills && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <Scale size={14} className="text-indigo-400" />
                  <span>技能语义与 Prompt 对比: {diffModalSkills.groupTitle}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  对比核心推荐技能与重叠待优化技能的指令差异
                </p>
              </div>
              <button
                onClick={() => setDiffModalSkills(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 flex-1 overflow-y-auto">
              {/* Left: Core Skill */}
              <div className="bg-[#0d1117] p-3.5 rounded-xl border border-emerald-500/30 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-200 text-xs">{diffModalSkills.s1.name}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1 rounded">👑 核心保留</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">90天调用: {diffModalSkills.s1.callStats.totalCalls}次</span>
                </div>
                <div className="mt-2 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto max-h-96">
                  {diffModalSkills.s1.contentMd}
                </div>
              </div>

              {/* Right: Competing Skill */}
              <div className="bg-[#0d1117] p-3.5 rounded-xl border border-rose-500/30 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-200 text-xs">{diffModalSkills.s2.name}</span>
                    <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1 rounded">⚠️ 重叠建议</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">90天调用: {diffModalSkills.s2.callStats.totalCalls}次</span>
                </div>
                <div className="mt-2 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto max-h-96">
                  {diffModalSkills.s2.contentMd}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end space-x-2">
              <button
                onClick={() => setDiffModalSkills(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
              >
                关闭对比
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
