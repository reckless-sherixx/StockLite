import type { SectionCounts } from '@/components/sections'
import { products, transactions, warehouses } from '@/lib/seed-data'

// Server-only: reads the live store for the drawer and compartment stats.
export function getSectionCounts(): SectionCounts {
  return {
    products: products.length,
    warehouses: warehouses.length,
    transactions: transactions.length,
  }
}
