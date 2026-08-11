import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ImportOutcome, TrendingRepo, TrendingView } from "../types";

type Props = {
  onLibraryChanged: () => void;
};

type RowState = {
  kind: "busy" | "success" | "error";
  message: string;
};

function fetchedAgo(fetchedAt: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - fetchedAt);
  if (seconds < 60) return "刚刚";
  return `${Math.floor(seconds / 60)} 分钟前`;
}

export default function DiscoverView({ onLibraryChanged }: Props) {
  const [view, setView] = useState<TrendingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const started = useRef(false);

  async function load(force: boolean) {
    setLoading(true);
    setError("");
    try {
      setView(await invoke<TrendingView>("trending", { force }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      load(false);
    }
  }, []);

  const importing = Object.values(rowStates).some((state) => state.kind === "busy");

  async function importRepo(repo: TrendingRepo) {
    if (importing) return;
    setRowStates((current) => ({
      ...current,
      [repo.full_name]: {
        kind: "busy",
        message: "导入中…（git 克隆可能要一会）",
      },
    }));
    try {
      const outcome = await invoke<ImportOutcome>("import_skill", {
        source: "git",
        reference: repo.clone_url,
      });
      setRowStates((current) => ({
        ...current,
        [repo.full_name]: {
          kind: "success",
          message: `已导入 ${outcome.imported.length} 个技能`,
        },
      }));
      onLibraryChanged();
    } catch (e) {
      setRowStates((current) => ({
        ...current,
        [repo.full_name]: { kind: "error", message: String(e) },
      }));
    }
  }

  return (
    <div className="discover">
      <div className="discover-bar">
        <button className="btn primary" disabled={loading} onClick={() => load(true)}>
          {loading ? "刷新中…" : "刷新榜单"}
        </button>
        <div className="discover-meta">
          {view && <span>数据取自 {fetchedAgo(view.fetched_at)}</span>}
          <span className="discover-source">来源：GitHub stars</span>
        </div>
      </div>

      {error && (
        <div className="error">
          <strong>读取热门榜单失败：</strong>
          {error}
          <p>请检查网络连接，或稍后点「刷新榜单」重试。</p>
        </div>
      )}
      {view && view.warnings.length > 0 && (
        <div className="warn">
          {view.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      {loading && !view && <div className="empty">正在读取 GitHub 热门榜单…</div>}
      {!loading && !error && view?.repos.length === 0 && (
        <div className="empty">榜单为空，点刷新试试</div>
      )}

      {view && view.repos.length > 0 && (
        <div className="trending-list">
          {view.repos.map((repo) => {
            const rowState = rowStates[repo.full_name];
            const busy = rowState?.kind === "busy";
            return (
              <article className="trending-row" key={repo.full_name}>
                <strong className="trending-name" title={repo.full_name}>
                  {repo.full_name}
                </strong>
                <span className="trending-stars">★ {repo.stars.toLocaleString("zh-CN")}</span>
                <p className="trending-description" title={repo.description}>
                  {repo.description || "（无描述）"}
                </p>
                <div className="trending-actions">
                  <button
                    className="btn primary sm"
                    disabled={loading || importing}
                    onClick={() => importRepo(repo)}
                  >
                    {busy ? "导入中…" : "导入"}
                  </button>
                  {rowState && (
                    <span className={`trending-result is-${rowState.kind}`}>
                      {rowState.message}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
