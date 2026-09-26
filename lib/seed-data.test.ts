import { describe, expect, it } from 'vitest'
import { applyStockMovement, applyTransfer, transactions } from './seed-data'
import { isMovementReason, type StaffUser } from './types'

const staff: StaffUser = { id: 'staff-01', name: 'Jordan Ruiz', role: 'staff' }

describe('applyStockMovement', () => {
  it('records reason and staff and returns the new transaction', () => {
    const { product, recorded } = applyStockMovement('p-001', 5, 'IN', {
      reason: 'Restock',
      staff,
    })
    expect(product.id).toBe('p-001')
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({
      productId: 'p-001',
      type: 'IN',
      quantity: 5,
      reason: 'Restock',
      staffId: 'staff-01',
      staffName: 'Jordan Ruiz',
    })
    expect(transactions).toContain(recorded[0])
  })

  it('works without options', () => {
    const { recorded } = applyStockMovement('p-001', 1, 'OUT')
    expect(recorded[0].reason).toBeUndefined()
    expect(recorded[0].staffName).toBeUndefined()
  })

  it('records nothing when the movement is rejected', () => {
    const before = transactions.length
    expect(() =>
      applyStockMovement('p-007', 999, 'OUT', { reason: 'Damaged', staff }),
    ).toThrow(/Cannot stock out/)
    expect(transactions.length).toBe(before)
  })
})

describe('applyTransfer', () => {
  it('stamps reason and staff on both linked transactions', () => {
    const { source, destination, recorded } = applyTransfer('p-011', 'wh-south', 3, {
      sourceWarehouseId: 'wh-north',
      reason: 'Rebalancing',
      staff,
    })
    expect(source.id).toBe('p-011')
    expect(destination.id).toBe('p-012')
    expect(recorded.map((t) => t.type)).toEqual(['TRANSFER_OUT', 'TRANSFER_IN'])
    for (const t of recorded) {
      expect(t).toMatchObject({ quantity: 3, reason: 'Rebalancing', staffName: 'Jordan Ruiz' })
    }
    expect(recorded[0].linkedTransactionId).toBe(recorded[1].id)
    expect(recorded[1].linkedTransactionId).toBe(recorded[0].id)
  })

  it('still checks the source warehouse passed in options', () => {
    expect(() =>
      applyTransfer('p-011', 'wh-south', 1, { sourceWarehouseId: 'wh-south' }),
    ).toThrow(/not stocked at the selected source/)
  })
})

describe('isMovementReason', () => {
  it('accepts listed reasons only, exactly as written', () => {
    expect(isMovementReason('Damaged')).toBe(true)
    expect(isMovementReason('Count correction')).toBe(true)
    expect(isMovementReason('damaged')).toBe(false)
    expect(isMovementReason('')).toBe(false)
    expect(isMovementReason(undefined)).toBe(false)
    expect(isMovementReason(5)).toBe(false)
  })
})
