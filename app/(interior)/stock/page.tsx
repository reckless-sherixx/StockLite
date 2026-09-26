import type { Metadata } from 'next'
import SheetHead from '@/components/SheetHead'
import StockForm from '@/components/StockForm'
import { sectionById } from '@/components/sections'
import { products } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: sectionById('stock').floor }

export default function StockPage() {
  return (
    <>
      <SheetHead
        title="Stock In / Stock Out"
        sub="Record incoming or outgoing stock for a single warehouse."
      />
      <StockForm products={products} />
    </>
  )
}
