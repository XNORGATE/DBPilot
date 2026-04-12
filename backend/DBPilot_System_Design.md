# DBPilot — Complete System Design

> AI copilot for your entire database lifecycle: ask questions, analyze migrations, and ship schema changes safely.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python) **or** Express (Node.js/TypeScript) |
| LLM (DBCopilot) | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Database agent | AutoDB API (`api.autodb.app/api/v1`) |
| Charts | Recharts |
| State | Zustand (or React Context) |

---

## 2. Environment Variables

```env
# AutoDB
AUTODB_API_KEY=your_autodb_api_key
AUTODB_BASE_URL=https://api.autodb.app/api/v1

# Anthropic (for DBCopilot SQL generation)
ANTHROPIC_API_KEY=your_anthropic_key

# App
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 3. Project Structure

```
dbpilot/
├── frontend/                         # Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Connection setup
│   │   ├── chat/page.tsx             # DataChat module
│   │   ├── migration/page.tsx        # MigrationGuard module
│   │   └── copilot/page.tsx          # DBCopilot module
│   ├── components/
│   │   ├── ConnectionSetup.tsx       # Register + introspect DB
│   │   ├── datachat/
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ResultsTable.tsx
│   │   │   └── ResultsChart.tsx
│   │   ├── migration/
│   │   │   ├── SQLInput.tsx
│   │   │   ├── RiskReport.tsx        # Score badge, blast radius, sandbox
│   │   │   ├── RollbackScript.tsx
│   │   │   └── ExecuteConfirm.tsx    # Confirm modal with approval_token
│   │   └── copilot/
│   │       ├── DescriptionInput.tsx
│   │       ├── GeneratedSQL.tsx
│   │       └── RiskPanel.tsx
│   └── lib/
│       ├── api.ts                    # fetch wrapper for our backend
│       ├── types.ts                  # shared TypeScript types
│       └── store.ts                  # Zustand store (connectionId, etc.)
│
└── backend/                          # FastAPI or Express
    ├── main.py (or index.ts)
    ├── routes/
    │   ├── chat.py                   # POST /api/chat
    │   ├── migration.py              # POST /api/migration/analyze + execute
    │   ├── copilot.py                # POST /api/copilot/generate
    │   └── connection.py             # POST /api/connection/setup
    └── lib/
        ├── autodb.py                 # AutoDB API client
        └── llm.py                    # Claude API wrapper (for copilot)
```

---

## 4. AutoDB API Client (shared lib)

```python
# backend/lib/autodb.py
import httpx
import os

BASE_URL = os.getenv("AUTODB_BASE_URL", "https://api.autodb.app/api/v1")
API_KEY  = os.getenv("AUTODB_API_KEY")

HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

async def autodb_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{BASE_URL}{path}", json=body, headers=HEADERS)
        res.raise_for_status()
        return res.json()

async def autodb_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{BASE_URL}{path}", headers=HEADERS)
        res.raise_for_status()
        return res.json()
```

---

## 5. Setup Flow: Register + Introspect

This runs once when the user first connects their database.

### Step 1 — Register connection

```
POST https://api.autodb.app/api/v1/connections
```

**Request body:**
```json
{
  "name": "My Production DB",
  "db_type": "postgresql",
  "connection_string": "postgresql://user:pass@host:5432/mydb"
}
```

**Response (save `data.id` as `connection_id`):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Production DB",
    "db_type": "postgresql",
    "is_active": true,
    "last_introspected_at": null
  }
}
```

### Step 2 — Introspect schema

```
POST https://api.autodb.app/api/v1/connections/{connection_id}/introspect
```

**No body required.**

**Response:**
```json
{
  "success": true,
  "data": {
    "table_count": 12,
    "tables": ["users", "orders", "products", "order_items"],
    "snapshot_id": "660e8400-...",
    "introspected_at": "2025-01-15T10:00:00Z"
  }
}
```

> Re-introspect whenever your schema changes. Store `connection_id` in app state — every subsequent API call needs it.

---

## 6. Feature: DataChat

Users ask plain-English questions and get back live data tables + charts.

### Frontend component flow

```tsx
// components/datachat/ChatInput.tsx
const [query, setQuery] = useState("")
const [result, setResult] = useState<ChatResult | null>(null)
const [loading, setLoading] = useState(false)

async function handleSubmit() {
  setLoading(true)
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId, query }),
  })
  const data = await res.json()
  setResult(data)
  setLoading(false)
}
```

### Backend route: `POST /api/chat`

```python
# routes/chat.py
from fastapi import APIRouter
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
    return result["data"]
```

### AutoDB call: `POST /connections/{id}/queries/generate`

**Request:**
```json
{
  "query": "Show me the top 10 customers by total order value in the last 30 days",
  "max_schema_chunks": 5,
  "max_doc_chunks": 3
}
```

