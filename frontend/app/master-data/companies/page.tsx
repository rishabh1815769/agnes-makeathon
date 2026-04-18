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

type CompanyRow = {
  Id: number
  Name: string
  ProductCount: number
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/companies`, { cache: "no-store" })
      const payload = (await response.json()) as CompanyRow[]

      if (!response.ok) {
        throw new Error("Unable to load companies from backend.")
      }

      setCompanies(Array.isArray(payload) ? payload : [])
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error while loading companies."
      setError(message)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCompanies()
  }, [loadCompanies])

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return companies
    }

    return companies.filter((company) =>
      [
        String(company.Id),
        company.Name,
        String(company.ProductCount),
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    )
  }, [companies, query])

  const totalCompanies = companies.length
  const totalProducts = companies.reduce((acc, row) => acc + row.ProductCount, 0)
  const filteredCount = filteredCompanies.length

  return (
    <main className="space-y-6 p-6 md:p-8">
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Companies</h1>
        <p className="mt-2 text-sm text-muted-foreground">
        </p>
        <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
          {filteredCount} shown of {totalCompanies} companies
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Companies</p>
          <p className="mt-2 text-2xl font-semibold">{totalCompanies}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Products</p>
          <p className="mt-2 text-2xl font-semibold">{totalProducts}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Companies</p>
          <p className="mt-2 text-2xl font-semibold">{filteredCount}</p>
        </article>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company or product count..."
            className="sm:max-w-md"
          />
          <Button onClick={() => void loadCompanies()} disabled={loading}>
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
                <TableHead className="w-1/3 text-center">Company ID</TableHead>
                <TableHead className="w-1/3 text-center">Company Name</TableHead>
                <TableHead className="w-1/3 text-center">Products</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`companies-skeleton-${index}`}>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-10" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="mx-auto h-4 w-10" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {!loading && filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No companies match the current search.
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? filteredCompanies.map((row) => (
                    <TableRow key={row.Id}>
                      <TableCell className="text-center text-xs text-muted-foreground">{row.Id}</TableCell>
                      <TableCell className="text-center font-medium">{row.Name}</TableCell>
                      <TableCell className="text-center">{row.ProductCount}</TableCell>
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
