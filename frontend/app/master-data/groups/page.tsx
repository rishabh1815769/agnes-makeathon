"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

type GroupRow = {
  SKU: string
  HasBOM: boolean
  BOMComponentCount: number
  SupplierProductCount: number
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/groups`, { cache: "no-store" })
      const payload = (await response.json()) as GroupRow[]

      if (!response.ok) {
        throw new Error("Unable to load groups from backend.")
      }

      setGroups(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unexpected error while loading groups."
      setError(message)
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGroups()
  }, [loadGroups])

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return groups
    }

    return groups.filter((row) =>
      [
        row.SKU,
        row.HasBOM ? "yes" : "no",
        String(row.BOMComponentCount),
        String(row.SupplierProductCount),
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    )
  }, [groups, query])

  const totalRows = groups.length
  const withBOMCount = groups.filter((row) => row.HasBOM).length
  const totalBOMComponents = groups.reduce((acc, row) => acc + row.BOMComponentCount, 0)
  const totalSupplierLinks = groups.reduce((acc, row) => acc + row.SupplierProductCount, 0)

  return (
    <main className="space-y-6 p-6 md:p-8">
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Groups</h1>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          {filteredGroups.length} shown of {totalRows} records
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
          <p className="mt-2 text-2xl font-semibold">{totalRows}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Has BOM</p>
          <p className="mt-2 text-2xl font-semibold">{withBOMCount}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">BOM Components</p>
          <p className="mt-2 text-2xl font-semibold">{totalBOMComponents}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier Product Links</p>
          <p className="mt-2 text-2xl font-semibold">{totalSupplierLinks}</p>
        </article>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, BOM status, or counts..."
            className="sm:max-w-md"
          />
          <Button onClick={() => void loadGroups()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4 text-center">Product SKU</TableHead>
                <TableHead className="w-1/4 text-center">Has BOM</TableHead>
                <TableHead className="w-1/4 text-center">BOM Component Count</TableHead>
                <TableHead className="w-1/4 text-center">Supplier Product Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`groups-skeleton-${index}`}>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-40" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-12" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-10" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-10" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {!loading && filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No groups match the current search.
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? filteredGroups.map((row) => (
                    <TableRow key={row.SKU}>
                      <TableCell className="text-center font-medium">{row.SKU}</TableCell>
                      <TableCell className="text-center">{row.HasBOM ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-center">{row.BOMComponentCount}</TableCell>
                      <TableCell className="text-center">{row.SupplierProductCount}</TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  )
}
