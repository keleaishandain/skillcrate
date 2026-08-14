export type EndpointType = "claude" | "codex" | "opencode";

export type EndpointSyncInfo = Record<EndpointType, boolean>;
export type SyncStatus = "synced" | "outdated" | "unsynced" | "error";
export type EndpointStatusMap = Record<EndpointType, SyncStatus>;

export type UsageStats90d = {
  totalCalls: number;
  callsByEndpoint: Record<EndpointType, number>;
  lastUsedDate: string;
  trend: number[];
};

export type QuarantineState = {
  quarantinedAt: string;
  daysRemaining: number;
  originalEndpoints: EndpointType[];
  reason: string;
  isArchived?: boolean;
};

/** Shared domain type: legacy fields keep the existing views compatible while the new UI uses the richer fields. */
export type Skill = {
  id: string;
  dir_name: string;
  name: string;
  slug: string;
  description: string;
  source_type: string | null;
  source_ref: string | null;
  enabled_tools: string[];
  isolated: boolean;
  version: string;
  author: string;
  repoUrl?: string;
  localPath: string;
  isDerived: boolean;
  derivedPackageName?: string;
  tags: string[];
  userTags: string[];
  category: string;
  endpoints: EndpointSyncInfo;
  endpointsStatus: EndpointStatusMap;
  callStats: UsageStats90d;
  contentMd: string;
  isWhitelisted: boolean;
  quarantineState?: QuarantineState;
  overlapGroupId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Preset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  skill_dir_names: string[];
  tools: string[];
  updated_at: string;
};

export type PresetPlan = {
  preset_id: string;
  preset_name: string;
  target_tools: string[];
  total_operations: number;
  already_applied: number;
  pending: number;
  missing_skills: string[];
};

export type BatchResult = {
  succeeded: number;
  skipped: number;
  unchanged: number;
  failed: number;
  failures: Array<{ item: string; reason: string }>;
};

export type ToolWorkspaceStatus = {
  tool: string;
  label: string;
  path: string;
  exists: boolean;
  total_skills: number;
  managed_skills: number;
  unmanaged_skills: number;
  skills: Array<{ dir_name: string; managed: boolean }>;
};

export type GitStatus = {
  repo_path: string;
  initialized: boolean;
  branch: string;
  remote: string;
  changed_files: number;
  last_commit: string;
  last_snapshot: string;
  error: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  target: string;
  success: boolean;
  detail: string;
  created_at: string;
};

export type LocalSkill = {
  dir_name: string;
  name: string;
  description: string;
  tool: "claude_code" | "codex" | "opencode";
  path: string;
  in_library: boolean;
};

export type ProjectSkill = {
  dir_name: string;
  name: string;
  description: string;
  tool: "claude_code" | "codex";
  in_library: boolean;
  content_md: string;
  has_diff: boolean;
  sync_status: "in_sync" | "project_newer" | "center_newer" | "diverged" | "project_only";
};

export type ProjectInfo = {
  path: string;
  exists: boolean;
  skills: ProjectSkill[];
  error: string | null;
};

export type ProjectSkillRef = {
  skillId: string;
  dirName: string;
  name: string;
  description: string;
  tool: "claude_code" | "codex";
  inLibrary: boolean;
  localContentMd: string;
  hasDiff: boolean;
  syncStatus: ProjectSkill["sync_status"];
  diffSummary?: string;
  lastSyncedWithHub: string;
};

export type AppSettings = {
  repoPath: string;
  archivePath: string;
  similarityThreshold: number;
  autoSyncOnSave: boolean;
  quarantineDays: number;
  claudeBinary: string;
};

export type ProjectWorkspace = {
  id: string;
  name: string;
  path: string;
  framework: string;
  skills: ProjectSkillRef[];
  lastScanned: string;
};

export type RepoStatus = {
  repo_path: string;
  exists: boolean;
  skill_count: number;
  db_found: boolean;
};

export type ImportOutcome = {
  imported: string[];
  skipped: string[];
  message: string;
};

export type TrendingRepo = {
  full_name: string;
  description: string;
  stars: number;
  url: string;
  clone_url: string;
};

export type TrendingView = {
  repos: TrendingRepo[];
  fetched_at: number;
  from_cache: boolean;
  warnings: string[];
};

export type MemberReport = {
  dir_name: string;
  name: string;
  count_90d: number;
  last_used_days: number | null;
  share: number;
  verdict: "keep" | "normal" | "suggest" | "observing";
};

export type GroupReport = {
  keywords: string[];
  total_calls_90d: number;
  observing: boolean;
  members: MemberReport[];
};

export type CurationReport = {
  groups: GroupReport[];
  grouped_count: number;
  ungrouped_count: number;
  isolated_count: number;
  files_scanned: number;
  window_days: number;
  threshold: number;
  data_source: string;
  generated_at: string;
  judge_note: string;
};

export type IsolationEntry = {
  dir_name: string;
  name: string;
  isolated_at: string;
  days_left: number;
  expired: boolean;
  tools: string[];
};

export type OverlapSkillMember = {
  skillId: string;
  callCount: number;
  callRatio: number;
  status: "core" | "observe" | "quarantine_suggested";
  reason: string;
};

export type OverlapGroup = {
  id: string;
  groupNumber: number;
  title: string;
  description: string;
  confidenceScore: number;
  tfidfScore: number;
  claudeReviewConfirmed: boolean;
  totalCalls: number;
  skills: OverlapSkillMember[];
  similarityAnalysis: {
    sharedKeywords: string[];
    promptOverlapPercent: number;
    recommendedAction: string;
    detailedReason: string;
  };
};

export type CommunitySkill = {
  id: string;
  name: string;
  slug: string;
  description: string;
  author: string;
  stars: number;
  installs: number;
  tags: string[];
  category: string;
  repoUrl: string;
  version: string;
  contentMd: string;
  verified: boolean;
};

export type ToolHealthInfo = {
  installed: boolean;
  version: string;
  path: string;
  status: "ready" | "missing" | "warning" | "login_required";
  lastChecked: string;
  message?: string;
};

export type EnvironmentHealth = {
  claudeCli: ToolHealthInfo;
  codex: ToolHealthInfo;
  openCode: ToolHealthInfo;
  mcpServer: {
    running: boolean;
    port: number;
    activeConnections: number;
    uptimeSeconds: number;
    protocol: string;
  };
};

export type ActiveTab = "dashboard" | "hub" | "presets" | "agents" | "projects" | "discover" | "curate" | "quarantine" | "backup";
export type NotificationToast = {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  timestamp: number;
};

export const TOOLS = ["claude_code", "codex", "opencode"] as const;
export const PROJECT_TOOLS = ["claude_code", "codex"] as const;
export type GroupBadges = Record<string, number>;
export const TOOL_LABELS: Record<string, string> = {
  claude_code: "Claude",
  codex: "Codex",
  opencode: "OpenCode",
};
export const SOURCE_LABELS: Record<string, string> = {
  git: "Git",
  skillssh: "skills.sh",
  local: "本地",
  import: "导入",
};
