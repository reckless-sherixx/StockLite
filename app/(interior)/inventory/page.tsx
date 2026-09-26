import type { Metadata } from 'next'
import InventoryTable from '@/components/InventoryTable'
import SheetHead from '@/components/SheetHead'
import { sectionById } from '@/components/sections'
import { products, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: sectionById('inventory').floor }

export default function InventoryPage() {
  return (
    <>
      <SheetHead title="Inventory" sub="Current stock across both warehouses." />
      <InventoryTable products={products} warehouses={warehouses} />
    </>
  )
}
