import {
  MovementReason,
  Product,
  StaffUser,
  Transaction,
  TransactionType,
  Warehouse,
} from './types'
import { logTransaction } from './transaction-log'

const seedWarehouses: Warehouse[] = [
  {
    id: 'wh-north',
    name: 'North Distribution Center',
    location: 'Elkridge, MD',
  },
  { id: 'wh-south', name: 'South Fulfillment Hub', location: 'Waco, TX' },
]

const seedProducts: Product[] = [
  {
    id: 'p-001',
    name: 'Corrugated Shipping Box (M)',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 420,
    reorderThreshold: 100,
  },
  {
    id: 'p-002',
    name: 'Corrugated Shipping Box (M)',
    category: 'Packaging',
    warehouseId: 'wh-south',
    currentStock: 38,
    reorderThreshold: 100,
  },
  {
    id: 'p-003',
    name: 'Stretch Wrap Film 18in',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 64,
    reorderThreshold: 60,
  },
  {
    id: 'p-004',
    name: 'Stretch Wrap Film 18in',
    category: 'Packaging',
    warehouseId: 'wh-south',
    currentStock: 15,
    reorderThreshold: 60,
  },
  {
    id: 'p-005',
    name: 'Packing Tape, Clear 48mm',
    category: 'Packaging',
    warehouseId: 'wh-north',
    currentStock: 210,
    reorderThreshold: 80,
  },
  {
    id: 'p-006',
    name: 'Heavy-Duty Pallet Jack',
    category: 'Equipment',
    warehouseId: 'wh-south',
    currentStock: 6,
    reorderThreshold: 5,
  },
  {
    id: 'p-007',
    name: 'Heavy-Duty Pallet Jack',
    category: 'Equipment',
    warehouseId: 'wh-north',
    currentStock: 3,
    reorderThreshold: 5,
  },
  {
    id: 'p-008',
    name: 'Steel Shelving Unit 5-Tier',
    category: 'Equipment',
    warehouseId: 'wh-north',
    currentStock: 12,
    reorderThreshold: 4,
  },
  {
    id: 'p-009',
    name: 'Forklift Safety Vest',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 25,
    reorderThreshold: 20,
  },
  {
    id: 'p-010',
    name: 'Forklift Safety Vest',
    category: 'Safety',
    warehouseId: 'wh-north',
    currentStock: 20,
    reorderThreshold: 20,
  },
  {
    id: 'p-011',
    name: 'Nitrile Gloves (Box of 100)',
    category: 'Safety',
    warehouseId: 'wh-north',
    currentStock: 140,
    reorderThreshold: 50,
  },
  {
    id: 'p-012',
    name: 'Nitrile Gloves (Box of 100)',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 9,
    reorderThreshold: 50,
  },
  {
    id: 'p-013',
    name: 'First Aid Kit, Wall-Mount',
    category: 'Safety',
    warehouseId: 'wh-south',
    currentStock: 8,
    reorderThreshold: 8,
  },
  {
    id: 'p-014',
    name: 'Handheld Barcode Scanner',
    category: 'Electronics',
    warehouseId: 'wh-north',
    currentStock: 18,
    reorderThreshold: 6,
  },
  {
    id: 'p-015',
    name: 'Handheld Barcode Scanner',
    category: 'Electronics',
    warehouseId: 'wh-south',
    currentStock: 4,
    reorderThreshold: 6,
  },
  {
    id: 'p-016',
    name: 'Label Printer, Thermal',
    category: 'Electronics',
    warehouseId: 'wh-north',
    currentStock: 9,
    reorderThreshold: 3,
  },
  {
    id: 'p-017',
    name: 'Warehouse Radio, Two-Way',
    category: 'Electronics',
    warehouseId: 'wh-south',
    currentStock: 11,
    reorderThreshold: 10,
  },
  {
    id: 'p-018',
    name: 'Wooden Pallet, Standard',
    category: 'Materials',
    warehouseId: 'wh-north',
    currentStock: 320,
    reorderThreshold: 150,
  },
  {
    id: 'p-019',
    name: 'Wooden Pallet, Standard',
    category: 'Materials',
    warehouseId: 'wh-south',
    currentStock: 132,
    reorderThreshold: 150,
  },
  {
    id: 'p-020',
    name: 'Cardboard Dunnage Sheets',
    category: 'Materials',
    warehouseId: 'wh-south',
    currentStock: 55,
    reorderThreshold: 55,
  },
]

