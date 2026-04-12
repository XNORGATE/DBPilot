"use client"
import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

interface Props {
  rollbackPlan: {
    has_irreversible: boolean
    combined_script: string
  }
}

export default function RollbackScript({ rollbackPlan }: Props) {
  const [show, setShow] = useState(false)

  return (
    <div>
      {rollbackPlan.has_irreversible && (
        <div
          style={{
            background: "var(--high-subtle)",
            border: "0.5px solid var(--high)",
            borderRadius: 7,
            padding: "9px 12px",
            fontSize: 12,
            color: "var(--high)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} /> This migration contains irreversible statements — rollback may not restore all data.
        </div>
      )}

      <button
        onClick={() => setShow(!show)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--accent)",
          padding: 0,
        }}
      >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {show ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {show ? "Hide rollback script" : "View rollback script"}
        </span>
      </button>

      {show && (
        <div style={{ marginTop: 10 }}>
          <pre className="code-block">{rollbackPlan.combined_script}</pre>
        </div>
      )}
    </div>
  )
}
