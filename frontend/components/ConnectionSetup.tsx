"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import type { Connection, SchemaInfo } from "@/lib/types"
import {
  MessageSquare, PenLine, ShieldCheck, Sparkles,
  Plug, CheckCircle2, Sun, Moon,
} from "lucide-react"

// ── Scroll-reveal hook ────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

// ── Data ──────────────────────────────────────────────────────────────────────

const DB_TYPES = [
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql",      label: "MySQL" },
  { value: "sqlite",     label: "SQLite" },
  { value: "mssql",      label: "SQL Server" },
]

type Mode = "existing" | "new"

interface AutoDBConnection {
  id: string; name: string; db_type: string
  is_active: boolean; last_introspected_at: string | null
}

const BLUE = "#1469A0"
const BLUE_BG = "rgba(20,105,160,0.08)"

const FEATURES = [
  {
    Icon: MessageSquare,
    title: "DataChat",
    sub: "Staff Portal",
    desc: "Ask anything about your clinic in plain English — patient counts, appointment schedules, revenue reports. Get live results instantly.",
    bullets: ["Natural language queries", "Live data tables + charts", "No SQL knowledge needed"],
  },
  {
    Icon: PenLine,
    title: "Record Assistant",
    sub: "Staff Portal",
    desc: "Add patients, log appointments, or update records just by describing it. AI previews every change before it saves.",
    bullets: ["Add & update in plain English", "Preview before save", "Risk badge on every action"],
  },
  {
    Icon: ShieldCheck,
    title: "MigrationGuard",
    sub: "Admin Panel",
    desc: "Safely evolve your clinic schema. Paste any SQL migration and get a full risk report, sandbox dry-run, and auto-rollback script.",
    bullets: ["0–10 risk scoring", "Sandbox dry-run", "Auto rollback script"],
  },
  {
    Icon: Sparkles,
    title: "DBCopilot",
    sub: "Admin Panel",
    desc: `Describe a schema change in plain English — "add a diagnosis_notes column to visits" — Claude generates and sandboxes the SQL.`,
    bullets: ["Plain-English → SQL", "Schema-aware generation", "Risk analysis before apply"],
  },
]

const STEPS = [
  {
    n: "01", Icon: Plug,
    title: "Connect your clinic database",
    desc: "Point YunoClinic at your PostgreSQL clinic database via AutoDB. The schema is introspected automatically.",
  },
  {
    n: "02", Icon: MessageSquare,
    title: "Ask or describe",
    desc: "Staff ask about patients and appointments in plain English. Admins describe schema changes. Claude handles the SQL.",
  },
  {
    n: "03", Icon: ShieldCheck,
    title: "Review before every action",
    desc: "Every record change shows a preview. Every migration shows a risk score and rollback script. You stay in control.",
  },
  {
    n: "04", Icon: CheckCircle2,
    title: "Execute with confidence",
    desc: "Confirm, and YunoClinic runs the operation live. All activity is logged and every session is fully auditable.",
  },
]

