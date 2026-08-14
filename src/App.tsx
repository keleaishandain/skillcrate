import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import "./index.css";
import type {
  ActiveTab,
  AuditEntry,
  AppSettings,
  BatchResult,
  CommunitySkill,
  CurationReport,
  EndpointType,
  EnvironmentHealth,
  GitStatus,
  GroupBadges,
  IsolationEntry,
  NotificationToast,
  OverlapGroup,
  ProjectInfo,
  ProjectWorkspace,
  ProjectSkillRef,
  RepoStatus,
  Preset,
  PresetPlan,
  Skill,
  ToolWorkspaceStatus,
  TrendingView,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { TopHeader } from "./components/TopHeader";
import { SkillHubView } from "./components/SkillHubView";
import { SkillDetailDrawer } from "./components/SkillDetailDrawer";
import { AiCurationView } from "./components/AiCurationView";
import { QuarantineView } from "./components/QuarantineView";
import { ProjectWorkspaceView } from "./components/ProjectWorkspaceView";
import { DiscoverView } from "./components/DiscoverView";
import { OmniIngestModal } from "./components/OmniIngestModal";
import { CommandPalette } from "./components/CommandPalette";
import { EnvironmentHealthModal } from "./components/EnvironmentHealthModal";
import { McpConfigModal } from "./components/McpConfigModal";
import { SettingsModal } from "./components/SettingsModal";
import { ToastContainer } from "./components/Toast";
import { DashboardView } from "./components/DashboardView";
import { PresetView } from "./components/PresetView";
import { AgentWorkspaceView } from "./components/AgentWorkspaceView";
import { BackupView } from "./components/BackupView";

const endpointToTool: Record<EndpointType, string> = {
  claude: "claude_code",
  codex: "codex",
  opencode: "opencode",
};

function sourceAuthor(sourceRef: string | null): string {
  if (!sourceRef) return "本地技能";
  const normalized = sourceRef.replace(/\\/g, "/").replace(/\.git$/, "");
  return normalized.split("/").slice(-2).join("/") || normalized;
}

function categoryFor(description: string, sourceType: string | null): string {
  const text = `${description} ${sourceType ?? ""}`.toLowerCase();
  if (text.includes("test") || text.includes("测试")) return "testing";
  if (text.includes("security") || text.includes("安全")) return "security";
  if (text.includes("database") || text.includes("sql") || text.includes("数据库")) return "database";
  if (text.includes("frontend") || text.includes("react") || text.includes("前端")) return "frontend";
  if (text.includes("git") || text.includes("commit")) return "git";
  if (text.includes("deploy") || text.includes("docker") || text.includes("devops")) return "devops";
  return "backend";
}

function mapSkill(raw: any, repoPath: string, usage?: Map<string, { count: number; last: number | null; share: number }>): Skill {
  const endpoints: Record<EndpointType, boolean> = {
    claude: raw.enabled_tools?.includes("claude_code") ?? false,
    codex: raw.enabled_tools?.includes("codex") ?? false,
    opencode: raw.enabled_tools?.includes("opencode") ?? false,
  };
  const stat = usage?.get(raw.dir_name);
  return {
    id: `skill-${raw.dir_name}`,
    dir_name: raw.dir_name,
    name: raw.name,
    slug: raw.dir_name,
    description: raw.description || "未提供技能描述",
    source_type: raw.source_type ?? null,
    source_ref: raw.source_ref ?? null,
    enabled_tools: raw.enabled_tools ?? [],
    isolated: Boolean(raw.isolated),
    version: "本地",
    author: sourceAuthor(raw.source_ref ?? null),
    repoUrl: raw.source_type === "git" ? raw.source_ref ?? undefined : undefined,
    localPath: `${repoPath}\\skills\\${raw.dir_name}\\SKILL.md`,
    isDerived: raw.source_type === "git" || raw.source_type === "skillssh",
    derivedPackageName: sourceAuthor(raw.source_ref ?? null),
    tags: Array.from(new Set([...(raw.tags ?? []), raw.source_type ?? "local", categoryFor(raw.description ?? "", raw.source_type)])),
    userTags: raw.tags ?? [],
    category: categoryFor(raw.description ?? "", raw.source_type),
    endpoints,
    endpointsStatus: {
      claude: endpoints.claude ? "synced" : "unsynced",
      codex: endpoints.codex ? "synced" : "unsynced",
      opencode: endpoints.opencode ? "synced" : "unsynced",
    },
    callStats: {
      totalCalls: stat?.count ?? 0,
      callsByEndpoint: { claude: 0, codex: 0, opencode: 0 },
      lastUsedDate: stat?.last == null ? "暂无记录" : `${stat.last} 天前`,
      trend: [0, 0, 0, 0, 0, 0, stat?.count ?? 0],
    },
    contentMd: raw.content_md || `# ${raw.name}\n\n${raw.description || "暂无 SKILL.md 内容"}\n`,
    isWhitelisted: Boolean(raw.is_whitelisted),
    createdAt: "未知",
    updatedAt: "未知",
  };
}

function toOverlapGroups(report: CurationReport | null): OverlapGroup[] {
  if (!report) return [];
  return report.groups.map((group, index) => ({
    id: `overlap-${index + 1}`,
    groupNumber: index + 1,
    title: group.keywords.length ? group.keywords.join(" / ") : `职责重叠组 ${index + 1}`,
    description: `共享关键词：${group.keywords.join("、") || "未提取"}`,
    confidenceScore: Math.round(Math.min(1, Math.max(0, report.threshold + 0.4)) * 100),
    tfidfScore: report.threshold,
    claudeReviewConfirmed: report.judge_note.includes("语义复核"),
    totalCalls: group.total_calls_90d,
    skills: group.members.map((member) => ({
      skillId: `skill-${member.dir_name}`,
      callCount: member.count_90d,
      callRatio: member.share * 100,
      status: member.verdict === "suggest" ? "quarantine_suggested" : member.verdict === "keep" ? "core" : member.verdict === "observing" ? "observe" : "observe",
      reason: member.last_used_days == null ? "近 90 天没有可识别调用记录" : `最近 ${member.last_used_days} 天前调用`,
    })),
    similarityAnalysis: {
      sharedKeywords: group.keywords,
      promptOverlapPercent: Math.round(report.threshold * 100),
      recommendedAction: "请结合调用份额和技能详情确认处置",
      detailedReason: report.judge_note,
    },
  }));
}

function toProjectWorkspaces(projects: ProjectInfo[]): ProjectWorkspace[] {
  return projects.map((project) => {
    return {
      id: project.path,
      name: project.path.split(/[\\/]/).filter(Boolean).pop() || project.path,
      path: project.path,
      framework: project.error ? `扫描异常：${project.error}` : "Claude / Codex 项目技能目录",
      lastScanned: "刚刚",
      skills: project.skills.map((item): ProjectSkillRef => ({
        skillId: `skill-${item.dir_name}-${item.tool}`,
        dirName: item.dir_name,
        name: item.name,
        description: item.description,
        tool: item.tool,
        inLibrary: item.in_library,
        localContentMd: item.content_md,
        hasDiff: item.has_diff,
        syncStatus: item.sync_status,
        diffSummary: item.sync_status === "project_newer" ? "项目版本更新，可推送到中央库" : item.sync_status === "center_newer" ? "中央版本更新，可拉取到项目" : item.sync_status === "diverged" ? "双方内容不同且时间不足以判断方向，请查看差异" : item.sync_status === "project_only" ? "仅存在于项目，可收编到中央库" : "内容哈希一致",
        lastSyncedWithHub: "刚刚",
      })),
    };
  });
}

function toCommunitySkills(trending: TrendingView | null): CommunitySkill[] {
  return (trending?.repos ?? []).map((repo) => ({
    id: repo.full_name,
    name: repo.full_name.split("/").pop() || repo.full_name,
    slug: repo.full_name.split("/").pop() || repo.full_name,
    description: repo.description || "GitHub Agent Skills 仓库",
    author: repo.full_name.split("/")[0] || "GitHub",
    stars: repo.stars,
    installs: 0,
    tags: ["github", "agent-skill"],
    category: "all",
    repoUrl: repo.clone_url || repo.url,
    version: "仓库",
    contentMd: `# ${repo.full_name}\n\n${repo.description || ""}\n\n来源：${repo.url}`,
    verified: false,
  }));
}

function emptyHealth(): EnvironmentHealth {
  return {
    claudeCli: { installed: false, version: "未探测", path: "claude", status: "missing", lastChecked: "尚未探测", message: "打开环境探测后读取 CLI 状态" },
    codex: { installed: false, version: "未探测", path: "codex", status: "missing", lastChecked: "尚未探测", message: "打开环境探测后读取 CLI 状态" },
    openCode: { installed: false, version: "未探测", path: "opencode", status: "missing", lastChecked: "尚未探测", message: "打开环境探测后读取 CLI 状态" },
    mcpServer: { running: false, port: 0, activeConnections: 0, uptimeSeconds: 0, protocol: "尚未探测" },
  };
}

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [report, setReport] = useState<CurationReport | null>(null);
  const [isolation, setIsolation] = useState<IsolationEntry[]>([]);
  const [trending, setTrending] = useState<TrendingView | null>(null);
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [modal, setModal] = useState<"import" | "command" | "health" | "mcp" | "settings" | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [health, setHealth] = useState<EnvironmentHealth>(emptyHealth);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [workspaces, setWorkspaces] = useState<ToolWorkspaceStatus[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [activity, setActivity] = useState<AuditEntry[]>([]);

  const showToast = useCallback((title: string, message: string, type: NotificationToast["type"] = "info") => {
    const id = `toast-${Date.now()}`;
    setToasts((current) => [...current, { id, title, message, type, timestamp: Date.now() }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rawSkills, repoStatus, badges, rawProjects, rawIsolation, rawPresets, rawWorkspaces, rawGitStatus, rawActivity] = await Promise.all([
        invoke<any[]>("list_skills"),
        invoke<RepoStatus>("repo_status"),
        invoke<GroupBadges>("group_badges"),
        invoke<ProjectInfo[]>("list_projects"),
        invoke<IsolationEntry[]>("isolation_list"),
        invoke<Preset[]>("list_presets"),
        invoke<ToolWorkspaceStatus[]>("workspace_status"),
        invoke<GitStatus>("git_status"),
        invoke<AuditEntry[]>("recent_activity"),
      ]);
      setStatus(repoStatus);
      setSkills(rawSkills.map((skill) => {
        const mapped = mapSkill(skill, repoStatus.repo_path);
        return badges[skill.dir_name] > 1 ? { ...mapped, overlapGroupId: `cluster-${skill.dir_name}` } : mapped;
      }));
      setProjects(rawProjects);
      setIsolation(rawIsolation);
      setPresets(rawPresets);
      setWorkspaces(rawWorkspaces);
      setGitStatus(rawGitStatus);
      setActivity(rawActivity);
    } catch (error) {
      showToast("读取项目数据失败", String(error), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshHealth = useCallback(async () => {
    const next = await invoke<EnvironmentHealth>("environment_health");
    setHealth(next);
  }, []);

  const loadSettings = useCallback(async () => {
    const next = await invoke<AppSettings>("get_settings");
    setSettings(next);
  }, []);

  useEffect(() => {
    void loadSettings().catch((error) => showToast("读取设置失败", String(error), "error"));
    void refreshHealth().catch((error) => showToast("环境探测失败", String(error), "error"));
  }, [loadSettings, refreshHealth, showToast]);

  const activeSkills = useMemo(() => skills.filter((skill) => !skill.isolated), [skills]);
  const quarantinedSkills = useMemo<Skill[]>(() => isolation.flatMap((entry) => {
    const skill = skills.find((item) => item.dir_name === entry.dir_name);
    if (!skill) return [];
    const originalEndpoints = entry.tools.map((tool) => tool === "claude_code" ? "claude" : tool).filter((tool): tool is EndpointType => tool === "claude" || tool === "codex" || tool === "opencode");
    return [{ ...skill, quarantineState: { quarantinedAt: entry.isolated_at, daysRemaining: entry.days_left, originalEndpoints, reason: "用户确认后移入安全隔离仓" } }];
  }), [isolation, skills]);
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const overlapGroups = useMemo(() => toOverlapGroups(report), [report]);
  const communitySkills = useMemo(() => toCommunitySkills(trending), [trending]);

  useEffect(() => {
    if (activeTab === "curate" && !report) {
      invoke<CurationReport>("analyze", { threshold: null }).then(setReport).catch((error) => showToast("策展分析失败", String(error), "error"));
    }
    if (activeTab === "discover" && !trending) {
      invoke<TrendingView>("trending", { force: false }).then(setTrending).catch((error) => showToast("发现榜单读取失败", String(error), "error"));
    }
  }, [activeTab, report, trending, showToast]);

  const toggleEndpoint = async (skillId: string, endpoint: EndpointType) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) return;
    try {
      await invoke("set_skill_tool", { dirName: target.dir_name, tool: endpointToTool[endpoint], enabled: !target.endpoints[endpoint] });
      await refresh();
      showToast(target.endpoints[endpoint] ? "已解除同步" : "同步已建立", `${target.name} 的 ${endpoint} 状态已更新`, "success");
    } catch (error) { showToast("同步操作失败", String(error), "error"); }
  };

  const toggleWhitelist = async (skillId: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) return;
    try {
      const enabled = await invoke<boolean>("toggle_whitelist", { dirName: target.dir_name });
      await refresh();
      showToast(enabled ? "已加入保留白名单" : "已移出保留白名单", target.name, "success");
    } catch (error) { showToast("白名单操作失败", String(error), "error"); }
  };

  const quarantine = async (skillId: string, reason?: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) return;
    try { await invoke("isolate_skill", { dirName: target.dir_name }); await refresh(); setSelectedSkillId(null); showToast("已移入安全隔离仓", reason || target.name, "warning"); }
    catch (error) { showToast("隔离失败", String(error), "error"); }
  };

  const restore = async (skillId: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) return;
    try { await invoke("restore_skill", { dirName: target.dir_name }); await refresh(); showToast("已恢复技能", target.name, "success"); }
    catch (error) { showToast("恢复失败", String(error), "error"); }
  };

  const archive = async (skillId: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) return;
    try { await invoke("archive_skill", { dirName: target.dir_name }); await refresh(); showToast("已归档技能", target.name, "info"); }
    catch (error) { showToast("归档失败", String(error), "error"); }
  };

  const syncAll = async () => {
    setIsSyncingAll(true);
    try {
      const enabledSkills = skills.filter((skill) => !skill.isolated && Object.values(skill.endpoints).some(Boolean));
      const results = await Promise.allSettled(enabledSkills.map((skill) => invoke("sync_skill", { dirName: skill.dir_name })));
      await refresh();
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - succeeded;
      showToast(failed ? "同步部分失败" : "同步完成", `成功 ${succeeded}，失败 ${failed}；已重新扫描 Agent 目录`, failed ? "warning" : "success");
    } catch (error) {
      showToast("批量同步失败", String(error), "error");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const batchEnable = async (ids: string[], endpoint: EndpointType) => {
    await batchSetEndpoint(ids, endpoint, true);
  };

  const batchSetEndpoint = async (ids: string[], endpoint: EndpointType, enabled: boolean) => {
    const targets = skills.filter((skill) => ids.includes(skill.id));
    const pending = targets.filter((skill) => skill.endpoints[endpoint] !== enabled);
    const unchanged = targets.length - pending.length;
    const results = await Promise.allSettled(pending.map((skill) => invoke("set_skill_tool", { dirName: skill.dir_name, tool: endpointToTool[endpoint], enabled })));
    await refresh();
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    showToast(
      failed ? "批量同步部分失败" : enabled ? "批量分发完成" : "批量停用完成",
      `成功 ${succeeded}，未变化 ${unchanged}，失败 ${failed}`,
      failed ? "warning" : "success",
    );
  };

  const batchWhitelist = async (ids: string[]) => {
    const targets = skills.filter((skill) => ids.includes(skill.id));
    const pending = targets.filter((skill) => !skill.isWhitelisted);
    const results = await Promise.allSettled(pending.map((skill) => invoke("toggle_whitelist", { dirName: skill.dir_name })));
    await refresh();
    const succeeded = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.length - succeeded;
    showToast(failed ? "白名单操作部分失败" : "已更新白名单", `成功 ${succeeded}，未变化 ${targets.length - pending.length}，失败 ${failed}`, failed ? "warning" : "success");
  };

  const reanalyze = async (threshold: number) => {
    const next = await invoke<CurationReport>("analyze", { threshold });
    setReport(next);
    return next.groups.length;
  };

  const saveSkillContent = async (skillId: string, content: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) throw new Error("找不到目标技能");
    await invoke("save_skill_content", { dirName: target.dir_name, content });
    await refresh();
  };

  const syncSkill = async (skillId: string) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) throw new Error("找不到目标技能");
    await invoke("sync_skill", { dirName: target.dir_name });
    await refresh();
  };

  const createSkill = async (name: string, description: string, content: string) => {
    const dirName = name.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!dirName) throw new Error("技能名称无法转换为有效目录名");
    await invoke("create_skill", { dirName, name, description, content });
    await refresh();
  };

  const saveSettings = async (next: AppSettings) => {
    const saved = await invoke<AppSettings>("save_settings", { settings: {
      similarityThreshold: next.similarityThreshold,
      autoSyncOnSave: next.autoSyncOnSave,
      quarantineDays: next.quarantineDays,
      claudeBinary: next.claudeBinary,
    } });
    setSettings(saved);
    setReport(null);
    await refreshHealth();
  };

  const addProject = async (path: string) => {
    await invoke("add_project", { path });
    await refresh();
  };

  const removeProject = async (path: string) => {
    await invoke("remove_project", { path });
    await refresh();
  };

  const projectPromote = async (project: string, dirName: string, tool: string) => {
    await invoke("project_promote_skill", { project, dirName, tool });
    await refresh();
  };

  const projectPull = async (project: string, dirName: string, tool: string) => {
    await invoke("project_pull_skill", { project, dirName, tool });
    await refresh();
  };

  const adoptProjectSkill = async (project: string, dirName: string, tool: string) => {
    await invoke("adopt_project_skill", { project, dirName, tool });
    await refresh();
  };

  const importSkill = async (source: string, reference: string) => {
    try { const outcome = await invoke<any>("import_skill", { source, reference }); await refresh(); showToast("导入完成", outcome.message || `${outcome.imported?.length ?? 0} 个技能已入库`, "success"); }
    catch (error) { showToast("导入失败", String(error), "error"); throw error; }
  };

  const savePreset = async (preset: Preset) => {
    const saved = await invoke<Preset>("save_preset", { preset });
    await refresh();
    return saved;
  };

  const deletePreset = async (id: string) => {
    await invoke("delete_preset", { id });
    await refresh();
  };

  const previewPreset = (id: string, tools: string[]) => invoke<PresetPlan>("preview_preset", { id, tools });

  const applyPreset = async (id: string, tools: string[]) => {
    const result = await invoke<BatchResult>("apply_preset", { id, tools });
    await refresh();
    return result;
  };

  const removePreset = async (id: string, tools: string[]) => {
    const result = await invoke<BatchResult>("remove_preset", { id, tools });
    await refresh();
    return result;
  };

  const createGitSnapshot = async (message: string) => {
    setGitStatus(await invoke<GitStatus>("git_create_snapshot", { message }));
    setActivity(await invoke<AuditEntry[]>("recent_activity"));
  };

  const refreshRepositoryStatus = async () => {
    const [nextGit, nextActivity] = await Promise.all([invoke<GitStatus>("git_status"), invoke<AuditEntry[]>("recent_activity")]);
    setGitStatus(nextGit);
    setActivity(nextActivity);
  };

  const setSkillTags = async (skillId: string, tags: string[]) => {
    const target = skills.find((skill) => skill.id === skillId);
    if (!target) throw new Error("找不到目标技能");
    await invoke("set_skill_tags", { dirName: target.dir_name, tags });
    await refresh();
  };

  return (
    <div className="flex h-screen w-full bg-[#0d1117] text-slate-200 font-sans antialiased select-none overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} skillCount={activeSkills.length} presetCount={presets.length} quarantineCount={isolation.length} overlapCount={overlapGroups.length} projectCount={projects.length} environmentHealth={health} onOpenImportModal={() => setModal("import")} onOpenHealthModal={() => setModal("health")} onOpenMcpModal={() => setModal("mcp")} onOpenSettingsModal={() => setModal("settings")} />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <nav className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-800 bg-[#0d1117] px-2 md:hidden">
          {([
            ["dashboard", "面板"], ["hub", "技能库"], ["presets", "Preset"], ["agents", "Agent"],
            ["projects", "项目"], ["discover", "发现"], ["curate", "策展"], ["quarantine", "隔离"], ["backup", "备份"],
          ] as Array<[ActiveTab, string]>).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}>{label}</button>
          ))}
        </nav>
        <TopHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} onOpenCommandPalette={() => setModal("command")} onOpenMcpModal={() => setModal("mcp")} onOpenSettingsModal={() => setModal("settings")} onOpenHealthModal={() => setModal("health")} onSyncAll={() => void syncAll()} isSyncingAll={isSyncingAll} environmentHealth={health} />
        <main className="flex-1 overflow-hidden relative">
          {activeTab === "dashboard" && <DashboardView skills={activeSkills} presets={presets} workspaces={workspaces} projectCount={projects.length} isolationCount={isolation.length} gitStatus={gitStatus} onNavigate={setActiveTab} onSyncAll={() => void syncAll()} isSyncing={isSyncingAll} />}
          {activeTab === "hub" && <SkillHubView skills={activeSkills} selectedSkillId={selectedSkillId} onSelectSkill={(skill) => setSelectedSkillId(skill.id)} onToggleEndpoint={(id, endpoint) => void toggleEndpoint(id, endpoint)} onToggleWhitelist={(id) => void toggleWhitelist(id)} onQuarantineSkill={(id) => void quarantine(id)} onBatchSync={(ids, endpoint) => void batchEnable(ids, endpoint)} onBatchSetEndpoint={(ids, endpoint, enabled) => void batchSetEndpoint(ids, endpoint, enabled)} onBatchQuarantine={(ids) => void Promise.all(ids.map((id) => quarantine(id)))} onBatchWhitelist={(ids) => void batchWhitelist(ids)} onNavigateToCuration={() => setActiveTab("curate")} onOpenImportModal={() => setModal("import")} onLaunchEditor={(skill) => showToast("编辑器入口", skill.localPath, "info")} />}
          {activeTab === "presets" && <PresetView presets={presets} skills={activeSkills} onSave={savePreset} onDelete={deletePreset} onPreview={previewPreset} onApply={applyPreset} onRemove={removePreset} onShowToast={showToast} />}
          {activeTab === "agents" && <AgentWorkspaceView workspaces={workspaces} skills={activeSkills} onToggleEndpoint={(id, endpoint) => void toggleEndpoint(id, endpoint)} onAdoptSkill={async (dirName, tool) => { await invoke("adopt_local_skill", { dirName, tool }); await refresh(); }} onOpenPath={(path) => void openPath(path)} onShowToast={showToast} />}
          {activeTab === "curate" && <AiCurationView overlapGroups={overlapGroups} skills={activeSkills} onQuarantineSkill={(id, reason) => void quarantine(id, reason)} onToggleWhitelist={(id) => void toggleWhitelist(id)} onOpenSkillDetail={(skill) => setSelectedSkillId(skill.id)} onReanalyze={reanalyze} onShowToast={showToast} />}
          {activeTab === "quarantine" && <QuarantineView quarantinedSkills={quarantinedSkills} onRestoreSkill={(id) => void restore(id)} onArchiveSkill={(id) => void archive(id)} onArchiveAllExpired={() => void Promise.all(quarantinedSkills.filter((skill) => skill.quarantineState?.daysRemaining === 0).map((skill) => archive(skill.id)))} onOpenSkillDetail={(skill) => setSelectedSkillId(skill.id)} onShowToast={showToast} />}
          {activeTab === "projects" && <ProjectWorkspaceView projects={toProjectWorkspaces(projects)} skills={activeSkills} onSyncProjectSkillToHub={projectPromote} onPullHubSkillToProject={projectPull} onAdoptProjectSkill={adoptProjectSkill} onAddProject={addProject} onRemoveProject={removeProject} onShowToast={showToast} />}
          {activeTab === "discover" && <DiscoverView communitySkills={communitySkills} installedSkillSlugs={new Set(activeSkills.map((skill) => skill.slug))} onInstallSkill={(skill) => void importSkill("git", skill.repoUrl)} onShowToast={showToast} />}
          {activeTab === "backup" && <BackupView status={gitStatus} activity={activity} onRefresh={refreshRepositoryStatus} onSnapshot={createGitSnapshot} onOpenPath={(path) => void openPath(path)} onShowToast={showToast} />}
          {selectedSkill && <SkillDetailDrawer skill={selectedSkill} onClose={() => setSelectedSkillId(null)} onToggleEndpoint={(id, endpoint) => void toggleEndpoint(id, endpoint)} onToggleWhitelist={(id) => void toggleWhitelist(id)} onQuarantineSkill={(id) => void quarantine(id)} onSaveContent={saveSkillContent} onSyncSkill={syncSkill} onSetTags={setSkillTags} onLaunchEditor={async (skill, app) => {
            try {
              if (app === "explorer") await revealItemInDir(skill.localPath);
              else await openPath(skill.localPath, "code");
            } catch (error) { showToast("打开文件失败", String(error), "error"); }
          }} onShowToast={showToast} />}
        </main>
      </div>
      <OmniIngestModal
        isOpen={modal === "import"}
        onClose={() => setModal(null)}
        onAddSkill={() => undefined}
        onShowToast={showToast}
        onImportRequest={importSkill}
        onScanTools={async () => {
          const found = await invoke<any[]>("scan_local_skills");
          return found.filter((item) => !item.in_library).map((item) => ({
            name: item.name,
            path: item.path,
            source: item.tool,
            dirName: item.dir_name,
            tool: item.tool,
            selected: true,
          }));
        }}
        onAdoptToolSkill={async (dirName, tool) => {
          await invoke("adopt_local_skill", { dirName, tool });
          await refresh();
        }}
        onCreateSkill={createSkill}
      />
      <CommandPalette isOpen={modal === "command"} onClose={() => setModal(null)} skills={activeSkills} onSelectSkill={(skill) => { setSelectedSkillId(skill.id); setModal(null); }} onNavigateTab={(tab) => { setActiveTab(tab); setModal(null); }} onSyncAll={() => void syncAll()} onOpenImportModal={() => setModal("import")} onOpenMcpModal={() => setModal("mcp")} onOpenHealthModal={() => setModal("health")} />
      <EnvironmentHealthModal isOpen={modal === "health"} onClose={() => setModal(null)} health={health} onRefresh={refreshHealth} onShowToast={showToast} />
      <McpConfigModal isOpen={modal === "mcp"} onClose={() => setModal(null)} skills={activeSkills} onShowToast={showToast} />
      <SettingsModal isOpen={modal === "settings"} onClose={() => setModal(null)} settings={settings} onSave={saveSettings} onShowToast={showToast} />
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
      {loading && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">正在读取技能库...</div>}
      {status && !status.exists && <div className="fixed top-16 right-5 text-[11px] text-amber-300 bg-amber-950/80 border border-amber-500/30 px-3 py-2 rounded-lg">未找到中央技能库：{status.repo_path}</div>}
    </div>
  );
}

export default App;
