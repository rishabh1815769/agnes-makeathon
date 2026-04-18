import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SupplierRow = Record<string, string | number | null>

type SupplierPayload = {
  tableName: string
  columns: string[]
  rows: SupplierRow[]
  rowCount: number
  dbPath: string
}

const DB_CANDIDATES = [
  path.resolve(process.cwd(), "..", "backend", "db.sqlite"),
  path.resolve(process.cwd(), "..", "backend", "database", "db.sqlite"),
  path.resolve(process.cwd(), "backend", "db.sqlite"),
  path.resolve(process.cwd(), "backend", "database", "db.sqlite"),
]

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

function resolveExistingDbPaths(): string[] {
  return DB_CANDIDATES.filter((candidate) => fs.existsSync(candidate))
}

function findSupplierTable(db: Database.Database): string | null {
  const exact = db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND lower(name) = lower(?)
       LIMIT 1`
    )
    .get("Supplier") as { name: string } | undefined

  if (exact?.name) {
    return exact.name
  }

  const fuzzy = db
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND lower(name) LIKE '%supplier%'
       ORDER BY name
       LIMIT 1`
    )
    .get() as { name: string } | undefined

  return fuzzy?.name ?? null
}

function readSupplierData(dbPath: string): SupplierPayload {
  const db = new Database(dbPath, { readonly: true })

  try {
    const tableName = findSupplierTable(db)
    if (!tableName) {
      throw new Error("No supplier table found in SQLite database.")
    }

    const tableNameQuoted = quoteIdentifier(tableName)
    const columns = db
      .prepare(`PRAGMA table_info(${tableNameQuoted})`)
      .all() as Array<{ name: string }>

    const columnNames = columns.map((column) => column.name)

    if (columnNames.length === 0) {
      throw new Error(`Table ${tableName} has no readable columns.`)
    }

    const idColumn = columnNames.find((column) => column.toLowerCase() === "id")
    const orderByColumn = idColumn ?? columnNames[0]

    const rows = db
      .prepare(
        `SELECT *
         FROM ${tableNameQuoted}
         ORDER BY ${quoteIdentifier(orderByColumn)}
         LIMIT 1000`
      )
      .all() as SupplierRow[]

    return {
      tableName,
      columns: columnNames,
      rows,
      rowCount: rows.length,
      dbPath,
    }
  } finally {
    db.close()
  }
}

export async function GET() {
  const dbPaths = resolveExistingDbPaths()

  if (dbPaths.length === 0) {
    return NextResponse.json(
      {
        error: "SQLite database was not found in expected backend paths.",
      },
      { status: 404 }
    )
  }

  const failures: string[] = []

  for (const dbPath of dbPaths) {
    try {
      const payload = readSupplierData(dbPath)
      return NextResponse.json(payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown supplier data error."
      failures.push(`${dbPath}: ${message}`)
    }
  }

  return NextResponse.json(
    {
      error: "No supplier table found in any detected SQLite database.",
      details: failures,
    },
    { status: 500 }
  )
}
