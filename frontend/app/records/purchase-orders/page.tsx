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

type PurchaseOrderRow = {
  id: number
  supplier_name: string
  sku: string
  created_at: string
}

function formatCreatedAt(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return iso
  }
  return parsed.toLocaleString()
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-orders`, { cache: "no-store" })
      const payload = (await response.json()) as PurchaseOrderRow[]

      if (!response.ok) {
        throw new Error("Unable to load purchase orders from backend.")
      }

      setOrders(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error while loading purchase orders."
      setError(message)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return orders
    }

    return orders.filter((row) =>
      [
        String(row.id),
        row.supplier_name,
        row.sku,
        row.created_at,
      ].some((value) => value.toLowerCase().includes(normalized))
    )
  }, [orders, query])

  return (
    <main className="space-y-6 p-6 md:p-8">
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Purchase Orders</h1>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          {filteredOrders.length} shown of {orders.length} orders
        </p>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ID, supplier, SKU, or date…"
            className="sm:max-w-md"
          />
          <Button onClick={() => void loadOrders()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[12%] text-center">ID</TableHead>
                <TableHead className="w-[28%] text-left">Supplier</TableHead>
                <TableHead className="w-[28%] text-left">SKU</TableHead>
                <TableHead className="w-[32%] text-left">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {!loading && filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {orders.length === 0
                      ? "No purchase orders yet. Approve a recommendation from the Agents page."
                      : "No orders match the current search."}
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? filteredOrders.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {row.id}
                      </TableCell>
                      <TableCell className="break-words font-medium">{row.supplier_name}</TableCell>
                      <TableCell className="break-all">{row.sku}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCreatedAt(row.created_at)}
                      </TableCell>
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
