# DBPilot — Part 3: DBCopilot, Context Engine & Polish

> Build the AI-powered schema generation feature, add the optional Context Engine for business docs, wire up all error handling, and prepare the demo.

---

## Checklist

### DBCopilot
- [ ] Backend route `POST /api/copilot/generate`
- [ ] `format_schema_for_prompt` helper in `lib/llm.py`
- [ ] `DescriptionInput.tsx` — plain-English input + generate button
- [ ] `GeneratedSQL.tsx` — display Claude-generated SQL (editable)
- [ ] `RiskPanel.tsx` — inline risk report for the generated migration
- [ ] Apply button → calls existing `POST /api/migration/execute`
- [ ] Wire copilot page together
- [ ] Uncomment copilot router in `backend/main.py`

### Context Engine
- [ ] Backend route `POST /api/context/upload`
- [ ] Backend route `POST /api/context/query`
- [ ] `DocumentUpload.tsx` — file picker (PDF / TXT)
- [ ] `ContextQuery.tsx` — debug query UI
- [ ] Wire context engine into the copilot page (optional section)

### Polish & Error Handling
- [ ] Backend: unified error response format across all routes
- [ ] Frontend: `ErrorBanner.tsx` shared component
- [ ] Frontend: loading skeleton placeholders
- [ ] Frontend: empty-state messages for each page
- [ ] Navigation active-link highlighting
- [ ] Demo walkthrough tested end-to-end

---

## Feature 1: DBCopilot

Users describe a schema change in plain English. Claude generates migration SQL, AutoDB analyzes the risk, and the user approves and applies it.

---

### Backend — `POST /api/copilot/generate`

**File:** `backend/routes/copilot.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_get, autodb_post
from lib.llm import generate_migration_sql, format_schema_for_prompt

router = APIRouter()

class CopilotRequest(BaseModel):
    connectionId: str
    description: str   # "Add email_verified boolean to users table"

@router.post("/api/copilot/generate")
async def copilot_generate(req: CopilotRequest):
    # Step 1: Fetch live schema context from AutoDB
    schema_resp = await autodb_get(f"/connections/{req.connectionId}/schema")
    if not schema_resp.get("success"):
        raise HTTPException(status_code=400, detail=schema_resp.get("error"))
    schema_text = format_schema_for_prompt(schema_resp["data"])

    # Step 2: Call Claude to generate migration SQL
    generated_sql = generate_migration_sql(schema_text, req.description)

    # Step 3: Auto-analyze with AutoDB
    analysis_resp = await autodb_post(
        f"/connections/{req.connectionId}/migrations/analyze",
        { "sql": generated_sql }
    )
    if not analysis_resp.get("success"):
        raise HTTPException(status_code=400, detail=analysis_resp.get("error"))

    # Step 4: Return both to frontend
    return {
        "generatedSql": generated_sql,
        "analysis": analysis_resp["data"],
    }
```

---

### Update `backend/lib/llm.py` — add `format_schema_for_prompt`

```python
def format_schema_for_prompt(schema: dict) -> str:
    """Format AutoDB schema response into a readable string for the LLM prompt."""
    lines = []
    for table in schema.get("tables", []):
        cols = ", ".join(
            f"{c['name']} {c['type']}" for c in table.get("columns", [])
        )
        lines.append(f"Table {table['name']}: ({cols})")
    return "\n".join(lines)
```

**AutoDB `GET /connections/{id}/schema` response shape expected:**

```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "uuid" },
        { "name": "email", "type": "varchar" }
      ]
    }
  ]
}
```

---

### Frontend — `components/copilot/DescriptionInput.tsx`

```tsx
"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import { CopilotResult } from "@/lib/types"
import GeneratedSQL from "./GeneratedSQL"
import RiskPanel from "./RiskPanel"

export default function DescriptionInput() {
  const connectionId = useAppStore((s) => s.connectionId)
  const [description, setDescription] = useState("")
  const [result, setResult] = useState<CopilotResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  async function handleGenerate() {
    if (!connectionId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiFetch<CopilotResult>("/api/copilot/generate", {
        method: "POST",
        body: JSON.stringify({ connectionId, description }),
      })
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    if (!result) return
    try {
      await apiFetch("/api/migration/execute", {
        method: "POST",
        body: JSON.stringify({
          connectionId,
          sql: result.generatedSql,
          approvalToken: result.analysis.approval_token,
        }),
      })
      setApplied(true)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">DBCopilot</h1>
      <p className="text-gray-500 text-sm mb-6">
        Describe a schema change in plain English. Claude will generate the SQL and analyze the risk.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 border rounded p-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="Add a soft delete column to the users table"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate SQL"}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result && !applied && (
        <div className="space-y-6">
          <GeneratedSQL sql={result.generatedSql} />
          <RiskPanel analysis={result.analysis} />

          <button
            onClick={handleApply}
            disabled={!result.analysis.sandbox_result.passed}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-40"
            title={!result.analysis.sandbox_result.passed ? "Sandbox must pass before applying" : undefined}
          >
            Apply Migration
          </button>
        </div>
      )}

      {applied && (
        <p className="text-green-600 font-semibold mt-4">
          Migration applied successfully.
        </p>
      )}
    </div>
  )
}
```