// A few sample transactions so the History page isn't empty on first load.
const seedTransactions: Transaction[] = [
  {
    id: 't-001',
    productId: 'p-002',
    productName: 'Corrugated Shipping Box (M)',
    warehouseId: 'wh-south',
    warehouseName: 'South Fulfillment Hub',
    type: 'OUT',
    quantity: 62,
    timestamp: '2026-09-15T14:32:00Z',
  },
  {
    id: 't-002',
    productId: 'p-018',
    productName: 'Wooden Pallet, Standard',
    warehouseId: 'wh-north',
    warehouseName: 'North Distribution Center',
    type: 'IN',
    quantity: 100,
    timestamp: '2026-09-16T09:05:00Z',
  },
  {
    id: 't-003',
    productId: 'p-011',
    productName: 'Nitrile Gloves (Box of 100)',
    warehouseId: 'wh-north',
    warehouseName: 'North Distribution Center',
    type: 'TRANSFER_OUT',
    quantity: 40,
    timestamp: '2026-09-17T11:20:00Z',
    linkedTransactionId: 't-004',
  },
  {
    id: 't-004',
    productId: 'p-012',
    productName: 'Nitrile Gloves (Box of 100)',
    warehouseId: 'wh-south',
    warehouseName: 'South Fulfillment Hub',
    type: 'TRANSFER_IN',
    quantity: 40,
    timestamp: '2026-09-17T11:20:00Z',
    linkedTransactionId: 't-003',
  },
]

// --- In-memory store -----------------------------------------------------
// Next.js can evaluate this module more than once in a single server process:
// dev mode re-runs it whenever it compiles a route for the first time or
// hot-reloads a file, and separately bundled routes can each get their own
// copy. Plain module-level arrays would then silently reset or drift apart
// (a stock movement made through the API vanishing from other pages), so the
// one live store is kept on globalThis. Restart the server to reset it.
type Store = {
  warehouses: Warehouse[]
  products: Product[]
  transactions: Transaction[]
  nextTransactionSeq: number
  nextProductSeq: number
}

const globalForStore = globalThis as typeof globalThis & {
  __stockLiteStore?: Store
}

const store: Store = (globalForStore.__stockLiteStore ??= {
  warehouses: seedWarehouses,
  products: seedProducts,
  transactions: seedTransactions,
  nextTransactionSeq: seedTransactions.length + 1,
  nextProductSeq: seedProducts.length + 1,
})

export const warehouses = store.warehouses
export const products = store.products
export const transactions = store.transactions

function findWarehouse(id: string) {
  return warehouses.find((w) => w.id === id)
}

function warehouseName(id: string) {
  return findWarehouse(id)?.name ?? id
}

export function findProduct(id: string) {
  return products.find((p) => p.id === id)
}

// Stock is counted in whole units, so a valid quantity is a positive integer.
// Throws for 0, negatives, fractions, NaN and Infinity.
function assertValidQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Quantity must be a whole number greater than 0')
  }
}

type MovementOptions = {
  reason?: MovementReason
  staff?: StaffUser
}

export function recordTransaction(input: {
  productId: string
  productName: string
  warehouseId: string
  type: TransactionType
  quantity: number
  linkedTransactionId?: string
  timestamp?: string
  reason?: MovementReason
  staff?: StaffUser
}): Transaction {
  const tx: Transaction = {
    id: `t-${String(store.nextTransactionSeq++).padStart(3, '0')}`,
    productId: input.productId,
    productName: input.productName,
    warehouseId: input.warehouseId,
    warehouseName: warehouseName(input.warehouseId),
    type: input.type,
    quantity: input.quantity,
    timestamp: input.timestamp ?? new Date().toISOString(),
    linkedTransactionId: input.linkedTransactionId,
    reason: input.reason,
    staffId: input.staff?.id,
    staffName: input.staff?.name,
  }
  transactions.push(tx)
  // Every write path records through here, so this logs all movements.
  // Callers update stock before recording, so this is the new level.
  logTransaction(tx, findProduct(tx.productId)?.currentStock ?? 0)
  return tx
}

