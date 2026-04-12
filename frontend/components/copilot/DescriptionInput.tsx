"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import type { CopilotResult } from "@/lib/types"
import { Sparkles, ClipboardList, X } from "lucide-react"
import GeneratedSQL from "./GeneratedSQL"
import RiskPanel from "./RiskPanel"
import DocumentUpload from "./DocumentUpload"

const EXAMPLES = [
  { label: "Diagnosis notes",  text: "Add a diagnosis_notes text column to visits" },
  { label: "Patient archive",  text: "Add a soft delete (deleted_at) column to patients" },
  { label: "Appt index",       text: "Create an index on appointments.scheduled_at for performance" },
  { label: "Priority column",  text: "Add a priority enum column (low/medium/high) to appointments" },
  { label: "Timestamps",       text: "Add updated_at timestamp to all tables missing it" },
]

const RISK_COLOR: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--high)",
  critical: "var(--danger)",
}

interface HistoryItem {
  id: number
  description: string
  sql: string
  risk: string
  applied: boolean
  ts: string
}

function SkeletonCard() {
  return (
    <div className="card animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="skeleton" style={{ height: 16, width: "50%" }} />
      <div className="skeleton" style={{ height: 90, width: "100%" }} />
      <div className="skeleton" style={{ height: 16, width: "70%" }} />
    </div>
  )
}

