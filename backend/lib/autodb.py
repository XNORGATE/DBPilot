import httpx
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("AUTODB_BASE_URL", "https://api.autodb.app/api/v1")
API_KEY = os.getenv("AUTODB_API_KEY")

HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY or "",
}

AUTODB_ERRORS = {
    "SCHEMA_VALIDATION_FAILED": "SQL references tables not in your schema.",
    "SQL_GENERATION_FAILED": "Could not generate valid SQL for that question.",
    "EXECUTION_FAILED": "SQL passed validation but failed on your database.",
}


async def autodb_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(f"{BASE_URL}{path}", json=body, headers=HEADERS)
        if not res.is_success:
            print(f"[AutoDB] POST {path} → {res.status_code}: {res.text}")
            res.raise_for_status()
        return res.json()


async def autodb_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.get(f"{BASE_URL}{path}", headers=HEADERS)
        if not res.is_success:
            print(f"[AutoDB] GET {path} → {res.status_code}: {res.text}")
            res.raise_for_status()
        return res.json()


async def autodb_upload_file(path: str, filename: str, content: bytes, content_type: str) -> dict:
    """Upload a file (PDF/TXT) to AutoDB."""
    upload_headers = {"X-API-Key": API_KEY or ""}
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{BASE_URL}{path}",
            headers=upload_headers,
            files={"file": (filename, content, content_type)},
        )
        res.raise_for_status()
        return res.json()
