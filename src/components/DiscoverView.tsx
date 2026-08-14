import React, { useState } from 'react';
import {
  Compass,
  Search,
  Star,
  Download,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Plus,
  Check,
  Flame,
  ShieldCheck,
  Eye,
  Share2
} from 'lucide-react';
import { CommunitySkill, Skill } from '../types';

interface DiscoverViewProps {
  communitySkills: CommunitySkill[];
  installedSkillSlugs: Set<string>;
  onInstallSkill: (skill: CommunitySkill) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  communitySkills,
  installedSkillSlugs,
  onInstallSkill,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewSkill, setPreviewSkill] = useState<CommunitySkill | null>(null);

  const filtered = communitySkills.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1117]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
              <span>探索社区与官方精选技能</span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono flex items-center">
                <Flame size={11} className="mr-1" />
                热门推荐
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              汇集 Anthropic 官方、Linear、Supabase 等优质 Agent 技能包，一键收编至本地中央库
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161b22] p-3.5 rounded-xl border border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 text-slate-500" size={13} />
            <input
              type="text"
              placeholder="搜索社区技能、作者、技术标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1117] border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
            {['all', 'git', 'frontend', 'backend', 'database', 'security'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? '全部' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((skill) => {
            const isInstalled = installedSkillSlugs.has(skill.slug);

            return (
              <div
                key={skill.id}
                className="p-4 rounded-xl bg-[#161b22] border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-slate-100 text-sm font-mono">{skill.name}</h3>
                        {skill.verified && (
                          <span title="官方认证技能" className="text-sky-400">
                            <ShieldCheck size={14} />
                          </span>
                        )}
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                          v{skill.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">by {skill.author}</p>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                      <span className="flex items-center space-x-1">
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span>{skill.stars}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Download size={11} className="text-slate-500" />
                        <span>{skill.installs}</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {skill.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {skill.tags.map((t, idx) => (
                      <span key={idx} className="px-1.5 py-0.2 bg-slate-800/80 text-slate-400 rounded text-[10px]">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => setPreviewSkill(skill)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                  >
                    <Eye size={12} />
                    <span>预览 Prompt</span>
                  </button>

                  {isInstalled ? (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-medium flex items-center space-x-1">
                      <Check size={12} />
                      <span>已收编入库</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => onInstallSkill(skill)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                    >
                      <Plus size={12} />
                      <span>一键导入中央库</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview Modal */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200 font-mono">
                社区技能: {previewSkill.name}
              </span>
              <button
                onClick={() => setPreviewSkill(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto bg-[#0d1117] text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {previewSkill.contentMd}
            </div>
            <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">来源: {previewSkill.repoUrl}</span>
              <button
                onClick={() => {
                  onInstallSkill(previewSkill);
                  setPreviewSkill(null);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
              >
                一键收编入库
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
