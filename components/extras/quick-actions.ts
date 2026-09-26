import {
  getStockStatus,
  getStockStatusLabel,
  type Product,
  type Warehouse,
} from '@/lib/types'

export type SortKey = 'name' | 'warehouse' | 'stock' | 'threshold' | 'coverage'
export type SortDir = 'asc' | 'desc'
export type QuickAction = 'IN' | 'OUT' | 'TRANSFER'

// Stock as a share of the reorder threshold (1 = exactly at threshold);
// null when the threshold is 0, where a ratio means nothing.
export function coverage(product: Product): number | null {
  return product.reorderThreshold > 0
    ? product.currentStock / product.reorderThreshold
    : null
}

export function filterAndSortProducts(
  products: Product[],
  warehouses: Warehouse[],
  options: { query: string; warehouseId: string; sortKey: SortKey; sortDir: SortDir },
): Product[] {
  const query = options.query.trim().toLowerCase()
  const direction = options.sortDir === 'asc' ? 1 : -1
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  const valueOf = (p: Product): string | number | null => {
    switch (options.sortKey) {
      case 'name':
        return p.name.toLowerCase()
      case 'warehouse':
        return warehouseName(p.warehouseId).toLowerCase()
      case 'stock':
        return p.currentStock
      case 'threshold':
        return p.reorderThreshold
      case 'coverage':
        return coverage(p)
    }
  }
  const tieBreak = (a: Product, b: Product) =>
    a.name.localeCompare(b.name) ||
    warehouseName(a.warehouseId).localeCompare(warehouseName(b.warehouseId))

  return products
    .filter(
      (p) => options.warehouseId === 'all' || p.warehouseId === options.warehouseId,
    )
    .filter(
      (p) =>
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const va = valueOf(a)
      const vb = valueOf(b)
      // Rows with no value (coverage at a zero threshold) always go last.
      if (va === null || vb === null) {
        if (va === vb) return tieBreak(a, b)
        return va === null ? 1 : -1
      }
      const compared =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
      return compared * direction || tieBreak(a, b)
    })
}

// Stock at the product's own warehouse after the action.
export function stockAfter(
  product: Product,
  action: QuickAction,
  quantity: number,
): number {
  return action === 'IN'
    ? product.currentStock + quantity
    : product.currentStock - quantity
}

export function statusLabelAt(product: Product, stock: number): string {
  return getStockStatusLabel(getStockStatus({ ...product, currentStock: stock }))
}
