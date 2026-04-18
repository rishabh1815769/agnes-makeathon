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

type ProductRow = {
  Id: number
  SKU: string
  CompanyId: number | null
  CompanyName: string | null
  Type: string | null
  material_name: string | null
  SupplierCount: number
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, { cache: "no-store" })
      const payload = (await response.json()) as ProductRow[]

      if (!response.ok) {
        throw new Error("Unable to load products from backend.")
      }

      setProducts(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error while loading products."
      setError(message)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts()
  }, [loadProducts])

  const productTypes = useMemo(() => {
    const values = new Set<string>()
    for (const product of products) {
      if (product.Type && product.Type.trim()) {
        values.add(product.Type)
      }
    }
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const matchesType = typeFilter === "all" || (product.Type ?? "") === typeFilter
      if (!matchesType) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return [
        String(product.Id),
        product.SKU,
        String(product.CompanyId ?? ""),
        product.CompanyName ?? "",
        product.Type ?? "",
        product.material_name ?? "",
        String(product.SupplierCount),
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [products, query, typeFilter])

  const totalProducts = products.length
  const totalSuppliersLinked = products.reduce((acc, row) => acc + row.SupplierCount, 0)
  const materialsTracked = products.filter((row) => Boolean(row.material_name)).length
  const filteredCount = filteredProducts.length

  return (
    <main className="space-y-6 p-6 md:p-8">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6 shadow-sm">
        <div className="absolute -top-10 right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Products</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Unified product master data from FastAPI, including company attribution, material metadata,
          and supplier coverage.
        </p>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          {filteredCount} shown of {totalProducts} products
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Products</p>
          <p className="mt-2 text-2xl font-semibold">{totalProducts}</p>
        </article>
        <article className="rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier Links</p>
          <p className="mt-2 text-2xl font-semibold">{totalSuppliersLinked}</p>
        </article>
        <article className="rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Materials Tracked</p>
          <p className="mt-2 text-2xl font-semibold">{materialsTracked}</p>
        </article>
      </section>

      <section className="space-y-4 rounded-2xl border bg-gradient-to-b from-card to-card/70 p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by SKU, company, type, material..."
              className="sm:max-w-md"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {productTypes.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All Types" : value}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void loadProducts()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
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
                <TableHead className="w-[14%] text-center">Product ID</TableHead>
                <TableHead className="w-[22%] text-left">Product SKU</TableHead>
                <TableHead className="w-[16%] text-center">Company Name</TableHead>
                <TableHead className="w-[16%] text-center">Product Type</TableHead>
                <TableHead className="w-[16%] text-center">Material Name</TableHead>
                <TableHead className="w-[16%] text-center">Supplier Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-36" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-24" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-56" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="mx-auto h-4 w-10" /></TableCell>
                    </TableRow>
                  ))
                : null}

              {!loading && filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No products match the current filters.
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? filteredProducts.map((row) => (
                    <TableRow key={row.Id}>
                      <TableCell className="align-top text-center text-xs text-muted-foreground">{row.Id}</TableCell>
                      <TableCell className="align-top text-left font-medium break-all">{row.SKU}</TableCell>
                      <TableCell className="align-top text-center break-words">
                        {row.CompanyName || `Company ${row.CompanyId ?? "-"}`}
                      </TableCell>
                      <TableCell className="align-top text-center break-words">{row.Type || "-"}</TableCell>
                      <TableCell className="align-top text-center break-words">{row.material_name || "-"}</TableCell>
                      <TableCell className="align-top text-center font-semibold">{row.SupplierCount}</TableCell>
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
