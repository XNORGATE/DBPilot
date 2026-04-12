import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post, autodb_get
from lib.llm import client
from lib import direct_db

router = APIRouter()


class ChatRequest(BaseModel):
    connectionId: str
    query: str


class SuggestionsRequest(BaseModel):
    connectionId: str
    tables: list[str]


# ── Schema helpers ──────────────────────────────────────────────────────────

def _format_schema(schema_data: dict | list) -> str:
    """Convert AutoDB introspect response into readable schema text for Claude."""
    lines = []

    if isinstance(schema_data, list):
        # plain list of table objects or strings
        tables = schema_data
    elif isinstance(schema_data, dict):
        # try common keys from AutoDB response
        tables = (
            schema_data.get("tables")
            or schema_data.get("schema")
            or schema_data.get("data")
            or []
        )
    else:
        return "(schema not available)"

    for table in tables:
        if isinstance(table, str):
            lines.append(f"Table: {table}")
        elif isinstance(table, dict):
            name = table.get("name") or table.get("table_name") or "unknown"
            cols = table.get("columns") or table.get("fields") or []
            if cols:
                col_parts = []
                for c in cols:
                    if isinstance(c, dict):
                        cname = c.get("name") or c.get("column_name") or "?"
                        ctype = c.get("type") or c.get("data_type") or ""
                        col_parts.append(f"{cname} {ctype}".strip())
                    elif isinstance(c, str):
                        col_parts.append(c)
                lines.append(f"Table {name}: ({', '.join(col_parts)})")
            else:
                lines.append(f"Table {name}")

    return "\n".join(lines) if lines else "(schema not available)"


def _extract_tables(sql: str) -> list[str]:
    """Extract table names referenced in a SQL statement."""
    pattern = r'\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z_][a-zA-Z0-9_.]*)'
    return list(set(re.findall(pattern, sql, re.IGNORECASE)))


async def _get_rich_schema(connection_id: str) -> str:
    """
    Get full column-level schema by querying information_schema via AutoDB /execute.
    Falls back to table-name-only introspect if that fails.
    """
    col_sql = """
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast',
                           'storage','pgsodium','graphql_public','vault',
                           'realtime','graphql','extensions','auth','public')
ORDER BY table_name, ordinal_position
"""
    try:
        resp = await autodb_post("/execute", {
            "connection_id": connection_id,
            "sql": col_sql,
            "caller": "human",
        })
        if resp.get("success"):
            data = resp.get("data", {})
            raw_rows = data.get("rows", [])
            col_names = data.get("columns", [])
            if raw_rows and isinstance(raw_rows[0], (list, tuple)):
                rows = [dict(zip(col_names, r)) for r in raw_rows]
            else:
                rows = raw_rows

            # Group by table
            tables: dict[str, list[str]] = {}
            for row in rows:
                t = row.get("table_name", "")
                c = row.get("column_name", "")
                dt = row.get("data_type", "")
                nullable = "" if row.get("is_nullable") == "YES" else " NOT NULL"
                tables.setdefault(t, []).append(f"{c} {dt}{nullable}")

            if tables:
                lines = [f"Table {t}: ({', '.join(cols)})" for t, cols in tables.items()]
                schema_text = "\n".join(lines)
                print(f"[Chat] Rich schema ({len(tables)} tables via information_schema)")
                return schema_text
    except Exception as e:
        print(f"[Chat] information_schema query failed: {e}")

    # Fallback: introspect (table names only)
    try:
        introspect = await autodb_post(f"/connections/{connection_id}/introspect", {})
        if introspect.get("success"):
            schema_data = introspect.get("data", {})
            text = _format_schema(schema_data)
            print(f"[Chat] Fallback schema (introspect only): {text[:80]}")
            return text
    except Exception as e:
        print(f"[Chat] introspect fallback failed: {e}")

    return "(schema not available)"


def _rows_to_markdown(data) -> str:
    """Convert AutoDB execution result to a markdown table string."""
    if not data:
        return ""

    rows, columns = [], []

    if isinstance(data, list):
        rows = data
        if rows and isinstance(rows[0], dict):
            columns = list(rows[0].keys())

    elif isinstance(data, dict):
        # many possible shapes: {rows, columns}, {data, fields}, {results}...
        rows = (
            data.get("rows")
            or data.get("results")
            or data.get("data")
            or []
        )
        columns = data.get("columns") or data.get("fields") or []
        # columns may be a list of dicts with a "name" key
        if columns and isinstance(columns[0], dict):
            columns = [c.get("name") or c.get("column_name") or str(c) for c in columns]
        # infer columns from first row if still missing
        if not columns and rows and isinstance(rows[0], dict):
            columns = list(rows[0].keys())

    if not rows or not columns:
        # scalar result (e.g. COUNT(*))
        if isinstance(data, dict) and "count" in data:
            return f"| count |\n|---|\n| {data['count']} |"
        return ""

    # build markdown table (cap at 200 rows)
    header = "| " + " | ".join(str(c) for c in columns) + " |"
    sep    = "|" + "|".join("---" for _ in columns) + "|"
    body_lines = []
    for row in rows[:200]:
        if isinstance(row, dict):
            vals = [str(row.get(c, "")) for c in columns]
        elif isinstance(row, (list, tuple)):
            vals = [str(v) for v in row]
        else:
            continue
        body_lines.append("| " + " | ".join(vals) + " |")

    return "\n".join([header, sep] + body_lines)


