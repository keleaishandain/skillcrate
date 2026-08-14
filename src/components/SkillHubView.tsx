import React, { useState, useMemo } from 'react';
import {
  FolderGit2,
  Search,
  ExternalLink,
  Check,
  AlertTriangle,
  Clock,
  Layers,
  Share2,
  Trash2,
  Pin,
  FileCode2,
  Sparkles,
  ArrowUpDown,
  CheckSquare,
  Square,
  Plus,
  Download,
  Cpu,
  CheckCircle2,
  X,
  LayoutGrid,
  List as ListIcon,
  FolderOpen,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Skill, EndpointType } from '../types';
import { groupPackages, type SkillPackage } from '../lib/packages';

interface SkillHubViewProps {
  skills: Skill[];
  selectedSkillId: string | null;
  onSelectSkill: (skill: Skill) => void;
  onToggleEndpoint: (skillId: string, endpoint: EndpointType) => void;
  onToggleWhitelist: (skillId: string) => void;
  onQuarantineSkill: (skillId: string) => void;
  onBatchSync: (skillIds: string[], endpoint: EndpointType) => void;
  onBatchSetEndpoint: (skillIds: string[], endpoint: EndpointType, enabled: boolean) => void;
  onBatchQuarantine: (skillIds: string[]) => void;
  onBatchWhitelist: (skillIds: string[]) => void;
  onNavigateToCuration: (groupId?: string) => void;
  onOpenImportModal: () => void;
  onLaunchEditor: (skill: Skill, app: 'vscode' | 'explorer') => void;
}

