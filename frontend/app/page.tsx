"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

type EntityRow = {
  Id: number
}

type GroupRow = {
  SKU: string
  HasBOM: boolean
}

type Snapshot = {
  totalProducts: number
  totalSuppliers: number
  totalCompanies: number
  bomCoverage: number
  refreshedAt: string
}

function SnapshotCard(props: { title: string; value: string | number; note?: string }) {
  const { title, value, note } = props

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl font-semibold tracking-tight">{value}</CardTitle>
        {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      </CardContent>
    </Card>
  )
}

export default function Page() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [productsResponse, suppliersResponse, companiesResponse, groupsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/products`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/suppliers`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/companies`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/api/groups`, { cache: "no-store" }),
      ])

      if (!productsResponse.ok) {
        throw new Error("Unable to load products.")
      }
      if (!suppliersResponse.ok) {
        throw new Error("Unable to load suppliers.")
      }
      if (!companiesResponse.ok) {
        throw new Error("Unable to load companies.")
      }
      if (!groupsResponse.ok) {
        throw new Error("Unable to load groups for BOM coverage.")
      }

      const products = (await productsResponse.json()) as EntityRow[]
      const suppliers = (await suppliersResponse.json()) as EntityRow[]
      const companies = (await companiesResponse.json()) as EntityRow[]
      const groups = (await groupsResponse.json()) as GroupRow[]

      const productsWithBOM = groups.filter((row) => row.HasBOM).length
      const bomCoverage = groups.length > 0 ? Math.round((productsWithBOM / groups.length) * 100) : 0

      setSnapshot({
        totalProducts: products.length,
        totalSuppliers: suppliers.length,
        totalCompanies: companies.length,
        bomCoverage,
        refreshedAt: new Date().toLocaleString(),
      })
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unexpected error while loading home KPIs."
      setError(message)
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSnapshot()
  }, [loadSnapshot])

  const subtitle = useMemo(() => {
    if (!snapshot) return "Live KPI snapshot"
    return `Live KPI snapshot · Refreshed ${snapshot.refreshedAt}`
  }, [snapshot])

  return (
    <main className="space-y-6 p-6 md:p-8">
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Home</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button onClick={() => void loadSnapshot()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </section>

      {error ? (
        <section className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !snapshot ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`snapshot-skeleton-${index}`}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <SnapshotCard title="Total Products" value={snapshot.totalProducts} />
            <SnapshotCard title="Total Suppliers" value={snapshot.totalSuppliers} />
            <SnapshotCard title="Total Companies" value={snapshot.totalCompanies} />
            <SnapshotCard
              title="BOM Coverage"
              value={`${snapshot.bomCoverage}%`}
              note="Products with BOM / total products"
            />
          </>
        )}
      </section>
    </main>
  )
}
