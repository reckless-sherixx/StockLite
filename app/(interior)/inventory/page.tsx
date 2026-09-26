import DashboardShell from '@/components/DashboardShell'
import InventoryTable from '@/components/InventoryTable'
import { products, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default function InventoryPage() {
  return (
    <DashboardShell>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Current stock across both warehouses.</p>
        </div>
      </div>
      <InventoryTable products={products} warehouses={warehouses} />
    </DashboardShell>
  )
}
