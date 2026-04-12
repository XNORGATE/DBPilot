# DBPilot — Part 2: DataChat & MigrationGuard

> Build the two query/migration features on top of the Part 1 foundation. Requires `connection_id` in Zustand store and all shared libs from Part 1.

---

## Checklist

### DataChat
- [ ] Backend route `POST /api/chat`
- [ ] `ChatInput.tsx` — query input + submit
- [ ] `ResultsTable.tsx` — parse markdown_output into table rows
- [ ] `ResultsChart.tsx` — Recharts bar chart
- [ ] Confidence badge (green / yellow / red)
- [ ] Collapsible SQL code block
- [ ] Warning display for hallucinated tables / invalid SQL
- [ ] Wire chat page together

### MigrationGuard
- [ ] Backend route `POST /api/migration/analyze`
- [ ] Backend route `POST /api/migration/execute`
- [ ] `SQLInput.tsx` — SQL textarea + analyze button
- [ ] `RiskReport.tsx` — risk score badge, affected tables, blast radius, sandbox result
- [ ] `RollbackScript.tsx` — display rollback SQL
- [ ] `ExecuteConfirm.tsx` — confirmation modal with approval_token
- [ ] Execute button gating (disabled if sandbox failed or critical risk)
- [ ] Wire migration page together
- [ ] Uncomment migration router in `backend/main.py`
- [ ] Uncomment chat router in `backend/main.py`

---

## Feature 1: DataChat

Users ask plain-English questions and get back live data tables + charts.

---

### Backend — `POST /api/chat`

**File:** `backend/routes/chat.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post

router = APIRouter()

class ChatRequest(BaseModel):
    connectionId: str
    query: str

@router.post("/api/chat")
async def chat(req: ChatRequest):
    result = await autodb_post(
        f"/connections/{req.connectionId}/queries/generate",
        {
            "query": req.query,
            "max_schema_chunks": 5,
            "max_doc_chunks": 3,
        }
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result["data"]
```

**AutoDB request fields:**

| Field | Value |
|---|---|
| `query` | Plain-English question from the user |
| `max_schema_chunks` | `5` |
| `max_doc_chunks` | `3` |

**AutoDB response fields used:**

| Field | Used for |
|---|---|
| `sql` | Collapsible code block |
| `confidence` | Color-coded badge |
| `reasoning` | Expandable explanation |
| `referenced_tables` | Chart data labels |
| `warnings` | Warning banner |
| `sql_valid` | Error fallback |
| `markdown_output` | Table rendering |
| `execution_error` | Error display |

---

### Frontend — `components/datachat/ChatInput.tsx`

