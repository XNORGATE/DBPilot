"use client"
import { useState, useRef, useCallback } from "react"
import { useAppStore } from "@/lib/store"
import { API_BASE, apiFetch } from "@/lib/api"
import { FileText, FileCode, Database, Upload, Download } from "lucide-react"

const ACCEPTED: Record<string, { label: string; color: string }> = {
  ".pdf": { label: "PDF", color: "var(--danger)"  },
  ".txt": { label: "TXT", color: "var(--accent)"  },
  ".sql": { label: "SQL", color: "var(--success)" },
}

function FileTypeIcon({ ext, size = 22 }: { ext: string; size?: number }) {
  if (ext === ".pdf") return <FileText size={size} />
  if (ext === ".txt") return <FileText size={size} />
  if (ext === ".sql") return <FileCode size={size} />
  return <Database size={size} />
}

interface Props {
  /** Called when a .sql file is uploaded and Claude has fixed it */
  onSqlFixed?: (sql: string, changes: string[]) => void
}

export default function DocumentUpload({ onSqlFixed }: Props) {
  const connectionId = useAppStore((s) => s.connectionId)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error" | "fixing"; msg: string } | null>(null)
  const [changes, setChanges] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function getExt(f: File) {
    return "." + f.name.split(".").pop()!.toLowerCase()
  }

  function pickFile(f: File) {
    const ext = getExt(f)
    if (!ACCEPTED[ext]) {
      setStatus({ type: "error", msg: `Unsupported file type. Please upload PDF, TXT, or SQL.` })
      return
    }
    setFile(f)
    setStatus(null)
    setChanges([])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }, [])

  async function handleUpload() {
    if (!file || !connectionId) return
    const ext = getExt(file)
    setLoading(true)
    setStatus(null)
    setChanges([])

    if (ext === ".sql") {
      // Read the file text, send to Claude for schema-aware fixing
      setStatus({ type: "fixing", msg: "Claude is checking the SQL against your schema…" })
      try {
        const text = await file.text()
        const result = await apiFetch<{ fixedSql: string; changes: string[] }>(
          "/api/migration/fix-sql",
          { method: "POST", body: JSON.stringify({ connectionId, sql: text }) }
        )
        setChanges(result.changes)
        setStatus({
          type: "success",
          msg: result.changes.length > 0
            ? `SQL loaded and adjusted for your schema (${result.changes.length} fix${result.changes.length > 1 ? "es" : ""} applied).`
            : `SQL loaded — no schema mismatches found.`,
        })
        onSqlFixed?.(result.fixedSql, result.changes)
        setFile(null)
        if (inputRef.current) inputRef.current.value = ""
      } catch (e: unknown) {
        setStatus({ type: "error", msg: e instanceof Error ? e.message : "SQL processing failed" })
      }
    } else {
      // PDF / TXT → RAG pipeline
      const form = new FormData()
      form.append("connectionId", connectionId)
      form.append("file", file)
      try {
        const res = await fetch(`${API_BASE}/api/context/upload`, { method: "POST", body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail ?? "Upload failed")
        }
        setStatus({ type: "success", msg: `${file.name} indexed into the RAG context successfully.` })
        setFile(null)
        if (inputRef.current) inputRef.current.value = ""
      } catch (e: unknown) {
        setStatus({ type: "error", msg: e instanceof Error ? e.message : "Upload failed" })
      }
    }
    setLoading(false)
  }

  const ext = file ? getExt(file) : null
  const meta = ext ? ACCEPTED[ext] : null

  return (
    <div>
      <p className="section-label">Upload Context or SQL File</p>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12, lineHeight: 1.6 }}>
        <strong>PDF / TXT</strong> — indexed into the AI context to improve SQL accuracy.
        <br />
        <strong>SQL</strong> — Claude reads it, fixes any schema mismatches, and loads it into the editor.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${dragging ? "var(--accent)" : file ? "var(--success)" : "var(--border-default)"}`,
          borderRadius: 12,
          padding: "1.5rem",
          background: dragging
            ? "var(--accent-subtle)"
            : file
            ? "var(--success-subtle)"
            : "var(--bg-surface)",
          cursor: loading ? "default" : "pointer",
          transition: "all 0.2s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          textAlign: "center",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.sql"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
        />

        {file ? (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "var(--bg-card)",
              border: `0.5px solid ${meta?.color ?? "var(--border-default)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: meta?.color ?? "var(--text-tertiary)",
            }}>
              <FileTypeIcon ext={ext ?? ""} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{file.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {(file.size / 1024).toFixed(1)} KB · {meta?.label}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setStatus(null); setChanges([]) }}
              style={{
                fontSize: 11, color: "var(--text-disabled)", background: "none",
                border: "none", cursor: "pointer", textDecoration: "underline",
              }}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "var(--bg-card)",
              border: "0.5px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-tertiary)",
            }}>
              {dragging ? <Download size={22} /> : <Upload size={22} />}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                {dragging ? "Drop it here" : "Drag & drop or click to browse"}
              </p>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
                {Object.entries(ACCEPTED).map(([ext, { label, color }]) => (
                  <span key={ext} style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 5, border: `0.5px solid ${color}`,
                    color, background: "var(--bg-card)",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <FileTypeIcon ext={ext} size={11} /> {label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Upload button */}
      {file && (
        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={loading}
          style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
        >
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
              {ext === ".sql" ? "Claude is reviewing SQL…" : "Uploading…"}
            </span>
          ) : ext === ".sql" ? "Fix SQL with Claude →" : `Upload ${meta?.label} →`}
        </button>
      )}

      {/* Status */}
      {status && status.type !== "fixing" && (
        <div style={{
          marginTop: 10,
          background: status.type === "success" ? "var(--success-subtle)" : "var(--danger-subtle)",
          border: `0.5px solid ${status.type === "success" ? "var(--success)" : "var(--danger)"}`,
          borderRadius: 8, padding: "10px 14px",
          fontSize: 12, color: status.type === "success" ? "var(--success)" : "var(--danger)",
          lineHeight: 1.6,
        }}>
          {status.msg}
          {/* Show what Claude changed */}
          {changes.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
              {changes.map((c, i) => <li key={i} style={{ marginTop: 2 }}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
