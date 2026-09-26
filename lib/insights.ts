import { isLowStock, Product, Warehouse } from './types'

// ---- Stock by product ------------------------------------------------------

export type ProductSummaryRow = {
  name: string
  category: string
  // The product's row in each warehouse, keyed by warehouse id; missing when
  // the product isn't stocked there.
  cells: Record<string, Product | undefined>
  total: number
  needsAttention: boolean // at or below threshold in any warehouse
}

export type ProductSummary = {
  rows: ProductSummaryRow[]
  totalsByWarehouse: Record<string, number>
  grandTotal: number
}

// One row per product name — the same product in two warehouses is two
// Product rows sharing a name. Rows needing attention come first.
export function summarizeByProduct(
  products: Product[],
  warehouses: Warehouse[],
): ProductSummary {
  const rowsByName = new Map<string, ProductSummaryRow>()
  const totalsByWarehouse: Record<string, number> = {}
  for (const w of warehouses) totalsByWarehouse[w.id] = 0
  let grandTotal = 0

  for (const p of products) {
    let row = rowsByName.get(p.name)
    if (!row) {
      row = {
        name: p.name,
        category: p.category,
        cells: {},
        total: 0,
        needsAttention: false,
      }
      rowsByName.set(p.name, row)
    }
    row.cells[p.warehouseId] = p
    row.total += p.currentStock
    if (isLowStock(p)) row.needsAttention = true
    totalsByWarehouse[p.warehouseId] =
      (totalsByWarehouse[p.warehouseId] ?? 0) + p.currentStock
    grandTotal += p.currentStock
  }

  const rows = Array.from(rowsByName.values()).sort(
    (a, b) =>
      Number(b.needsAttention) - Number(a.needsAttention) ||
      a.name.localeCompare(b.name),
  )
  return { rows, totalsByWarehouse, grandTotal }
}

// ---- Suggested transfers ---------------------------------------------------

export type TransferSuggestion = {
  productName: string
  from: Product // donor row; stays above its threshold after the move
  to: Product // receiver row; currently at or below its threshold
  quantity: number // suggested units to move
  need: number // units that would lift the receiver just above its threshold
  fullyCovers: boolean // quantity === need
}

export type ReorderReason =
  | 'other-warehouse-low'
  | 'no-spare-stock'
  | 'not-stocked-elsewhere'

export type ReorderItem = { product: Product; reason: ReorderReason }

// Low means stock <= threshold, so threshold + 1 is the first healthy level.
function unitsNeeded(p: Product) {
  return p.reorderThreshold - p.currentStock + 1
}

// What a row can give while staying above its own threshold.
function unitsSpare(p: Product) {
  return p.currentStock - p.reorderThreshold - 1
}

// Lower is more urgent. A zero threshold has no meaningful ratio.
function urgency(p: Product) {
  return p.reorderThreshold > 0 ? p.currentStock / p.reorderThreshold : 0
}

function byUrgency(a: Product, b: Product) {
  return urgency(a) - urgency(b) || a.name.localeCompare(b.name)
}

// For every low row, suggest moving stock from the same product's healthiest
// other warehouse — never so much that the donor becomes low. Low rows no
// transfer can fix are listed for reordering instead.
export function suggestTransfers(products: Product[]): {
  suggestions: TransferSuggestion[]
  reorder: ReorderItem[]
} {
  const suggestions: TransferSuggestion[] = []
  const reorder: ReorderItem[] = []

  for (const to of products) {
    if (!isLowStock(to)) continue

    const others = products.filter(
      (p) => p.name === to.name && p.warehouseId !== to.warehouseId,
    )
    if (others.length === 0) {
      reorder.push({ product: to, reason: 'not-stocked-elsewhere' })
      continue
    }
    const donors = others.filter((p) => !isLowStock(p))
    if (donors.length === 0) {
      reorder.push({ product: to, reason: 'other-warehouse-low' })
      continue
    }

    const from = donors.reduce((best, p) =>
      unitsSpare(p) > unitsSpare(best) ? p : best,
    )
    const need = unitsNeeded(to)
    const quantity = Math.min(need, unitsSpare(from))
    if (quantity <= 0) {
      reorder.push({ product: to, reason: 'no-spare-stock' })
      continue
    }
    suggestions.push({
      productName: to.name,
      from,
      to,
      quantity,
      need,
      fullyCovers: quantity === need,
    })
  }

  suggestions.sort((a, b) => byUrgency(a.to, b.to))
  reorder.sort((a, b) => byUrgency(a.product, b.product))
  return { suggestions, reorder }
}