const INTEGRATIONS = [
  { name: "Supabase",   color: "#3ECF8E" },
  { name: "Neon",       color: "#00E5CC" },
  { name: "Railway",    color: "#B044FF" },
  { name: "PlanetScale",color: "#F9F871" },
  { name: "PostgreSQL", color: "#336791" },
  { name: "AutoDB",     color: "#1469A0" },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectionSetup() {
  const router = useRouter()
  const setConnection = useAppStore((s) => s.setConnection)
  const [mode, setMode] = useState<Mode>("existing")
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("dbpilot-theme")
    if (saved === "dark") { document.documentElement.setAttribute("data-theme", "dark"); setDark(true) }
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    if (next) { document.documentElement.setAttribute("data-theme", "dark"); localStorage.setItem("dbpilot-theme", "dark") }
    else { document.documentElement.removeAttribute("data-theme"); localStorage.setItem("dbpilot-theme", "light") }
  }

  const [dbList, setDbList] = useState<AutoDBConnection[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listLoaded, setListLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [dbType, setDbType] = useState("postgresql")
  const [connStr, setConnStr] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const featuresReveal  = useReveal()
  const stepsReveal     = useReveal()
  const intReveal       = useReveal()

  async function loadDatabases() {
    setListLoading(true); setError(null)
    try {
      const data = await apiFetch<AutoDBConnection[]>("/api/connection/list")
      setDbList(Array.isArray(data) ? data : [])
      setListLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load databases")
    } finally { setListLoading(false) }
  }

  async function handleUseSelected() {
    if (!selectedId) return
    const picked = dbList.find((d) => d.id === selectedId)
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ connection: Connection; schema: SchemaInfo }>(
        "/api/connection/use-existing",
        { method: "POST", body: JSON.stringify({ connectionId: selectedId, name: picked?.name ?? "My Database" }) }
      )
      setConnection(data.connection.id, data.connection, data.schema)
      router.push("/chat")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load connection")
    } finally { setLoading(false) }
  }

  async function handleNew(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !connStr.trim()) return
    if (!connStr.startsWith("postgresql://") && !connStr.startsWith("postgres://")) {
      setError("Connection string must start with postgresql://"); return
    }
    setLoading(true); setError(null)
    try {
      const data = await apiFetch<{ connection: Connection; schema: SchemaInfo }>(
        "/api/connection/setup",
        { method: "POST", body: JSON.stringify({ name, db_type: dbType, connection_string: connStr }) }
      )
      setConnection(data.connection.id, data.connection, data.schema)
      router.push("/chat")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed")
    } finally { setLoading(false) }
  }

  const Spinner = () => (
    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
  )

  const bg      = dark ? "#050D1A" : "#F0F4F8"
  const bgCard  = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)"
  const border  = dark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.1)"
  const textPri = dark ? "#fff"                    : "#0F172A"
  const textSub = dark ? "rgba(255,255,255,0.55)"  : "rgba(15,23,42,0.55)"
  const textDis = dark ? "rgba(255,255,255,0.3)"   : "rgba(15,23,42,0.3)"
  const gridLine= dark ? "rgba(20,105,160,0.07)"   : "rgba(20,105,160,0.05)"
  const toggleBg= dark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.08)"
  const toggleBd= dark ? "rgba(255,255,255,0.12)"  : "rgba(0,0,0,0.12)"
  const toggleCl= dark ? "rgba(255,255,255,0.7)"   : "rgba(15,23,42,0.7)"
  const inputStyle: React.CSSProperties = {
    width: "100%", background: dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.05)",
    border: `1px solid ${border}`, borderRadius: 9,
    color: textPri, fontSize: 13, padding: "10px 13px",
    outline: "none", fontFamily: "inherit",
  }

  return (
    <div style={{ background: bg, minHeight: "100vh", overflowX: "hidden", transition: "background 0.3s" }}>

      {/* Fixed theme toggle */}
      <button onClick={toggleTheme} title={dark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 100,
          width: 38, height: 38, borderRadius: 10,
          background: toggleBg,
          border: `1px solid ${toggleBd}`,
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 16, color: toggleCl,
          transition: "background 0.15s",
        }}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 460px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background mesh */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            linear-gradient(${gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${gridLine} 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }} />

        {/* Gradient orbs */}
        <div style={{
          position: "absolute", top: -180, right: 400, width: 600, height: 600,
          background: "radial-gradient(circle, rgba(20,105,160,0.18) 0%, transparent 65%)",
          borderRadius: "50%", animation: "orb-float 14s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -100, left: -80, width: 500, height: 500,
          background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)",
          borderRadius: "50%", animation: "orb-float 18s ease-in-out infinite reverse",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: "35%", width: 300, height: 300,
          background: "radial-gradient(circle, rgba(20,105,160,0.1) 0%, transparent 65%)",
          borderRadius: "50%", animation: "orb-float 11s ease-in-out infinite 3s",
          pointerEvents: "none",
        }} />

        {/* ── LEFT: hero copy ── */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "5rem 4rem 4rem 5rem",
          position: "relative", zIndex: 1,
        }}>
          {/* Top badge */}
          <div className="animate-fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(20,105,160,0.15)",
            border: "1px solid rgba(20,105,160,0.35)",
            borderRadius: 100, padding: "6px 14px",
            marginBottom: "2.5rem", width: "fit-content",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2E88C4", display: "inline-block", animation: "pulse-ring 2s ease-out infinite" }} />
            <span style={{ fontSize: 12, color: "#7FB8DC", fontWeight: 600, letterSpacing: "0.06em" }}>
              Powered by Claude AI · Built on DBPilot
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-1" style={{
            fontSize: 58, fontWeight: 900, lineHeight: 1.06,
            letterSpacing: -2, marginBottom: "1.5rem",
            color: textPri,
          }}>
            Your clinic,<br />
            <span style={{
              background: "linear-gradient(135deg, #2E88C4 0%, #7C3AED 50%, #2E88C4 100%)",
              backgroundSize: "200% 200%",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "gradient-shift 4s ease infinite",
            }}>
              powered by AI.
            </span>
          </h1>

          <p className="animate-fade-up delay-2" style={{
            fontSize: 19, color: textSub,
            lineHeight: 1.7, marginBottom: "3rem", maxWidth: 500,
          }}>
            Query patient records, manage appointments, and safely evolve your clinic schema — all in plain English, powered by Claude AI.
          </p>

          {/* Feature pills */}
          <div className="animate-fade-up delay-3" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: "3.5rem" }}>
            {["DataChat", "Record Assistant", "MigrationGuard", "DBCopilot"].map((label) => (
              <span key={label} style={{
                fontSize: 14, fontWeight: 600,
                background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${border}`,
                borderRadius: 8, padding: "8px 18px",
                color: textSub,
              }}>{label}</span>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="animate-fade-up delay-4" style={{
            display: "flex", alignItems: "center", gap: 10,
            color: textDis, fontSize: 12,
          }}>
            <div style={{
              width: 24, height: 38, border: `1.5px solid ${border}`,
              borderRadius: 12, display: "flex", alignItems: "flex-start",
              justifyContent: "center", padding: "5px 0",
            }}>
              <div style={{
                width: 3, height: 8, background: textDis,
                borderRadius: 2, animation: "fadeUp 1.5s ease-in-out infinite alternate",
              }} />
            </div>
            Scroll to explore features
          </div>
        </div>

        {/* ── RIGHT: connect form ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-start",
          padding: "3rem 2.5rem 3rem 0",
          position: "relative", zIndex: 1,
        }}>
          <div className="animate-fade-up delay-2" style={{
            width: "100%", maxWidth: 400,
            background: bgCard,
            border: `1px solid ${border}`,
            borderRadius: 20,
            padding: "2rem",
            backdropFilter: "blur(24px)",
            boxShadow: dark ? "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 32px 80px rgba(0,0,0,0.12)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: textDis, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Get started
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: textPri, marginBottom: "1.5rem", letterSpacing: -0.4 }}>
              Connect your clinic database
            </h2>

            {/* Mode toggle */}
            <div style={{
              display: "flex", background: dark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${border}`,
              borderRadius: 10, padding: 3, gap: 3, marginBottom: "1.5rem",
            }}>
              {([
                { value: "existing", label: "My AutoDB databases" },
                { value: "new",      label: "Register new" },
              ] as { value: Mode; label: string }[]).map(({ value, label }) => (
                <button key={value}
                  onClick={() => { setMode(value); setError(null) }}
                  style={{
                    flex: 1, border: "none", borderRadius: 8,
                    padding: "8px 10px", fontSize: 12, fontWeight: mode === value ? 700 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    background: mode === value ? "rgba(20,105,160,0.6)" : "transparent",
                    color: mode === value ? "#fff" : textDis,
                    transition: "all 0.18s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Existing ── */}
            {mode === "existing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 12, color: textSub, lineHeight: 1.6 }}>
                  Load your existing databases from AutoDB and click one to connect.
                </p>

                {!listLoaded ? (
                  <button onClick={loadDatabases} disabled={listLoading}
                    style={{
                      width: "100%", border: "1px solid rgba(20,105,160,0.5)",
                      borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                      background: "rgba(20,105,160,0.2)", color: dark ? "#7FB8DC" : "#1469A0",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    {listLoading ? <><Spinner /> Loading databases…</> : "Load my AutoDB databases"}
                  </button>
                ) : dbList.length === 0 ? (
                  <div style={{
                    background: "rgba(180,83,9,0.12)", border: "1px solid rgba(180,83,9,0.3)",
                    borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#E6820C", lineHeight: 1.6,
                  }}>
                    No databases found. Go to <strong>app.autodb.app → Databases → Connect Database</strong> first.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {dbList.map((db) => (
                      <button key={db.id} onClick={() => setSelectedId(db.id)}
                        style={{
                          background: selectedId === db.id ? "rgba(20,105,160,0.25)" : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                          border: `1px solid ${selectedId === db.id ? "rgba(46,136,196,0.6)" : border}`,
                          borderRadius: 10, padding: "11px 14px", cursor: "pointer",
                          textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                          transition: "all 0.15s", fontFamily: "inherit",
                        }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: db.is_active ? "#26A058" : "rgba(255,255,255,0.2)" }} />
                          {db.is_active && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#26A058", animation: "pulse-ring 1.8s ease-out infinite" }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: textPri, margin: 0 }}>{db.name}</p>
                          <p style={{ fontSize: 11, color: textDis, margin: 0, marginTop: 1, fontFamily: "monospace" }}>{db.db_type} · {db.id.slice(0, 8)}…</p>
                        </div>
                        {selectedId === db.id && (
                          <span style={{ fontSize: 10, color: "#2E88C4", fontWeight: 700, background: "rgba(46,136,196,0.15)", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}><CheckCircle2 size={10} /> Selected</span>
                        )}
                      </button>
                    ))}
                    <button onClick={handleUseSelected} disabled={!selectedId || loading}
                      style={{
                        marginTop: 4, width: "100%", border: "none", borderRadius: 10,
                        padding: "13px", fontSize: 13, fontWeight: 700,
                        cursor: selectedId && !loading ? "pointer" : "not-allowed",
                        background: selectedId && !loading ? "linear-gradient(135deg, #1469A0, #2E88C4)" : (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"),
                        color: selectedId && !loading ? "#fff" : textDis,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}>
                      {loading ? <><Spinner /> Syncing schema…</> : "Connect selected database →"}
                    </button>
                    <button onClick={loadDatabases} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: textDis, padding: "2px 0", textDecoration: "underline", fontFamily: "inherit" }}>
                      Refresh list
                    </button>
                  </div>
                )}
                {error && <ErrorBox message={error} />}
              </div>
            )}

            {/* ── New ── */}
            {mode === "new" && (
              <form onSubmit={handleNew} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FormField label="Connection name" labelColor={textDis}>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="My Production DB" required style={inputStyle} />
                </FormField>
                <FormField label="Database type" labelColor={textDis}>
                  <select value={dbType} onChange={(e) => setDbType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {DB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Connection string" labelColor={textDis}>
                  <input value={connStr} onChange={(e) => setConnStr(e.target.value)}
                    placeholder="postgresql://user:pass@host:5432/db"
                    required style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }} />
                </FormField>
                {error && <ErrorBox message={error} />}
                <button type="submit" disabled={loading}
                  style={{
                    width: "100%", border: "none", borderRadius: 10,
                    padding: "13px", fontSize: 13, fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    background: "linear-gradient(135deg, #1469A0, #2E88C4)",
                    color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8, fontFamily: "inherit",
                  }}>
                  {loading ? <><Spinner /> Connecting & introspecting…</> : "Connect & introspect schema →"}
                </button>
              </form>
            )}

            <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 11, color: textDis }}>
              AutoDB dashboard:{" "}
              <a href="https://app.autodb.app" target="_blank" rel="noreferrer"
                style={{ color: "#1469A0", textDecoration: "none", fontWeight: 600 }}>app.autodb.app →</a>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — FEATURES
      ══════════════════════════════════════════════════════ */}
      <section style={{ background: dark ? "#080F1C" : "#E8EDF3", padding: "7rem 5rem", transition: "background 0.3s" }}>
        <div ref={featuresReveal.ref} className={`reveal ${featuresReveal.visible ? "visible" : ""}`}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ fontSize: 46, fontWeight: 900, color: "#1469A0", letterSpacing: -1.5, marginBottom: 16 }}>
              Everything your team needs
            </h2>
            <p style={{ fontSize: 18, color: textSub, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              Clinical staff query records without SQL. Admins evolve the schema safely. One platform, two portals.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 960, margin: "0 auto" }}>
            {FEATURES.map((f, i) => (
              <div key={f.title}
                className={`reveal ${featuresReveal.visible ? `visible reveal-delay-${i + 1}` : ""}`}
                style={{
                  background: dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)",
                  border: `1px solid ${border}`,
                  borderRadius: 18,
                  padding: "2rem 2.25rem",
                  position: "relative", overflow: "hidden",
                  transition: "border-color 0.2s, background 0.2s",
                }}>
                {/* Top accent line */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`,
                  opacity: 0.4,
                }} />

                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: "1.1rem" }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 13,
                    background: BLUE_BG, border: `1px solid rgba(20,105,160,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: BLUE,
                  }}><f.Icon size={22} /></div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: textPri }}>{f.title}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: BLUE_BG, border: `1px solid rgba(20,105,160,0.2)`, borderRadius: 4, padding: "1px 7px" }}>{f.sub}</span>
                    </div>
                    <p style={{ fontSize: 14, color: textSub, lineHeight: 1.65 }}>{f.desc}</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: "1.1rem" }}>
                  {f.bullets.map((b) => (
                    <div key={b} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, flexShrink: 0, opacity: 0.5 }} />
                      <span style={{ fontSize: 13, color: textSub }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section style={{ background: bg, padding: "7rem 5rem", position: "relative", overflow: "hidden", transition: "background 0.3s" }}>
        {/* Background accent */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(20,105,160,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div ref={stepsReveal.ref} className={`reveal ${stepsReveal.visible ? "visible" : ""}`}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 14 }}>
              Simple by design
            </span>
            <h2 style={{ fontSize: 42, fontWeight: 900, color: textPri, letterSpacing: -1.5, marginBottom: 14 }}>
              How it works
            </h2>
            <p style={{ fontSize: 16, color: textSub, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              From zero to querying your clinic data in under a minute.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, maxWidth: 960, margin: "0 auto", position: "relative" }}>
            {/* Connector line */}
            <div style={{
              position: "absolute", top: 28, left: "12.5%", right: "12.5%", height: 1,
              background: "linear-gradient(90deg, rgba(20,105,160,0.0), rgba(20,105,160,0.4), rgba(124,58,237,0.4), rgba(20,105,160,0.0))",
            }} />

            {STEPS.map((step, i) => (
              <div key={step.n}
                className={`reveal ${stepsReveal.visible ? `visible reveal-delay-${i + 1}` : ""}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", marginBottom: "1.25rem",
                  background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", color: "#2E88C4",
                  boxShadow: "0 0 0 8px rgba(20,105,160,0.04)",
                }}>
                  <step.Icon size={22} />
                  <span style={{
                    position: "absolute", top: -8, right: -8,
                    fontSize: 10, fontWeight: 800, color: "#2E88C4",
                    background: bg, border: "1px solid rgba(46,136,196,0.4)",
                    borderRadius: 5, padding: "1px 6px",
                  }}>{step.n}</span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: textPri, marginBottom: 8, lineHeight: 1.3 }}>{step.title}</p>
                <p style={{ fontSize: 12, color: textSub, lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — INTEGRATIONS
      ══════════════════════════════════════════════════════ */}
      <section style={{ background: dark ? "#080F1C" : "#E8EDF3", padding: "5rem 5rem", transition: "background 0.3s" }}>
        <div ref={intReveal.ref} className={`reveal ${intReveal.visible ? "visible" : ""}`}>
          <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: textDis, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2.5rem" }}>
            Works with
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: "5rem" }}>
            {INTEGRATIONS.map((int, i) => (
              <div key={int.name}
                className={`reveal ${intReveal.visible ? `visible reveal-delay-${Math.min(i + 1, 4)}` : ""}`}
                style={{
                  background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
                  border: `1px solid ${border}`,
                  borderRadius: 12, padding: "10px 20px",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: int.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: textSub }}>{int.name}</span>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{
            background: "linear-gradient(135deg, rgba(20,105,160,0.12), rgba(124,58,237,0.08))",
            border: "1px solid rgba(20,105,160,0.2)",
            borderRadius: 24, padding: "3rem",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 24, maxWidth: 780, margin: "0 auto",
          }}>
            <div>
              <h3 style={{ fontSize: 26, fontWeight: 800, color: textPri, letterSpacing: -0.5, marginBottom: 8 }}>
                Ready to power up your clinic?
              </h3>
              <p style={{ fontSize: 14, color: textSub, lineHeight: 1.6 }}>
                Scroll back up to connect your clinic database, or pick an existing AutoDB connection.
              </p>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{
                flexShrink: 0, border: "none", borderRadius: 12,
                padding: "14px 28px", fontSize: 14, fontWeight: 700,
                background: "linear-gradient(135deg, #1469A0, #2E88C4)",
                color: "#fff", cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 8px 32px rgba(20,105,160,0.35)",
                whiteSpace: "nowrap",
              }}>
              Get started →
            </button>
          </div>

          {/* Footer */}
          <p style={{ textAlign: "center", marginTop: "3rem", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            YunoClinic · Built with DBPilot, AutoDB &amp; Claude AI · Hackathon 2026
          </p>
        </div>
      </section>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function FormField({ label, labelColor, children }: { label: string; labelColor: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: labelColor, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{
      background: "rgba(192,40,25,0.12)", border: "1px solid rgba(192,40,25,0.3)",
      borderRadius: 9, padding: "10px 13px", fontSize: 12, color: "#F4A59D", lineHeight: 1.6,
    }}>
      {message}
    </div>
  )
}
