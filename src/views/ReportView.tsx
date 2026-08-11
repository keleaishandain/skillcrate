import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CurationReport } from "../types";

const VERDICTS: Record<string, { label: string; cls: string }> = {
  keep: { label: "保留", cls: "v-keep" },
  normal: { label: "正常", cls: "v-normal" },
  suggest: { label: "建议隔离", cls: "v-suggest" },
  observing: { label: "观察中", cls: "v-observe" },
};

export default function ReportView({ onChanged }: { onChanged: () => void }) {
  const [report, setReport] = useState<CurationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState("");
  const [confirming, setConfirming] = useState("");
  const [isolating, setIsolating] = useState("");
  const started = useRef(false);

  async function generate(t?: number) {
    setBusy(true);
    setError("");
    try {
      const r = await invoke<CurationReport>("analyze", {
        threshold: t ?? null,
      });
      setReport(r);
      setThreshold(String(r.threshold));
      setConfirming("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      generate();
    }
  }, []);

  async function isolate(dirName: string) {
    setIsolating(dirName);
    try {
      await invoke("isolate_skill", { dirName });
      await generate();
      onChanged();
    } catch (e) {
      alert(String(e));
    } finally {
      setIsolating("");
    }
  }

  function regenerate() {
    const t = parseFloat(threshold);
    generate(Number.isFinite(t) ? t : undefined);
  }

  return (
    <div className="report">
      <div className="report-bar">
        <button className="btn primary" onClick={regenerate} disabled={busy}>
          {busy ? "分析中…（首次扫描会话日志较慢）" : "重新生成报告"}
        </button>
        <label className="th-label">
          分组阈值
          <input
            className="th-input"
            value={threshold}
            onChange={(e) => setThreshold(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && regenerate()}
          />
        </label>
        {report && (
          <span className="muted">
            生成于 {report.generated_at} · 窗口 {report.window_days} 天 · 扫描{" "}
            {report.files_scanned} 个日志文件 · 数据源:{report.data_source} ·{" "}
            {report.judge_note}
          </span>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {busy && !report && (
        <div className="empty">正在做两段式分析：先分组，后裁决…</div>
      )}
      {report && !busy && report.groups.length === 0 && (
        <div className="empty">
          当前阈值（{report.threshold}）下没有职责重叠的技能组——库很干净，或把阈值调低再试。
        </div>
      )}

      {report?.groups.map((g, i) => (
        <section className="group" key={i}>
          <header className="group-head">
            <div className="kw">
              {g.keywords.map((k) => (
                <span className="chip" key={k}>
                  {k}
                </span>
              ))}
            </div>
            <span className="muted">
              组内 90 天共 {g.total_calls_90d} 次调用
              {g.observing ? " · 数据积累中，暂不裁决（冷启动保护）" : ""}
            </span>
          </header>
          {g.members.map((m) => {
            const v = VERDICTS[m.verdict] ?? VERDICTS.normal;
            return (
              <div className="member" key={m.dir_name}>
                <span className="m-name" title={m.dir_name}>
                  {m.name}
                </span>
                <div className="share-bar">
                  <div
                    className="share-fill"
                    style={{ width: `${Math.round(m.share * 100)}%` }}
                  />
                </div>
                <span className="m-stat">
                  {m.count_90d} 次 ·{" "}
                  {m.last_used_days == null
                    ? "从未调用"
                    : m.last_used_days === 0
                      ? "今天用过"
                      : `${m.last_used_days} 天前`}
                </span>
                <span className={`verdict ${v.cls}`}>{v.label}</span>
                {m.verdict === "suggest" &&
                  (confirming === m.dir_name ? (
                    <button
                      className="btn danger sm"
                      disabled={isolating === m.dir_name}
                      onClick={() => isolate(m.dir_name)}
                    >
                      {isolating === m.dir_name
                        ? "隔离中…"
                        : "确认隔离？（30 天可恢复）"}
                    </button>
                  ) : (
                    <button className="btn sm" onClick={() => setConfirming(m.dir_name)}>
                      隔离
                    </button>
                  ))}
              </div>
            );
          })}
        </section>
      ))}

      {report && (
        <p className="muted foot">
          {report.grouped_count} 个技能进入 {report.groups.length} 个职责组；
          {report.ungrouped_count} 个独门技能不参与冗余判定（组外豁免）；隔离区{" "}
          {report.isolated_count} 个。相似度为本地词法近似（E4），embedding + LLM
          复核在 V1.1。
        </p>
      )}
    </div>
  );
}