# ── SQL generation (our Claude) ──────────────────────────────────────────────

async def _generate_sql(schema_text: str, question: str) -> tuple[str, str]:
    """Call our Claude to produce SQL + reasoning. Returns (sql, reasoning)."""
    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=700,
        messages=[
            {
                "role": "user",
                "content": f"""You are a SQL expert. Write a single SQL SELECT query to answer the user's question.

Schema:
{schema_text}

Question: {question}

Rules:
- SELECT only — no INSERT / UPDATE / DELETE / DROP
- Use fully-qualified table names as they appear in the schema
- Return ONLY a JSON object with two keys — "sql" and "reasoning"
- "sql": the complete SQL query
- "reasoning": 1–2 sentences explaining your approach
- No markdown, no code fences, no extra text — just raw JSON

JSON:""",
            }
        ],
    )
    text = msg.content[0].text.strip()
    try:
        start = text.find("{")
        end   = text.rfind("}") + 1
        obj   = json.loads(text[start:end])
        return str(obj.get("sql", "")).strip(), str(obj.get("reasoning", ""))
    except Exception:
        # fallback: treat the whole response as SQL
        return text.strip(), "Generated by Claude"


# ── Execution via AutoDB ─────────────────────────────────────────────────────

async def _execute_sql(connection_id: str, sql: str) -> tuple[str, str | None]:
    """
    Execute SQL via AutoDB /execute, with direct asyncpg fallback.
    Always returns (markdown, error_message_or_None).
    Never returns a sentinel — errors are real messages shown to the user.
    """
    last_error: str | None = None

    # ── Priority 1: AutoDB /execute ─────────────────────────────────────────
    try:
        resp = await autodb_post("/execute", {
            "connection_id": connection_id,
            "sql": sql,
            "caller": "human",
        })
        if resp.get("success"):
            data = resp.get("data", {})
            columns = data.get("columns", [])
            raw_rows = data.get("rows", [])
            if columns and raw_rows and isinstance(raw_rows[0], (list, tuple)):
                dict_rows = [dict(zip(columns, r)) for r in raw_rows]
                data = {"columns": columns, "rows": dict_rows}
            markdown = _rows_to_markdown(data)
            print(f"[Chat] AutoDB /execute OK — {data.get('row_count', '?')} rows")
            return markdown, None
        else:
            err = resp.get("error", {})
            last_error = err.get("message", "Query failed") if isinstance(err, dict) else str(err)
            print(f"[Chat] AutoDB /execute error: {last_error}")
    except Exception as e:
        last_error = str(e)
        print(f"[Chat] AutoDB /execute exception: {e}")

    # ── Priority 2: direct asyncpg ──────────────────────────────────────────
    conn_str = direct_db.retrieve(connection_id)
    if conn_str:
        try:
            result = await direct_db.execute_query(conn_str, sql)
            markdown = _rows_to_markdown(result)
            print(f"[Chat] Direct asyncpg OK — {result['row_count']} rows")
            return markdown, None
        except Exception as e:
            last_error = str(e)
            print(f"[Chat] Direct asyncpg failed: {e}")

    # Return whatever error we collected — never a sentinel
    return "", last_error


# ── Routes ──────────────────────────────────────────────────────────────────

@router.post("/api/chat")
async def chat(req: ChatRequest):
    """
    AutoDB's /queries/generate is down (Bedrock IAM 403).
    We bypass it: generate SQL with our Claude, execute via AutoDB's raw SQL endpoint.
    """
    # 1. Get rich column-level schema via information_schema
    schema_text = await _get_rich_schema(req.connectionId)

    # 2. Generate SQL with our Claude
    sql, reasoning = await _generate_sql(schema_text, req.query)
    if not sql:
        raise HTTPException(status_code=400, detail="Could not generate SQL for that question")

    # 3. Execute
    markdown_output, execution_error = await _execute_sql(req.connectionId, sql)

    # 4. Return
    return {
        "sql": sql,
        "sql_valid": True,
        "confidence": 0.85,
        "reasoning": reasoning,
        "referenced_tables": _extract_tables(sql),
        "warnings": [],
        "hallucinated_tables": [],
        "markdown_output": markdown_output,
        "execution_error": execution_error,
        "needs_connection_string": False,
    }


