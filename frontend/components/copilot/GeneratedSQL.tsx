"use client"
import { useState } from "react"
import { Check, Copy } from "lucide-react"

export default function GeneratedSQL({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p className="section-label" style={{ margin: 0 }}>Generated SQL</p>
        <button
          onClick={handleCopy}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11, display: "flex", alignItems: "center", gap: 4,
            color: copied ? "var(--success)" : "var(--accent)",
            fontWeight: 500,
          }}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="code-block">{sql}</pre>
    </div>
  )
}