```tsx
"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import { ChatResult } from "@/lib/types"
import ResultsTable from "./ResultsTable"
import ResultsChart from "./ResultsChart"

export default function ChatInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<ChatResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSql, setShowSql] = useState(false)

  async function handleSubmit() {
    if (!connectionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ChatResult>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ connectionId, query }),
      })
      if (!data.sql_valid) throw new Error("Couldn't generate SQL. Try rephrasing.")
      if (data.execution_error) throw new Error(`Query failed: ${data.execution_error}`)
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const confidenceColor =
    result && result.confidence >= 0.9 ? "bg-green-100 text-green-800" :
    result && result.confidence >= 0.7 ? "bg-yellow-100 text-yellow-800" :
    "bg-red-100 text-red-800"

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">DataChat</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Which products had the most returns this quarter?"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-4">
          {/* Confidence badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-sm font-medium ${confidenceColor}`}>
              Confidence: {Math.round(result.confidence * 100)}%
            </span>
            {result.warnings.length > 0 && (
              <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-sm">
                ⚠ {result.warnings.join(", ")}
              </span>
            )}
          </div>

          {/* Results table */}
          <ResultsTable markdownOutput={result.markdown_output} />

          {/* Chart */}
          <ResultsChart referencedTables={result.referenced_tables} markdownOutput={result.markdown_output} />

          {/* Collapsible SQL */}
          <div>
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showSql ? "Hide SQL" : "Show SQL"}
            </button>
            {showSql && (
              <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto">
                {result.sql}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Frontend — `components/datachat/ResultsTable.tsx`

```tsx
interface Props {
  markdownOutput: string
}

export default function ResultsTable({ markdownOutput }: Props) {
  // Parse GitHub-flavored markdown table
  const lines = markdownOutput.trim().split("\n").filter(Boolean)
  if (lines.length < 3) return null  // need header + separator + at least one row

  const parseRow = (line: string) =>
    line.split("|").map((cell) => cell.trim()).filter(Boolean)

  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow)  // skip separator line

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h, i) => (
              <th key={i} className="border px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td key={ci} className="border px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

### Frontend — `components/datachat/ResultsChart.tsx`

```tsx
"use client"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

interface Props {
  markdownOutput: string
  referencedTables: string[]
}

export default function ResultsChart({ markdownOutput }: Props) {
  // Parse the first two columns of the markdown table as name/value pairs
  const lines = markdownOutput.trim().split("\n").filter(Boolean)
  if (lines.length < 3) return null

  const parseRow = (line: string) =>
    line.split("|").map((cell) => cell.trim()).filter(Boolean)

  const headers = parseRow(lines[0])
  const rows = lines.slice(2).map(parseRow)

  const chartData = rows.map((row) => ({
    name: row[0] ?? "",
    value: parseFloat(row[1]) || 0,
  }))

  if (chartData.every((d) => d.value === 0)) return null

  return (
    <div className="h-64 mt-4">
      <p className="text-sm text-gray-500 mb-2">
        {headers[0]} vs {headers[1]}
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

### Frontend — `app/chat/page.tsx`

```tsx
import ChatInput from "@/components/datachat/ChatInput"

export default function ChatPage() {
  return <ChatInput />
}
```

---

## Feature 2: MigrationGuard

Users paste a SQL migration and get a full risk analysis before any production changes.

---

### Backend — `POST /api/migration/analyze`

**File:** `backend/routes/migration.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post

router = APIRouter()

class AnalyzeRequest(BaseModel):
    connectionId: str
    sql: str

@router.post("/api/migration/analyze")
async def analyze(req: AnalyzeRequest):
    result = await autodb_post(
        f"/connections/{req.connectionId}/migrations/analyze",
        { "sql": req.sql }
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result["data"]
```

**AutoDB response fields used:**

| Field | Used for |
|---|---|
| `risk_score` | Numeric badge (0–100) |
| `risk_category` | Color: low=green, medium=yellow, high=orange, critical=red |
| `total_statements` | Statement count display |
| `affected_tables` | Blast radius list |
| `sandbox_result.passed` | Gate the Execute button |
| `sandbox_result.duration_ms` | Sandbox timing info |
| `rollback_plan.combined_script` | Rollback SQL display |
| `rollback_plan.has_irreversible` | Warning flag |
| `approval_token` | Passed to execute endpoint |

---

### Backend — `POST /api/migration/execute`

```python
class ExecuteRequest(BaseModel):
    connectionId: str
    sql: str
    approvalToken: str

@router.post("/api/migration/execute")
async def execute(req: ExecuteRequest):
    result = await autodb_post(
        "/migrations/execute",
        {
            "connection_id": req.connectionId,
            "sql": req.sql,
            "approval_token": req.approvalToken,
        }
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result["data"]
```

> The `approval_token` is HMAC-signed and tied to the exact SQL that was analyzed. If the SQL is modified after analysis, execution will be rejected by AutoDB.

---

### Frontend — `components/migration/SQLInput.tsx`

```tsx
"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import { MigrationAnalysis } from "@/lib/types"
import RiskReport from "./RiskReport"
import RollbackScript from "./RollbackScript"
import ExecuteConfirm from "./ExecuteConfirm"

export default function SQLInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const [sql, setSql] = useState("")
  const [analysis, setAnalysis] = useState<MigrationAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyze() {
    if (!connectionId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<MigrationAnalysis>("/api/migration/analyze", {
        method: "POST",
        body: JSON.stringify({ connectionId, sql }),
      })
      setAnalysis(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">MigrationGuard</h1>

      <textarea
        className="w-full border rounded p-3 font-mono text-sm h-40 mb-4"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        placeholder="ALTER TABLE orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';"
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleAnalyze}
        disabled={loading || !sql.trim()}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-6"
      >
        {loading ? "Analyzing…" : "Analyze Migration"}
      </button>

      {analysis && (
        <div className="space-y-6">
          <RiskReport analysis={analysis} />
          <RollbackScript rollbackPlan={analysis.rollback_plan} />
          <ExecuteConfirm
            connectionId={connectionId!}
            sql={sql}
            approvalToken={analysis.approval_token}
            canExecute={analysis.sandbox_result.passed && analysis.risk_category !== "critical"}
          />
        </div>
      )}
    </div>
  )
}
```

---

### Frontend — `components/migration/RiskReport.tsx`

```tsx
import { MigrationAnalysis } from "@/lib/types"

const RISK_COLORS = {
  low:      "bg-green-100 text-green-800 border-green-300",
  medium:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  high:     "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
}

export default function RiskReport({ analysis }: { analysis: MigrationAnalysis }) {
  const colorClass = RISK_COLORS[analysis.risk_category]

  return (
    <div className="border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-4">
        <span className={`text-3xl font-bold px-4 py-2 rounded-lg border ${colorClass}`}>
          {analysis.risk_score}
        </span>
        <div>
          <p className="font-semibold capitalize">{analysis.risk_category} Risk</p>
          <p className="text-sm text-gray-500">
            {analysis.total_statements} statement{analysis.total_statements !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Sandbox result */}
      <div className={`text-sm px-3 py-2 rounded ${
        analysis.sandbox_result.passed
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}>
        Sandbox: {analysis.sandbox_result.passed ? "✓ Passed" : "✗ Failed"}{" "}
        ({analysis.sandbox_result.duration_ms}ms)
      </div>

      {/* Blast radius */}
      <div>
        <p className="text-sm font-semibold mb-2">Affected Tables</p>
        <ul className="space-y-1">
          {analysis.affected_tables.map((t, i) => (
            <li key={i} className="text-sm flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                t.impact === "direct"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }`}>
                {t.impact}
              </span>
              <span>{t.table}</span>
              {t.cascade_path && (
                <span className="text-gray-400 text-xs">
                  via {t.cascade_path.join(" → ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {!analysis.sandbox_result.passed && (
        <p className="text-red-600 text-sm font-medium">
          Migration failed in sandbox — fix your SQL before proceeding.
        </p>
      )}
    </div>
  )
}
```

---

### Frontend — `components/migration/RollbackScript.tsx`

```tsx
import { useState } from "react"

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
        <p className="text-orange-600 text-sm mb-2 font-medium">
          ⚠ This migration contains irreversible statements.
        </p>
      )}
      <button
        onClick={() => setShow(!show)}
        className="text-sm text-blue-600 hover:underline"
      >
        {show ? "Hide Rollback Script" : "View Rollback Script"}
      </button>
      {show && (
        <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto">
          {rollbackPlan.combined_script}
        </pre>
      )}
    </div>
  )
}
```

---

### Frontend — `components/migration/ExecuteConfirm.tsx`

```tsx
"use client"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

interface Props {
  connectionId: string
  sql: string
  approvalToken: string
  canExecute: boolean
}

export default function ExecuteConfirm({ connectionId, sql, approvalToken, canExecute }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExecute() {
    setLoading(true)
    setError(null)
    try {
      await apiFetch("/api/migration/execute", {
        method: "POST",
        body: JSON.stringify({ connectionId, sql, approvalToken }),
      })
      setSuccess(true)
      setOpen(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return <p className="text-green-600 font-semibold">Migration executed successfully.</p>
  }

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        disabled={!canExecute}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-40"
        title={!canExecute ? "Sandbox must pass and risk must not be critical" : undefined}
      >
        Execute Migration
      </button>

      {!canExecute && (
        <p className="text-sm text-gray-500 mt-1">
          Execute is disabled: sandbox must pass and risk category must not be critical.
        </p>
      )}

      {/* Confirmation modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-bold mb-3">Confirm Execution</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will run the migration on your live database. This action cannot be undone.
            </p>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Executing…" : "Yes, Execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Frontend — `app/migration/page.tsx`

```tsx
import SQLInput from "@/components/migration/SQLInput"

export default function MigrationPage() {
  return <SQLInput />
}
```

---

## Navigation (update `app/layout.tsx`)

```tsx
import Link from "next/link"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b px-6 py-3 flex gap-6 text-sm font-medium">
          <Link href="/">Connect</Link>
          <Link href="/chat">DataChat</Link>
          <Link href="/migration">MigrationGuard</Link>
          <Link href="/copilot">DBCopilot</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

---

## Activate Routes in Backend

Update `backend/main.py` to uncomment:

```python
from routes.chat import router as chat_router
from routes.migration import router as migration_router

app.include_router(chat_router)
app.include_router(migration_router)
```

---

## Deliverables for Part 2

- [ ] User can type a question and receive a results table + bar chart
- [ ] Confidence badge shows correct color for each response
- [ ] SQL is hidden by default and toggleable
- [ ] User can paste SQL migration and receive risk score, affected tables, sandbox status
- [ ] Rollback script is viewable
- [ ] Execute button is disabled when sandbox failed or risk is critical
- [ ] Confirmation modal is shown before execution
- [ ] Success/failure states are displayed after execution
