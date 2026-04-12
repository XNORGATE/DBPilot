import type { MigrationAnalysis } from "@/lib/types"

const RISK_CONFIG = {
  low:      { cls: "badge-success", color: "var(--success)", label: "Low" },
  medium:   { cls: "badge-warning", color: "var(--warning)", label: "Medium" },
  high:     { cls: "badge-high",    color: "var(--high)",    label: "High" },
  critical: { cls: "badge-danger",  color: "var(--danger)",  label: "Critical" },
}

export default function RiskPanel({ analysis }: { analysis: MigrationAnalysis }) {
  const cfg = RISK_CONFIG[analysis.risk_category]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Score line */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
          {analysis.risk_score}
        </span>
        <div>
          <span className={`badge ${cfg.cls}`}>{cfg.label} Risk</span>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>
            {analysis.total_statements} statement{analysis.total_statements !== 1 ? "s" : ""}
          </p>
        </div>
        {analysis.sandbox_result != null && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: analysis.sandbox_result.passed ? "var(--success)" : "var(--danger)",
              fontWeight: 600,
            }}
          >
            {analysis.sandbox_result.passed ? "Sandbox passed" : "Sandbox failed"}
          </div>
        )}
      </div>

      {/* Affected tables */}
      {(analysis.affected_tables ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(analysis.affected_tables ?? []).map((t, i) => (
            <span
              key={i}
              className={`badge ${t.impact === "direct" ? "badge-accent" : "badge-warning"}`}
            >
              {t.table}
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {analysis.rollback_plan?.has_irreversible && (
        <div
          style={{
            background: "var(--high-subtle)",
            border: "0.5px solid var(--high)",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 11,
            color: "var(--high)",
            fontWeight: 600,
          }}
        >
          Contains irreversible operations
        </div>
      )}
      {analysis.sandbox_result != null && !analysis.sandbox_result.passed && (
        <div
          style={{
            background: "var(--danger-subtle)",
            border: "0.5px solid var(--danger)",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 11,
            color: "var(--danger)",
            fontWeight: 600,
          }}
        >
          Sandbox failed — cannot apply this migration
        </div>
      )}
    </div>
  )
}
