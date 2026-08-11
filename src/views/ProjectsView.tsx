import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProjectInfo, ProjectSkill, Skill } from "../types";
import { PROJECT_TOOLS, TOOL_LABELS } from "../types";

type Props = {
  skills: Skill[];
  onLibraryChanged: () => void;
};

type ProjectTool = ProjectSkill["tool"];

function projectSkillKey(project: string, skill: ProjectSkill) {
  return `${project}\u001f${skill.tool}\u001f${skill.dir_name}`;
}

export default function ProjectsView({ skills, onLibraryChanged }: Props) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [projectPath, setProjectPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [confirmingProject, setConfirmingProject] = useState("");
  const [confirmingSkill, setConfirmingSkill] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<Record<string, string>>({});
  const [selectedTools, setSelectedTools] = useState<Record<string, ProjectTool>>({});

  const librarySkills = useMemo(() => skills.filter((skill) => !skill.isolated), [skills]);

  async function loadProjects() {
    setLoading(true);
    setError("");
    try {
      setProjects(await invoke<ProjectInfo[]>("list_projects"));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function addProject() {
    if (busyKey || loading) return;
    setBusyKey("add-project");
    setError("");
    try {
      await invoke("add_project", { path: projectPath });
      setProjectPath("");
      await loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyKey("");
    }
  }

  async function removeProject(path: string) {
    const key = `remove-project:${path}`;
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    try {
      await invoke("remove_project", { path });
      setConfirmingProject("");
      await loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyKey("");
    }
  }

  async function removeSkill(project: string, skill: ProjectSkill) {
    const rowKey = projectSkillKey(project, skill);
    const key = `remove-skill:${rowKey}`;
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    try {
      await invoke("project_remove_skill", {
        project,
        dirName: skill.dir_name,
        tool: skill.tool,
      });
      setConfirmingSkill("");
      await loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyKey("");
    }
  }

  async function adoptSkill(project: string, skill: ProjectSkill) {
    const rowKey = projectSkillKey(project, skill);
    const key = `adopt-skill:${rowKey}`;
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    try {
      await invoke("adopt_project_skill", {
        project,
        dirName: skill.dir_name,
        tool: skill.tool,
      });
      await loadProjects();
      onLibraryChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyKey("");
    }
  }

  async function addSkillToProject(project: string) {
    const dirName = selectedSkills[project] ?? librarySkills[0]?.dir_name ?? "";
    const tool = selectedTools[project] ?? "claude_code";
    const key = `add-skill:${project}`;
    if (busyKey || !dirName) return;
    setBusyKey(key);
    setError("");
    try {
      await invoke("project_add_skill", { project, dirName, tool });
      await loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="projects">
      <div className="lib-bar projects-bar">
        <input
          className="search"
          aria-label="项目绝对路径"
          placeholder="粘贴项目文件夹的绝对路径…"
          value={projectPath}
          onChange={(e) => setProjectPath(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && addProject()}
        />
        <button
          className="btn primary"
          disabled={loading || busyKey !== ""}
          onClick={addProject}
        >
          {busyKey === "add-project" ? "添加中…" : "添加项目"}
        </button>
        <button className="btn" disabled={loading || busyKey !== ""} onClick={loadProjects}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error && (
        <div className="error">
          <strong>项目操作失败：</strong>
          {error}
        </div>
      )}
      {loading && <div className="empty">正在读取项目工作区…</div>}
      {!loading && !error && projects.length === 0 && (
        <div className="empty">还没有注册项目——把项目文件夹的绝对路径粘进来</div>
      )}

      {!loading && (
        <div className="projects-list">
          {projects.map((project) => {
            const selectedDirName =
              selectedSkills[project.path] ?? librarySkills[0]?.dir_name ?? "";
            const selectedTool = selectedTools[project.path] ?? "claude_code";
            const removeProjectKey = `remove-project:${project.path}`;
            const addSkillKey = `add-skill:${project.path}`;

            return (
              <section className="card project-card" key={project.path}>
                <header className="project-head">
                  <div className="project-title">
                    <h2 title={project.path}>{project.path}</h2>
                    <span className="muted">{project.skills.length} 个项目技能</span>
                  </div>
                  {confirmingProject === project.path ? (
                    <button
                      className="btn danger sm"
                      disabled={busyKey !== ""}
                      onClick={() => removeProject(project.path)}
                    >
                      {busyKey === removeProjectKey
                        ? "移除中…"
                        : "确认移除？（仅取消注册，不动磁盘）"}
                    </button>
                  ) : (
                    <button
                      className="btn sm"
                      disabled={busyKey !== ""}
                      onClick={() => setConfirmingProject(project.path)}
                    >
                      移除项目
                    </button>
                  )}
                </header>

                {!project.exists && (
                  <div className="error small project-missing">
                    <strong>目录不存在</strong>
                    <span>请恢复该路径，或移除这个项目注册项。</span>
                  </div>
                )}
                {project.error && (
                  <div className="error small project-missing">
                    <strong>部分目录读取失败</strong>
                    <span>{project.error}</span>
                  </div>
                )}

                <div className="project-skills">
                  {project.skills.length === 0 ? (
                    <p className="muted project-skills-empty">
                      {project.exists ? "这个项目还没有技能。" : "目录恢复后才能读取项目技能。"}
                    </p>
                  ) : (
                    project.skills.map((skill) => {
                      const rowKey = projectSkillKey(project.path, skill);
                      const removeSkillKey = `remove-skill:${rowKey}`;
                      const adoptSkillKey = `adopt-skill:${rowKey}`;
                      return (
                        <div className="project-skill-row" key={`${skill.tool}:${skill.dir_name}`}>
                          <div className="project-skill-copy">
                            <strong title={skill.dir_name}>{skill.name}</strong>
                            <p className="project-skill-desc" title={skill.description}>
                              {skill.description || "（无描述）"}
                            </p>
                          </div>
                          <div className="project-skill-badges">
                            <span className="badge badge-tool">
                              {TOOL_LABELS[skill.tool] ?? skill.tool}
                            </span>
                            <span
                              className={
                                skill.in_library
                                  ? "badge badge-in-library"
                                  : "badge badge-project-only"
                              }
                            >
                              {skill.in_library ? "库中已有" : "仅项目内"}
                            </span>
                          </div>
                          <div className="project-skill-ops">
                            {!skill.in_library && (
                              <button
                                className="btn primary sm"
                                disabled={busyKey !== ""}
                                onClick={() => adoptSkill(project.path, skill)}
                              >
                                {busyKey === adoptSkillKey ? "收编中…" : "收编入库"}
                              </button>
                            )}
                            {confirmingSkill === rowKey ? (
                              <button
                                className="btn danger sm"
                                disabled={busyKey !== ""}
                                onClick={() => removeSkill(project.path, skill)}
                              >
                                {busyKey === removeSkillKey ? "移除中…" : "确认移除？"}
                              </button>
                            ) : (
                              <button
                                className="btn sm"
                                disabled={busyKey !== ""}
                                onClick={() => setConfirmingSkill(rowKey)}
                              >
                                移除
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="project-add">
                  <strong>从库添加</strong>
                  <select
                    className="project-select project-skill-select"
                    aria-label={`选择添加到 ${project.path} 的技能`}
                    value={selectedDirName}
                    disabled={!project.exists || librarySkills.length === 0 || busyKey !== ""}
                    onChange={(e) =>
                      setSelectedSkills((current) => ({
                        ...current,
                        [project.path]: e.currentTarget.value,
                      }))
                    }
                  >
                    {librarySkills.length === 0 && <option value="">没有可添加的技能</option>}
                    {librarySkills.map((skill) => (
                      <option value={skill.dir_name} key={skill.dir_name}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="project-select"
                    aria-label={`选择 ${project.path} 的目标工具`}
                    value={selectedTool}
                    disabled={!project.exists || busyKey !== ""}
                    onChange={(e) =>
                      setSelectedTools((current) => ({
                        ...current,
                        [project.path]: e.currentTarget.value as ProjectTool,
                      }))
                    }
                  >
                    {PROJECT_TOOLS.map((tool) => (
                      <option value={tool} key={tool}>
                        {TOOL_LABELS[tool]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn primary sm"
                    disabled={
                      !project.exists || !selectedDirName || loading || busyKey !== ""
                    }
                    onClick={() => addSkillToProject(project.path)}
                  >
                    {busyKey === addSkillKey ? "添加中…" : "添加到项目"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
