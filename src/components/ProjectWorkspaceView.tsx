import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  GitBranch,
  RefreshCw,
  Check,
  AlertTriangle,
  FileCode,
  ArrowLeftRight,
  ExternalLink,
  Plus,
  CheckCircle2,
  Layers,
  Download,
  Upload,
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import { ProjectWorkspace, Skill, ProjectSkillRef } from '../types';

interface ProjectWorkspaceViewProps {
  projects: ProjectWorkspace[];
  skills: Skill[];
  onSyncProjectSkillToHub: (projectId: string, dirName: string, tool: ProjectSkillRef['tool']) => Promise<void>;
  onPullHubSkillToProject: (projectId: string, dirName: string, tool: ProjectSkillRef['tool']) => Promise<void>;
  onAdoptProjectSkill: (projectId: string, dirName: string, tool: ProjectSkillRef['tool']) => Promise<void>;
  onAddProject: (path: string) => Promise<void>;
  onRemoveProject: (path: string) => Promise<void>;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  projects,
  skills,
  onSyncProjectSkillToHub,
  onPullHubSkillToProject,
  onAdoptProjectSkill,
  onAddProject,
  onRemoveProject,
  onShowToast
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [activeDiffSkill, setActiveDiffSkill] = useState<{ project: ProjectWorkspace; ref: ProjectSkillRef; hubSkill: Skill } | null>(null);
  const [newProjectPath, setNewProjectPath] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);

  useEffect(() => {
    if (!projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? '');
    }
  }, [projects, selectedProjectId]);

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const getHubSkill = (ref: ProjectSkillRef) => skills.find(skill => skill.dir_name === ref.dirName);
  const statusLabel: Record<ProjectSkillRef['syncStatus'], string> = {
    in_sync: '内容一致',
    project_newer: '项目版本较新',
    center_newer: '中央版本较新',
    diverged: '双方已分叉',
    project_only: '仅项目存在',
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1117]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
              <span>项目工作区与技能差异对比</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                {projects.length} 个活跃项目
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              自动探测各独立代码仓库下 <code className="text-indigo-400 font-mono text-[11px]">.claude/skills/</code> 的本地定制，并提供与中央技能库的双向 Diff 对比与同步
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newProjectPath}
              onChange={(event) => setNewProjectPath(event.target.value)}
              placeholder="添加本地项目路径"
              className="w-56 bg-[#0d1117] border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
            />
            <button
              disabled={!newProjectPath.trim() || isAddingProject}
              onClick={async () => {
                setIsAddingProject(true);
                try {
                  await onAddProject(newProjectPath.trim());
                  setNewProjectPath('');
                  onShowToast('项目已添加', '已重新扫描项目技能目录', 'success');
                } catch (error) {
                  onShowToast('添加项目失败', String(error), 'error');
                } finally {
                  setIsAddingProject(false);
                }
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Plus size={13} />
              <span>{isAddingProject ? '添加中...' : '添加项目'}</span>
            </button>
          </div>
        </div>

        {/* Project Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const isSelected = proj.id === selectedProjectId;
            const diffCount = proj.skills.filter(s => s.hasDiff).length;

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'bg-indigo-950/25 border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'bg-[#161b22] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-8 w-8 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center border border-slate-700">
                      <FolderKanban size={16} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-100 text-sm font-mono">{proj.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{proj.framework}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                  {diffCount > 0 ? (
                    <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-medium flex items-center">
                      <AlertTriangle size={10} className="mr-1" />
                      {diffCount} 处本地定制差异
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                      ✓ 与中央库完全一致
                    </span>
                  )}
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void onRemoveProject(proj.path).then(() => onShowToast('项目已移除', proj.path, 'info')).catch((error) => onShowToast('移除项目失败', String(error), 'error'));
                    }}
                    className="text-[10px] text-slate-500 hover:text-rose-300"
                  >
                    移除
                  </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 font-mono">
                  <span className="truncate max-w-[240px]">{proj.path}</span>
                  <span>挂载技能: {proj.skills.length} 个</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Project Injected Skills Table */}
        {currentProject && (
          <div className="bg-[#161b22] border border-slate-800/90 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <GitBranch size={15} className="text-indigo-400" />
                  <span>项目【{currentProject.name}】挂载技能状态</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  上次校验: {currentProject.lastScanned} | 路径: {currentProject.path}/.claude/skills/
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-800/60 text-xs">
              {currentProject.skills.map((item) => {
                const hubSkill = getHubSkill(item);
                return (
                  <div
                    key={`${item.skillId}-${item.tool}`}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/20 transition"
                  >
                    {/* Left: Skill name & diff tag */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-100 font-mono">{hubSkill?.name ?? item.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">{item.tool}</span>
                        {item.syncStatus !== 'in_sync' ? (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-medium">
                            {statusLabel[item.syncStatus]}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                            完全同步 (无差异)
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.diffSummary ? item.diffSummary : (hubSkill?.description ?? item.description)}
                      </p>
                    </div>

                    {/* Right: Diff button & Sync Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {item.hasDiff && hubSkill ? (
                        <>
                          <button
                            onClick={() => setActiveDiffSkill({ project: currentProject, ref: item, hubSkill })}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold flex items-center space-x-1 transition"
                          >
                            <ArrowLeftRight size={12} />
                            <span>查看版本差异 Diff</span>
                          </button>

                          <button
                            onClick={() => void onSyncProjectSkillToHub(currentProject.id, item.dirName, item.tool).then(() => onShowToast('同步成功', `已将项目中的定制 Prompt 推送回中央技能库`, 'success')).catch((error) => onShowToast('同步失败', String(error), 'error'))}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700 flex items-center space-x-1"
                            title="将项目中的特殊改动覆盖更新回中央库"
                          >
                            <Upload size={12} />
                            <span>推送到中央库</span>
                          </button>
                        </>
                      ) : !item.inLibrary ? (
                        <button
                          onClick={() => void onAdoptProjectSkill(currentProject.id, item.dirName, item.tool).then(() => onShowToast('收编成功', `${item.name} 已加入中央技能库`, 'success')).catch((error) => onShowToast('收编失败', String(error), 'error'))}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5"
                        >
                          <Download size={12} />
                          <span>收编到中央库</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-400 flex items-center px-2 py-1 bg-emerald-500/10 rounded">
                          <CheckCircle2 size={12} className="mr-1" />
                          已是最新版本
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Visual Diff Modal */}
      {activeDiffSkill && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <ArrowLeftRight size={15} className="text-indigo-400" />
                  <span>Prompt 版本差异对比: {activeDiffSkill.hubSkill.name}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  左侧为项目本地覆写文件 <code className="text-indigo-300 font-mono text-[10px]">({activeDiffSkill.project.name})</code>，右侧为中央技能库原始定义
                </p>
              </div>
              <button
                onClick={() => setActiveDiffSkill(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Side-by-side Diff Content */}
            <div className="grid grid-cols-2 gap-4 p-4 flex-1 overflow-y-auto">
              {/* Project Local Version */}
              <div className="bg-[#0d1117] p-3.5 rounded-xl border border-amber-500/30 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-amber-300 text-xs font-mono">项目本地定制版</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded font-mono">Local Custom</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{activeDiffSkill.project.name}</span>
                </div>
                <div className="mt-2 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto max-h-96">
                  {activeDiffSkill.ref.localContentMd}
                </div>
              </div>

              {/* Central Hub Version */}
              <div className="bg-[#0d1117] p-3.5 rounded-xl border border-indigo-500/30 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-indigo-300 text-xs font-mono">中央技能库标准版</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1 rounded font-mono">Hub Standard</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">~/.skills-manager/</span>
                </div>
                <div className="mt-2 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto max-h-96">
                  {activeDiffSkill.hubSkill.contentMd}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                差异说明: <strong className="text-amber-300 font-normal">{activeDiffSkill.ref.diffSummary}</strong>
              </span>

              <div className="flex items-center space-x-2">
                <button
                          onClick={() => void onPullHubSkillToProject(activeDiffSkill.project.id, activeDiffSkill.ref.dirName, activeDiffSkill.ref.tool).then(() => {
                            setActiveDiffSkill(null);
                            onShowToast('覆盖完成', '已从中央技能库拉取标准版本覆盖项目本地文件', 'info');
                          }).catch((error) => onShowToast('覆盖失败', String(error), 'error'))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700"
                >
                  从中央库拉取并覆盖项目
                </button>

                <button
                    onClick={() => void onSyncProjectSkillToHub(activeDiffSkill.project.id, activeDiffSkill.ref.dirName, activeDiffSkill.ref.tool).then(() => {
                      setActiveDiffSkill(null);
                      onShowToast('同步成功', '已将项目定制规则提升为中央技能库基准', 'success');
                    }).catch((error) => onShowToast('同步失败', String(error), 'error'))}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
                >
                  将项目定制提升至中央库
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