---

### Frontend — `components/copilot/GeneratedSQL.tsx`

```tsx
"use client"
import { useState } from "react"

export default function GeneratedSQL({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">Generated SQL</p>
        <button
          onClick={handleCopy}
          className="text-xs text-blue-600 hover:underline"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
        {sql}
      </pre>
    </div>
  )
}
```

---

### Frontend — `components/copilot/RiskPanel.tsx`

```tsx
import { MigrationAnalysis } from "@/lib/types"

const RISK_COLORS = {
  low:      "bg-green-100 text-green-800",
  medium:   "bg-yellow-100 text-yellow-800",
  high:     "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
}

export default function RiskPanel({ analysis }: { analysis: MigrationAnalysis }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded font-bold text-lg ${RISK_COLORS[analysis.risk_category]}`}>
          {analysis.risk_score}
        </span>
        <div>
          <p className="font-medium capitalize">{analysis.risk_category} Risk</p>
          <p className="text-xs text-gray-500">
            Sandbox: {analysis.sandbox_result.passed ? "✓ Passed" : "✗ Failed"}
          </p>
        </div>
      </div>

      <ul className="text-sm text-gray-700 space-y-1">
        {analysis.affected_tables.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{t.impact}</span>
            {t.table}
          </li>
        ))}
      </ul>

      {analysis.rollback_plan.has_irreversible && (
        <p className="text-orange-600 text-sm">⚠ Contains irreversible operations.</p>
      )}

      {!analysis.sandbox_result.passed && (
        <p className="text-red-600 text-sm font-medium">
          Sandbox failed — fix the SQL before applying.
        </p>
      )}
    </div>
  )
}
```

---

### Frontend — `app/copilot/page.tsx`

```tsx
import DescriptionInput from "@/components/copilot/DescriptionInput"

export default function CopilotPage() {
  return <DescriptionInput />
}
```

---

### Activate Route in Backend

Update `backend/main.py`:

```python
from routes.copilot import router as copilot_router
app.include_router(copilot_router)
```

---

## Feature 2: Context Engine (Optional)

Upload business documentation (PDFs, TXT files) to improve AutoDB's schema awareness and Text-to-SQL accuracy via its RAG pipeline.

---

### Backend — Context Routes

**File:** `backend/routes/context.py`

```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from lib.autodb import autodb_post
import httpx, os

router = APIRouter()

BASE_URL = os.getenv("AUTODB_BASE_URL", "https://api.autodb.app/api/v1")
API_KEY  = os.getenv("AUTODB_API_KEY")

@router.post("/api/context/upload")
async def upload_document(
    connectionId: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload a PDF or TXT file to AutoDB's RAG pipeline."""
    content = await file.read()
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{BASE_URL}/connections/{connectionId}/documents/upload",
            headers={"X-API-Key": API_KEY},
            files={"file": (file.filename, content, file.content_type)},
        )
        res.raise_for_status()
        result = res.json()
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result["data"]

