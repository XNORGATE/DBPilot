# YunoClinic

AI-powered clinic database management platform. Two-portal system: staff access patient data in plain English, admins safely evolve the schema with AI-assisted migration tooling.

Built on top of the **DBPilot** platform using **AutoDB**, **Claude AI**, and **Next.js 14**.

---

## Features

### Staff Portal
| Feature | Description |
|---|---|
| **DataChat** | Ask plain-English questions — "How many patients were seen this week?" — and get live result tables |
| **Record Assistant** | Add or update records in plain English with risk preview before saving |

### Admin Portal
| Feature | Description |
|---|---|
| **MigrationGuard** | Paste SQL → risk score (0–10), sandbox dry-run, blast radius, auto-generated rollback script |
| **DBCopilot** | Describe a schema change in plain English → Claude generates SQL + auto-runs risk analysis |

---

## Tech Stack

### Frontend
| Tech | Version | Purpose |
|---|---|---|
| Next.js | 14.2.35 | App Router, SSG, file-based routing |
| React | 18 | UI components |
| TypeScript | 5 | Type safety |
| Zustand | 5 | Global state + localStorage persistence |
| Recharts | 3 | Data visualization charts |
| Lucide React | latest | Icon library (no emoji) |
| Tailwind CSS | 3.4 | Utility classes (minimal, mostly CSS variables) |
| Geist Font | — | Variable font via `next/font` |

### Backend
| Tech | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.115 | REST API framework |
| Uvicorn | 0.32 | ASGI server |
| asyncpg | 0.30 | Direct PostgreSQL execution |
| httpx | 0.27 | Async HTTP client (AutoDB calls) |
| Anthropic SDK | 0.39 | Claude API integration |
| python-dotenv | 1.0 | Environment variable loading |
| Pydantic | 2.x | Request/response validation |

### External Services
| Service | Role |
|---|---|
| **AutoDB** (`api.autodb.app`) | Connection registry, schema introspection, migration analysis & sandbox, SQL execution fallback |
| **Anthropic Claude** (`claude-sonnet-4-20250514`) | SQL generation, CRUD intent detection, migration SQL generation, SQL file fixing |
| **Neon** (or any PostgreSQL host) | The actual clinic database being managed |

---

## Architecture

```
Browser (localhost:3000)
        │
        │  REST API calls
        ▼
FastAPI Backend (localhost:8000)
        │
        ├──► AutoDB API ──────────────────────────────────┐
        │    - Connection management                       │
        │    - Schema introspection                        │
        │    - Migration analysis + sandbox                │
        │    - SQL execution (primary path)                │
        │                                                  │
        ├──► Claude API (Anthropic)                        │
        │    - SQL generation from natural language        │
        │    - CRUD intent detection & DML generation      │
        │    - Plain-English → migration SQL               │
        │    - SQL file error detection & fixing           │
        │                                                  │
        └──► Direct asyncpg ◄──────────────────────────────┘
             - Fallback when AutoDB /execute fails
             - Read-only enforced via transaction
             - Connection strings stored in memory (session)
```

### Data flow — DataChat query

```
User types question
        │
        ▼
POST /api/chat  { connectionId, query }
        │
        ├─1─► information_schema query via AutoDB /execute
        │     → full column-level schema text
        │
        ├─2─► Claude: schema + question → JSON { sql, reasoning }
        │
        ├─3─► AutoDB /execute with generated SQL
        │         │ fails?
        │         └─► direct asyncpg fallback
        │
        └─4─► Response: { sql, markdown_output, reasoning, execution_error }
                │
                ▼
        Frontend renders ResultsTable + ResultsChart
```

### Data flow — Record Assistant (CRUD agent)

