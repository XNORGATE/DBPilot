"use client"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { LayoutDashboard, MessageSquare, PenLine, Wrench, ShieldCheck, Sparkles, Sun, Moon, Database, X, Users } from "lucide-react"

const STAFF_LINKS = [
  { href: "/chat",            label: "DataChat",         mode: null  },
  { href: "/chat?mode=agent", label: "Record Assistant", mode: "agent" },
]

const ADMIN_LINKS = [
  { href: "/admin",     label: "Admin Panel",    exact: true  },
  { href: "/migration", label: "MigrationGuard", exact: false },
  { href: "/copilot",   label: "DBCopilot",      exact: false },
]

function NavIcon({ href, size = 15 }: { href: string; size?: number }) {
  if (href === "/")                  return <LayoutDashboard size={size} />
  if (href === "/chat?mode=agent")   return <PenLine size={size} />
  if (href === "/chat")              return <MessageSquare size={size} />
  if (href === "/admin")             return <Wrench size={size} />
  if (href === "/migration")         return <ShieldCheck size={size} />
  if (href === "/copilot")           return <Sparkles size={size} />
  return <Database size={size} />
}

export default function NavBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentMode = searchParams.get("mode")
  const connection = useAppStore((s) => s.connection)
  const clearConnection = useAppStore((s) => s.clearConnection)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("dbpilot-theme")
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark")
      setDark(true)
    }
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark")
      localStorage.setItem("dbpilot-theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
      localStorage.setItem("dbpilot-theme", "light")
    }
  }

  if (!connection && pathname === "/") return null

  return (
    <nav style={{
      background: "var(--bg-card)",
      borderBottom: "0.5px solid var(--border-subtle)",
      padding: "0 2rem",
      display: "flex",
      alignItems: "center",
      height: "var(--nav-height)",
      position: "sticky",
      top: 0,
      zIndex: 40,
      gap: 0,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: "flex", alignItems: "center", gap: 10,
        textDecoration: "none", marginRight: "2rem", flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, background: "var(--accent)",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <ellipse cx="10" cy="5" rx="8" ry="3" stroke="#fff" strokeWidth="1.5" />
            <path d="M2 5v5c0 1.657 3.582 3 8 3s8-1.343 8-3V5" stroke="#fff" strokeWidth="1.5" />
            <path d="M2 10v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" stroke="#fff" strokeWidth="1.5" />
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.4 }}>
          YunoClinic
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", flex: 1, gap: 0 }}>

        {/* Home */}
        <Link href="/" style={{
          padding: "8px 16px", borderRadius: 8, fontSize: 15,
          fontWeight: pathname === "/" ? 600 : 400,
          color: pathname === "/" ? "var(--accent)" : "var(--text-secondary)",
          background: pathname === "/" ? "var(--accent-subtle)" : "transparent",
          textDecoration: "none", transition: "background 0.15s, color 0.15s",
          display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
        }}>
          <NavIcon href="/" /> Dashboard
        </Link>

        {/* Staff + Admin sections — only shown when connected */}
        {connection && (
          <>
            {/* ── Divider ── */}
            <div style={{ width: 1, height: 28, background: "var(--border-subtle)", margin: "0 20px", flexShrink: 0 }} />

            {/* ── Staff group ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--accent-subtle)",
              border: "0.5px solid var(--accent-mid)",
              borderRadius: 10, padding: "4px 6px",
            }}>
              {/* Staff badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
              }}>
                <Users size={13} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Staff
                </span>
              </div>

              {STAFF_LINKS.map(({ href, label, mode }) => {
                const active = pathname === "/chat" && currentMode === mode
                return (
                  <Link key={href} href={href} style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#fff" : "var(--accent)",
                    background: active ? "var(--accent)" : "transparent",
                    textDecoration: "none", transition: "background 0.15s, color 0.15s",
                    display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  }}>
                    <NavIcon href={href} size={15} />
                    {label}
                  </Link>
                )
              })}
            </div>

            {/* ── Divider ── */}
            <div style={{ width: 1, height: 28, background: "var(--border-subtle)", margin: "0 20px", flexShrink: 0 }} />

            {/* ── Admin group ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "var(--admin-subtle)",
              border: "0.5px solid var(--admin-mid)",
              borderRadius: 10, padding: "4px 6px",
            }}>
              {/* Admin badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
              }}>
                <Wrench size={13} style={{ color: "var(--admin)" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--admin)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Admin
                </span>
              </div>

              {ADMIN_LINKS.map(({ href, label, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link key={href} href={href} style={{
                    padding: "6px 14px", borderRadius: 7, fontSize: 15,
                    fontWeight: active ? 700 : 500,
                    color: active ? "#fff" : "var(--admin)",
                    background: active ? "var(--admin)" : "transparent",
                    textDecoration: "none", transition: "background 0.15s, color 0.15s",
                    display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  }}>
                    <NavIcon href={href} size={15} />
                    {label}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Connection status */}
        {connection && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--success-subtle)",
            border: "0.5px solid var(--success)",
            borderRadius: 8, padding: "5px 12px",
          }}>
            <div style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", position: "absolute" }} />
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "var(--success)", animation: "pulse-ring 2s ease-out infinite",
              }} />
            </div>
            <span style={{
              fontSize: 13, fontWeight: 600, color: "var(--success-text)",
              maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {connection.name}
            </span>
            <button onClick={clearConnection} title="Disconnect"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--success)", padding: "0 2px", lineHeight: 1,
                opacity: 0.7, display: "flex", alignItems: "center",
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Dark mode toggle */}
        <button onClick={toggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-subtle)",
            borderRadius: 8, width: 36, height: 34,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.15s",
            color: "var(--text-secondary)",
          }}
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </nav>
  )
}
