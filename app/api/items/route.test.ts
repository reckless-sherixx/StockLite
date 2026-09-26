import { afterEach, describe, expect, it, vi } from 'vitest'
import { transactions, findProduct } from '@/lib/seed-data'
import { POST } from './route'

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/items — reason and staff', () => {
  it('records the reason and the server-side staff user', async () => {
    const res = await post({
      action: 'stock',
      productId: 'p-001',
      quantity: 2,
      direction: 'IN',
      reason: 'Restock',
      staffName: 'Mallory', // must be ignored
      staffId: 'staff-99', // must be ignored
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.product.id).toBe('p-001')
    expect(Array.isArray(data.products)).toBe(true)
    expect(data.recorded).toHaveLength(1)
    expect(data.recorded[0]).toMatchObject({
      reason: 'Restock',
      staffId: 'staff-01',
      staffName: 'Jordan Ruiz',
    })
  })

  it('treats a missing, null or empty reason as no reason', async () => {
    for (const reason of [undefined, null, '']) {
      const res = await post({
        action: 'stock',
        productId: 'p-001',
        quantity: 1,
        direction: 'IN',
        reason,
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.recorded[0].reason).toBeUndefined()
      expect(data.recorded[0].staffName).toBe('Jordan Ruiz')
    }
  })

  it('rejects unknown or malformed reasons without writing anything', async () => {
    const before = transactions.length
    const stock = findProduct('p-001')!.currentStock
    for (const reason of ['Because', 'damaged', 5, {}, ['Restock']]) {
      const res = await post({
        action: 'stock',
        productId: 'p-001',
        quantity: 1,
        direction: 'IN',
        reason,
      })
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Unknown reason')
    }
    expect(transactions.length).toBe(before)
    expect(findProduct('p-001')!.currentStock).toBe(stock)
  })

  it('returns both linked transactions for a transfer', async () => {
    const res = await post({
      action: 'transfer',
      productId: 'p-011',
      sourceWarehouseId: 'wh-north',
      destWarehouseId: 'wh-south',
      quantity: 2,
      reason: 'Rebalancing',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.source.id).toBe('p-011')
    expect(data.destination.id).toBe('p-012')
    expect(data.recorded.map((t: { type: string }) => t.type)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ])
    expect(data.recorded[1].reason).toBe('Rebalancing')
  })

  it('rejects an unknown reason on a transfer before moving stock', async () => {
    const source = findProduct('p-011')!.currentStock
    const res = await post({
      action: 'transfer',
      productId: 'p-011',
      destWarehouseId: 'wh-south',
      quantity: 1,
      reason: 'Nope',
    })
    expect(res.status).toBe(400)
    expect(findProduct('p-011')!.currentStock).toBe(source)
  })

  it('rejects a transfer larger than the source stock and records nothing', async () => {
    const before = transactions.length
    const res = await post({
      action: 'transfer',
      productId: 'p-015',
      destWarehouseId: 'wh-north',
      quantity: 999,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Cannot transfer 999/)
    expect(transactions.length).toBe(before)
  })
})

describe('POST /api/items — terminal logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs rejected movements as warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await post({
      action: 'stock',
      productId: 'p-007',
      quantity: 999,
      direction: 'OUT',
    })
    expect(res.status).toBe(400)
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock OUT p-007 × 999: Cannot stock out 999 — only 3 in stock',
    )
  })

  it('logs validation rejections too', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await post({ action: 'stock', productId: 'p-001', quantity: 1, direction: 'UP' })
    expect(warn).toHaveBeenCalledWith(
      '[StockLite] REJECTED stock UP p-001 × 1: direction must be IN or OUT',
    )
    await post({ action: 'launch' })
    expect(warn).toHaveBeenLastCalledWith(
      '[StockLite] REJECTED action launch: Unknown action',
    )
  })
})
