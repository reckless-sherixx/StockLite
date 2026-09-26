import DashboardShell from '@/components/DashboardShell'
import TransferForm from '@/components/TransferForm'
import { products, warehouses } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default function TransferPage() {
  return (
    <DashboardShell>
      <div className="page-header">
        <div>
          <h1>Warehouse Transfer</h1>
          <p>Move stock from one warehouse to another.</p>
        </div>
      </div>
      <TransferForm products={products} warehouses={warehouses} />
    </DashboardShell>
  )
}
