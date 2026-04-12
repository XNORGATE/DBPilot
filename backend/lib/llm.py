import re
import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def format_schema_for_prompt(schema_data: dict | list) -> str:
    """Format AutoDB schema response into a readable string for Claude.
    Handles multiple response shapes from /schema and /introspect endpoints."""
    if isinstance(schema_data, list):
        tables = schema_data
    elif isinstance(schema_data, dict):
        tables = (
            schema_data.get("tables")
            or schema_data.get("schema")
            or schema_data.get("data")
            or []
        )
    else:
        return "(schema not available)"

    lines = []
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


def _extract_sql(text: str) -> str:
    """
    Strip any prose/explanation from Claude's response, returning only SQL.
    Handles:
    - markdown fences (```sql ... ```)
    - lines of prose before the first SQL keyword
    """
    # Strip markdown code fences
    fenced = re.search(r"```(?:sql)?\s*([\s\S]+?)```", text, re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    # Find the first line that starts with a SQL keyword
    sql_keywords = re.compile(
        r"^\s*(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|SELECT|DO|WITH)\b",
        re.IGNORECASE,
    )
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if sql_keywords.match(line):
            return "\n".join(lines[i:]).strip()

    # Fallback: return as-is (let AutoDB reject with a clear error)
    return text.strip()


def generate_migration_sql(schema_text: str, description: str) -> str:
    """Call Claude to generate migration SQL from a plain-English description."""
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""You are a PostgreSQL expert. Generate migration SQL for the following request.

Schema context:
{schema_text}

Request: {description}

Rules:
- Use ALTER TABLE, not DROP/RECREATE
- Add DEFAULT values where appropriate
- Make it reversible
- Output MUST start directly with a SQL keyword (ALTER, CREATE, etc.)
- Do NOT include any explanation, comments, or prose — SQL statements only

SQL:""",
            },
        ],
    )
    return _extract_sql(message.content[0].text.strip())