export default function DescriptionInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const connection = useAppStore((s) => s.connection)
  const addAdminActivity = useAppStore((s) => s.addAdminActivity)
  const [description, setDescription] = useState("")
  const [result, setResult] = useState<CopilotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [uploadedSqlPreview, setUploadedSqlPreview] = useState<string | null>(null)

  function handleSqlFixed(sql: string) {
    setUploadedSqlPreview(sql)
    setDescription("Review and apply the uploaded SQL migration")
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault()
    if (!connectionId || !description.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setApplied(false)
    try {
      const data = await apiFetch<CopilotResult>("/api/copilot/generate", {
        method: "POST",
        body: JSON.stringify({ connectionId, description }),
      })
      setResult(data)
      addAdminActivity({
        kind: "copilot",
        label: `Generated: ${description}`,
        detail: data.generatedSql.slice(0, 120),
        risk: data.analysis.risk_category,
        success: true,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    if (!result) return
    setApplying(true)
    setError(null)
    try {
      await apiFetch("/api/migration/execute", {
        method: "POST",
        body: JSON.stringify({
          connectionId,
          sql: result.generatedSql,
          approvalToken: result.analysis.approval_token,
        }),
      })
      setApplied(true)
      addAdminActivity({
        kind: "copilot",
        label: description,
        detail: result.generatedSql.slice(0, 120),
        risk: result.analysis.risk_category,
        success: true,
      })
      // Add to history
      const item: HistoryItem = {
        id: Date.now(),
        description,
        sql: result.generatedSql,
        risk: result.analysis.risk_category,
        applied: true,
        ts: new Date().toLocaleTimeString(),
      }
      setHistory((h) => [item, ...h].slice(0, 20))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  function handleStartOver() {
    // If there's a result not yet applied, save it to history as "not applied"
    if (result && !applied) {
      const item: HistoryItem = {
        id: Date.now(),
        description,
        sql: result.generatedSql,
        risk: result.analysis.risk_category,
        applied: false,
        ts: new Date().toLocaleTimeString(),
      }
      setHistory((h) => [item, ...h].slice(0, 20))
    }
    setResult(null)
    setApplied(false)
    setError(null)
  }

  const sandboxOk = result?.analysis?.sandbox_result == null || result?.analysis?.sandbox_result?.passed
  const canApply = sandboxOk && result?.analysis?.risk_category !== "critical"

  return (
    <div style={{
      height: "calc(100vh - var(--nav-height))",
      display: "flex",
      background: "var(--bg-page)",
      overflow: "hidden",
    }}>

      {/* ── History sidebar ── */}
      <aside style={{
        width: 280,
        flexShrink: 0,
        borderRight: "0.5px solid var(--border-subtle)",
        background: "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        padding: "1.5rem 1.25rem",
        gap: "1rem",
      }}>
        <div>
          <p className="section-label">Recent Migrations</p>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-disabled)" }}>
              <div style={{ marginBottom: 8, color: "var(--text-disabled)" }}><ClipboardList size={28} /></div>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                Generated migrations will appear here
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((item) => (
                <div key={item.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: `0.5px solid ${item.applied ? "var(--success)" : "var(--border-subtle)"}`,
                    borderRadius: 9, padding: "10px 12px", cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                      background: RISK_COLOR[item.risk] || "var(--text-disabled)",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 12, fontWeight: 600, color: "var(--text-primary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{item.description}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--text-disabled)" }}>{item.ts}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: item.applied ? "var(--success)" : "var(--text-tertiary)",
                        }}>
                          {item.applied ? "Applied" : "Skipped"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {expandedId === item.id && (
                    <pre className="code-block" style={{ marginTop: 8, fontSize: 10, maxHeight: 120, overflowY: "auto" }}>
                      {item.sql}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            style={{
              background: "none", border: "0.5px solid var(--border-subtle)",
              borderRadius: 8, padding: "7px 12px", fontSize: 12,
              color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Clear history
          </button>
        )}

        <hr className="divider" style={{ margin: 0 }} />

        {/* Upload SQL / Context */}
        <div>
          <DocumentUpload onSqlFixed={handleSqlFixed} />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
        {/* Header */}
        <div className="page-header animate-fade-up">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Sparkles size={26} style={{ color: "var(--accent)" }} />
            <h1>DBCopilot</h1>
          </div>
          <p>
            Describe a clinic schema change in plain English — Claude generates the SQL, AutoDB analyzes the risk
            {connection && <>, connected to <span style={{ color: "var(--accent)", fontWeight: 600 }}>{connection.name}</span></>}.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleGenerate} className="animate-fade-up delay-1">
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            {uploadedSqlPreview && (
            <div style={{
              background: "var(--success-subtle)", border: "0.5px solid var(--success)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 10, fontSize: 12,
              color: "var(--success)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <strong>SQL file loaded — Claude-verified against your schema</strong>
                <button type="button" onClick={() => setUploadedSqlPreview(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", opacity: 0.7, display: "flex", alignItems: "center" }}>
                  <X size={13} />
                </button>
              </div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", maxHeight: 80, overflowY: "auto", color: "var(--text-secondary)" }}>
                {uploadedSqlPreview.slice(0, 300)}{uploadedSqlPreview.length > 300 ? "…" : ""}
              </pre>
            </div>
          )}
          <p className="section-label">What change do you want to make to the clinic schema?</p>
            <input
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerate() }}
              placeholder="Describe a change, e.g. 'Add a soft delete column to the users table'"
              disabled={loading}
              style={{ fontSize: 15 }}
            />

            {/* Example chips */}
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", alignSelf: "center" }}>Try:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.label} type="button"
                  onClick={() => setDescription(ex.text)}
                  style={{
                    background: "var(--accent-subtle)", border: "0.5px solid var(--accent-mid)",
                    borderRadius: 6, padding: "5px 12px", fontSize: 12,
                    color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={loading || !description.trim()}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Claude is thinking…
                  </span>
                ) : "Generate SQL with Claude →"}
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

        {/* Loading */}
        {loading && <SkeletonCard />}

        {/* Success */}
        {applied && (
          <div className="animate-fade-up" style={{
            background: "var(--success-subtle)", border: "0.5px solid var(--success)",
            borderRadius: 10, padding: "14px 18px", fontSize: 14,
            color: "var(--success)", fontWeight: 600, marginBottom: "1.25rem",
          }}>
            Migration applied successfully to {connection?.name}.
          </div>
        )}

        {/* Results */}
        {result && !loading && !applied && (
          <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="card">
              <GeneratedSQL sql={result.generatedSql} />
            </div>
            <div className="card">
              <p className="section-label">Risk analysis</p>
              <RiskPanel analysis={result.analysis} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={handleStartOver}>
                Start over
              </button>
              <button
                className="btn-success"
                onClick={handleApply}
                disabled={applying || !canApply}
                title={!canApply ? "Sandbox must pass and risk must not be critical" : undefined}
              >
                {applying ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    Applying…
                  </span>
                ) : "Apply migration →"}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="animate-fade-up delay-2" style={{
            textAlign: "center", padding: "4rem 2rem", color: "var(--text-disabled)",
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--bg-surface), var(--border-subtle))",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1.5rem", color: "var(--text-disabled)",
            }}><Sparkles size={32} /></div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              Describe, generate, analyze, apply
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7 }}>
              Tell Claude what you want to change in plain English.<br />
              It generates the SQL for your clinic schema — AutoDB sandboxes it and rates the risk — you decide to apply.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
