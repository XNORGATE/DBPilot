interface Props {
  markdownOutput: string
}

function parseMarkdownTable(md: string): { headers: string[]; rows: string[][] } | null {
  const lines = md.trim().split("\n").filter((l) => l.trim())
  if (lines.length < 3) return null

  const parseRow = (line: string) =>
    line.split("|").map((c) => c.trim()).filter((c, i, arr) => i !== 0 && i !== arr.length - 1)

  const isSeparator = (line: string) => /^\|?\s*[-:]+[\s|:|-]*$/.test(line)
  const headerIdx = lines.findIndex((_, i) => i + 1 < lines.length && isSeparator(lines[i + 1]))
  if (headerIdx === -1) return null

  const headers = parseRow(lines[headerIdx])
  const rows = lines.slice(headerIdx + 2).map(parseRow)
  return { headers, rows }
}

export default function ResultsTable({ markdownOutput }: Props) {
  const parsed = parseMarkdownTable(markdownOutput)
  if (!parsed) return null

  const { headers, rows } = parsed

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        <thead>
          <tr style={{ background: "var(--bg-surface)" }}>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  border: "0.5px solid var(--border-subtle)",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontSize: 11,
                  letterSpacing: "0.03em",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ background: ri % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: "0.5px solid var(--border-subtle)",
                    padding: "7px 12px",
                    color: "var(--text-secondary)",
                    fontFamily: ci > 0 ? "monospace" : "inherit",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
        {rows.length} row{rows.length !== 1 ? "s" : ""} returned
      </p>
    </div>
  )
}
