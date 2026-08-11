import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import type { GroupBadges, RepoStatus, Skill } from "./types";
import LibraryView from "./views/LibraryView";
import ImportView from "./views/ImportView";
import DiscoverView from "./views/DiscoverView";
import ProjectsView from "./views/ProjectsView";
import ReportView from "./views/ReportView";
import IsolationView from "./views/IsolationView";

type Tab = "library" | "import" | "discover" | "projects" | "report" | "isolation";

function App() {
  const [tab, setTab] = useState<Tab>("library");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [groupBadges, setGroupBadges] = useState<GroupBadges>({});
  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, st, badges] = await Promise.all([
        invoke<Skill[]>("list_skills"),
        invoke<RepoStatus>("repo_status"),
        invoke<GroupBadges>("group_badges"),
      ]);
      setSkills(s);
      setStatus(st);
      setGroupBadges(badges);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isolatedCount = skills.filter((s) => s.isolated).length;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <span className="brand-name">SkillCurator</span>
          <span className="brand-sub">策展人</span>
        </div>
        <nav>
          <button
            className={tab === "library" ? "nav active" : "nav"}
            onClick={() => setTab("library")}
          >
            技能库 <em>{skills.length}</em>
          </button>
          <button
            className={tab === "import" ? "nav active" : "nav"}
            onClick={() => setTab("import")}
          >
            导入
          </button>
          <button
            className={tab === "discover" ? "nav active" : "nav"}
            onClick={() => setTab("discover")}
          >
            发现
          </button>
          <button
            className={tab === "projects" ? "nav active" : "nav"}
            onClick={() => setTab("projects")}
          >
            项目工作区
          </button>
          <button
            className={tab === "report" ? "nav active" : "nav"}
            onClick={() => setTab("report")}
          >
            策展报告
          </button>
          <button
            className={tab === "isolation" ? "nav active" : "nav"}
            onClick={() => setTab("isolation")}
          >
            隔离区 <em>{isolatedCount}</em>
          </button>
        </nav>
        {status && (
          <div className="side-foot">
            <p title={status.repo_path}>库:{status.repo_path}</p>
            <p>
              {status.db_found
                ? "已兼容读取 skills-manager 元数据"
                : "未发现元数据库，仅按文件夹扫描"}
            </p>
          </div>
        )}
      </aside>
      <main className="content">
        {tab === "library" && (
          <LibraryView
            skills={skills}
            loading={loading}
            error={error}
            onRefresh={refresh}
            groupBadges={groupBadges}
            onOpenReport={() => setTab("report")}
            onOpenImport={() => setTab("import")}
          />
        )}
        {tab === "import" && <ImportView onLibraryChanged={refresh} />}
        {tab === "discover" && <DiscoverView onLibraryChanged={refresh} />}
        {tab === "projects" && (
          <ProjectsView skills={skills} onLibraryChanged={refresh} />
        )}
        {tab === "report" && <ReportView onChanged={refresh} />}
        {tab === "isolation" && <IsolationView onChanged={refresh} />}
      </main>
    </div>
  );
}

export default App;
