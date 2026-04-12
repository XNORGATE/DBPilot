"""
Direct PostgreSQL execution using asyncpg.
Bypasses AutoDB's broken /queries/generate endpoint entirely.
AutoDB is still used for: connection management, schema introspection, migration analysis.
"""

import asyncpg
from typing import Any

# In-memory session store: connectionId -> connection_string
# This is fine for a local/dev tool. In production, encrypt + persist.
_conn_strings: dict[str, str] = {}


def store(connection_id: str, connection_string: str) -> None:
    """Save a connection string for the session."""
    _conn_strings[connection_id] = connection_string.strip()


def retrieve(connection_id: str) -> str | None:
    """Get stored connection string for a connectionId."""
    return _conn_strings.get(connection_id)


def has_string(connection_id: str) -> bool:
    return connection_id in _conn_strings


async def execute_query(connection_string: str, sql: str) -> dict[str, Any]:
    """
    Execute a read-only SQL query directly via asyncpg.
    Returns {"columns": [...], "rows": [...], "row_count": int}.
    Raises on connection error or SQL error.
    """
    # asyncpg accepts postgresql:// and postgres:// URLs
    conn = await asyncpg.connect(dsn=connection_string, timeout=20)
    try:
        # Enforce read-only with a transaction
        async with conn.transaction(readonly=True):
            records = await conn.fetch(sql)
    finally:
        await conn.close()

    if not records:
        return {"columns": [], "rows": [], "row_count": 0}

    columns = list(records[0].keys())
    rows = []
    for rec in records:
        row = {}
        for col in columns:
            val = rec[col]
            # Make all values JSON-serializable
            row[col] = str(val) if val is not None and not isinstance(val, (int, float, bool, str)) else val
        rows.append(row)

    return {"columns": columns, "rows": rows, "row_count": len(rows)}