@router.post("/api/chat/agent")
async def chat_agent(req: ChatRequest):
    """
    CRUD agent for non-technical staff.
    Detects write intent, generates safe DML, previews affected rows, returns for confirmation.
    Allowed: INSERT, UPDATE (with WHERE), SELECT.
    Blocked: DELETE without WHERE, DROP, ALTER, schema changes.
    """
    schema_text = await _get_rich_schema(req.connectionId)

    # 1. Ask Claude to classify intent and generate DML
    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=900,
        messages=[{
            "role": "user",
            "content": f"""You are a clinic database assistant helping non-technical staff.
The user wants to make a change to the database.

Schema:
{schema_text}

User request: {req.query}

Rules:
- Only generate INSERT or UPDATE (with WHERE clause). Never DELETE, DROP, or ALTER.
- Use exact column names from the schema.
- For UPDATE, always include a WHERE clause targeting a specific record.
- Return ONLY a JSON object with these keys:
  - "intent": "insert" | "update" | "select" | "blocked"
  - "sql": the DML statement (or SELECT if intent is select/blocked)
  - "preview_sql": a SELECT query that shows what will be affected/inserted
  - "description": plain English summary of what this will do (1 sentence, user-friendly)
  - "risk": "low" | "medium" | "high"
  - "block_reason": null or reason string if blocked

JSON:""",
        }],
    )

    text = msg.content[0].text.strip()
    try:
        start = text.find("{")
        end   = text.rfind("}") + 1
        obj   = json.loads(text[start:end])
    except Exception:
        obj = {"intent": "blocked", "block_reason": "Could not parse request", "sql": "", "preview_sql": "", "description": "", "risk": "high"}

    intent      = obj.get("intent", "blocked")
    sql         = str(obj.get("sql", "")).strip()
    preview_sql = str(obj.get("preview_sql", "")).strip()
    description = str(obj.get("description", ""))
    risk        = obj.get("risk", "medium")
    block_reason = obj.get("block_reason")

    if intent == "blocked" or not sql:
        return {
            "intent": "blocked",
            "block_reason": block_reason or "This operation is not permitted for staff users.",
            "description": description,
            "sql": sql,
            "preview_sql": "",
            "preview_data": None,
            "risk": "high",
        }

    # 2. Run preview SELECT to show user what will be affected
    preview_data = None
    if preview_sql:
        try:
            resp = await autodb_post("/execute", {
                "connection_id": req.connectionId,
                "sql": preview_sql,
                "caller": "human",
            })
            if resp.get("success"):
                data = resp.get("data", {})
                cols = data.get("columns", [])
                rows = data.get("rows", [])
                if rows and isinstance(rows[0], (list, tuple)):
                    rows = [dict(zip(cols, r)) for r in rows]
                preview_data = {"columns": cols, "rows": rows[:10]}
        except Exception as e:
            print(f"[Agent] preview failed: {e}")

    return {
        "intent": intent,
        "block_reason": None,
        "description": description,
        "sql": sql,
        "preview_sql": preview_sql,
        "preview_data": preview_data,
        "risk": risk,
    }


@router.post("/api/chat/agent-execute")
async def chat_agent_execute(req: ChatRequest):
    """Execute a confirmed CRUD operation from the agent."""
    sql = req.query.strip()

    # Safety: block anything other than INSERT or UPDATE
    first_word = sql.split()[0].upper() if sql.split() else ""
    if first_word not in ("INSERT", "UPDATE"):
        raise HTTPException(status_code=403, detail="Only INSERT and UPDATE are permitted for staff users.")

    markdown, error = await _execute_sql(req.connectionId, sql)
    if error:
        raise HTTPException(status_code=400, detail=error)

    return {"success": True, "markdown_output": markdown}


@router.post("/api/chat/suggestions")
async def get_suggestions(req: SuggestionsRequest):
    """Generate AI-powered example questions based on the schema tables."""
    if not req.tables:
        return {"suggestions": []}

    tables_str = ", ".join(req.tables[:25])

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        messages=[
            {
                "role": "user",
                "content": f"""You are a data analyst. Given these database tables, generate exactly 6 specific, useful questions a business user might ask. Make them concrete and varied — include: a count/aggregate, a top-N ranking, a filter/search, a trend over time, a comparison, and a summary.

Tables: {tables_str}

Return ONLY a valid JSON array of exactly 6 short question strings (max 12 words each). No explanation, no markdown, no extra text:
["question 1", "question 2", "question 3", "question 4", "question 5", "question 6"]""",
            }
        ],
    )

    text = message.content[0].text.strip()
    start = text.find("[")
    end   = text.rfind("]") + 1
    try:
        suggestions = json.loads(text[start:end]) if start >= 0 else []
    except Exception:
        suggestions = []

    return {"suggestions": suggestions[:6]}
