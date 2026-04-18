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

type SupplierRow = {
	Id: number
	Name: string
	ProductCount: number
}

export default function SuppliersPage() {
	const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
	const [query, setQuery] = useState("")
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadSuppliers = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const response = await fetch(`${API_BASE_URL}/api/suppliers`, { cache: "no-store" })
			const payload = (await response.json()) as SupplierRow[]

			if (!response.ok) {
				throw new Error("Unable to load suppliers from backend.")
			}

			setSuppliers(Array.isArray(payload) ? payload : [])
		} catch (loadError) {
			const message =
				loadError instanceof Error
					? loadError.message
					: "Unexpected error while loading suppliers."
			setError(message)
			setSuppliers([])
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void loadSuppliers()
	}, [loadSuppliers])

	const filteredSuppliers = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		if (!normalizedQuery) {
			return suppliers
		}

		return suppliers.filter((supplier) =>
			[String(supplier.Id), supplier.Name, String(supplier.ProductCount)].some((value) =>
				value.toLowerCase().includes(normalizedQuery)
			)
		)
	}, [suppliers, query])

	const totalSuppliers = suppliers.length
	const totalLinkedProducts = suppliers.reduce((acc, supplier) => acc + supplier.ProductCount, 0)
	const filteredCount = filteredSuppliers.length

	return (
		<main className="space-y-6 p-6 md:p-8">
			<section className="rounded-lg border bg-card p-6 text-card-foreground">
				<h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Suppliers</h1>
				<p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
					{filteredCount} shown of {totalSuppliers} suppliers
				</p>
			</section>

			<section className="grid gap-3 sm:grid-cols-3">
				<article className="rounded-lg border bg-card p-4 text-card-foreground">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Total Suppliers</p>
					<p className="mt-2 text-2xl font-semibold">{totalSuppliers}</p>
				</article>
				<article className="rounded-lg border bg-card p-4 text-card-foreground">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Products</p>
					<p className="mt-2 text-2xl font-semibold">{totalLinkedProducts}</p>
				</article>
				<article className="rounded-lg border bg-card p-4 text-card-foreground">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">Visible Suppliers</p>
					<p className="mt-2 text-2xl font-semibold">{filteredCount}</p>
				</article>
			</section>

			<section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground md:p-5">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search supplier name or product count..."
						className="sm:max-w-md"
					/>
					<Button onClick={() => void loadSuppliers()} disabled={loading}>
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
								<TableHead className="w-1/3 text-center">Supplier ID</TableHead>
								<TableHead className="w-1/3 text-center">Supplier Name</TableHead>
								<TableHead className="w-1/3 text-center">Products</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading
								? Array.from({ length: 8 }).map((_, index) => (
										<TableRow key={`suppliers-skeleton-${index}`}>
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

							{!loading && filteredSuppliers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
										No suppliers match the current search.
									</TableCell>
								</TableRow>
							) : null}

							{!loading
								? filteredSuppliers.map((row) => (
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
