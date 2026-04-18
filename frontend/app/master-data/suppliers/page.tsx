<<<<<<< HEAD
export default function SuppliersPage() {
  return (
    <main className="space-y-4 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
      <p className="text-sm text-muted-foreground">
        Suppliers tab is available and will be expanded with advanced views next.
      </p>
    </main>
  )
}
=======
"use client"

import { useEffect, useMemo, useState } from "react"

type SupplierRow = Record<string, string | number | null>

type SupplierResponse = {
  tableName: string
  columns: string[]
  rows: SupplierRow[]
  rowCount: number
  dbPath: string
}

export default function SuppliersPage() {
  const [data, setData] = useState<SupplierResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSuppliers() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/master-data/suppliers", {
          cache: "no-store",
        })

        const payload = (await response.json()) as SupplierResponse | { error: string }

        if (!response.ok) {
          throw new Error("error" in payload ? payload.error : "Failed to load suppliers.")
        }

        if (isMounted) {
          setData(payload as SupplierResponse)
        }
      } catch (loadError) {
        if (!isMounted) return
        setError(loadError instanceof Error ? loadError.message : "Failed to load suppliers.")
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      isMounted = false
    }
  }, [])

  const hasRows = (data?.rows.length ?? 0) > 0
  const rowCountLabel = useMemo(() => {
    const count = data?.rowCount ?? 0
    return `${count} supplier${count === 1 ? "" : "s"}`
  }, [data?.rowCount])

  return (
    <main className="min-h-svh bg-background px-4 py-6 md:px-8">
      <section className="mx-auto w-full max-w-7xl rounded-xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-5 py-4 md:px-6">
          <h1 className="text-xl font-semibold text-card-foreground md:text-2xl">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Loading suppliers..." : rowCountLabel}
          </p>
        </header>

        {error ? (
          <div className="px-5 py-6 text-sm text-destructive md:px-6">{error}</div>
        ) : null}

        {!error && isLoading ? (
          <div className="px-5 py-6 text-sm text-muted-foreground md:px-6">Fetching data from SQLite...</div>
        ) : null}

        {!error && !isLoading && !hasRows ? (
          <div className="px-5 py-6 text-sm text-muted-foreground md:px-6">No supplier records found.</div>
        ) : null}

        {!error && !isLoading && hasRows ? (
          <div className="w-full overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {data?.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="sticky top-0 border-b border-border bg-muted px-4 py-3 text-left font-medium text-muted-foreground"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((row, index) => (
                  <tr key={`${index}-${String(row[data.columns[0]] ?? "row")}`} className="odd:bg-background even:bg-muted/20">
                    {data.columns.map((column) => (
                      <td key={`${index}-${column}`} className="border-b border-border px-4 py-2 align-top text-card-foreground">
                        {row[column] === null || row[column] === "" ? "-" : String(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!error && !isLoading && data ? (
          <footer className="border-t border-border px-5 py-3 text-xs text-muted-foreground md:px-6">
            Source table: {data.tableName}
          </footer>
        ) : null}
      </section>
    </main>
  )
}
>>>>>>> 9a2b73c (render suppliers table in /master-data/suppliers)
