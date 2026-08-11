import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GroupBadges, Skill } from "../types";
import { SOURCE_LABELS, TOOLS, TOOL_LABELS } from "../types";
import { groupPackages } from "../lib/packages";

type Props = {
  skills: Skill[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  groupBadges: GroupBadges;
  onOpenReport: () => void;
  onOpenImport: () => void;
};

export default function LibraryView({
  skills,
  loading,
  error,
  onRefresh,
  groupBadges,
  onOpenReport,
  onOpenImport,
}: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.source_ref ?? "").toLowerCase().includes(q),
    );
  }, [skills, query]);

  const { packages, independent } = useMemo(() => groupPackages(filtered), [filtered]);

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function toggleTool(s: Skill, tool: string) {
    if (busyKey) return;
    setBusyKey(`${s.dir_name}:${tool}`);
    try {
      const enabled = s.enabled_tools.includes(tool);
      await invoke("set_skill_tool", { dirName: s.dir_name, tool, enabled: !enabled });
      onRefresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setBusyKey("");
    }
  }

  async function togglePackageTool(pkgSkills: Skill[], tool: string, enable: boolean) {
    if (busyKey) return;
    setBusyKey(`pkg:${tool}`);
    try {
      for (const s of pkgSkills) {
        if (s.isolated) continue;
        const has = s.enabled_tools.includes(tool);
        if (enable !== has) {
          await invoke("set_skill_tool", { dirName: s.dir_name, tool, enabled: enable });
        }
      }
      onRefresh();
    } catch (e) {
      alert(String(e));
    } finally {
      setBusyKey("");
    }
  }

  const renderCard = (s: Skill) => (
    <article className={s.isolated ? "card isolated" : "card"} key={s.dir_name}>
      <div className="card-head">
        <h3 title={s.dir_name}>{s.name}</h3>
        <div className="card-badges">
          <span className={`badge badge-${s.source_type ?? "unknown"}`}>
            {SOURCE_LABELS[s.source_type ?? ""] ?? "来源未知"}
          </span>
          {!s.isolated && groupBadges[s.dir_name] >= 2 && (
            <button
              type="button"
              className="badge badge-group"
              title={`与另外 ${groupBadges[s.dir_name] - 1} 个技能职责重叠，详见策展报告`}
              onClick={onOpenReport}
            >
              同职责组 ×{groupBadges[s.dir_name]}
            </button>
          )}
        </div>
      </div>
      <p className="desc">{s.description || "（无描述）"}</p>
      <div className="card-foot">
        {s.isolated ? (
          <span className="badge badge-isolated">隔离中</span>
        ) : (
          TOOLS.map((tool) => {
            const on = s.enabled_tools.includes(tool);
            const busy = busyKey === `${s.dir_name}:${tool}`;
            return (
              <button
                key={tool}
                className={on ? "toggle on" : "toggle"}
                disabled={busyKey !== ""}
                title={on ? `从 ${TOOL_LABELS[tool]} 停用` : `启用到 ${TOOL_LABELS[tool]}`}
                onClick={() => toggleTool(s, tool)}
              >
                {busy ? "…" : TOOL_LABELS[tool]}
              </button>
            );
          })
        )}
        {s.source_ref && (
          <span className="ref" title={s.source_ref}>
            {s.source_ref}
          </span>
        )}
      </div>
    </article>
  );

  return (
    <div className="library">
      <div className="lib-bar">
        <input
          className="search"
          placeholder="搜索技能名、描述或来源…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <button className="btn" onClick={onRefresh} disabled={loading}>
          {loading ? "刷新中…" : "刷新"}
        </button>
        <button className="btn primary" onClick={onOpenImport}>
          + 导入技能
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>读取技能库失败：</strong>
          {error}
          <p>请确认 ~/.skills-manager/skills 目录存在（D5：兼容 skills-manager 库格式）。</p>
        </div>
      )}
      {loading && skills.length === 0 && <div className="empty">正在扫描技能库…</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty">
          {skills.length === 0 ? "技能库是空的——点右上角「导入技能」开始" : `没有匹配「${query}」的技能`}
        </div>
      )}

      {packages.map((pkg) => {
        const isCollapsed = collapsed.has(pkg.key);
        return (
          <section className="pkg" key={pkg.key}>
            <header className="pkg-head">
              <button className="chev" onClick={() => toggleCollapsed(pkg.key)}>
                {isCollapsed ? "▸" : "▾"}
              </button>
              <span className="pkg-icon">📦</span>
              <strong>{pkg.label}</strong>
              <span className="muted">{pkg.skills.length} 个技能</span>
              <div className="pkg-ops">
                {TOOLS.map((tool) => {
                  const activeSkills = pkg.skills.filter((s) => !s.isolated);
                  const allOn =
                    activeSkills.length > 0 &&
                    activeSkills.every((s) => s.enabled_tools.includes(tool));
                  return (
                    <button
                      key={tool}
                      className="btn sm"
                      disabled={busyKey !== ""}
                      onClick={() => togglePackageTool(pkg.skills, tool, !allOn)}
                    >
                      {TOOL_LABELS[tool]}：{allOn ? "全部停用" : "全部启用"}
                    </button>
                  );
                })}
              </div>
            </header>
            {!isCollapsed && <div className="grid">{pkg.skills.map(renderCard)}</div>}
          </section>
        );
      })}

      {independent.length > 0 && (
        <>
          {packages.length > 0 && (
            <div className="divider">独立技能（{independent.length}）</div>
          )}
          <div className="grid">{independent.map(renderCard)}</div>
        </>
      )}

    </div>
  );
}
