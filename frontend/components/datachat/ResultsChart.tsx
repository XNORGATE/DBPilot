"use client"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"

interface Props {
  markdownOutput: string
  referencedTables: string[]
}

function parseChartData(md: string): { name: string; value: number; label: string }[] {
  const lines = md.trim().split("\n").filter((l) => l.trim())
  if (lines.length < 3) return []

  const parseRow = (line: string) =>
    line.split("|").map((c) => c.trim()).filter((c, i, arr) => i !== 0 && i !== arr.length - 1)

  const isSeparator = (line: string) => /^\|?\s*[-:]+[\s|:|-]*$/.test(line)
  const headerIdx = lines.findIndex((_, i) => i + 1 < lines.length && isSeparator(lines[i + 1]))
  if (headerIdx === -1) return []

  const headers = parseRow(lines[headerIdx])
  const rows = lines.slice(headerIdx + 2).map(parseRow)

  // Find first numeric column (after col 0)
  const numericColIdx = headers.findIndex((_, i) => {
    if (i === 0) return false
    return rows.some((r) => !isNaN(parseFloat(r[i])))
  })

  if (numericColIdx === -1) return []

  return rows
    .map((row) => ({
      name: (row[0] ?? "").slice(0, 20),
      value: parseFloat(row[numericColIdx]) || 0,
      label: headers[numericColIdx],
    }))
    .filter((d) => d.value !== 0)
    .slice(0, 15)
}

interface TooltipProps { active?: boolean; payload?: { name: string; value: number }[]; label?: string }
const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "0.5px solid var(--border-default)",
        borderRadius: 7,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ color: "var(--text-primary)", fontWeight: 600 }}>{label}</p>
      <p style={{ color: "var(--accent)", marginTop: 2 }}>
        {payload[0].name}: {payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}

export default function ResultsChart({ markdownOutput, referencedTables }: Props) {
  const data = parseChartData(markdownOutput)
  if (data.length === 0) return null

  const yLabel = data[0]?.label ?? "value"

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p className="section-label" style={{ margin: 0 }}>Chart</p>
        {referencedTables.length > 0 && (
          <span className="badge badge-accent">
            {referencedTables.join(", ")}
          </span>
        )}
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
              axisLine={false}
              tickLine={false}
              label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--text-tertiary)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={`var(--accent)`} opacity={0.85 - i * 0.025} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
