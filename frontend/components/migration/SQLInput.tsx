"use client"
import { useState, useRef, useCallback } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import type { MigrationAnalysis } from "@/lib/types"
import { ShieldCheck, Check } from "lucide-react"
import RiskReport from "./RiskReport"
import RollbackScript from "./RollbackScript"
import ExecuteConfirm from "./ExecuteConfirm"

const EXAMPLES = [
  {
    label: "Add column",
    sql: "ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;",
  },
  {
    label: "Create index",
    sql: "CREATE INDEX CONCURRENTLY idx_orders_created ON orders(created_at);",
  },
  {
    label: "Add FK column",
    sql: "ALTER TABLE orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal' NOT NULL;",
  },
]

function SkeletonCard() {
  return (
    <div className="card animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[70, 90, 55, 80].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: 16, width: `${w}%` }} />
      ))}
    </div>
  )
}

export default function SQLInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const connection = useAppStore((s) => s.connection)
  const addAdminActivity = useAppStore((s) => s.addAdminActivity)
  const [sql, setSql] = useState("")
  const [analysis, setAnalysis] = useState<MigrationAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [fixChanges, setFixChanges] = useState<string[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSqlFile(file: File) {
    if (!connectionId) return
    const text = await file.text()
    setFixing(true)
    setFixChanges([])
    setError(null)
    try {
      const result = await apiFetch<{ fixedSql: string; changes: string[] }>(
        "/api/migration/fix-sql",
        { method: "POST", body: JSON.stringify({ connectionId, sql: text }) }
      )
      setSql(result.fixedSql)
      setFixChanges(result.changes)
    } catch {
      // fallback: load raw SQL
      setSql(text)
    } finally {
      setFixing(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const file = Array.from(e.dataTransfer.files).find((f) => f.name.endsWith(".sql"))
    if (file) handleSqlFile(file)
  }, [connectionId])

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!connectionId || !sql.trim()) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setSuccess(false)
    try {
      const data = await apiFetch<MigrationAnalysis>("/api/migration/analyze", {
        method: "POST",
        body: JSON.stringify({ connectionId, sql }),
      })
      setAnalysis(data)
      addAdminActivity({
        kind: "migration",
        label: `Analyzed: ${sql.trim().split("\n")[0].slice(0, 60)}`,
        detail: sql.slice(0, 120),
        risk: data.risk_category,
        success: true,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header animate-fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={26} style={{ color: "var(--admin)" }} />
          <h1>MigrationGuard</h1>
        </div>
        <p>
          Paste a SQL migration for your clinic schema to get a risk score, sandbox results, blast radius, and a rollback script
          {connection && <> — analyzing against <span style={{ color: "var(--accent)", fontWeight: 600 }}>{connection.name}</span></>}.
        </p>
      </div>

      {/* SQL Input */}
      <form onSubmit={handleAnalyze} className="animate-fade-up delay-1">
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p className="section-label" style={{ margin: 0 }}>SQL migration</p>
            {/* Upload SQL file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fixing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--accent-subtle)", border: "0.5px solid var(--accent-mid)",
                borderRadius: 7, padding: "5px 12px", fontSize: 12,
                color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {fixing ? (
                <>
                  <span style={{ width: 11, height: 11, border: "1.5px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Claude fixing SQL…
                </>
              ) : (
                <> Upload .sql file</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSqlFile(f) }}
            />
          </div>

          {/* Claude fix notifications */}
          {fixChanges.length > 0 && (
            <div style={{
              background: "var(--success-subtle)", border: "0.5px solid var(--success)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12,
              color: "var(--success)", marginBottom: 10, lineHeight: 1.6,
            }}>
              <strong>Claude adjusted {fixChanges.length} thing{fixChanges.length > 1 ? "s" : ""} to match your schema:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                {fixChanges.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {/* Drop zone wrapper */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
            onDragLeave={() => setDraggingOver(false)}
            onDrop={onDrop}
            style={{
              position: "relative",
              border: draggingOver ? "2px dashed var(--accent)" : "none",
              borderRadius: 8,
              transition: "border 0.15s",
            }}
          >
            {draggingOver && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10, borderRadius: 8,
                background: "var(--accent-subtle)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 14, color: "var(--accent)", fontWeight: 600, pointerEvents: "none",
              }}>
                Drop .sql file to load
              </div>
            )}
            <textarea
              className="input-field"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder={"ALTER TABLE appointments ADD COLUMN clinic_id INTEGER;\nCREATE INDEX ON appointments(scheduled_at);"}
              rows={7}
              style={{
                fontFamily: "'Fira Code', 'Cascadia Code', ui-monospace, monospace",
                fontSize: 13, resize: "vertical", lineHeight: 1.7, width: "100%",
              }}
            />
          </div>

          {/* Example chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button"
                onClick={() => { setSql(ex.sql); setFixChanges([]) }}
                style={{
                  background: "var(--accent-subtle)", border: "0.5px solid var(--accent-mid)",
                  borderRadius: 6, padding: "4px 12px", fontSize: 12,
                  color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button type="submit" className="btn-primary" disabled={loading || fixing || !sql.trim()}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Analyzing…
                </span>
              ) : "Analyze migration →"}
            </button>
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="animate-fade-up" style={{
          background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
          borderRadius: 10, padding: "14px 18px", fontSize: 14,
          color: "var(--danger)", marginBottom: "1.25rem", lineHeight: 1.6,
        }}>
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="animate-fade-up" style={{
          background: "var(--success-subtle)", border: "0.5px solid var(--success)",
          borderRadius: 10, padding: "14px 18px", fontSize: 14,
          color: "var(--success)", fontWeight: 600, marginBottom: "1.25rem",
        }}>
          <Check size={14} style={{ display: "inline-block", marginRight: 6 }} />Migration executed successfully.
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <SkeletonCard />}

      {/* Analysis results */}
      {analysis && !loading && (
        <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card">
            <p className="section-label">Risk report</p>
            <RiskReport analysis={analysis} />
          </div>
          <div className="card">
            <p className="section-label">Rollback script</p>
            <RollbackScript rollbackPlan={analysis.rollback_plan} />
          </div>
          <div className="card">
            <p className="section-label">Execute migration</p>
            <ExecuteConfirm
              connectionId={connectionId!}
              sql={sql}
              approvalToken={analysis.approval_token}
              canExecute={analysis.sandbox_result.passed && analysis.risk_category !== "critical"}
              riskCategory={analysis.risk_category}
              onSuccess={() => {
                setSuccess(true)
                addAdminActivity({
                  kind: "migration",
                  label: `Executed: ${sql.trim().split("\n")[0].slice(0, 60)}`,
                  detail: sql.slice(0, 120),
                  risk: analysis!.risk_category,
                  success: true,
                })
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !loading && !error && (
        <div className="animate-fade-up delay-2" style={{
          textAlign: "center", padding: "4rem 2rem", color: "var(--text-disabled)",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--bg-surface), var(--border-subtle))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.5rem", color: "var(--text-disabled)",
          }}><ShieldCheck size={32} /></div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            Analyze before you ship
          </p>
          <p style={{ fontSize: 14 }}>
            Paste a SQL migration above. You&apos;ll see risk score, blast radius,<br />
            sandbox result, and a rollback script — before executing anything.
          </p>
        </div>
      )}
    </div>
  )
}
