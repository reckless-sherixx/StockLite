// Shared types used across the StockLite app.

export type Warehouse = {
  id: string
  name: string
  location: string
}

export type Product = {
  id: string
  name: string
  category: string
  warehouseId: string
  currentStock: number
  reorderThreshold: number
}

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER_OUT' | 'TRANSFER_IN'

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}

export type Transaction = {
  id: string
  productId: string
  productName: string
  warehouseId: string
  warehouseName: string
  type: TransactionType
  quantity: number
  timestamp: string // ISO string
  linkedTransactionId?: string // pairs TRANSFER_OUT with TRANSFER_IN
  reason?: MovementReason
  // Who recorded it. Always set server-side from the signed-in staff user.
  staffId?: string
  staffName?: string
}

export type StaffUser = {
  id: string
  name: string
  role: 'staff'
}

// Why stock moved. Optional on every movement; the list is fixed so reports
// can group by it.
export const MOVEMENT_REASONS = [
  'Restock',
  'Customer order',
  'Customer return',
  'Damaged',
  'Count correction',
  'Rebalancing',
  'Other',
] as const

export type MovementReason = (typeof MOVEMENT_REASONS)[number]

export function isMovementReason(value: unknown): value is MovementReason {
  return (
    typeof value === 'string' &&
    (MOVEMENT_REASONS as readonly string[]).includes(value)
  )
}

// Low-stock status shared by the inventory table and status badge.
export type StockStatus = 'ok' | 'low' | 'critical'

// The one low-stock rule: a product needs replenishment when its current stock
// is at or below its reorder threshold. Filters, badges and summaries all use
// this so they can't disagree.
export function isLowStock(product: Product): boolean {
  return product.currentStock <= product.reorderThreshold
}

export function getStockStatus(product: Product): StockStatus {
  if (!isLowStock(product)) return 'ok'
  return product.currentStock < product.reorderThreshold ? 'critical' : 'low'
}

export function getStockStatusLabel(status: StockStatus): string {
  if (status === 'critical') return 'Below threshold'
  if (status === 'low') return 'At threshold'
  return 'In stock'
}