// Applies a stock in/out movement to a single product row (one warehouse)
// and logs it. Validates everything before writing, so a rejected movement
// leaves stock and history untouched.
export function applyStockMovement(
  productId: string,
  quantity: number,
  direction: 'IN' | 'OUT',
  options: MovementOptions = {},
): { product: Product; recorded: Transaction[] } {
  const product = findProduct(productId)
  if (!product) throw new Error('Product not found')

  assertValidQuantity(quantity)
  if (direction === 'OUT' && quantity > product.currentStock) {
    throw new Error(
      `Cannot stock out ${quantity} — only ${product.currentStock} in stock`,
    )
  }

  product.currentStock += direction === 'IN' ? quantity : -quantity

  const tx = recordTransaction({
    productId: product.id,
    productName: product.name,
    warehouseId: product.warehouseId,
    type: direction,
    quantity,
    reason: options.reason,
    staff: options.staff,
  })

  return { product, recorded: [tx] }
}

// Moves stock for one product from its warehouse to another. The same
// product in a different warehouse is a separate row with the same name;
// if the destination has no row for it yet, one is created. Every check runs
// before any write, so a failed transfer changes nothing. On success a linked
// TRANSFER_OUT / TRANSFER_IN pair is logged.
export function applyTransfer(
  productId: string,
  destWarehouseId: string,
  quantity: number,
  options: MovementOptions & { sourceWarehouseId?: string } = {},
): { source: Product; destination: Product; recorded: Transaction[] } {
  const { sourceWarehouseId } = options
  const source = findProduct(productId)
  if (!source) throw new Error('Source product not found')

  if (sourceWarehouseId !== undefined && sourceWarehouseId !== source.warehouseId) {
    throw new Error('Product is not stocked at the selected source warehouse')
  }
  if (!findWarehouse(source.warehouseId)) {
    throw new Error('Source warehouse not found')
  }
  if (!findWarehouse(destWarehouseId)) {
    throw new Error('Destination warehouse not found')
  }
  if (destWarehouseId === source.warehouseId) {
    throw new Error('Source and destination warehouses must be different')
  }
  assertValidQuantity(quantity)
  if (quantity > source.currentStock) {
    throw new Error(
      `Cannot transfer ${quantity} — only ${source.currentStock} in stock at the source warehouse`,
    )
  }

  // All checks passed — from here on nothing can fail, so the transfer
  // applies to both warehouses or (above) to neither.
  let destination = products.find(
    (p) => p.name === source.name && p.warehouseId === destWarehouseId,
  )
  if (!destination) {
    destination = {
      id: nextProductId(),
      name: source.name,
      category: source.category,
      warehouseId: destWarehouseId,
      currentStock: 0,
      reorderThreshold: source.reorderThreshold,
    }
    products.push(destination)
  }

  source.currentStock -= quantity
  destination.currentStock += quantity

  const timestamp = new Date().toISOString()
  const transferOut = recordTransaction({
    productId: source.id,
    productName: source.name,
    warehouseId: source.warehouseId,
    type: 'TRANSFER_OUT',
    quantity,
    timestamp,
    reason: options.reason,
    staff: options.staff,
  })
  const transferIn = recordTransaction({
    productId: destination.id,
    productName: destination.name,
    warehouseId: destination.warehouseId,
    type: 'TRANSFER_IN',
    quantity,
    timestamp,
    linkedTransactionId: transferOut.id,
    reason: options.reason,
    staff: options.staff,
  })
  transferOut.linkedTransactionId = transferIn.id

  return { source, destination, recorded: [transferOut, transferIn] }
}

function nextProductId() {
  let id: string
  do {
    id = `p-${String(store.nextProductSeq++).padStart(3, '0')}`
  } while (findProduct(id))
  return id
}