```
User: "Add patient Anna, born 1993-04-22"
        │
        ▼
POST /api/chat/agent  { connectionId, query }
        │
        ├─1─► Rich schema fetch (information_schema)
        │
        ├─2─► Claude: classify intent + generate DML
        │     Returns: { intent, sql, preview_sql, description, risk }
        │
        ├─3─► AutoDB executes preview_sql (SELECT)
        │     → shows user what will be affected/inserted
        │
        └─4─► Response sent to frontend
                │
                ▼
        User sees: description + risk badge + preview table
        User clicks Confirm
                │
                ▼
        POST /api/chat/agent-execute  { sql }
        Safety: only INSERT/UPDATE allowed, revalidated server-side
```

### Data flow — MigrationGuard

```
User pastes SQL (or uploads .sql file)
        │
        ├── File upload path:
        │   POST /api/migration/fix-sql
        │   ├─► information_schema via AutoDB /execute
        │   └─► Claude: compare SQL vs schema, fix mismatches
        │       Returns: { fixedSql, changes[] }
        │
        └── Analyze path:
            POST /api/migration/analyze
            └─► AutoDB /migrations/analyze
                Returns: {
                  risk_score, risk_category,
                  sandbox_result: { passed, output },
                  blast_radius: { affected_tables, affected_rows },
                  rollback_plan,
                  approval_token
                }
                        │
                        ▼
            User reviews RiskReport + RollbackScript
            User clicks Execute
                        │
                        ▼
            POST /api/migration/execute  { sql, approvalToken }
            └─► AutoDB (token-gated — only runs if analyze was called first)
```

### Data flow — DBCopilot

```
User: "Add a diagnosis_notes column to visits"
        │
        ▼
POST /api/copilot/generate  { connectionId, description }
        │
        ├─1─► AutoDB /schema (or /introspect fallback)
        │
        ├─2─► Claude: schema + description → migration SQL
        │     (ALTER TABLE, not DROP/RECREATE, reversible)
        │
        └─3─► AutoDB /migrations/analyze (auto-runs on generated SQL)
              Returns combined: { generatedSql, analysis }
                        │
                        ▼
              Frontend shows GeneratedSQL + RiskPanel
              User can then execute via MigrationGuard flow
```

---

## Project Structure

```
DBPilot/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── requirements.txt
│   ├── seed_clinic.py             # Seeds Neon DB with clinic demo data
│   ├── lib/
│   │   ├── autodb.py              # AutoDB HTTP client (get/post/upload)
│   │   ├── direct_db.py          # asyncpg direct execution + session store
│   │   └── llm.py                # Anthropic client, SQL/migration generators
│   └── routes/
│       ├── connection.py          # /api/connection/* (register, list, introspect)
│       ├── chat.py                # /api/chat, /api/chat/agent, /api/chat/agent-execute, /api/chat/suggestions
│       ├── migration.py           # /api/migration/analyze, /api/migration/fix-sql, /api/migration/execute
│       ├── copilot.py             # /api/copilot/generate
│       └── context.py            # /api/context (schema context endpoint)
│
└── frontend/
    ├── app/
    │   ├── layout.tsx             # Root layout, NavBar with Suspense wrapper
    │   ├── globals.css            # CSS custom properties (design tokens), animations
    │   ├── page.tsx               # Root: shows ConnectionSetup or Dashboard
    │   ├── chat/page.tsx          # DataChat + Record Assistant (mode=agent)
    │   ├── admin/page.tsx         # Admin Panel hub + activity log
    │   ├── migration/page.tsx     # MigrationGuard
    │   └── copilot/page.tsx       # DBCopilot
    ├── components/
    │   ├── ConnectionSetup.tsx    # Landing page: register/select DB connection
    │   ├── Dashboard.tsx          # Two-portal command center (staff + admin)
    │   ├── NavBar.tsx             # Sticky nav: Staff pill group + Admin pill group
    │   ├── datachat/
    │   │   ├── ChatInput.tsx      # Chat UI, mode switching, CRUD confirm flow
    │   │   ├── ResultsTable.tsx   # Paginated markdown table renderer
    │   │   └── ResultsChart.tsx   # Auto-chart from query results (Recharts)
    │   ├── migration/
    │   │   ├── SQLInput.tsx       # SQL textarea, file upload, drag-and-drop
    │   │   ├── RiskReport.tsx     # Risk score, sandbox result, blast radius
    │   │   ├── RollbackScript.tsx # Rollback SQL display with copy button
    │   │   └── ExecuteConfirm.tsx # Gated execute button with approval token
    │   └── copilot/
    │       ├── DescriptionInput.tsx  # Plain-English input for schema changes
    │       ├── GeneratedSQL.tsx      # Generated SQL display with copy button
    │       ├── RiskPanel.tsx         # Inline risk analysis for generated SQL
    │       └── DocumentUpload.tsx    # PDF/TXT context upload for schema docs
    └── lib/
        ├── api.ts                 # apiFetch wrapper (base URL, error handling)
        ├── store.ts               # Zustand store (connection, schema, activity logs)
        └── types.ts               # Shared TypeScript interfaces
```