**Response (key fields):**
```json
{
  "sql": "SELECT c.id, c.name, SUM(o.total) AS total FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.id, c.name ORDER BY total DESC LIMIT 10",
  "confidence": 0.92,
  "reasoning": "Found customers and orders tables with required columns...",
  "referenced_tables": ["customers", "orders"],
  "warnings": [],
  "sql_valid": true,
  "hallucinated_tables": [],
  "markdown_output": "| id | name | total |\n|---|---|---|\n| 42 | Acme Corp | 15230.00 |",
  "execution_error": null
}
```

### Frontend display logic

```tsx
// Show confidence badge
const confidenceColor =
  confidence >= 0.9 ? "green" :
  confidence >= 0.7 ? "yellow" : "red"

// Parse markdown_output into table rows for display
// Render chart using Recharts BarChart with referenced_tables data
// Show sql in a collapsible code block
```

---

## 7. Feature: MigrationGuard

Users paste a SQL migration and get a full risk analysis before any production changes.

### Backend routes

#### `POST /api/migration/analyze`

```python
class AnalyzeRequest(BaseModel):
    connectionId: str
    sql: str

@router.post("/api/migration/analyze")
async def analyze(req: AnalyzeRequest):
    result = await autodb_post(
        f"/connections/{req.connectionId}/migrations/analyze",
        { "sql": req.sql }
    )
    return result["data"]
```

#### `POST /api/migration/execute`

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
    return result["data"]
```

### AutoDB: `POST /connections/{id}/migrations/analyze`

**Request:**
```json
{
  "sql": "ALTER TABLE orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';\nCREATE INDEX CONCURRENTLY idx_orders_priority ON orders(priority);"
}
```

**Response (key fields):**
```json
{
  "risk_score": 35,
  "risk_category": "medium",
  "total_statements": 2,
  "affected_tables": [
    { "table": "orders", "impact": "direct", "cascade_path": null },
    { "table": "order_items", "impact": "cascade", "cascade_path": ["orders", "order_items"] }
  ],
  "sandbox_result": {
    "passed": true,
    "migration_applied": true,
    "tables_created": 8,
    "duration_ms": 4500
  },
  "rollback_plan": {
    "has_irreversible": false,
    "combined_script": "BEGIN;\nALTER TABLE orders DROP COLUMN priority;\nCOMMIT;"
  },
  "approval_token": "eyJzcWwiOi4uLn0.a1b2c3d4"
}
```

### Risk score display logic

```tsx
// RiskReport.tsx
const riskColor = {
  low: "green",       // 0–25
  medium: "yellow",   // 26–50
  high: "orange",     // 51–75
  critical: "red",    // 76–100
}[riskCategory]

// Only enable "Execute" button if:
const canExecute = sandboxResult.passed && riskCategory !== "critical"
```

### AutoDB: `POST /migrations/execute`

**Request:**
```json
{
  "connection_id": "550e8400-...",
  "sql": "ALTER TABLE orders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';",
  "approval_token": "eyJzcWwiOi4uLn0.a1b2c3d4"
}
```

> The `approval_token` is HMAC-signed and tied to the exact SQL that was analyzed. If the SQL doesn't match, execution is rejected.

---

## 8. Feature: DBCopilot

Users describe a schema change in plain English. The backend generates SQL using Claude, then auto-runs it through AutoDB's migration analysis. Users see the generated SQL + risk report and approve.

### Backend route: `POST /api/copilot/generate`

```python
# routes/copilot.py
import anthropic
from lib.autodb import autodb_get, autodb_post

anthropic_client = anthropic.Anthropic()

class CopilotRequest(BaseModel):
    connectionId: str
    description: str   # "Add email_verified boolean to users table"

@router.post("/api/copilot/generate")
async def copilot_generate(req: CopilotRequest):
    # Step 1: Fetch live schema context from AutoDB
    schema = await autodb_get(f"/connections/{req.connectionId}/schema")
    schema_text = format_schema_for_prompt(schema["data"])

    # Step 2: Call Claude to generate migration SQL
    message = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""You are a PostgreSQL expert. Generate a safe, reversible migration SQL for the following request.

Schema context:
{schema_text}

Request: {req.description}

Rules:
- Use ALTER TABLE, not DROP/RECREATE
- Add DEFAULT values where appropriate
- Make it reversible
- Return ONLY the SQL, no explanation

