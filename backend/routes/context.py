from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from lib.autodb import autodb_post, autodb_upload_file

router = APIRouter()


@router.post("/api/context/upload")
async def upload_document(
    connectionId: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a PDF or TXT file to AutoDB's RAG pipeline."""
    content = await file.read()
    result = await autodb_upload_file(
        f"/connections/{connectionId}/documents/upload",
        filename=file.filename or "upload",
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Upload failed"))
    return result["data"]


class ContextQueryRequest(BaseModel):
    connectionId: str
    query: str


@router.post("/api/context/query")
async def query_context(req: ContextQueryRequest):
    """Return the most relevant context chunks for a query (debug)."""
    result = await autodb_post(
        f"/connections/{req.connectionId}/context/query",
        {"query": req.query},
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Context query failed"))
    return result["data"]
