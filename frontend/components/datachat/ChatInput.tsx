"use client"
import { useState, useEffect, useRef } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import type { ChatResult, AgentResult } from "@/lib/types"
import ResultsTable from "./ResultsTable"
import ResultsChart from "./ResultsChart"
import { Hash, Trophy, TrendingUp, BarChart2, Search, Lightbulb, Bot, ChevronUp, ChevronDown, PenLine, MessageSquare, Info, Check, X } from "lucide-react"

// ── Message types ─────────────────────────────────────────────────────────────

interface ReadMessage {
  type: "read"
  id: number
  query: string
  result: ChatResult
  error?: string
}

interface CrudMessage {
  type: "crud"
  id: number
  query: string
  agentResult: AgentResult
  status: "pending" | "confirmed" | "cancelled" | "error"
  execError?: string
}

type Message = ReadMessage | CrudMessage

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWriteIntent(q: string): boolean {
  const lower = q.toLowerCase()
  const writeVerb = /\b(add|insert|register|create new|create a new|add a new|add new|update|edit|change|modify|set)\b/.test(lower)
  const readVerb = /\b(show|list|find|get|count|how many|what|which|who|when|where|total|avg|average|top|all|describe|tell me|select)\b/.test(lower)
  return writeVerb && !readVerb
}

function QueryIcon({ q, size = 15 }: { q: string; size?: number }) {
  const lower = q.toLowerCase()
  if (/how many|count|total number/.test(lower)) return <Hash size={size} />
  if (/top|highest|most|best|largest/.test(lower)) return <Trophy size={size} />
  if (/trend|over time|by month|by day|by week/.test(lower)) return <TrendingUp size={size} />
  if (/average|avg|sum|revenue|sales/.test(lower)) return <BarChart2 size={size} />
  if (/show|list|find|get|all/.test(lower)) return <Search size={size} />
  return <Lightbulb size={size} />
}

const RISK_COLOR: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--warning)",
  high: "var(--danger)",
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const cls = confidence >= 0.9 ? "badge-success" : confidence >= 0.7 ? "badge-warning" : "badge-danger"
  return <span className={`badge ${cls}`}>Confidence {pct}%</span>
}

