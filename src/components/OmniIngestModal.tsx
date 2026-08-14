import React, { useEffect, useState } from 'react';
import {
  X,
  GitBranch,
  FolderOpen,
  Terminal,
  Plus,
  Sparkles,
  Check,
  AlertCircle,
  Layers,
  UploadCloud,
  FileCode,
  CheckSquare,
  Square
} from 'lucide-react';
import { Skill, EndpointType } from '../types';

interface OmniIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSkill: (skill: Partial<Skill>) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onImportRequest?: (source: string, reference: string) => Promise<void>;
  onScanTools?: () => Promise<Array<{ name: string; path: string; source: string; dirName: string; tool: string; selected?: boolean }>>;
  onAdoptToolSkill?: (dirName: string, tool: string) => Promise<void>;
  onCreateSkill?: (name: string, description: string, content: string) => Promise<void>;
}

export const OmniIngestModal: React.FC<OmniIngestModalProps> = ({
  isOpen,
  onClose,
  onAddSkill,
  onShowToast,
  onImportRequest,
  onScanTools,
  onAdoptToolSkill,
  onCreateSkill
}) => {
  const [tab, setTab] = useState<'git' | 'local' | 'skills_sh' | 'tools' | 'custom'>('git');

  // Git tab state
  const [gitUrl, setGitUrl] = useState('https://github.com/anthropics/agent-skills');
  const [isRecursive, setIsRecursive] = useState(true);
  const [isIngestingGit, setIsIngestingGit] = useState(false);
  const [localPath, setLocalPath] = useState('');
  const [skillsShRef, setSkillsShRef] = useState('');

  // Tools tab state
  const [discoveredToolSkills, setDiscoveredToolSkills] = useState([
    { name: 'quick-docker-run', path: '~/.claude/skills/quick-docker-run', source: 'Claude CLI', dirName: 'quick-docker-run', tool: 'claude_code', selected: true },
    { name: 'fast-pr-template', path: '~/.codex/skills/fast-pr-template', source: 'Codex CLI', dirName: 'fast-pr-template', tool: 'codex', selected: true },
    { name: 'npm-audit-fix', path: '~/.config/opencode/skills/npm-audit-fix', source: 'OpenCode', dirName: 'npm-audit-fix', tool: 'opencode', selected: false }
  ]);

  // Custom skill creator state
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCategory, setCustomCategory] = useState<'git' | 'frontend' | 'backend' | 'testing' | 'devops' | 'database'>('frontend');
  const [customContent, setCustomContent] = useState(`# My Custom Agent Skill\n\n## Purpose\nDescribe what this agent skill does and under what prompt triggers it executes.\n\n## Instructions\n1. Check repository state.\n2. Output structured recommendations.\n`);

  useEffect(() => {
    if (tab !== 'tools' || !onScanTools) return;
    onScanTools()
      .then((items) => setDiscoveredToolSkills(items.map((item) => ({ ...item, selected: item.selected ?? true }))))
      .catch((error) => onShowToast('扫描本机技能失败', String(error), 'error'));
  }, [onScanTools, onShowToast, tab]);

  const handleGitIngest = async () => {
    if (!gitUrl.trim()) return;
    if (onImportRequest) {
      setIsIngestingGit(true);
      try {
        await onImportRequest("git", gitUrl.trim());
        onClose();
      } catch {
        // The parent presents the actual backend error.
      } finally {
        setIsIngestingGit(false);
      }
      return;
    }
    setIsIngestingGit(true);
    setTimeout(() => {
      setIsIngestingGit(false);
      const newSkillName = gitUrl.split('/').pop()?.replace('.git', '') || 'imported-skill';
      const newSkill: Partial<Skill> = {
        id: `skill-${Date.now()}`,
        name: newSkillName,
        slug: newSkillName,
        description: `从 Git 仓库 ${gitUrl} 成功导入的 Agent 技能包`,
        version: '1.0.0',
        author: 'git-import',
        repoUrl: gitUrl,
        localPath: `~/.skills-manager/skills/${newSkillName}/SKILL.md`,
        isDerived: true,
        derivedPackageName: gitUrl.split('/').slice(-2).join('/'),
        tags: ['imported', 'git', 'custom'],
        category: 'backend',
        endpoints: { claude: true, codex: true, opencode: false },
        endpointsStatus: { claude: 'synced', codex: 'synced', opencode: 'unsynced' },
        callStats: {
          totalCalls: 0,
          callsByEndpoint: { claude: 0, codex: 0, opencode: 0 },
          lastUsedDate: '刚刚导入',
          trend: [0, 0, 0, 0, 0, 0, 0]
        },
        isWhitelisted: false,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        contentMd: `# ${newSkillName}\n\nImported from ${gitUrl}\n\n## Execution Details\nStandard SKILL.md definition.\n`
      };
      onAddSkill(newSkill);
      onShowToast('导入成功', `已从 Git 仓库收编技能 ${newSkillName} 并映射至中央库`, 'success');
      onClose();
    }, 900);
  };

  const handleCreateCustom = async () => {
    if (!customName.trim()) {
      onShowToast('请输入技能名称', '技能名称为必填项 (如: git-commit-helper)', 'warning');
      return;
    }
    if (!onCreateSkill) {
      onShowToast('无法创建技能', '未连接技能创建命令。', 'error');
      return;
    }
    try {
      await onCreateSkill(customName.trim(), customDesc.trim(), customContent);
      onShowToast('创建成功', `${customName.trim()} 已写入中央技能库`, 'success');
      onClose();
    } catch (error) {
      onShowToast('创建失败', String(error), 'error');
    }
  };

  const handleIngestFromTools = async () => {
    const selected = discoveredToolSkills.filter(s => s.selected);
    if (selected.length === 0) return;

    if (onAdoptToolSkill) {
      try {
        await Promise.all(selected.map((item) => onAdoptToolSkill(item.dirName, item.tool)));
        onShowToast('收编完成', `已将 ${selected.length} 个本机技能复制到中央库`, 'success');
        onClose();
      } catch (error) {
        onShowToast('收编失败', String(error), 'error');
      }
      return;
    }
    onShowToast('无法收编本机技能', '未连接本机技能扫描接口。', 'error');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
              +
            </div>
            <h3 className="text-sm font-bold text-slate-100">导入与新建技能 (Omni Ingest)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 text-xs font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => setTab('git')}
            className={`py-3 px-3 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              tab === 'git'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <GitBranch size={13} />
            <span>Git 仓库 / URL</span>
          </button>
          <button
            onClick={() => setTab('local')}
            className={`py-3 px-3 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              tab === 'local'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <FolderOpen size={13} />
            <span>本地文件夹</span>
          </button>
          <button
            onClick={() => setTab('skills_sh')}
            className={`py-3 px-3 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              tab === 'skills_sh'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Terminal size={13} />
            <span>skills.sh 引用</span>
          </button>
          <button
            onClick={() => setTab('tools')}
            className={`py-3 px-3 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              tab === 'tools'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Layers size={13} />
            <span>从已装 CLI 收编</span>
          </button>
          <button
            onClick={() => setTab('custom')}
            className={`py-3 px-3 border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap ${
              tab === 'custom'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            <Plus size={13} />
            <span>新建空白技能</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 flex-1 overflow-y-auto text-xs space-y-4">
          {/* TAB 1: Git Repo */}
          {tab === 'git' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Git 仓库地址 (HTTPS / SSH):</label>
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/anthropics/agent-skills"
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  id="recursive-scan"
                  checked={isRecursive}
                  onChange={(e) => setIsRecursive(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 cursor-pointer"
                />
                <label htmlFor="recursive-scan" className="text-slate-300 cursor-pointer">
                  自动递归扫描子目录中所有的 <code className="text-indigo-400 font-mono text-[11px]">SKILL.md</code> 并作为独立技能入库
                </label>
              </div>

              <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-indigo-300 text-[11px] leading-relaxed">
                SkillCurator 将自动克隆或拉取仓库最新快照至 <code className="font-mono text-slate-200">~/.skills-manager/skills/</code>，并保留派生包上游版本追踪。
              </div>
            </div>
          )}

          {/* TAB 2: Local Directory */}
          {tab === 'local' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">本地技能目录路径:</label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="例如：D:\\skills\\my-skill"
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-8 text-center bg-[#0d1117] cursor-pointer transition">
                <UploadCloud className="mx-auto text-indigo-400 mb-2" size={32} />
                <h4 className="text-sm font-semibold text-slate-200">拖拽本地技能文件夹至此处</h4>
                <p className="text-slate-500 text-xs mt-1">
                  或点击选择本机文件夹，自动识别包含 SKILL.md 的单技能或多技能集合
                </p>
                <button
                  onClick={() => {
                    setCustomName('local-dev-tools');
                    setTab('custom');
                  }}
                  className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  浏览本地文件系统
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: skills.sh */}
          {tab === 'skills_sh' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">粘贴 skills.sh 命令或包名:</label>
                <input
                  type="text"
                  value={skillsShRef}
                  onChange={(e) => setSkillsShRef(e.target.value)}
                  placeholder="npx skills add vercel/nextjs-skills"
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <p className="text-slate-500 text-[11px]">
                兼容 skills.sh 生态包标识符，自动解析并拉取对应的 Markdown 规范与工具描述。
              </p>
            </div>
          )}

          {/* TAB 4: Ingest from Tools */}
          {tab === 'tools' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                已扫描到本机 Claude CLI / Codex / OpenCode 中尚未纳入中央库的孤立技能，勾选后一键收编：
              </p>

              <div className="divide-y divide-slate-800 bg-[#0d1117] border border-slate-800 rounded-xl">
                {discoveredToolSkills.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => {
                          const next = [...discoveredToolSkills];
                          next[idx].selected = !next[idx].selected;
                          setDiscoveredToolSkills(next);
                        }}
                      >
                        {item.selected ? <CheckSquare size={14} className="text-indigo-400" /> : <Square size={14} className="text-slate-500" />}
                      </button>
                      <div>
                        <span className="font-semibold text-slate-200 font-mono">{item.name}</span>
                        <p className="text-[10px] text-slate-500 font-mono">{item.path}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      来源: {item.source}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Custom Skill */}
          {tab === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">技能名称 (Name):</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="如: git-commit-helper"
                    className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">工程领域分类:</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as any)}
                    className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="frontend">前端开发 (Frontend)</option>
                    <option value="backend">后端服务 (Backend)</option>
                    <option value="git">Git / 版本控制</option>
                    <option value="testing">测试工程 (Testing)</option>
                    <option value="devops">DevOps / 部署</option>
                    <option value="database">数据库 (Database)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">简要描述:</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="简述该技能的功能与执行契约..."
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">SKILL.md 初始 Prompt 内容:</label>
                <textarea
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  rows={6}
                  className="w-full bg-[#0d1117] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
          >
            取消
          </button>

          {tab === 'git' && (
            <button
              onClick={handleGitIngest}
              disabled={isIngestingGit}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5"
            >
              <Sparkles size={12} />
              <span>{isIngestingGit ? '正在克隆并解析...' : '立即导入并入库'}</span>
            </button>
          )}

          {tab === 'local' && (
            <button
              onClick={async () => {
                if (!onImportRequest) return;
                try { await onImportRequest('local', localPath.trim()); onClose(); } catch { /* parent reports */ }
              }}
              disabled={!localPath.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
            >
              导入本地目录
            </button>
          )}

          {tab === 'skills_sh' && (
            <button
              onClick={async () => {
                if (!onImportRequest) return;
                try { await onImportRequest('skillssh', skillsShRef.trim()); onClose(); } catch { /* parent reports */ }
              }}
              disabled={!skillsShRef.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
            >
              导入 skills.sh 引用
            </button>
          )}

          {tab === 'tools' && (
            <button
              onClick={handleIngestFromTools}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
            >
              一键收编入库
            </button>
          )}

          {tab === 'custom' && (
            <button
              onClick={handleCreateCustom}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold"
            >
              保存并创建技能
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
