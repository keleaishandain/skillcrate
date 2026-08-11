import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ImportOutcome, LocalSkill } from "../types";
import { TOOL_LABELS } from "../types";

const TABS = [
  {
    id: "git",
    label: "Git 仓库",
    placeholder: "https://github.com/owner/repo.git",
    hint: "整仓导入：根目录或两级子目录内所有含 SKILL.md 的技能一起进库",
  },
  {
    id: "local",
    label: "本地目录",
    placeholder: "E:\\path\\to\\skills",
    hint: "单个技能目录，或装着多个技能的文件夹",
  },
  {
    id: "skillssh",
    label: "skills.sh",
    placeholder: "owner/repo@skill 或 owner/repo",
    hint: "按 GitHub 直译获取（V1 不接 skills.sh API）",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Props = {
  onLibraryChanged: () => void;
};

export default function ImportView({ onLibraryChanged }: Props) {
  const [tab, setTab] = useState<TabId>("git");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [localSkills, setLocalSkills] = useState<LocalSkill[]>([]);
  const [scanLoading, setScanLoading] = useState(true);
  const [scanError, setScanError] = useState("");
  const [adoptingKey, setAdoptingKey] = useState("");
  const [adoptErrors, setAdoptErrors] = useState<Record<string, string>>({});

  const current = TABS.find((item) => item.id === tab) ?? TABS[0];
  const adoptableSkills = localSkills.filter((skill) => !skill.in_library);
  const inLibraryCount = localSkills.length - adoptableSkills.length;

  const scanLocalSkills = useCallback(async () => {
    setScanLoading(true);
    setScanError("");
    try {
      const skills = await invoke<LocalSkill[]>("scan_local_skills");
      setLocalSkills(skills);
    } catch (scanFailure) {
      setScanError(String(scanFailure));
    } finally {
      setScanLoading(false);
    }
  }, []);

  useEffect(() => {
    scanLocalSkills();
  }, [scanLocalSkills]);

  async function doImport() {
    if (!reference.trim() || busy) return;
    setBusy(true);
    setError("");
    setOutcome(null);
    try {
      const result = await invoke<ImportOutcome>("import_skill", {
        source: tab,
        reference,
      });
      setOutcome(result);
      if (result.imported.length > 0) onLibraryChanged();
    } catch (importFailure) {
      setError(String(importFailure));
    } finally {
      setBusy(false);
    }
  }

  async function adoptSkill(skill: LocalSkill) {
    const key = `${skill.tool}:${skill.dir_name}`;
    if (adoptingKey) return;
    setAdoptingKey(key);
    setAdoptErrors((previous) => ({ ...previous, [key]: "" }));
    try {
      await invoke("adopt_local_skill", { dirName: skill.dir_name, tool: skill.tool });
      await scanLocalSkills();
      onLibraryChanged();
    } catch (adoptFailure) {
      setAdoptErrors((previous) => ({ ...previous, [key]: String(adoptFailure) }));
    } finally {
      setAdoptingKey("");
    }
  }

  return (
    <div className="import-view">
      <section className="import-section">
        <div className="import-section-head">
          <div>
            <h2>从来源导入</h2>
            <p>从 Git 仓库、本地目录或 skills.sh 引用安装技能。</p>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "tab active" : "tab"}
              onClick={() => {
                setTab(item.id);
                setOutcome(null);
                setError("");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="import-form-row">
          <input
            className="modal-input"
            placeholder={current.placeholder}
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            onKeyDown={(event) => event.key === "Enter" && doImport()}
          />
          <button
            className="btn primary"
            onClick={doImport}
            disabled={busy || !reference.trim()}
          >
            {busy ? "导入中…（git 克隆可能要一会）" : "导入"}
          </button>
        </div>
        <p className="hint">
          {current.hint}。安装零拦截（D6）：想装什么就装什么，冗余留给策展报告在使用中筛选。
        </p>
        {error && <div className="error small">{error}</div>}
        {outcome && (
          <div className="outcome">
            <p>{outcome.message}</p>
            {outcome.imported.length > 0 && (
              <p className="ok">已导入:{outcome.imported.join("、")}</p>
            )}
            {outcome.skipped.length > 0 && (
              <p className="muted">跳过:{outcome.skipped.join("、")}</p>
            )}
          </div>
        )}
      </section>

      <section className="import-section">
        <div className="import-section-head">
          <div>
            <h2>本机已发现的技能</h2>
            <p>自动扫描 Claude、Codex 和 OpenCode 的全局技能目录。</p>
          </div>
          <button className="btn" onClick={scanLocalSkills} disabled={scanLoading || !!adoptingKey}>
            {scanLoading ? "扫描中…" : "重新扫描"}
          </button>
        </div>

        {scanError && <div className="error small">扫描本机技能失败：{scanError}</div>}
        {scanLoading && localSkills.length === 0 && <div className="empty import-empty">扫描中…</div>}
        {!scanLoading && !scanError && adoptableSkills.length === 0 && (
          <div className="empty import-empty">三个工具目录里的技能都已在库中</div>
        )}
        {adoptableSkills.length > 0 && (
          <div className="local-skill-list">
            {adoptableSkills.map((skill) => {
              const key = `${skill.tool}:${skill.dir_name}`;
              const rowError = adoptErrors[key];
              return (
                <div className="local-skill-row" key={key}>
                  <div className="local-skill-main">
                    <div className="local-skill-title">
                      <strong>{skill.name}</strong>
                      <span className="badge badge-tool">{TOOL_LABELS[skill.tool] ?? skill.tool}</span>
                    </div>
                    <p className="local-skill-description" title={skill.description}>
                      {skill.description || "（无描述）"}
                    </p>
                    <p className="local-skill-path" title={skill.path}>{skill.path}</p>
                    {rowError && <p className="local-skill-error">{rowError}</p>}
                  </div>
                  <button
                    className="btn primary"
                    disabled={!!adoptingKey}
                    onClick={() => adoptSkill(skill)}
                  >
                    {adoptingKey === key ? "收编中…" : "收编入库"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {!scanLoading && !scanError && inLibraryCount > 0 && (
          <p className="import-count">另有 {inLibraryCount} 个本机技能已在库中</p>
        )}
      </section>
    </div>
  );
}