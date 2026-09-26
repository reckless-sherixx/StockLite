import type { Product, StaffUser, Transaction, Warehouse } from '@/lib/types'
import type { ItemsResult } from './api'

// What every Extra features tab receives from ExtrasWorkspace.
export type ExtrasContext = {
  products: Product[]
  warehouses: Warehouse[]
  transactions: Transaction[]
  staff: StaffUser
  // Call with a successful postItems() result; updates every tab at once.
  onResult: (result: ItemsResult) => void
}