SQL:"""
        }]
    )
    generated_sql = message.content[0].text.strip()

    # Step 3: Auto-analyze with AutoDB
    analysis = await autodb_post(
        f"/connections/{req.connectionId}/migrations/analyze",
        { "sql": generated_sql }
    )

    # Step 4: Return both to frontend
    return {
        "generatedSql": generated_sql,
        "analysis": analysis["data"]
    }


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

### Frontend component flow

```tsx
// components/copilot/DescriptionInput.tsx
const [description, setDescription] = useState("")
const [result, setResult] = useState<CopilotResult | null>(null)

async function handleGenerate() {
  const res = await fetch("/api/copilot/generate", {
    method: "POST",
    body: JSON.stringify({ connectionId, description }),
  })
  const data = await res.json()
  setResult(data)
  // Show: generatedSql, analysis.risk_score, analysis.sandbox_result
  // Enable "Apply" only if analysis.sandbox_result.passed === true
}

async function handleApply() {
  await fetch("/api/migration/execute", {
    method: "POST",
    body: JSON.stringify({
      connectionId,
      sql: result.generatedSql,
      approvalToken: result.analysis.approval_token,
    }),
  })
}
```

---

## 9. Shared TypeScript Types

```ts
// frontend/lib/types.ts

export interface Connection {
  id: string
  name: string
  db_type: string
  last_introspected_at: string | null
}

export interface ChatResult {
  sql: string
  confidence: number
  reasoning: string
  referenced_tables: string[]
  warnings: string[]
  sql_valid: boolean
  markdown_output: string
  execution_error: string | null
}

export interface AffectedTable {
  table: string
  impact: "direct" | "cascade"
  cascade_path: string[] | null
}

export interface MigrationAnalysis {
  risk_score: number
  risk_category: "low" | "medium" | "high" | "critical"
  total_statements: number
  affected_tables: AffectedTable[]
  sandbox_result: {
    passed: boolean
    migration_applied: boolean
    tables_created: number
    duration_ms: number
  }
  rollback_plan: {
    has_irreversible: boolean
    combined_script: string
  }
  approval_token: string
}

export interface CopilotResult {
  generatedSql: string
  analysis: MigrationAnalysis
}
```

---

## 10. Context Engine (Optional Enhancement)

Upload business documentation to improve AutoDB's schema awareness and Text-to-SQL accuracy.

### Upload a document

```
POST https://api.autodb.app/api/v1/connections/{id}/documents/upload
Content-Type: multipart/form-data

file: <PDF or TXT>
```

This ingests the document into AutoDB's RAG pipeline. Future Text-to-SQL queries will use it as business context (e.g. your data dictionary, field naming conventions, business rules).

### Query context (debugging)

```
POST https://api.autodb.app/api/v1/connections/{id}/context/query

{
  "query": "what does the priority field in orders mean?"
}
```

Returns the most relevant schema + document chunks for a given question.

---

## 11. AutoDB API Quick Reference

| Endpoint | Method | Used by |
|---|---|---|
| `/connections` | POST | Connection setup |
| `/connections/{id}/introspect` | POST | Connection setup |
| `/connections/{id}/schema` | GET | DBCopilot (schema grounding) |
| `/connections/{id}/queries/generate` | POST | DataChat |
| `/connections/{id}/migrations/analyze` | POST | MigrationGuard, DBCopilot |
| `/migrations/execute` | POST | MigrationGuard, DBCopilot |
| `/connections/{id}/documents/upload` | POST | Context Engine |
| `/connections/{id}/context/query` | POST | Context Engine (debug) |

**Auth header on all requests:**
```
X-API-Key: YOUR_AUTODB_API_KEY
```

---

## 12. Error Handling

```python
# AutoDB error codes to handle
AUTODB_ERRORS = {
    "SCHEMA_VALIDATION_FAILED": "SQL references tables not in your schema.",
    "SQL_GENERATION_FAILED":    "Could not generate valid SQL for that question.",
    "EXECUTION_FAILED":         "SQL passed validation but failed on your database.",
}

# Always check response["success"] before using response["data"]
# If success is False, response["error"] contains the message
```

```tsx
// Frontend — show user-friendly errors
if (!result.sql_valid) {
  showError("Couldn't generate SQL for that question. Try rephrasing.")
}
if (result.execution_error) {
  showError(`Query failed: ${result.execution_error}`)
}
if (!analysis.sandbox_result.passed) {
  showWarning("Migration failed in sandbox — check your SQL before proceeding.")
}
```

---

## 13. Demo Script (Hackathon Presentation)

1. **Connection setup** — paste a Supabase connection string, click "Connect". AutoDB introspects 12 tables in ~2s.
2. **DataChat** — type "Which products have had the most returns this quarter?" → live table + bar chart in 3s.
3. **MigrationGuard** — paste `ALTER TABLE orders ADD COLUMN priority VARCHAR(20)` → risk score 35 (medium), sandbox passed, rollback script ready. Execute with one click.
4. **DBCopilot** — type "Add a soft delete column to the users table" → Claude generates `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ` → AutoDB analyzes it → risk score 20 (low), approve and apply.

**Total demo time: ~4 minutes.**