function ThinkingBubble({ label = "Analyzing your database…" }: { label?: string }) {
  return (
    <div className="animate-fade-up" style={{
      display: "flex", alignItems: "flex-start", gap: 12, marginBottom: "1.5rem",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent) 0%, #0a3d5e 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      }}><Bot size={16} /></div>
      <div style={{
        background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
        borderRadius: "4px 12px 12px 12px", padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%", background: "var(--accent)",
            animation: `skeleton-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
        <span style={{ fontSize: 13, color: "var(--text-tertiary)", marginLeft: 4 }}>{label}</span>
      </div>
    </div>
  )
}

function ReadMessageBubble({ message, index }: { message: ReadMessage; index: number }) {
  const hasError = !!message.error
  const hasData = !!message.result.markdown_output
  const [showSql, setShowSql] = useState(hasError)

  return (
    <div className="animate-fade-up" style={{ marginBottom: "2rem", animationDelay: `${index * 0.05}s` }}>
      {/* User query */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{
          background: "var(--accent)", color: "#fff",
          borderRadius: "12px 4px 12px 12px",
          padding: "11px 18px", fontSize: 14, maxWidth: "75%", lineHeight: 1.5,
        }}>
          {message.query}
        </div>
      </div>

      {/* AI response */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent) 0%, #0a3d5e 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          fontWeight: 700, color: "#fff",
        }}>DB</div>

        <div style={{
          flex: 1, background: "var(--bg-card)",
          border: `0.5px solid ${hasError ? "var(--danger)" : "var(--border-subtle)"}`,
          borderRadius: "4px 12px 12px 12px",
          padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <ConfidenceBadge confidence={message.result.confidence} />
            {(message.result.referenced_tables ?? []).slice(0, 4).map(t => (
              <span key={t} style={{
                background: "var(--accent-subtle)", color: "var(--accent)",
                fontSize: 11, padding: "2px 8px", borderRadius: 5,
                fontFamily: "monospace", fontWeight: 600,
              }}>{t.split(".").pop()}</span>
            ))}
          </div>

          {hasError && (
            <div style={{
              background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--danger)", lineHeight: 1.6,
            }}>
              <strong>Query failed:</strong> {message.error}
            </div>
          )}

          {hasData && <ResultsTable markdownOutput={message.result.markdown_output} />}

          {!hasData && !hasError && (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              Query ran successfully — 0 rows returned.
            </p>
          )}

          {hasData && (
            <ResultsChart
              markdownOutput={message.result.markdown_output}
              referencedTables={message.result.referenced_tables}
            />
          )}

          {message.result.reasoning && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              {message.result.reasoning}
            </p>
          )}

          <button onClick={() => setShowSql(!showSql)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--text-disabled)", padding: 0, textAlign: "left",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {showSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showSql ? "Hide SQL" : "View SQL"}
          </button>
          {showSql && <pre className="code-block">{message.result.sql}</pre>}
        </div>
      </div>
    </div>
  )
}

function CrudMessageBubble({
  message, index, onConfirm, onCancel, confirming,
}: {
  message: CrudMessage
  index: number
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
}) {
  const { agentResult, status, execError } = message
  const [showSql, setShowSql] = useState(false)

  const riskColor = RISK_COLOR[agentResult.risk] ?? "var(--text-disabled)"

  return (
    <div className="animate-fade-up" style={{ marginBottom: "2rem", animationDelay: `${index * 0.05}s` }}>
      {/* User query */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{
          background: "var(--accent)", color: "#fff",
          borderRadius: "12px 4px 12px 12px",
          padding: "11px 18px", fontSize: 14, maxWidth: "75%", lineHeight: 1.5,
        }}>
          {message.query}
        </div>
      </div>

      {/* Agent confirmation bubble */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: status === "confirmed" ? "var(--success)" :
                      status === "cancelled" ? "var(--bg-surface)" :
                      status === "error" ? "var(--danger)" :
                      "linear-gradient(135deg, var(--accent) 0%, #0a3d5e 100%)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>
          {status === "confirmed" ? <Check size={16} /> :
           status === "cancelled" ? <X size={16} /> :
           status === "error" ? <X size={16} /> : <PenLine size={16} />}
        </div>

        <div style={{
          flex: 1, background: "var(--bg-card)",
          border: `0.5px solid ${
            status === "confirmed" ? "var(--success)" :
            status === "cancelled" ? "var(--border-subtle)" :
            status === "error" ? "var(--danger)" :
            "var(--accent-mid)"
          }`,
          borderRadius: "4px 12px 12px 12px",
          padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12,
        }}>

          {/* Blocked */}
          {agentResult.intent === "blocked" && (
            <div style={{
              background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--danger)", lineHeight: 1.6,
            }}>
              <strong>Operation not permitted:</strong> {agentResult.block_reason}
            </div>
          )}

          {/* Pending confirmation */}
          {agentResult.intent !== "blocked" && status === "pending" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  background: agentResult.intent === "insert" ? "var(--accent-subtle)" : "var(--admin-subtle)",
                  color: agentResult.intent === "insert" ? "var(--accent)" : "var(--admin)",
                  border: `0.5px solid ${agentResult.intent === "insert" ? "var(--accent-mid)" : "var(--admin-mid)"}`,
                  borderRadius: 5, padding: "2px 8px",
                }}>
                  {agentResult.intent === "insert" ? "New record" : "Update record"}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  color: riskColor, background: "var(--bg-surface)",
                  border: `0.5px solid ${riskColor}`,
                  borderRadius: 5, padding: "2px 8px",
                }}>
                  Risk: {agentResult.risk.toUpperCase()}
                </span>
              </div>

              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {agentResult.description}
              </p>

              {/* Preview data */}
              {agentResult.preview_data && agentResult.preview_data.rows.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {agentResult.intent === "update" ? "Records that will be modified" : "Preview"}
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {agentResult.preview_data.columns.map((col) => (
                            <th key={col} style={{
                              padding: "6px 10px", textAlign: "left",
                              background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)",
                              color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap",
                            }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentResult.preview_data.rows.slice(0, 5).map((row, ri) => (
                          <tr key={ri} style={{ borderBottom: "0.5px solid var(--border-subtle)" }}>
                            {agentResult.preview_data!.columns.map((col) => (
                              <td key={col} style={{ padding: "6px 10px", color: "var(--text-secondary)" }}>
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {agentResult.preview_data === null && agentResult.intent === "insert" && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  A new record will be created.
                </p>
              )}

              {/* SQL toggle */}
              <button onClick={() => setShowSql(!showSql)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--text-disabled)", padding: 0, textAlign: "left",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {showSql ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showSql ? "Hide SQL" : "View SQL"}
              </button>
              {showSql && <pre className="code-block">{agentResult.sql}</pre>}

              {/* Warning for high risk */}
              {agentResult.risk === "high" && (
                <div style={{
                  background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--danger)", lineHeight: 1.5,
                }}>
                  High-risk operation. Please review the SQL carefully before confirming.
                </div>
              )}

              {/* Confirm / Cancel */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onCancel} disabled={confirming} style={{
                  background: "none", border: "0.5px solid var(--border-default)",
                  borderRadius: 8, padding: "8px 18px", fontSize: 13,
                  color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit",
                }}>
                  Cancel
                </button>
                <button onClick={onConfirm} disabled={confirming} style={{
                  background: "var(--success)", border: "none",
                  borderRadius: 8, padding: "8px 20px", fontSize: 13,
                  color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {confirming ? (
                    <>
                      <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                      Saving…
                    </>
                  ) : "Confirm & Save →"}
                </button>
              </div>
            </>
          )}

          {/* Confirmed */}
          {status === "confirmed" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Check size={20} style={{ color: "var(--success)" }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                  {agentResult.intent === "insert" ? "Record added successfully" : "Record updated successfully"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{agentResult.description}</p>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {status === "cancelled" && (
            <p style={{ fontSize: 13, color: "var(--text-disabled)", fontStyle: "italic" }}>
              Operation cancelled.
            </p>
          )}

          {/* Error */}
          {status === "error" && (
            <div style={{
              background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--danger)", lineHeight: 1.6,
            }}>
              <strong>Failed:</strong> {execError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  const schema = useAppStore((s) => s.schema)
  const tables = schema?.tables ?? []
  const hasClinic = tables.some((t) => t.includes("patient") || t.includes("diagnos"))
  const STARTERS = hasClinic
    ? [
        "How many patients were seen this month?",
        "Show upcoming scheduled appointments",
        "Which doctor has the most completed visits?",
        "List all moderate or critical diagnoses",
        "Add patient Jane Smith, born 1988-03-22",
      ]
    : [
        "Show me all tables",
        "Count total rows in each table",
        "Show recent records",
      ]

  return (
    <div className="animate-fade-up" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", padding: "3rem 2rem", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, var(--accent-subtle), var(--accent-mid))",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "1.5rem", color: "var(--accent)",
        boxShadow: "0 8px 24px rgba(20,105,160,0.15)",
      }}>
        <MessageSquare size={32} />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        Ask questions or make changes
      </h3>
      <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: "2rem", maxWidth: 420, lineHeight: 1.65 }}>
        Ask questions in plain English to query your data, or describe a change to add/update records safely.
        {schema && <><br /><span style={{ color: "var(--accent)", fontWeight: 500 }}>{schema.table_count} tables</span> are ready.</>}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {STARTERS.map((q, i) => (
          <button key={i} onClick={() => onSuggest(q)}
            className={`animate-fade-up delay-${i + 1}`}
            style={{
              background: "var(--bg-card)", border: "0.5px solid var(--border-subtle)",
              borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const connection = useAppStore((s) => s.connection)
  const schema = useAppStore((s) => s.schema)
  const addStaffActivity = useAppStore((s) => s.addStaffActivity)

  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [autocomplete, setAutocomplete] = useState<string[]>([])
  const [acSelected, setAcSelected] = useState(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load AI suggestions on mount
  useEffect(() => {
    if (!connectionId || !schema?.tables?.length) return
    setSuggestionsLoading(true)
    apiFetch<{ suggestions: string[] }>("/api/chat/suggestions", {
      method: "POST",
      body: JSON.stringify({ connectionId, tables: schema.tables }),
    })
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false))
  }, [connectionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  function handleQueryChange(val: string) {
    setQuery(val)
    setAcSelected(0)
    if (val.length > 1 && schema?.tables) {
      const lastWord = val.split(/\s+/).pop()?.toLowerCase() || ""
      if (lastWord.length >= 2) {
        const matches = schema.tables
          .filter((t) => t.toLowerCase().includes(lastWord) && t.toLowerCase() !== lastWord)
          .slice(0, 5)
        setAutocomplete(matches)
        return
      }
    }
    setAutocomplete([])
  }

  function applyAutocomplete(table: string) {
    const words = query.trimEnd().split(/\s+/)
    words[words.length - 1] = table
    setQuery(words.join(" ") + " ")
    setAutocomplete([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (autocomplete.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcSelected((s) => Math.min(s + 1, autocomplete.length - 1)); return }
      if (e.key === "ArrowUp")   { e.preventDefault(); setAcSelected((s) => Math.max(s - 1, 0)); return }
      if (e.key === "Tab" || e.key === "Enter") {
        if (autocomplete.length > 0) { e.preventDefault(); applyAutocomplete(autocomplete[acSelected]); return }
      }
      if (e.key === "Escape") { setAutocomplete([]); return }
    }
    if (e.key === "Enter" && !e.shiftKey && autocomplete.length === 0) {
      e.preventDefault()
      submitQuery()
    }
  }

  async function submitQuery(overrideQuery?: string) {
    const q = (overrideQuery ?? query).trim()
    if (!connectionId || !q) return
    setLoading(true)
    setError(null)
    setAutocomplete([])
    if (!overrideQuery) setQuery("")

    try {
      if (isWriteIntent(q)) {
        // ── CRUD agent path ─────────────────────────────────────────────────
        const data = await apiFetch<AgentResult>("/api/chat/agent", {
          method: "POST",
          body: JSON.stringify({ connectionId, query: q }),
        })

        // If agent classifies as SELECT, fall through to read path
        if (data.intent === "select") {
          const readData = await apiFetch<ChatResult>("/api/chat", {
            method: "POST",
            body: JSON.stringify({ connectionId, query: q }),
          })
          const execErr = readData.execution_error ?? undefined
          setMessages((prev) => [...prev, { type: "read", id: Date.now(), query: q, result: readData, error: execErr }])
          addStaffActivity({ kind: "query", label: q, detail: readData.sql, success: !execErr && !!readData.markdown_output })
        } else {
          // Blocked or DML — show confirmation bubble
          const id = Date.now()
          setMessages((prev) => [...prev, { type: "crud", id, query: q, agentResult: data, status: "pending" }])
          addStaffActivity({ kind: "crud", label: q, detail: data.sql, success: data.intent !== "blocked" })
        }
      } else {
        // ── Read path ───────────────────────────────────────────────────────
        const data = await apiFetch<ChatResult>("/api/chat", {
          method: "POST",
          body: JSON.stringify({ connectionId, query: q }),
        })
        if (!data.sql_valid) {
          setError("Couldn't generate valid SQL for that question. Try rephrasing.")
          return
        }
        const execErr = data.execution_error ?? undefined
        setMessages((prev) => [...prev, { type: "read", id: Date.now(), query: q, result: data, error: execErr }])
        addStaffActivity({ kind: "query", label: q, detail: data.sql, success: !execErr && !!data.markdown_output })
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed")
    } finally {
      setLoading(false)
    }
  }

  async function confirmCrud(msgId: number) {
    const msg = messages.find((m) => m.id === msgId) as CrudMessage | undefined
    if (!msg || msg.type !== "crud") return
    setConfirming(msgId)
    try {
      await apiFetch("/api/chat/agent-execute", {
        method: "POST",
        body: JSON.stringify({ connectionId, query: msg.agentResult.sql }),
      })
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, status: "confirmed" } as CrudMessage : m
      ))
      addStaffActivity({ kind: "crud", label: msg.query, detail: msg.agentResult.sql, success: true })
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "Execute failed"
      setMessages((prev) => prev.map((m) =>
        m.id === msgId ? { ...m, status: "error", execError: err } as CrudMessage : m
      ))
      addStaffActivity({ kind: "crud", label: msg.query, detail: msg.agentResult.sql, success: false })
    } finally {
      setConfirming(null)
    }
  }

  function cancelCrud(msgId: number) {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.type === "crud" ? { ...m, status: "cancelled" } as CrudMessage : m
    ))
  }

  const readMessages = messages.filter((m): m is ReadMessage => m.type === "read")

  return (
    <div style={{
      height: "calc(100vh - var(--nav-height))",
      display: "flex",
      background: "var(--bg-page)",
      overflow: "hidden",
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 290, flexShrink: 0,
        borderRight: "0.5px solid var(--border-subtle)",
        background: "var(--bg-card)",
        display: "flex", flexDirection: "column",
        overflowY: "auto", padding: "1.5rem", gap: "1.25rem",
      }}>
        {/* Connection info */}
        <div className="animate-fade-up">
          <p className="section-label">Connected Database</p>
          <div style={{
            background: "var(--success-subtle)", border: "0.5px solid var(--success)",
            borderRadius: 10, padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--success)", position: "absolute" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--success)", animation: "pulse-ring 2s ease-out infinite" }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--success-text)" }}>{connection?.name}</p>
              {schema && (
                <p style={{ fontSize: 11, color: "var(--success)", marginTop: 1 }}>
                  {schema.table_count} tables · live execution
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mode info badge */}
        <div style={{
          background: "var(--accent-subtle)", border: "0.5px solid var(--accent-mid)",
          borderRadius: 9, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: "var(--accent)", lineHeight: 1.6 }}>
            Ask questions to query data, or say <em>&ldquo;Add patient…&rdquo;</em> / <em>&ldquo;Update appointment…&rdquo;</em> to make changes with AI review.
          </p>
        </div>

        <hr className="divider" style={{ margin: 0 }} />

        {/* AI suggestions */}
        <div className="animate-fade-up delay-1">
          <p className="section-label">
            {suggestionsLoading ? "Scanning schema…" : "Smart Suggestions"}
          </p>
          {suggestionsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8 }} />
              ))}
            </div>
          ) : suggestions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((s, i) => (
                <button key={i}
                  onClick={() => submitQuery(s)}
                  disabled={loading}
                  className={`suggestion-card animate-fade-up delay-${Math.min(i + 1, 6)}`}
                  style={{
                    background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
                    borderRadius: 9, padding: "10px 12px", textAlign: "left", cursor: "pointer",
                    fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45,
                    fontFamily: "inherit", display: "flex", gap: 8, alignItems: "flex-start",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 1, color: "var(--accent)", display: "flex" }}><QueryIcon q={s} /></span>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              Suggestions will appear here after schema analysis.
            </p>
          )}
        </div>

        {/* Schema tables */}
        {schema?.tables && schema.tables.length > 0 && (
          <>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="animate-fade-up delay-2">
              <p className="section-label">Schema Tables</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {schema.tables.map((t) => (
                  <button key={t}
                    onClick={() => { setQuery((q) => q + (q.endsWith(" ") || !q ? "" : " ") + t + " "); inputRef.current?.focus() }}
                    style={{
                      background: "var(--accent-subtle)", color: "var(--accent)",
                      fontSize: 11, padding: "3px 9px", borderRadius: 5,
                      fontFamily: "monospace", fontWeight: 600, border: "none", cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Recent queries */}
        {readMessages.length > 0 && (
          <>
            <hr className="divider" style={{ margin: 0 }} />
            <div className="animate-fade-up">
              <p className="section-label">Recent Queries</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[...readMessages].reverse().slice(0, 8).map((msg) => (
                  <button key={msg.id}
                    onClick={() => submitQuery(msg.query)}
                    disabled={loading}
                    style={{
                      background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
                      borderRadius: 7, padding: "8px 10px", textAlign: "left",
                      fontSize: 12, color: "var(--text-secondary)", cursor: "pointer",
                      fontFamily: "inherit", lineHeight: 1.4, transition: "all 0.15s",
                      display: "flex", alignItems: "flex-start", gap: 6,
                    }}
                  >
                    <span style={{ color: msg.error ? "var(--danger)" : "var(--success)", marginTop: 2, flexShrink: 0, display: "flex" }}>
                      {msg.error ? <X size={11} /> : <Check size={11} />}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.query}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setMessages([])}
              style={{
                background: "none", border: "0.5px solid var(--border-subtle)",
                borderRadius: 8, padding: "8px 14px", fontSize: 12,
                color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Clear conversation
            </button>
          </>
        )}
      </aside>

      {/* ── Main chat area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Messages scroll area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "2rem 2.5rem" }}>
          {messages.length === 0 && !loading && !error ? (
            <EmptyState onSuggest={(q) => { setQuery(q); submitQuery(q) }} />
          ) : (
            <>
              {messages.map((msg, i) => {
                if (msg.type === "read") {
                  return <ReadMessageBubble key={msg.id} message={msg} index={i} />
                }
                return (
                  <CrudMessageBubble
                    key={msg.id}
                    message={msg}
                    index={i}
                    onConfirm={() => confirmCrud(msg.id)}
                    onCancel={() => cancelCrud(msg.id)}
                    confirming={confirming === msg.id}
                  />
                )
              })}
              {loading && <ThinkingBubble label={isWriteIntent(query || "") ? "Reviewing your request…" : "Analyzing your database…"} />}
              {error && !loading && (
                <div className="animate-fade-up" style={{
                  background: "var(--danger-subtle)", border: "0.5px solid var(--danger)",
                  borderRadius: 10, padding: "14px 18px", fontSize: 13,
                  color: "var(--danger)", lineHeight: 1.6, marginBottom: "1rem",
                }}>
                  {error}
                  <button onClick={() => setError(null)} style={{
                    marginLeft: 12, fontSize: 11, color: "var(--danger)",
                    background: "none", border: "none", cursor: "pointer", textDecoration: "underline",
                  }}>dismiss</button>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* ── Input bar ── */}
        <div style={{
          borderTop: "0.5px solid var(--border-subtle)",
          background: "var(--bg-card)",
          padding: "1rem 2.5rem 1.25rem",
        }}>
          <div style={{ position: "relative" }}>
            {/* Autocomplete dropdown */}
            {autocomplete.length > 0 && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                background: "var(--bg-card)", border: "1px solid var(--border-default)",
                borderRadius: 10, overflow: "hidden",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-disabled)", padding: "8px 14px 4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Tables matching &ldquo;{query.split(/\s+/).pop()}&rdquo;
                </p>
                {autocomplete.map((t, i) => (
                  <button key={t} onClick={() => applyAutocomplete(t)}
                    style={{
                      display: "flex", width: "100%", padding: "9px 14px",
                      textAlign: "left", background: i === acSelected ? "var(--accent-subtle)" : "none",
                      border: "none", cursor: "pointer", fontSize: 13,
                      color: i === acSelected ? "var(--accent)" : "var(--text-primary)",
                      fontFamily: "monospace", gap: 8, alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>TABLE</span>
                    {t}
                    {i === 0 && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-disabled)", background: "var(--bg-surface)", padding: "2px 6px", borderRadius: 4 }}>Tab</span>}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <input
                ref={inputRef}
                className="input-field"
                style={{
                  flex: 1, fontSize: 15, padding: "13px 18px",
                  borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={'Ask anything or say \u201cAdd patient Jane Doe, born 1990\u2026\u201d'}
                disabled={loading}
                autoFocus
              />
              <button
                className="btn-primary"
                onClick={() => submitQuery()}
                disabled={loading || !query.trim()}
                style={{ padding: "13px 26px", fontSize: 14, flexShrink: 0 }}
              >
                {loading ? (
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M14 8L2 2l3 6-3 6 12-6z" fill="#fff" />
                  </svg>
                )}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 6, textAlign: "center" }}>
              Query data or add/update records — AI reviews every change before saving
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