export const SkillHubView: React.FC<SkillHubViewProps> = ({
  skills,
  selectedSkillId,
  onSelectSkill,
  onToggleEndpoint,
  onToggleWhitelist,
  onQuarantineSkill,
  onBatchSync,
  onBatchSetEndpoint,
  onBatchQuarantine,
  onBatchWhitelist,
  onNavigateToCuration,
  onOpenImportModal,
  onLaunchEditor
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'overlap' | 'derived' | 'whitelisted'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [groupByPackage, setGroupByPackage] = useState(() => {
    try {
      return localStorage.getItem('skill-curator:group-by-package') !== 'false';
    } catch {
      return true;
    }
  });
  const [collapsedPackages, setCollapsedPackages] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('skill-curator:collapsed-packages') ?? '[]');
      return new Set(Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : []);
    } catch {
      return new Set();
    }
  });

  // Stats calculation
  const totalSkills = skills.length;
  const claudeSyncedCount = skills.filter(s => s.endpoints.claude).length;
  const codexSyncedCount = skills.filter(s => s.endpoints.codex).length;
  const opencodeSyncedCount = skills.filter(s => s.endpoints.opencode).length;
  const overlapRiskCount = skills.filter(s => !!s.overlapGroupId).length;
  const derivedCount = skills.filter(s => s.isDerived).length;

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter(skill => {
      // Search
      const matchesSearch =
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (skill.derivedPackageName && skill.derivedPackageName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'synced' && !(skill.endpoints.claude || skill.endpoints.codex || skill.endpoints.opencode)) {
        return false;
      }
      if (statusFilter === 'overlap' && !skill.overlapGroupId) {
        return false;
      }
      if (statusFilter === 'derived' && !skill.isDerived) {
        return false;
      }
      if (statusFilter === 'whitelisted' && !skill.isWhitelisted) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && skill.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [skills, searchQuery, statusFilter, categoryFilter]);

  const { packages, independent } = useMemo(() => groupPackages(filteredSkills), [filteredSkills]);
  const displayedSkills = useMemo(
    () => groupByPackage ? [...packages.flatMap((pkg) => pkg.skills), ...independent] : filteredSkills,
    [filteredSkills, groupByPackage, independent, packages],
  );
  const packageStarts = useMemo(() => {
    const starts = new Map<string, SkillPackage>();
    for (const pkg of packages) {
      const first = pkg.skills[0];
      if (first) starts.set(first.id, pkg);
    }
    return starts;
  }, [packages]);
  const packageBySkill = useMemo(() => {
    const owners = new Map<string, SkillPackage>();
    for (const pkg of packages) {
      for (const skill of pkg.skills) owners.set(skill.id, pkg);
    }
    return owners;
  }, [packages]);
  const firstIndependentId = groupByPackage && packages.length > 0 ? independent[0]?.id : undefined;

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSkills.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSkills.map(s => s.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleGroupByPackage = () => {
    setGroupByPackage((current) => {
      const next = !current;
      try {
        localStorage.setItem('skill-curator:group-by-package', String(next));
      } catch {
        // Preference persistence is optional; the view remains usable when storage is unavailable.
      }
      return next;
    });
  };

  const togglePackageCollapsed = (key: string) => {
    setCollapsedPackages((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('skill-curator:collapsed-packages', JSON.stringify(Array.from(next)));
      } catch {
        // Preference persistence is optional; the view remains usable when storage is unavailable.
      }
      return next;
    });
  };

  const togglePackageSelection = (pkg: SkillPackage) => {
    const packageIds = pkg.skills.map((skill) => skill.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = packageIds.length > 0 && packageIds.every((id) => next.has(id));
      for (const id of packageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const packageHeader = (pkg: SkillPackage, gridClass = '') => {
    const collapsed = collapsedPackages.has(pkg.key);
    const activeSkills = pkg.skills.filter((skill) => !skill.isolated);
    const selectedCount = pkg.skills.filter((skill) => selectedIds.has(skill.id)).length;

    return (
      <div key={`package-${pkg.key}`} className={`${gridClass} flex items-center gap-2 border-y border-slate-800/80 bg-slate-900/70 px-3 py-2.5 text-xs`}>
        <button
          type="button"
          onClick={() => togglePackageCollapsed(pkg.key)}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          title={collapsed ? '展开技能包' : '折叠技能包'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <button
          type="button"
          onClick={() => togglePackageSelection(pkg)}
          className="text-slate-400 hover:text-slate-200"
          title="选择整包"
        >
          {selectedCount === pkg.skills.length ? <CheckSquare size={15} className="text-indigo-400" /> : <Square size={15} />}
        </button>
        <Layers size={15} className="shrink-0 text-indigo-400" />
        <span className="min-w-0 flex-1 truncate font-semibold text-slate-200">{pkg.label}</span>
        <span className="shrink-0 text-[11px] text-slate-500">{pkg.skills.length} 个技能</span>
        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {(['claude', 'codex', 'opencode'] as EndpointType[]).map((endpoint) => {
            const allEnabled = activeSkills.length > 0 && activeSkills.every((skill) => skill.endpoints[endpoint]);
            const label = endpoint === 'claude' ? 'Claude' : endpoint === 'codex' ? 'Codex' : 'OpenCode';
            return (
              <button
                key={endpoint}
                type="button"
                disabled={activeSkills.length === 0}
                onClick={() => onBatchSetEndpoint(activeSkills.map((skill) => skill.id), endpoint, !allEnabled)}
                className={`rounded border px-2 py-1 text-[10px] font-medium transition ${
                  allEnabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={allEnabled ? `从 ${label} 停用整包` : `启用整包到 ${label}`}
              >
                {label}：{allEnabled ? '全部停用' : '全部启用'}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d1117]">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top Header & Intro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
              <span>中央技能库</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                {totalSkills} 个技能
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              本地托管于 <code className="text-indigo-400 font-mono text-[11px]">~/.skills-manager/skills/</code>，自动映射并同步至多端 AI Agent CLI
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
            >
              <Plus size={14} />
              <span>快速导入技能</span>
            </button>
          </div>
        </div>

        {/* 1. Statistics Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Total Skills */}
          <div className="p-3.5 rounded-lg bg-[#161b22] border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">总技能库</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5 font-mono">{totalSkills}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">覆盖 8 大工程领域</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FolderGit2 size={18} />
            </div>
          </div>

          {/* Endpoint Sync Distribution */}
          <div className="p-3.5 rounded-lg bg-[#161b22] border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">已同步端点</p>
              <div className="flex items-center space-x-2 mt-1 text-xs font-mono">
                <span className="text-emerald-400" title="Claude Code">{claudeSyncedCount} <span className="text-[10px] text-slate-500">CL</span></span>
                <span className="text-slate-600">/</span>
                <span className="text-sky-400" title="Codex CLI">{codexSyncedCount} <span className="text-[10px] text-slate-500">CX</span></span>
                <span className="text-slate-600">/</span>
                <span className="text-amber-400" title="OpenCode">{opencodeSyncedCount} <span className="text-[10px] text-slate-500">OP</span></span>
              </div>
              <p className="text-[10px] text-emerald-400/90 mt-0.5 flex items-center">
                <CheckCircle2 size={10} className="mr-1" />
                就绪率 92%
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Layers size={18} />
            </div>
          </div>

          {/* Overlap Risk Group */}
          <div
            onClick={() => onNavigateToCuration()}
            className="p-3.5 rounded-lg bg-[#161b22] hover:bg-[#1c2128] border border-amber-500/30 shadow-sm flex items-center justify-between cursor-pointer transition group"
          >
            <div>
              <p className="text-[11px] text-amber-300 font-medium">重叠冗余预警</p>
              <h3 className="text-xl font-bold text-amber-400 mt-0.5 font-mono">{overlapRiskCount} <span className="text-xs font-normal text-slate-400">个技能</span></h3>
              <p className="text-[10px] text-amber-400/80 mt-0.5 group-hover:underline">点击进入 AI 策展中心 →</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle size={18} />
            </div>
          </div>

          {/* Derived Packages */}
          <div className="p-3.5 rounded-lg bg-[#161b22] border border-slate-800/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400">派生聚合包</p>
              <h3 className="text-xl font-bold text-slate-100 mt-0.5 font-mono">{derivedCount}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">含 anthropics/skills 等</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Sparkles size={18} />
            </div>
          </div>
        </div>

        {/* 2. Filter & Toolbar Section */}
        <div className="space-y-3 bg-[#161b22]/70 p-3.5 rounded-xl border border-slate-800/80">
          {/* Top Filter Row: Search & Status Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 text-slate-500" size={13} />
              <input
                type="text"
                placeholder="搜索技能名称、描述、派生来源、标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-800 focus:border-indigo-500 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1 md:pb-0">
              <FilterTabButton
                label="全部"
                count={skills.length}
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />
              <FilterTabButton
                label="已同步端点"
                count={skills.filter(s => s.endpoints.claude || s.endpoints.codex).length}
                active={statusFilter === 'synced'}
                onClick={() => setStatusFilter('synced')}
              />
              <FilterTabButton
                label="重叠风险"
                count={overlapRiskCount}
                active={statusFilter === 'overlap'}
                badgeColor="warning"
                onClick={() => setStatusFilter('overlap')}
              />
              <FilterTabButton
                label="派生包"
                count={derivedCount}
                active={statusFilter === 'derived'}
                onClick={() => setStatusFilter('derived')}
              />
              <FilterTabButton
                label="白名单豁免"
                count={skills.filter(s => s.isWhitelisted).length}
                active={statusFilter === 'whitelisted'}
                onClick={() => setStatusFilter('whitelisted')}
              />

              {/* View Toggle */}
              <div className="border-l border-slate-800 pl-2 flex items-center space-x-1">
                <button
                  onClick={toggleGroupByPackage}
                  className={`px-2 py-1 rounded text-[10px] font-medium ${groupByPackage ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}
                  title={groupByPackage ? '切换为平铺视图' : '按安装来源分组'}
                >
                  {groupByPackage ? '按包分组' : '平铺'}
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title="列表视图"
                >
                  <ListIcon size={14} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                  title="卡片网格"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Filter Row: Category Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] pt-1">
            <span className="text-slate-500 text-[10px] uppercase font-semibold mr-1">分类:</span>
            {['all', 'git', 'frontend', 'backend', 'testing', 'devops', 'security', 'database'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? '全部领域' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Skill List / Grid View */}
        {filteredSkills.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] rounded-xl border border-slate-800/80 p-8">
            <FolderGit2 className="mx-auto text-slate-600 mb-3" size={36} />
            <h4 className="text-sm font-medium text-slate-300">未找到匹配的技能</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              尝试清除筛选条件，或使用上方“+ 导入新技能”按钮将外部 Git 仓库、本地文件夹收编入库。
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCategoryFilter('all'); }}
              className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded border border-slate-700 transition"
            >
              重置所有筛选
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW */
          <div className="bg-[#161b22] border border-slate-800/90 rounded-xl overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 select-none">
              <div className="col-span-4 flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-slate-400 hover:text-slate-200 transition"
                >
                  {selectedIds.size > 0 && selectedIds.size === filteredSkills.length ? (
                    <CheckSquare size={14} className="text-indigo-400" />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
                <span>技能名称 & 派生归属</span>
              </div>
              <div className="col-span-3">目标同步端点 (CLAUDE / CODEX / OPENCODE)</div>
              <div className="col-span-2 text-center">90天调用活跃度</div>
              <div className="col-span-2">状态 / 策展预警</div>
              <div className="col-span-1 text-right">快捷操作</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-800/60">
              {displayedSkills.map((skill) => {
                const isSelected = selectedIds.has(skill.id);
                const isActiveInDrawer = selectedSkillId === skill.id;
                const pkg = groupByPackage ? packageBySkill.get(skill.id) : undefined;
                const packageStart = groupByPackage ? packageStarts.get(skill.id) : undefined;
                const isCollapsed = pkg ? collapsedPackages.has(pkg.key) : false;

                return (
                  <React.Fragment key={skill.id}>
                    {packageStart && packageHeader(packageStart)}
                    {firstIndependentId === skill.id && (
                      <div className="border-y border-slate-800/80 bg-slate-900/50 px-4 py-2 text-[11px] font-medium text-slate-500">
                        独立技能（{independent.length}）
                      </div>
                    )}
                    {!isCollapsed && <div
                    key={skill.id}
                    onClick={() => onSelectSkill(skill)}
                    className={`grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs transition cursor-pointer group ${
                      isActiveInDrawer
                        ? 'bg-indigo-950/25 border-l-2 border-l-indigo-500'
                        : isSelected
                        ? 'bg-slate-800/40'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Col 1: Select & Name */}
                    <div className="col-span-4 flex items-start space-x-2.5 min-w-0">
                      <button
                        onClick={(e) => handleToggleSelect(skill.id, e)}
                        className="mt-0.5 text-slate-500 hover:text-slate-300 transition"
                      >
                        {isSelected ? (
                          <CheckSquare size={14} className="text-indigo-400" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-100 group-hover:text-indigo-300 transition truncate">
                            {skill.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">v{skill.version}</span>
                          {skill.isWhitelisted && (
                            <span title="白名单豁免 (永不建议隔离)" className="text-amber-400">
                              <Pin size={10} className="fill-amber-400" />
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {skill.description}
                        </p>

                        <div className="flex items-center space-x-2 mt-1">
                          {skill.isDerived && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              📦 {skill.derivedPackageName}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            #{skill.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Endpoint Sync Toggles */}
                    <div className="col-span-3 flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      {/* Claude Code Toggle */}
                      <EndpointTogglePill
                        label="Claude"
                        enabled={skill.endpoints.claude}
                        onClick={() => onToggleEndpoint(skill.id, 'claude')}
                      />
                      {/* Codex Toggle */}
                      <EndpointTogglePill
                        label="Codex"
                        enabled={skill.endpoints.codex}
                        onClick={() => onToggleEndpoint(skill.id, 'codex')}
                      />
                      {/* OpenCode Toggle */}
                      <EndpointTogglePill
                        label="OpenCode"
                        enabled={skill.endpoints.opencode}
                        onClick={() => onToggleEndpoint(skill.id, 'opencode')}
                      />
                    </div>

                    {/* Col 3: 90-Day Calls */}
                    <div className="col-span-2 text-center">
                      <div className="text-xs font-mono font-medium text-slate-200">
                        {skill.callStats.totalCalls} <span className="text-[10px] text-slate-500">次</span>
                      </div>
                      <div className="flex items-center justify-center space-x-0.5 mt-1">
                        {skill.callStats.trend.map((val, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${Math.max(3, Math.min(14, val * 1.5))}px` }}
                            className={`w-1 rounded-t-sm ${
                              val > 10 ? 'bg-indigo-400' : val > 0 ? 'bg-slate-600' : 'bg-slate-800'
                            }`}
                            title={`周度调用: ${val}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Col 4: Status & Overlap Alert */}
                    <div className="col-span-2">
                      {skill.overlapGroupId ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToCuration(skill.overlapGroupId);
                          }}
                          className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-medium flex items-center space-x-1 transition"
                        >
                          <AlertTriangle size={11} />
                          <span>重叠风险 (组 #1)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 flex items-center">
                          <CheckCircle2 size={12} className="text-emerald-400 mr-1" />
                          已纳管正常
                        </span>
                      )}
                    </div>

                    {/* Col 5: Actions */}
                    <div className="col-span-1 flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onLaunchEditor(skill, 'vscode')}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                        title="在 VSCode 中编辑"
                      >
                        <FileCode2 size={13} />
                      </button>
                      <button
                        onClick={() => onLaunchEditor(skill, 'explorer')}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                        title="在文件资源管理器中打开"
                      >
                        <FolderOpen size={13} />
                      </button>
                    </div>
                    </div>}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedSkills.map((skill) => {
              const isSelected = selectedIds.has(skill.id);
              const isActiveInDrawer = selectedSkillId === skill.id;
              const pkg = groupByPackage ? packageBySkill.get(skill.id) : undefined;
              const packageStart = groupByPackage ? packageStarts.get(skill.id) : undefined;
              const isCollapsed = pkg ? collapsedPackages.has(pkg.key) : false;

              return (
                <React.Fragment key={skill.id}>
                  {packageStart && packageHeader(packageStart, 'md:col-span-2 lg:col-span-3')}
                  {firstIndependentId === skill.id && (
                    <div className="md:col-span-2 lg:col-span-3 border-y border-slate-800/80 bg-slate-900/50 px-4 py-2 text-[11px] font-medium text-slate-500">
                      独立技能（{independent.length}）
                    </div>
                  )}
                  {!isCollapsed && <div
                  key={skill.id}
                  onClick={() => onSelectSkill(skill)}
                  className={`p-4 rounded-xl bg-[#161b22] border transition flex flex-col justify-between cursor-pointer space-y-3 ${
                    isActiveInDrawer
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30 bg-indigo-950/20'
                      : isSelected
                      ? 'border-indigo-500/50 bg-slate-800/40'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-[#1c2128]'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => handleToggleSelect(skill.id, e)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {isSelected ? <CheckSquare size={14} className="text-indigo-400" /> : <Square size={14} />}
                        </button>
                        <h3 className="font-semibold text-slate-100 text-sm">{skill.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                        v{skill.version}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {skill.description}
                    </p>

                    {skill.overlapGroupId && (
                      <div className="mt-2.5">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-medium flex items-center w-max">
                          <AlertTriangle size={10} className="mr-1" />
                          职责重叠组 #1 (AI 策展预警)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex space-x-1.5">
                      <EndpointTogglePill
                        label="CL"
                        enabled={skill.endpoints.claude}
                        onClick={() => onToggleEndpoint(skill.id, 'claude')}
                      />
                      <EndpointTogglePill
                        label="CX"
                        enabled={skill.endpoints.codex}
                        onClick={() => onToggleEndpoint(skill.id, 'codex')}
                      />
                      <EndpointTogglePill
                        label="OP"
                        enabled={skill.endpoints.opencode}
                        onClick={() => onToggleEndpoint(skill.id, 'opencode')}
                      />
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      90天: <span className="text-slate-200 font-medium">{skill.callStats.totalCalls}次</span>
                    </div>
                  </div>
                  </div>}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Batch Action Bar (Floating at Bottom) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 bg-[#161b22]/95 border border-indigo-500/40 backdrop-blur-md px-5 py-3 rounded-xl shadow-2xl shadow-black/80 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center space-x-2 border-r border-slate-700 pr-3 text-xs">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-slate-200 font-medium">已选中 {selectedIds.size} 个技能</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={() => onBatchSync(Array.from(selectedIds), 'claude')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition"
            >
              同步至 Claude
            </button>
            <button
              onClick={() => onBatchSync(Array.from(selectedIds), 'codex')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 font-medium transition"
            >
              同步至 Codex
            </button>
            <button
              onClick={() => onBatchWhitelist(Array.from(selectedIds))}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 font-medium transition flex items-center space-x-1"
            >
              <Pin size={11} />
              <span>设为永久白名单</span>
            </button>
            <button
              onClick={() => onBatchQuarantine(Array.from(selectedIds))}
              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded border border-rose-500/30 font-medium transition flex items-center space-x-1"
            >
              <Trash2 size={11} />
              <span>移入安全隔离仓</span>
            </button>
          </div>

          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition"
            title="取消选择"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

interface FilterTabButtonProps {
  label: string;
  count: number;
  active: boolean;
  badgeColor?: 'default' | 'warning';
  onClick: () => void;
}

const FilterTabButton: React.FC<FilterTabButtonProps> = ({
  label,
  count,
  active,
  badgeColor = 'default',
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md font-medium text-xs transition flex items-center space-x-1.5 ${
        active
          ? 'bg-slate-800 text-slate-100 border border-slate-700'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
          badgeColor === 'warning'
            ? 'bg-amber-500/20 text-amber-400'
            : active
            ? 'bg-indigo-600/30 text-indigo-300'
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        {count}
      </span>
    </button>
  );
};

interface EndpointTogglePillProps {
  label: string;
  enabled: boolean;
  onClick: () => void;
}

const EndpointTogglePill: React.FC<EndpointTogglePillProps> = ({
  label,
  enabled,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition flex items-center space-x-1 ${
        enabled
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-slate-800/60 text-slate-500 border-slate-700/60 hover:bg-slate-800 hover:text-slate-400'
      }`}
      title={enabled ? `点击取消向 ${label} 同步` : `点击启用向 ${label} 同步`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <span>{label}</span>
    </button>
  );
};