---

## State Management

Zustand store (`lib/store.ts`) with `persist` middleware — serialized to `localStorage` under key `dbpilot-store`.

| State slice | Type | Persisted | Description |
|---|---|---|---|
| `connectionId` | `string \| null` | Yes | AutoDB connection UUID |
| `connection` | `Connection` | Yes | Name, db_type, status |
| `schema` | `SchemaInfo` | Yes | Tables list from introspect |
| `staffActivity` | `ActivityItem[]` | Yes | Last 30 staff actions |
| `adminActivity` | `ActivityItem[]` | Yes | Last 30 admin actions |

Chat conversation messages live in component `useState` only — not persisted across refreshes.

---

## API Reference

### Connection
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/connection/list` | List all AutoDB-registered connections |
| POST | `/api/connection/setup` | Register new DB + introspect schema |
| POST | `/api/connection/use-existing` | Load existing AutoDB connection |
| POST | `/api/connection/set-direct-string` | Store connection string for direct execution |
| GET | `/api/connection/has-direct/{id}` | Check if direct string is stored |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Natural language → SQL → execute → results |
| POST | `/api/chat/agent` | CRUD intent detection + DML generation + preview |
| POST | `/api/chat/agent-execute` | Execute confirmed INSERT/UPDATE |
| POST | `/api/chat/suggestions` | Generate 6 AI example questions from schema |

### Migration
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/migration/analyze` | Risk score + sandbox + blast radius + rollback |
| POST | `/api/migration/fix-sql` | AI-fix uploaded SQL against real schema |
| POST | `/api/migration/execute` | Execute approved migration (requires approval_token) |

### Copilot
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/copilot/generate` | Plain English → migration SQL + auto risk analysis |

---

## Design System

All colors are CSS custom properties in `globals.css`. Two accent families:

| Token family | Color | Used for |
|---|---|---|
| `--accent` | Blue `#1469A0` | Staff portal, DataChat, Record Assistant |
| `--admin` | Slate-indigo `#3F5FA8` | Admin portal, MigrationGuard, DBCopilot |
| `--success` | Green | Connected status, OK badges |
| `--danger` | Red | Errors, destructive risk |
| `--warning` | Amber | Medium risk levels in migration analysis only |

Full dark mode via `data-theme="dark"` on `<html>`, toggled by NavBar and persisted to `localStorage` under `dbpilot-theme`.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- AutoDB API key — get one at [app.autodb.app](https://app.autodb.app)
- Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)
- A PostgreSQL database (Neon, Supabase, Railway, or local Docker)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

cp .env.example .env
# Edit .env — fill in AUTODB_API_KEY and ANTHROPIC_API_KEY

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# .env.local is already configured:
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed demo data (optional)

```bash
cd backend
# Edit seed_clinic.py — update CONN with your PostgreSQL connection string
python seed_clinic.py
```

Creates 7 tables with realistic clinic data: departments, doctors, patients, appointments, visits, diagnoses, prescriptions.

---

## Environment Variables

### Backend (`.env`)
```
AUTODB_API_KEY=your_autodb_key
AUTODB_BASE_URL=https://api.autodb.app/api/v1
ANTHROPIC_API_KEY=your_anthropic_key
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
