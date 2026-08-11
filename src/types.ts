export type Skill = {
  dir_name: string;
  name: string;
  description: string;
  source_type: string | null;
  source_ref: string | null;
  enabled_tools: string[];
  isolated: boolean;
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
};

export type ProjectInfo = {
  path: string;
  exists: boolean;
  skills: ProjectSkill[];
  error: string | null;
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

export const TOOLS = ["claude_code", "codex", "opencode"] as const;

export type GroupBadges = Record<string, number>;

export const PROJECT_TOOLS = ["claude_code", "codex"] as const;

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
