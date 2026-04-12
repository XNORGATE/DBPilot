from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post, autodb_get
from lib.direct_db import store as db_store, retrieve as db_retrieve, has_string as db_has_string, execute_query as db_execute

router = APIRouter()


class SetupRequest(BaseModel):
    name: str
    db_type: str
    connection_string: str


class UseExistingRequest(BaseModel):
    connectionId: str
    name: str


class DirectStringRequest(BaseModel):
    connectionId: str
    connection_string: str


@router.get("/api/connection/list")
async def list_connections():
    """Fetch all connections already registered in AutoDB."""
    resp = await autodb_get("/connections")
    print(f"[AutoDB] /connections raw response: {resp}")
    if not resp.get("success"):
        raise HTTPException(status_code=400, detail=resp.get("error", "Failed to list connections"))
    data = resp.get("data")
    # AutoDB may return {"connections": [...]} or {"items": [...]} or a plain list
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("connections", "items", "results", "databases"):
            if isinstance(data.get(key), list):
                return data[key]
    # Return empty list if nothing matches so the UI shows the "no databases" message
    print(f"[AutoDB] Unexpected data shape: {type(data)} — {data}")
    return []


@router.post("/api/connection/setup")
async def setup_connection(req: SetupRequest):
    register = await autodb_post(
        "/connections",
        {
            "name": req.name,
            "db_type": req.db_type,
            "connection_string": req.connection_string,
        },
    )
    if not register.get("success"):
        raise HTTPException(status_code=400, detail=register.get("error", "Failed to register connection"))

    connection_id = register["data"]["id"]

    # Store the connection string locally for direct execution (bypassing AutoDB's broken AI endpoint)
    db_store(connection_id, req.connection_string)

    introspect = await autodb_post(f"/connections/{connection_id}/introspect", {})
    if not introspect.get("success"):
        raise HTTPException(status_code=400, detail=introspect.get("error", "Failed to introspect schema"))

    return {
        "connection": register["data"],
        "schema": introspect["data"],
        "has_direct_execution": True,
    }


@router.post("/api/connection/set-direct-string")
async def set_direct_string(req: DirectStringRequest):
    """
    Store a connection string for direct DB execution.
    Called when the user loaded a DB via AutoDB's list (we don't have the string yet),
    and they paste it to enable live query results.
    """
    # Validate it's at least a plausible PostgreSQL URL
    cs = req.connection_string.strip()
    if not (cs.startswith("postgresql://") or cs.startswith("postgres://")):
        raise HTTPException(status_code=400, detail="Must be a postgresql:// connection string")
    # Quick connectivity test
    try:
        result = await db_execute(cs, "SELECT 1 AS ok")
        if not result["rows"]:
            raise Exception("No response")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not connect: {e}")

    db_store(req.connectionId, cs)
    return {"ok": True, "has_direct_execution": True}


@router.get("/api/connection/has-direct/{connection_id}")
async def has_direct(connection_id: str):
    return {"has_direct_execution": db_has_string(connection_id)}


@router.post("/api/connection/use-existing")
async def use_existing_connection(req: UseExistingRequest):
    """Use a connection already registered in the AutoDB dashboard."""
    conn_resp = await autodb_get(f"/connections/{req.connectionId}")
    if not conn_resp.get("success"):
        raise HTTPException(status_code=400, detail=conn_resp.get("error", "Connection not found — check the ID"))

    connection = conn_resp["data"]

    introspect = await autodb_post(f"/connections/{req.connectionId}/introspect", {})
    if not introspect.get("success"):
        raise HTTPException(status_code=400, detail=introspect.get("error", "Failed to introspect schema"))

    return {
        "connection": {
            "id": req.connectionId,
            "name": req.name or connection.get("name", "My Database"),
            "db_type": connection.get("db_type", "postgresql"),
            "is_active": connection.get("is_active", True),
            "last_introspected_at": introspect["data"].get("introspected_at"),
        },
        "schema": introspect["data"],
    }
