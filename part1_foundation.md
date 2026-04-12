# DBPilot — Part 1: Foundation & Infrastructure

> Set up the full project skeleton, shared libraries, environment config, and the database connection flow before any feature work begins.

---

## Checklist

- [ ] Scaffold frontend (Next.js 14)
- [ ] Scaffold backend (FastAPI)
- [ ] Configure environment variables
- [ ] Implement shared TypeScript types
- [ ] Implement AutoDB API client
- [ ] Implement Claude API wrapper stub
- [ ] Set up Zustand store
- [ ] Implement API fetch wrapper
- [ ] Build Connection Setup UI
- [ ] Build backend connection route
- [ ] Wire register + introspect flow end-to-end
- [ ] Set up global error handling

---

## 1. Project Scaffolding

### Frontend — Next.js 14

```bash
npx create-next-app@latest frontend \
  --typescript --tailwind --app --no-src-dir
cd frontend
npm install zustand recharts
```

Directory structure to create:
```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Connection setup page
│   ├── chat/page.tsx             # DataChat (Part 2)
│   ├── migration/page.tsx        # MigrationGuard (Part 2)
│   └── copilot/page.tsx          # DBCopilot (Part 3)
├── components/
│   ├── ConnectionSetup.tsx
│   ├── datachat/                 # (Part 2)
│   ├── migration/                # (Part 2)
│   └── copilot/                  # (Part 3)
└── lib/
    ├── api.ts
    ├── types.ts
    └── store.ts
```

### Backend — FastAPI

```bash
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate          # or venv\Scripts\activate on Windows
pip install fastapi uvicorn httpx anthropic python-dotenv
```

Directory structure to create:
```
backend/
├── main.py
├── .env
├── routes/
│   ├── connection.py
│   ├── chat.py                   # (Part 2)
│   ├── migration.py              # (Part 2)
│   └── copilot.py                # (Part 3)
└── lib/
    ├── autodb.py
    └── llm.py
```

---

## 2. Environment Variables

### `backend/.env`

```env
# AutoDB
AUTODB_API_KEY=your_autodb_api_key
AUTODB_BASE_URL=https://api.autodb.app/api/v1

# Anthropic (for DBCopilot SQL generation)
ANTHROPIC_API_KEY=your_anthropic_key

# App
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 3. Shared TypeScript Types

**File:** `frontend/lib/types.ts`

```ts
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

## 4. AutoDB API Client

**File:** `backend/lib/autodb.py`

```python
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

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

## 5. Claude API Wrapper Stub

**File:** `backend/lib/llm.py`

```python
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def generate_migration_sql(schema_text: str, description: str) -> str:
    """Call Claude to generate migration SQL from a plain-English description."""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""You are a PostgreSQL expert. Generate a safe, reversible migration SQL for the following request.

Schema context:
{schema_text}

Request: {description}

Rules:
- Use ALTER TABLE, not DROP/RECREATE
- Add DEFAULT values where appropriate
- Make it reversible
- Return ONLY the SQL, no explanation

