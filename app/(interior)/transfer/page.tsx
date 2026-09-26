import type { Metadata } from 'next'
import SheetHead from '@/components/SheetHead'
import TransferForm from '@/components/TransferForm'
import { sectionById } from '@/components/sections'
import { products, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: sectionById('transfer').floor }

export default function TransferPage() {
  return (
    <>
      <SheetHead
        title="Warehouse Transfer"
        sub="Move stock from one warehouse to another."
      />
      <TransferForm products={products} warehouses={warehouses} />
    </>
  )
}
