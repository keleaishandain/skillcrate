import type { Skill } from "../types";

// D1（翻案定稿）：包不落库，展示时按来源派生；同源且 ≥2 个技能才成包。

function normalizeGitRef(ref: string): string {
  let r = ref.trim().toLowerCase();
  r = r.replace(/\.git$/, "").replace(/\/+$/, "");
  const scp = r.match(/^git@([^:]+):(.+)$/);
  if (scp) r = `${scp[1]}/${scp[2]}`;
  r = r.replace(/^https?:\/\//, "").replace(/^ssh:\/\/(git@)?/, "");
  return r;
}

export function gitLabel(ref: string): string {
  const norm = normalizeGitRef(ref);
  const parts = norm.split("/").filter(Boolean);
  if (parts.length >= 3) return parts.slice(-2).join("/");
  return norm;
}

function parentDir(p: string): string {
  const cleaned = p.replace(/[\\/]+$/, "");
  const idx = Math.max(cleaned.lastIndexOf("/"), cleaned.lastIndexOf("\\"));
  return idx > 0 ? cleaned.slice(0, idx) : cleaned;
}

export function packageKey(s: Skill): string | null {
  const ref = s.source_ref?.trim();
  if (!ref) return null;
  if (s.source_type === "git" || s.source_type === "skillssh") {
    return "git:" + normalizeGitRef(ref);
  }
  if (s.source_type === "local" || s.source_type === "import") {
    return "dir:" + parentDir(ref).toLowerCase();
  }
  return null;
}

export type SkillPackage = { key: string; label: string; skills: Skill[] };

export function groupPackages(skills: Skill[]): {
  packages: SkillPackage[];
  independent: Skill[];
} {
  const byKey = new Map<string, Skill[]>();
  for (const s of skills) {
    const k = packageKey(s);
    if (!k) continue;
    const arr = byKey.get(k) ?? [];
    arr.push(s);
    byKey.set(k, arr);
  }
  const packages: SkillPackage[] = [];
  const packaged = new Set<string>();
  for (const [key, arr] of byKey) {
    if (arr.length < 2) continue;
    const first = arr[0];
    const label =
      first.source_type === "git" || first.source_type === "skillssh"
        ? gitLabel(first.source_ref ?? "")
        : key.replace(/^dir:/, "").split(/[\\/]/).pop() || key;
    packages.push({ key, label, skills: arr });
    for (const s of arr) packaged.add(s.dir_name);
  }
  packages.sort((a, b) => a.label.localeCompare(b.label));
  const independent = skills.filter((s) => !packaged.has(s.dir_name));
  return { packages, independent };
}
