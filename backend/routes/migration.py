import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post
from lib.llm import client as llm_client

router = APIRouter()


class AnalyzeRequest(BaseModel):
    connectionId: str
    sql: str


class ExecuteRequest(BaseModel):
    connectionId: str
    sql: str
    approvalToken: str


@router.post("/api/migration/analyze")
async def analyze(req: AnalyzeRequest):
    result = await autodb_post(
        f"/connections/{req.connectionId}/migrations/analyze",
        {"sql": req.sql},
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Migration analysis failed"))
    return result["data"]


class FixSqlRequest(BaseModel):
    connectionId: str
    sql: str


@router.post("/api/migration/fix-sql")
async def fix_sql(req: FixSqlRequest):
    """
    Use Claude to check uploaded SQL against the real schema and fix any
    mismatched table names, column names, or missing columns.
    """
    # Get real schema via information_schema
    col_sql = """
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast',
    'storage','pgsodium','graphql_public','vault','realtime',
    'graphql','extensions','auth','public')
ORDER BY table_name, ordinal_position
"""
    schema_text = "(schema not available)"
    try:
        resp = await autodb_post("/execute", {
            "connection_id": req.connectionId,
            "sql": col_sql,
            "caller": "human",
        })
        if resp.get("success"):
            data = resp.get("data", {})
            col_names = data.get("columns", [])
            raw_rows = data.get("rows", [])
            if raw_rows and isinstance(raw_rows[0], (list, tuple)):
                rows = [dict(zip(col_names, r)) for r in raw_rows]
            else:
                rows = raw_rows
            tables: dict[str, list[str]] = {}
            for row in rows:
                t = row.get("table_name", "")
                c = row.get("column_name", "")
                dt = row.get("data_type", "")
                tables.setdefault(t, []).append(f"{c} ({dt})")
            if tables:
                schema_text = "\n".join(
                    f"Table {t}: {', '.join(cols)}" for t, cols in tables.items()
                )
    except Exception as e:
        print(f"[fix-sql] schema fetch failed: {e}")

    msg = llm_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": f"""You are a PostgreSQL migration expert. A user uploaded a SQL migration file.
Check it against the real database schema and fix any issues.

Real schema (source of truth):
{schema_text}

Uploaded SQL:
{req.sql}

Fix any:
- Wrong table names (use exact names from schema)
- Wrong column names (use exact names from schema)
- Missing columns that are NOT NULL (add reasonable defaults)
- Syntax errors

Return ONLY a JSON object with two keys:
- "fixedSql": the corrected SQL (same intent, correct names)
- "changes": array of short strings describing what was changed (empty if nothing needed fixing)

JSON:""",
        }],
    )

    text = msg.content[0].text.strip()
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        obj = json.loads(text[start:end])
        return {
            "fixedSql": str(obj.get("fixedSql", req.sql)).strip(),
            "changes": obj.get("changes", []),
        }
    except Exception:
        return {"fixedSql": req.sql, "changes": []}


@router.post("/api/migration/execute")
async def execute(req: ExecuteRequest):
    result = await autodb_post(
        "/migrations/execute",
        {
            "connection_id": req.connectionId,
            "sql": req.sql,
            "approval_token": req.approvalToken,
        },
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Migration execution failed"))
    return result["data"]
