import type { Transaction } from './types'

const PREFIX = '[StockLite]'

// One line per recorded transaction for the server terminal, e.g.
// [StockLite] t-005 OUT 20 × Box @ North 420 → 400 · by Jordan Ruiz · reason: Restock
export function formatTransaction(tx: Transaction, stockAfter: number): string {
  const delta =
    tx.type === 'IN' || tx.type === 'TRANSFER_IN' ? tx.quantity : -tx.quantity
  const parts = [
    `${PREFIX} ${tx.id} ${tx.type} ${tx.quantity} × ${tx.productName} @ ${tx.warehouseName} ${stockAfter - delta} → ${stockAfter}`,
  ]
  if (tx.linkedTransactionId) parts.push(`linked ${tx.linkedTransactionId}`)
  if (tx.staffName) parts.push(`by ${tx.staffName}`)
  if (tx.reason) parts.push(`reason: ${tx.reason}`)
  return parts.join(' · ')
}

export function logTransaction(tx: Transaction, stockAfter: number) {
  console.log(formatTransaction(tx, stockAfter))
}

export function formatRejected(action: string, message: string): string {
  return `${PREFIX} REJECTED ${action}: ${message}`
}

export function logRejected(action: string, message: string) {
  console.warn(formatRejected(action, message))
}
