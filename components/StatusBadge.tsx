import { StockStatus, getStockStatusLabel } from '@/lib/types'

// Stock status as label tape: black below threshold, grey at it, white when
// in stock.
export default function StatusBadge({
  status,
  label = getStockStatusLabel(status),
}: {
  status: StockStatus
  label?: string
}) {
  return <span className={`dymo dymo--${status}`}>{label}</span>
}
