import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { IsolationEntry } from "../types";
import { TOOL_LABELS } from "../types";

export default function IsolationView({ onChanged }: { onChanged: () => void }) {
  const [entries, setEntries] = useState<IsolationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setEntries(await invoke<IsolationEntry[]>("isolation_list"));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function restore(dirName: string) {
    setBusy(dirName);
    try {
      await invoke("restore_skill", { dirName });
      await load();
      onChanged();
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy("");
    }
  }

  async function archive(dirName: string) {
    setBusy(dirName);
    try {
      await invoke("archive_skill", { dirName });
      setConfirming("");
      await load();
      onChanged();
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="isolation">
      {error && <div className="error">{error}</div>}
      {loading && <div className="empty">读取隔离区…</div>}
      {!loading && !error && entries.length === 0 && (
        <div className="empty">
          隔离区是空的。被隔离的技能会从所有工具撤下但保留文件，30 天内可一键恢复——本产品永不自动删除任何技能。
        </div>
      )}
      {entries.map((e) => (
        <div className="iso-row" key={e.dir_name}>
          <div className="iso-main">
            <strong>{e.name}</strong>
            <span className="muted">
              隔离于 {e.isolated_at} · 原同步到:
              {e.tools.length
                ? e.tools.map((t) => TOOL_LABELS[t] ?? t).join("、")
                : "（未同步任何工具）"}
            </span>
          </div>
          <span className={e.expired ? "iso-days expired" : "iso-days"}>
            {e.expired ? "已满 30 天，可归档" : `剩 ${e.days_left} 天`}
          </span>
          <button
            className="btn sm"
            disabled={busy === e.dir_name}
            onClick={() => restore(e.dir_name)}
          >
            恢复
          </button>
          {confirming === e.dir_name ? (
            <button
              className="btn danger sm"
              disabled={busy === e.dir_name}
              onClick={() => archive(e.dir_name)}
            >
              确认归档？（移出库，文件保留在 archive）
            </button>
          ) : (
            <button className="btn sm" onClick={() => setConfirming(e.dir_name)}>
              归档
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
