import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  formatRejected,
  formatTransaction,
  logRejected,
  logTransaction,
} from './transaction-log'
import type { Transaction } from './types'

const base: Transaction = {
  id: 't-005',
  productId: 'p-001',
  productName: 'Corrugated Shipping Box (M)',
  warehouseId: 'wh-north',
  warehouseName: 'North Distribution Center',
  type: 'OUT',
  quantity: 20,
  timestamp: '2026-09-26T10:00:00.000Z',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('formatTransaction', () => {
  it('shows before → after for a stock out, with staff and reason', () => {
    expect(
      formatTransaction(
        { ...base, staffName: 'Jordan Ruiz', reason: 'Customer order' },
        400,
      ),
    ).toBe(
      '[StockLite] t-005 OUT 20 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 400 · by Jordan Ruiz · reason: Customer order',
    )
  })

  it('counts stock in upwards and omits missing staff and reason', () => {
    expect(formatTransaction({ ...base, type: 'IN', quantity: 5 }, 425)).toBe(
      '[StockLite] t-005 IN 5 × Corrugated Shipping Box (M) @ North Distribution Center 420 → 425',
    )
  })

  it('shows transfers, with the link on the inbound half', () => {
    expect(
      formatTransaction({ ...base, type: 'TRANSFER_OUT', quantity: 12 }, 98),
    ).toBe(
      '[StockLite] t-005 TRANSFER_OUT 12 × Corrugated Shipping Box (M) @ North Distribution Center 110 → 98',
    )
    expect(
      formatTransaction(
        {
          ...base,
          id: 't-007',
          type: 'TRANSFER_IN',
          quantity: 12,
          warehouseName: 'South Fulfillment Hub',
          linkedTransactionId: 't-006',
          staffName: 'Jordan Ruiz',
          reason: 'Rebalancing',
        },
        51,
      ),
    ).toBe(
      '[StockLite] t-007 TRANSFER_IN 12 × Corrugated Shipping Box (M) @ South Fulfillment Hub 39 → 51 · linked t-006 · by Jordan Ruiz · reason: Rebalancing',
    )
  })
})

describe('console output', () => {
  it('logTransaction writes exactly one console.log line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    logTransaction(base, 400)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(formatTransaction(base, 400))
  })

  it('logRejected writes a console.warn line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logRejected('stock OUT p-007 × 4', 'Cannot stock out 4 — only 3 in stock')
    expect(formatRejected('a', 'b')).toBe('[StockLite] REJECTED a: b')
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock OUT p-007 × 4: Cannot stock out 4 — only 3 in stock',
    )
  })
})

describe('store integration', () => {
  it('logs every recorded transaction with the new stock level', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { applyStockMovement, applyTransfer, findProduct } = await import(
      './seed-data'
    )
    const before = findProduct('p-018')!.currentStock
    applyStockMovement('p-018', 10, 'OUT')
    expect(log).toHaveBeenLastCalledWith(
      expect.stringContaining(
        `OUT 10 × Wooden Pallet, Standard @ North Distribution Center ${before} → ${before - 10}`,
      ),
    )

    log.mockClear()
    applyTransfer('p-018', 'wh-south', 5)
    expect(log).toHaveBeenCalledTimes(2)
    expect(log.mock.calls[0][0]).toContain('TRANSFER_OUT 5 × Wooden Pallet')
    expect(log.mock.calls[1][0]).toMatch(
      /TRANSFER_IN 5 × Wooden Pallet, Standard @ South Fulfillment Hub \d+ → \d+ · linked t-\d+/,
    )
  })
})
