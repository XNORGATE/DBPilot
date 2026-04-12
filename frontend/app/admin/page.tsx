"use client"
import Link from "next/link"
import { useAppStore } from "@/lib/store"
import type { ActivityItem } from "@/lib/types"
import { ShieldCheck, Sparkles, MessageSquare, PenLine, Wrench, Database, Circle } from "lucide-react"

function KindIcon({ kind }: { kind: string }) {
  if (kind === "migration") return <ShieldCheck size={13} />
  if (kind === "copilot")   return <Sparkles size={13} />
  if (kind === "query")     return <MessageSquare size={13} />
  if (kind === "crud")      return <PenLine size={13} />
  return <Circle size={8} />
}

function ActivityFeed({ items, onClear }: { items: ActivityItem[]; onClear: () => void }) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-disabled)" }}>
        <div style={{ marginBottom: 8, color: "var(--text-disabled)" }}><ShieldCheck size={28} /></div>
        <p style={{ fontSize: 12, lineHeight: 1.6 }}>No admin actions yet.</p>
      </div>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.slice(0, 20).map((item) => (
        <div key={item.id} style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "9px 11px",
          background: "var(--bg-page)",
          border: "0.5px solid var(--border-subtle)",
          borderRadius: 8,
        }}>
          <span style={{ flexShrink: 0, color: "var(--text-tertiary)", display: "flex", alignItems: "center", marginTop: 1 }}><KindIcon kind={item.kind} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{item.label}</p>
            {item.detail && (
              <p style={{
                fontSize: 10, color: "var(--text-disabled)", fontFamily: "monospace",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{item.detail}</p>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: item.success ? "var(--success)" : "var(--danger)" }}>
              {item.success ? "OK" : "ERR"}
            </span>
            <p style={{ fontSize: 9, color: "var(--text-disabled)", marginTop: 1 }}>{item.ts}</p>
          </div>
        </div>
      ))}
      <button onClick={onClear} style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 11, color: "var(--text-disabled)", textAlign: "right",
        padding: "2px 0", marginTop: 2,
      }}>
        Clear log
      </button>
    </div>
  )
}