@router.post("/api/context/query")
async def query_context(payload: dict):
    """Debug: return the most relevant context chunks for a query."""
    connection_id = payload.get("connectionId")
    query = payload.get("query")
    result = await autodb_post(
        f"/connections/{connection_id}/context/query",
        { "query": query }
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result["data"]
```

---

### Frontend — `components/copilot/DocumentUpload.tsx`

```tsx
"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"

export default function DocumentUpload() {
  const connectionId = useAppStore((s) => s.connectionId)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleUpload() {
    if (!file || !connectionId) return
    setLoading(true)
    setStatus(null)
    const form = new FormData()
    form.append("connectionId", connectionId)
    form.append("file", file)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/context/upload`, {
        method: "POST",
        body: form,
      })
      if (!res.ok) throw new Error("Upload failed")
      setStatus("Document uploaded and indexed successfully.")
    } catch (e: any) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm font-semibold mb-3">Upload Business Context (PDF / TXT)</p>
      <input
        type="file"
        accept=".pdf,.txt"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-3 text-sm"
      />
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="bg-gray-700 text-white px-4 py-1.5 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Uploading…" : "Upload"}
      </button>
      {status && <p className="text-sm mt-2 text-gray-600">{status}</p>}
    </div>
  )
}
```

---

### Frontend — `components/copilot/ContextQuery.tsx`

```tsx
"use client"
import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"

export default function ContextQuery() {
  const connectionId = useAppStore((s) => s.connectionId)
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<string | null>(null)

  async function handleQuery() {
    const data = await apiFetch<object>("/api/context/query", {
      method: "POST",
      body: JSON.stringify({ connectionId, query }),
    })
    setResult(JSON.stringify(data, null, 2))
  }

  return (
    <div className="border rounded-lg p-4">
      <p className="text-sm font-semibold mb-2">Debug Context Query</p>
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 border rounded p-1.5 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="what does the priority field in orders mean?"
        />
        <button
          onClick={handleQuery}
          className="bg-gray-200 px-3 py-1.5 rounded text-sm hover:bg-gray-300"
        >
          Query
        </button>
      </div>
      {result && (
        <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">{result}</pre>
      )}
    </div>
  )
}
```

---

## Polish & Error Handling

### Shared `ErrorBanner` component

**File:** `frontend/components/ErrorBanner.tsx`

```tsx
export default function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded mb-4">
      {message}
    </div>
  )
}
```

### Backend: AutoDB error codes

```python
# backend/lib/autodb.py — add at top

AUTODB_ERRORS = {
    "SCHEMA_VALIDATION_FAILED": "SQL references tables not in your schema.",
    "SQL_GENERATION_FAILED":    "Could not generate valid SQL for that question.",
    "EXECUTION_FAILED":         "SQL passed validation but failed on your database.",
}
```

### Loading skeletons (shared pattern)

```tsx
// Use in any component while loading
{loading && (
  <div className="animate-pulse space-y-3">
    <div className="h-4 bg-gray-200 rounded w-3/4" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />
  </div>
)}
```

### Empty-state messages

| Page | Empty state text |
|---|---|
| DataChat | "Ask a question to see results." |
| MigrationGuard | "Paste a SQL migration above to analyze it." |
| DBCopilot | "Describe the schema change you want to make." |

### Active nav link

```tsx
// app/layout.tsx — highlight active route
"use client"
import { usePathname } from "next/navigation"

// In nav:
const pathname = usePathname()
className={pathname === "/chat" ? "text-blue-600 font-semibold" : "text-gray-600"}
```

---

## Demo Script (Hackathon Presentation)

Total time: ~4 minutes

| Step | Action | Expected output |
|---|---|---|
| 1 | Paste a Supabase connection string → click "Connect & Introspect" | "12 tables introspected" in ~2s |
| 2 | Go to DataChat → type "Which products had the most returns this quarter?" | Live table + bar chart in ~3s |
| 3 | Go to MigrationGuard → paste `ALTER TABLE orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';` | Risk score 35 (medium), sandbox passed, rollback script shown |
| 4 | Click "Execute Migration" → confirm modal → click "Yes, Execute" | "Migration executed successfully." |
| 5 | Go to DBCopilot → type "Add a soft delete column to the users table" | Claude generates `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ`, risk score 20 (low) |
| 6 | Click "Apply Migration" | "Migration applied successfully." |

---

## Final Integration Checklist

- [ ] All 4 pages accessible via nav: Connect, DataChat, MigrationGuard, DBCopilot
- [ ] `connection_id` persists across page navigation (Zustand)
- [ ] Backend returns `{ detail: "..." }` on all error paths
- [ ] Frontend catches and displays all errors via `ErrorBanner`
- [ ] Loading states shown on all async actions
- [ ] Execute/Apply buttons correctly disabled when conditions not met
- [ ] Context Engine upload and query routes functional (optional)
- [ ] Demo walkthrough completed successfully end-to-end

---

## Deliverables for Part 3

- [ ] User can type a plain-English schema change → receive Claude-generated SQL + risk panel
- [ ] Apply button executes the migration using the approval token
- [ ] Optional: user can upload a PDF/TXT document to improve SQL accuracy
- [ ] Optional: context debug query UI works
- [ ] All error states handled gracefully across all three features
- [ ] App is demo-ready with a smooth 4-minute walkthrough
