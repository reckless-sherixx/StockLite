import type { Metadata } from 'next'
import SheetHead from '@/components/SheetHead'
import ExtrasWorkspace from '@/components/extras/ExtrasWorkspace'
import { parseExtrasTab } from '@/components/extras/tabs'
import { sectionById } from '@/components/sections'
import { getCurrentUser } from '@/lib/auth'
import { products, transactions, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: sectionById('extras').floor }

export default function ExtrasPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  return (
    <>
      <SheetHead
        title="Extra features"
        sub="Cross-warehouse summaries, rebalancing suggestions, quick actions and a full activity log."
      />
      <ExtrasWorkspace
        products={products}
        warehouses={warehouses}
        transactions={transactions}
        staff={getCurrentUser()}
        initialTab={parseExtrasTab(searchParams.tab)}
      />
    </>
  )
}