export default function AdminPage() {
  const connection = useAppStore((s) => s.connection)
  const schema = useAppStore((s) => s.schema)
  const adminActivity = useAppStore((s) => s.adminActivity)
  const clearAdmin = useAppStore((s) => s.clearAdminActivity)

  const tables = (schema?.tables ?? []).map((t) =>
    t.includes(".") ? t.split(".").pop()! : t
  )

  const migrationCount = adminActivity.filter((a) => a.kind === "migration").length
  const copilotCount = adminActivity.filter((a) => a.kind === "copilot").length

  return (
    <div style={{
      minHeight: "calc(100vh - var(--nav-height))",
      display: "flex",
      background: "var(--bg-page)",
    }}>
      {/* ── Left sidebar: activity log ── */}
      <aside style={{
        width: 300, flexShrink: 0,
        borderRight: "0.5px solid var(--border-subtle)",
        background: "var(--bg-card)",
        display: "flex", flexDirection: "column",
        overflowY: "auto", padding: "1.5rem",
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          Admin Activity Log
        </p>
        <ActivityFeed items={adminActivity} onClear={clearAdmin} />
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem", maxWidth: 760 }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "var(--admin)", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, color: "#fff",
            }}><Wrench size={22} /></div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.5 }}>
                Admin Panel
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
                Clinic schema management, migrations, and AI-powered database changes
              </p>
            </div>
          </div>

          {/* Warning bar */}
          <div style={{
            background: "var(--admin-subtle)", border: "0.5px solid var(--admin)",
            borderRadius: 9, padding: "10px 16px", fontSize: 12,
            color: "var(--admin)", lineHeight: 1.6, display: "flex", gap: 8, alignItems: "center",
          }}>
            <ShieldCheck size={14} style={{ flexShrink: 0 }} />
            Admin actions affect the live clinic database. All operations are sandboxed and require explicit approval before execution.
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: "2rem" }}>
          {[
            { label: "Tables",      value: tables.length,   Icon: Database,    sub: "in schema"    },
            { label: "Migrations",  value: migrationCount,  Icon: ShieldCheck, sub: "this session" },
            { label: "Generated SQL", value: copilotCount,  Icon: Sparkles,    sub: "via DBCopilot" },
          ].map(({ label, value, Icon, sub }) => (
            <div key={label} style={{
              background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
              borderRadius: 12, padding: "1rem 1.25rem",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <Icon size={22} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{label} · {sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tool cards */}
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          Admin Tools
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "2rem" }}>

          <Link href="/migration" style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
              borderRadius: 14, padding: "1.25rem 1.5rem",
              display: "flex", alignItems: "flex-start", gap: 16,
              transition: "box-shadow 0.15s",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--admin-subtle)", border: "0.5px solid var(--admin)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: "var(--admin)",
              }}><ShieldCheck size={22} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>MigrationGuard</p>
                  {migrationCount > 0 && (
                    <span style={{
                      fontSize: 10, background: "var(--admin-subtle)", color: "var(--admin)",
                      border: "0.5px solid var(--admin)", borderRadius: 4, padding: "1px 7px", fontWeight: 700,
                    }}>{migrationCount} run</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 10 }}>
                  Safely evolve your clinic schema. Paste any SQL migration → instant risk score (0–10), sandbox dry-run, blast radius, and auto-rollback.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Risk scoring", "Sandbox test", "Rollback generation", "Blast radius"].map((f) => (
                    <span key={f} style={{
                      fontSize: 11, background: "var(--bg-surface)",
                      border: "0.5px solid var(--border-subtle)", borderRadius: 5,
                      padding: "2px 8px", color: "var(--text-tertiary)",
                    }}>{f}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: 13, color: "var(--admin)", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>Open →</span>
            </div>
          </Link>

          <Link href="/copilot" style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
              borderRadius: 14, padding: "1.25rem 1.5rem",
              display: "flex", alignItems: "flex-start", gap: 16,
              transition: "box-shadow 0.15s",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--accent-subtle)", border: "0.5px solid var(--accent-mid)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: "var(--accent)",
              }}><Sparkles size={22} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>DBCopilot</p>
                  {copilotCount > 0 && (
                    <span style={{
                      fontSize: 10, background: "var(--accent-subtle)", color: "var(--accent)",
                      border: "0.5px solid var(--accent-mid)", borderRadius: 4, padding: "1px 7px", fontWeight: 700,
                    }}>{copilotCount} generated</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 10 }}>
                  Describe a clinic schema change in plain English — &ldquo;add a diagnosis_notes column to visits&rdquo; — Claude generates and sandboxes the SQL.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["Natural language SQL", "Auto risk analysis", "SQL file import", "Schema-aware fix"].map((f) => (
                    <span key={f} style={{
                      fontSize: 11, background: "var(--bg-surface)",
                      border: "0.5px solid var(--border-subtle)", borderRadius: 5,
                      padding: "2px 8px", color: "var(--text-tertiary)",
                    }}>{f}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>Open →</span>
            </div>
          </Link>
        </div>

        {/* Available tables */}
        {tables.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Schema — {tables.length} Tables
            </p>
            <div style={{
              background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
              borderRadius: 12, padding: "1rem 1.25rem",
            }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tables.map((t) => (
                  <span key={t} style={{
                    fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                    background: "var(--bg-surface)", color: "var(--text-secondary)",
                    border: "0.5px solid var(--border-subtle)", borderRadius: 5,
                    padding: "3px 9px",
                  }}>{t}</span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 10 }}>
                Connected to <strong style={{ color: "var(--success-text)" }}>{connection?.name}</strong>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
