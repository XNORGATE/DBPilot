export interface Connection {
  id: string
  name: string
  db_type: string
  is_active: boolean
  last_introspected_at: string | null
}

export interface SchemaInfo {
  table_count: number
  tables: string[]
  snapshot_id: string
  introspected_at: string
}

export interface ChatResult {
  sql: string
  confidence: number
  reasoning: string
  referenced_tables: string[]
  warnings: string[]
  sql_valid: boolean
  hallucinated_tables: string[]
  markdown_output: string
  execution_error: string | null
  needs_connection_string?: boolean
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

export interface AgentResult {
  intent: "insert" | "update" | "select" | "blocked"
  block_reason: string | null
  description: string
  sql: string
  preview_sql: string
  preview_data: {
    columns: string[]
    rows: Record<string, unknown>[]
  } | null
  risk: "low" | "medium" | "high"
}

export type ActivityKind = "query" | "migration" | "copilot" | "crud"

export interface ActivityItem {
  id: number
  kind: ActivityKind
  label: string        // short human-readable description
  detail?: string      // SQL or query text
  risk?: string        // for copilot/migration
  success: boolean
  ts: string           // locale time string
}
