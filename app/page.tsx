import Exterior, { type ExteriorNotice } from '@/components/exterior/Exterior'
import { products, transactions, warehouses } from '@/lib/seed-data'
import { isLowStock } from '@/lib/types'

// Reads the in-memory store, so it must render per request.
export const dynamic = 'force-dynamic'

// The landing page: the reference's exterior (WebGL scene, scroll descent,
// ENTER). The ground notice prints live numbers from the store.
export default function HomePage() {
  const north = warehouses.find((w) => w.id === 'wh-north') ?? warehouses[0]
  const northProducts = products.filter((p) => p.warehouseId === north?.id)
  const lastTransfer = [...transactions]
    .filter((t) => t.type === 'TRANSFER_IN')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]

  const notice: ExteriorNotice = {
    warehouse: north?.name ?? 'Warehouse',
    units: northProducts.reduce((sum, p) => sum + p.currentStock, 0),
    productCount: northProducts.length,
    lowCount: products.filter(isLowStock).length,
    lastTransferTo: lastTransfer?.warehouseName ?? null,
  }

  return <Exterior notice={notice} />
}
