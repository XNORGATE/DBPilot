"use client"
import Link from "next/link"
import { useAppStore } from "@/lib/store"
import type { ActivityItem } from "@/lib/types"
import { MessageSquare, PenLine, ShieldCheck, Sparkles, Users, Wrench, X, Circle } from "lucide-react"

function KindIcon({ kind }: { kind: string }) {
  const style = { display: "inline-flex", alignItems: "center" }
  if (kind === "query")     return <span style={style}><MessageSquare size={13} /></span>
  if (kind === "crud")      return <span style={style}><PenLine size={13} /></span>
  if (kind === "migration") return <span style={style}><ShieldCheck size={13} /></span>
  if (kind === "copilot")   return <span style={style}><Sparkles size={13} /></span>
  return <span style={style}><Circle size={8} /></span>
}

function ActivityList({ items, onClear }: { items: ActivityItem[]; onClear: () => void }) {
  if (items.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-disabled)", textAlign: "center", padding: "1.5rem 0" }}>
        No recent actions yet.
      </p>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {items.slice(0, 6).map((item) => (
        <div key={item.id} style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: "8px 10px",
          background: "var(--bg-page)",
          border: "0.5px solid var(--border-subtle)",
          borderRadius: 7,
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
      {items.length > 0 && (
        <button onClick={onClear} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--text-disabled)", textAlign: "right",
          padding: "2px 0", marginTop: 2,
        }}>
          Clear
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const connection   = useAppStore((s) => s.connection)
  const schema       = useAppStore((s) => s.schema)
  const staffActivity = useAppStore((s) => s.staffActivity)
  const adminActivity = useAppStore((s) => s.adminActivity)
  const clearStaff   = useAppStore((s) => s.clearStaffActivity)
  const clearAdmin   = useAppStore((s) => s.clearAdminActivity)
  const clearConnection = useAppStore((s) => s.clearConnection)

  const tables = (schema?.tables ?? []).map((t) =>
    t.includes(".") ? t.split(".").pop()! : t
  )

  return (
    <div style={{
      minHeight: "calc(100vh - var(--nav-height))",
      background: "var(--bg-page)",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Top header bar ── */}
      <div style={{
        borderBottom: "0.5px solid var(--border-subtle)",
        background: "var(--bg-card)",
        padding: "1rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.4 }}>
            YunoClinic · Clinic Command Center
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            AI-powered database access for staff and administrators
          </p>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--success-subtle)", border: "0.5px solid var(--success)",
          borderRadius: 10, padding: "8px 14px",
        }}>
          <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", position: "absolute" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--success)", animation: "pulse-ring 2s ease-out infinite" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--success-text)" }}>{connection?.name}</p>
            <p style={{ fontSize: 11, color: "var(--success)" }}>{tables.length} tables · live</p>
          </div>
          <button onClick={clearConnection} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--success)", opacity: 0.6, display: "flex", alignItems: "center",
          }}><X size={13} /></button>
        </div>
      </div>

      {/* ── Two-portal split ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>

        {/* ══ LEFT: Staff Portal ══ */}
        <div style={{
          borderRight: "0.5px solid var(--border-subtle)",
          display: "flex", flexDirection: "column",
          background: "var(--bg-page)",
        }}>
          {/* Section header */}
          <div style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "0.5px solid var(--border-subtle)",
            background: "linear-gradient(135deg, var(--accent-subtle) 0%, var(--bg-card) 100%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--accent)", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff", flexShrink: 0,
              }}><Users size={17} /></div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Staff Portal
                </p>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.3 }}>
                  Data Access & Records
                </h2>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, marginLeft: 44 }}>
              Ask questions about patient data, view reports, and add or update records — no SQL knowledge needed.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{ padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/chat" style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
                borderRadius: 12, padding: "1rem 1.25rem",
                transition: "box-shadow 0.15s",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <MessageSquare size={20} style={{ flexShrink: 0, color: "var(--accent)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>DataChat</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                    Ask plain-English questions and get live tables — &ldquo;How many patients were seen this week?&rdquo;
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>Open →</span>
              </div>
            </Link>

            <Link href="/chat?mode=agent" style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--bg-card)", border: "0.5px solid var(--accent-mid)",
                borderRadius: 12, padding: "1rem 1.25rem",
                transition: "box-shadow 0.15s",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <PenLine size={20} style={{ flexShrink: 0, color: "var(--accent)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
                    Record Assistant
                    <span style={{
                      marginLeft: 8, fontSize: 10, background: "var(--accent-subtle)",
                      color: "var(--accent)", border: "0.5px solid var(--accent-mid)",
                      borderRadius: 4, padding: "1px 6px", fontWeight: 700,
                    }}>NEW</span>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                    Add or update records in plain English — &ldquo;Add patient Sarah Johnson, born 1990-05-15&rdquo;. Shows risk before saving.
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>Open →</span>
              </div>
            </Link>

            {/* Tables quick reference */}
            {tables.length > 0 && (
              <div style={{
                background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
                borderRadius: 10, padding: "10px 14px",
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>
                  Available Tables
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {tables.map((t) => (
                    <span key={t} style={{
                      fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                      background: "var(--accent-subtle)", color: "var(--accent)",
                      border: "0.5px solid var(--accent-mid)", borderRadius: 5,
                      padding: "2px 8px",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Staff activity */}
          <div style={{
            flex: 1, padding: "0 1.75rem 1.5rem",
            borderTop: "0.5px solid var(--border-subtle)", paddingTop: "1rem", marginTop: "auto",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Staff Activity
            </p>
            <ActivityList items={staffActivity} onClear={clearStaff} />
          </div>
        </div>

        {/* ══ RIGHT: Admin Panel ══ */}
        <div style={{
          display: "flex", flexDirection: "column",
          background: "var(--bg-card)",
        }}>
          {/* Section header */}
          <div style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "0.5px solid var(--border-subtle)",
            background: "linear-gradient(135deg, var(--admin-subtle) 0%, var(--bg-card) 100%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--admin)", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#fff", flexShrink: 0,
              }}><Wrench size={17} /></div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--admin)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Admin Panel
                </p>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.3 }}>
                  Schema & Migrations
                </h2>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, marginLeft: 44 }}>
              Analyze and apply schema migrations safely. Generate SQL from plain English with full risk analysis.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{ padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/migration" style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
                borderRadius: 12, padding: "1rem 1.25rem",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <ShieldCheck size={20} style={{ flexShrink: 0, color: "var(--admin)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>MigrationGuard</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                    Paste SQL → instant risk score, sandbox test, blast radius report, and auto-generated rollback.
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "var(--admin)", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>Open →</span>
              </div>
            </Link>

            <Link href="/copilot" style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
                borderRadius: 12, padding: "1rem 1.25rem",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <Sparkles size={20} style={{ flexShrink: 0, color: "var(--success)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>DBCopilot</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.55 }}>
                    Describe a schema change in plain English — Claude generates the SQL and runs risk analysis automatically.
                  </p>
                </div>
                <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>Open →</span>
              </div>
            </Link>

            {/* Warning notice */}
            <div style={{
              background: "var(--admin-subtle)", border: "0.5px solid var(--admin)",
              borderRadius: 9, padding: "10px 14px", fontSize: 11,
              color: "var(--admin)", lineHeight: 1.6,
            }}>
              Admin actions affect the production database. All operations are sandboxed and require explicit approval.
            </div>
          </div>

          {/* Admin activity */}
          <div style={{
            flex: 1, padding: "0 1.75rem 1.5rem",
            borderTop: "0.5px solid var(--border-subtle)", paddingTop: "1rem", marginTop: "auto",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Admin Activity
            </p>
            <ActivityList items={adminActivity} onClear={clearAdmin} />
          </div>
        </div>
      </div>
    </div>
  )
}
