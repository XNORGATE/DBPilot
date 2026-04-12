import type { MigrationAnalysis } from "@/lib/types"
import { Check, X } from "lucide-react"

const RISK_CONFIG = {
  low:      { cls: "badge-success", label: "LOW",      barColor: "var(--success)", barPct: "20%" },
  medium:   { cls: "badge-warning", label: "MEDIUM",   barColor: "var(--warning)", barPct: "40%" },
  high:     { cls: "badge-high",    label: "HIGH",     barColor: "var(--high)",    barPct: "65%" },
  critical: { cls: "badge-danger",  label: "CRITICAL", barColor: "var(--danger)",  barPct: "90%" },
}

export default function RiskReport({ analysis }: { analysis: MigrationAnalysis }) {
  const cfg = RISK_CONFIG[analysis.risk_category]
  const barPct = `${analysis.risk_score}%`

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Score + category */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1,
              color: cfg.barColor,
            }}
          >
            {analysis.risk_score}
          </div>
          <span className={`badge ${cfg.cls}`} style={{ marginTop: 4 }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
            {analysis.total_statements} statement{analysis.total_statements !== 1 ? "s" : ""} · Risk scale
          </div>
          {/* Risk bar */}
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: 6,
              height: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: barPct,
                height: "100%",
                background: cfg.barColor,
                borderRadius: 6,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((l) => (
              <span key={l} style={{ fontSize: 9, fontWeight: 700, color: "var(--text-disabled)", letterSpacing: "0.05em" }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Sandbox result */}
      <div
        style={{
          background: analysis.sandbox_result.passed ? "var(--success-subtle)" : "var(--danger-subtle)",
          border: `0.5px solid ${analysis.sandbox_result.passed ? "var(--success)" : "var(--danger)"}`,
          borderRadius: 7,
          padding: "9px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: analysis.sandbox_result.passed ? "var(--success)" : "var(--danger)",
          fontWeight: 600,
        }}
      >
        {analysis.sandbox_result.passed ? <Check size={14} /> : <X size={14} />}
        Sandbox {analysis.sandbox_result.passed ? "passed" : "failed"}
        <span style={{ fontWeight: 400, color: analysis.sandbox_result.passed ? "var(--success-text)" : "var(--danger-text)" }}>
          · {analysis.sandbox_result.duration_ms}ms
        </span>
        {!analysis.sandbox_result.passed && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400 }}>
            Fix your SQL before proceeding
          </span>
        )}
      </div>

      {/* Affected tables */}
      {analysis.affected_tables.length > 0 && (
        <div>
          <p className="section-label">Blast radius — affected tables</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {analysis.affected_tables.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "var(--bg-surface)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <span
                  className={`badge ${t.impact === "direct" ? "badge-accent" : "badge-warning"}`}
                >
                  {t.impact}
                </span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{t.table}</span>
                {t.cascade_path && (
                  <span style={{ color: "var(--text-disabled)", fontSize: 11 }}>
                    via {t.cascade_path.join(" → ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