SQL:"""
        }]
    )
    return message.content[0].text.strip()
```

---

## 6. Zustand Store

**File:** `frontend/lib/store.ts`

```ts
import { create } from "zustand"
import { Connection } from "./types"

interface AppState {
  connectionId: string | null
  connection: Connection | null
  setConnection: (id: string, conn: Connection) => void
  clearConnection: () => void
}

export const useAppStore = create<AppState>((set) => ({
  connectionId: null,
  connection: null,
  setConnection: (id, conn) => set({ connectionId: id, connection: conn }),
  clearConnection: () => set({ connectionId: null, connection: null }),
}))
```

---

## 7. API Fetch Wrapper

**File:** `frontend/lib/api.ts`

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail ?? `Request failed: ${res.status}`)
  }
  return res.json()
}
```

---

## 8. Backend Entry Point

**File:** `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.connection import router as connection_router
# from routes.chat import router as chat_router        # uncomment in Part 2
# from routes.migration import router as migration_router  # uncomment in Part 2
# from routes.copilot import router as copilot_router  # uncomment in Part 3

app = FastAPI(title="DBPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connection_router)
# app.include_router(chat_router)
# app.include_router(migration_router)
# app.include_router(copilot_router)
```

---

## 9. Backend — Connection Route

**File:** `backend/routes/connection.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post

router = APIRouter()

class SetupRequest(BaseModel):
    name: str
    db_type: str
    connection_string: str

@router.post("/api/connection/setup")
async def setup_connection(req: SetupRequest):
    # Step 1: Register the connection
    register_result = await autodb_post("/connections", {
        "name": req.name,
        "db_type": req.db_type,
        "connection_string": req.connection_string,
    })
    if not register_result.get("success"):
        raise HTTPException(status_code=400, detail=register_result.get("error"))

    connection_id = register_result["data"]["id"]

    # Step 2: Introspect the schema
    introspect_result = await autodb_post(
        f"/connections/{connection_id}/introspect", {}
    )
    if not introspect_result.get("success"):
        raise HTTPException(status_code=400, detail=introspect_result.get("error"))

    return {
        "connection": register_result["data"],
        "schema": introspect_result["data"],
    }
```

---

## 10. Frontend — Connection Setup UI

**File:** `frontend/components/ConnectionSetup.tsx`

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiFetch } from "@/lib/api"
import { Connection } from "@/lib/types"

export default function ConnectionSetup() {
  const router = useRouter()
  const setConnection = useAppStore((s) => s.setConnection)

  const [name, setName] = useState("")
  const [dbType, setDbType] = useState("postgresql")
  const [connStr, setConnStr] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ connection: Connection; schema: object }>(
        "/api/connection/setup",
        {
          method: "POST",
          body: JSON.stringify({ name, db_type: dbType, connection_string: connStr }),
        }
      )
      setConnection(data.connection.id, data.connection)
      router.push("/chat")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-6">Connect Your Database</h1>

      <label className="block mb-1 text-sm">Connection Name</label>
      <input
        className="w-full border rounded p-2 mb-4"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="My Production DB"
      />

      <label className="block mb-1 text-sm">Database Type</label>
      <select
        className="w-full border rounded p-2 mb-4"
        value={dbType}
        onChange={(e) => setDbType(e.target.value)}
      >
        <option value="postgresql">PostgreSQL</option>
        <option value="mysql">MySQL</option>
        <option value="sqlite">SQLite</option>
      </select>

      <label className="block mb-1 text-sm">Connection String</label>
      <input
        className="w-full border rounded p-2 mb-4"
        value={connStr}
        onChange={(e) => setConnStr(e.target.value)}
        placeholder="postgresql://user:pass@host:5432/mydb"
      />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Connecting…" : "Connect & Introspect"}
      </button>
    </div>
  )
}
```

**File:** `frontend/app/page.tsx`

```tsx
import ConnectionSetup from "@/components/ConnectionSetup"

export default function Home() {
  return <ConnectionSetup />
}
```

---

## 11. Global Error Handling

### Backend error responses (all routes)

```python
# Pattern to follow in every route
from fastapi import HTTPException

# Always check AutoDB success flag
if not result.get("success"):
    raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
```

### Frontend error display (shared pattern)

```tsx
// Reusable error state pattern used in all feature components
const [error, setError] = useState<string | null>(null)

// In catch block:
setError(e.message)

// In JSX:
{error && <p className="text-red-500 text-sm">{error}</p>}
```

---

## Deliverables for Part 1

- [ ] Both apps run locally (`npm run dev` + `uvicorn main:app --reload`)
- [ ] User can enter a connection string and connect to a database
- [ ] `connection_id` is stored in Zustand and persists across page navigation
- [ ] All shared types, API client, and store are in place for Parts 2 and 3
