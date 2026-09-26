import type { Metadata } from 'next'
import SheetHead from '@/components/SheetHead'
import TransactionTable from '@/components/TransactionTable'
import { sectionById } from '@/components/sections'
import { transactions } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: sectionById('history').floor }

export default function HistoryPage() {
  return (
    <>
      <SheetHead
        title="Transaction History"
        sub="A record of every stock movement across warehouses."
      />
      <TransactionTable transactions={transactions} />
    </>
  )
}
