import { NextResponse } from 'next/server'
import { transactions } from '@/lib/seed-data'

// Without this, Next.js treats a GET-only route handler as static and serves
// the log as it was at build time, so new transactions never appear.
export const dynamic = 'force-dynamic'

// GET /api/transactions — returns the transaction log.
// New transactions are appended here as a side effect of POST /api/items
// (stock in/out and transfers both log through lib/seed-data.ts), so this
// route only needs to read the current in-memory list.
export async function GET() {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  return NextResponse.json({ transactions: sorted })
}
