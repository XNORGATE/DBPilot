import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_get, autodb_post
from lib.llm import generate_migration_sql, format_schema_for_prompt

router = APIRouter()


class CopilotRequest(BaseModel):
    connectionId: str
    description: str


@router.post("/api/copilot/generate")
async def copilot_generate(req: CopilotRequest):
    # Step 1: Fetch schema — try /schema first, fall back to /introspect
    schema_data = {}
    try:
        schema_resp = await autodb_get(f"/connections/{req.connectionId}/schema")
        if schema_resp.get("success") and schema_resp.get("data"):
            schema_data = schema_resp["data"]
            print(f"[Copilot] Schema from /schema — keys: {list(schema_data.keys()) if isinstance(schema_data, dict) else type(schema_data).__name__}")
    except Exception as e:
        print(f"[Copilot] /schema failed: {e}")

    if not schema_data:
        try:
            intro_resp = await autodb_post(f"/connections/{req.connectionId}/introspect", {})
            if intro_resp.get("success") and intro_resp.get("data"):
                schema_data = intro_resp["data"]
                print(f"[Copilot] Schema from /introspect fallback")
        except Exception as e:
            print(f"[Copilot] /introspect also failed: {e}")

    schema_text = format_schema_for_prompt(schema_data)
    print(f"[Copilot] Schema for Claude:\n{schema_text}")

    if schema_text == "(schema not available)":
        raise HTTPException(
            status_code=400,
            detail="Could not fetch schema for this connection. Try syncing the schema in AutoDB first.",
        )

    # Step 2: Call Claude to generate migration SQL
    try:
        generated_sql = generate_migration_sql(schema_text, req.description)
        print(f"[Copilot] Generated SQL:\n{generated_sql}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM generation failed: {str(e)}")

    # Step 3: Auto-analyze the generated SQL with AutoDB
    try:
        analysis_resp = await autodb_post(
            f"/connections/{req.connectionId}/migrations/analyze",
            {"sql": generated_sql},
        )
    except httpx.HTTPStatusError as e:
        body = {}
        try:
            body = e.response.json()
        except Exception:
            pass
        err_msg = (
            body.get("error", {}).get("message", str(e))
            if isinstance(body.get("error"), dict)
            else str(body.get("error", str(e)))
        )
        raise HTTPException(status_code=400, detail=f"Migration analysis failed: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration analysis error: {str(e)}")

    if not analysis_resp.get("success"):
        err = analysis_resp.get("error", {})
        msg = err.get("message", "Migration analysis failed") if isinstance(err, dict) else str(err)
        raise HTTPException(status_code=400, detail=msg)

    return {
        "generatedSql": generated_sql,
        "analysis": analysis_resp["data"],
    }
