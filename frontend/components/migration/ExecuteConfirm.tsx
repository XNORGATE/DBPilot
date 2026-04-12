"use client"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

interface Props {
  connectionId: string
  sql: string
  approvalToken: string
  canExecute: boolean
  riskCategory: string
  onSuccess: () => void
}

export default function ExecuteConfirm({
  connectionId, sql, approvalToken, canExecute, riskCategory, onSuccess,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExecute() {
    setLoading(true)
    setError(null)
    try {
      await apiFetch("/api/migration/execute", {
        method: "POST",
        body: JSON.stringify({ connectionId, sql, approvalToken }),
      })
      setOpen(false)
      onSuccess()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Execution failed")
    } finally {
      setLoading(false)
    }
  }

  const disabledReason =
    riskCategory === "critical"
      ? "Cannot execute critical-risk migrations."
      : !canExecute
      ? "Sandbox must pass before executing."
      : null

  return (
    <div>
      <button
        className="btn-danger-outline"
        onClick={() => setOpen(true)}
        disabled={!canExecute}
        title={disabledReason ?? undefined}
      >
        Execute migration
      </button>

      {disabledReason && (
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-disabled)" }}>{disabledReason}</p>
      )}

      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Confirm migration execution
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
              This will run the migration on your <strong>live database</strong>. The action cannot be fully undone — use the rollback script if needed.
            </p>

            {error && (
              <div
                style={{
                  background: "var(--danger-subtle)",
                  border: "0.5px solid var(--danger)",
                  borderRadius: 7,
                  padding: "9px 12px",
                  fontSize: 12,
                  color: "var(--danger)",
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </button>
              <button className="btn-danger-outline" onClick={handleExecute} disabled={loading}
                style={loading ? {} : { background: "var(--danger)", color: "#fff" }}
              >
                {loading ? "Executing…" : "Yes, execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
