import { describe, expect, it } from 'vitest'
import type { Transaction } from '@/lib/types'
import {
  ALL,
  NO_REASON,
  UNKNOWN_STAFF,
  filterActivity,
  newestFirst,
  staffNames,
} from './activity'

function tx(id: string, timestamp: string, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    productId: 'p-1',
    productName: 'Gloves',
    warehouseId: 'wh-north',
    warehouseName: 'North',
    type: 'IN',
    quantity: 1,
    timestamp,
    ...extra,
  }
}

const a = tx('t-1', '2026-09-15T10:00:00Z')
const b = tx('t-2', '2026-09-26T10:00:00Z', { reason: 'Damaged', staffName: 'Jordan Ruiz' })
const c = tx('t-3', '2026-09-26T10:00:00Z', { reason: 'Restock', staffName: 'Sam Lee' })
const d = tx('t-4', '2026-09-20T10:00:00Z', { staffName: 'Jordan Ruiz' })

describe('newestFirst', () => {
  it('sorts by timestamp descending, keeping recorded order on ties, without mutating', () => {
    const input = [a, b, c, d]
    expect(newestFirst(input).map((t) => t.id)).toEqual(['t-2', 't-3', 't-4', 't-1'])
    expect(input.map((t) => t.id)).toEqual(['t-1', 't-2', 't-3', 't-4'])
  })
})

describe('filterActivity', () => {
  const all = [a, b, c, d]

  it('returns everything for ALL/ALL', () => {
    expect(filterActivity(all, { reason: ALL, staff: ALL })).toEqual(all)
  })

  it('filters by reason, including "no reason"', () => {
    expect(filterActivity(all, { reason: 'Damaged', staff: ALL })).toEqual([b])
    expect(filterActivity(all, { reason: NO_REASON, staff: ALL })).toEqual([a, d])
  })

  it('filters by staff, including "not recorded"', () => {
    expect(filterActivity(all, { reason: ALL, staff: 'Jordan Ruiz' })).toEqual([b, d])
    expect(filterActivity(all, { reason: ALL, staff: UNKNOWN_STAFF })).toEqual([a])
  })

  it('combines both filters', () => {
    expect(filterActivity(all, { reason: NO_REASON, staff: 'Jordan Ruiz' })).toEqual([d])
    expect(filterActivity(all, { reason: 'Restock', staff: 'Jordan Ruiz' })).toEqual([])
  })
})

describe('staffNames', () => {
  it('lists distinct recorded names alphabetically', () => {
    expect(staffNames([a, b, c, d])).toEqual(['Jordan Ruiz', 'Sam Lee'])
    expect(staffNames([a])).toEqual([])
  })
})
