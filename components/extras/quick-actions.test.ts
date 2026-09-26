import { describe, expect, it } from 'vitest'
import type { Product, Warehouse } from '@/lib/types'
import {
  coverage,
  filterAndSortProducts,
  statusLabelAt,
  stockAfter,
} from './quick-actions'

const warehouses: Warehouse[] = [
  { id: 'wh-north', name: 'North Distribution Center', location: 'MD' },
  { id: 'wh-south', name: 'South Fulfillment Hub', location: 'TX' },
]

function p(
  id: string,
  name: string,
  warehouseId: string,
  currentStock: number,
  reorderThreshold: number,
  category = 'Packaging',
): Product {
  return { id, name, category, warehouseId, currentStock, reorderThreshold }
}

const box = p('p-1', 'Corrugated Shipping Box (M)', 'wh-north', 420, 100)
const boxS = p('p-2', 'Corrugated Shipping Box (M)', 'wh-south', 38, 100)
const gloves = p('p-3', 'Nitrile Gloves', 'wh-north', 140, 50, 'Safety')
const scanner = p('p-4', 'Barcode Scanner', 'wh-south', 4, 6, 'Electronics')
const tag = p('p-5', 'Asset Tag', 'wh-north', 3, 0, 'Electronics')
const all = [box, boxS, gloves, scanner, tag]

const base = { query: '', warehouseId: 'all', sortKey: 'name' as const, sortDir: 'asc' as const }

describe('coverage', () => {
  it('is stock as a share of the threshold, or null for a zero threshold', () => {
    expect(coverage(boxS)).toBeCloseTo(0.38)
    expect(coverage(tag)).toBeNull()
  })
})

describe('filterAndSortProducts', () => {
  it('searches name and category, trimmed and case-insensitive', () => {
    const ids = (query: string) =>
      filterAndSortProducts(all, warehouses, { ...base, query }).map((x) => x.id)
    expect(ids('  GLOVES ')).toEqual(['p-3'])
    expect(ids('electronics')).toEqual(['p-5', 'p-4'])
    expect(ids('(m)')).toEqual(['p-1', 'p-2'])
    expect(ids('nothing like this')).toEqual([])
  })

  it('filters by warehouse', () => {
    expect(
      filterAndSortProducts(all, warehouses, { ...base, warehouseId: 'wh-south' }).map(
        (x) => x.id,
      ),
    ).toEqual(['p-4', 'p-2'])
  })

  it('sorts by stock in both directions', () => {
    const sorted = (sortDir: 'asc' | 'desc') =>
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'stock', sortDir }).map(
        (x) => x.currentStock,
      )
    expect(sorted('asc')).toEqual([3, 4, 38, 140, 420])
    expect(sorted('desc')).toEqual([420, 140, 38, 4, 3])
  })

  it('sorts by coverage with zero-threshold rows last in either direction', () => {
    const ids = (sortDir: 'asc' | 'desc') =>
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'coverage', sortDir }).map(
        (x) => x.id,
      )
    expect(ids('asc')).toEqual(['p-2', 'p-4', 'p-3', 'p-1', 'p-5'])
    expect(ids('desc')).toEqual(['p-1', 'p-3', 'p-4', 'p-2', 'p-5'])
  })

  it('sorts by warehouse name, breaking ties by product name', () => {
    expect(
      filterAndSortProducts(all, warehouses, { ...base, sortKey: 'warehouse' }).map(
        (x) => x.id,
      ),
    ).toEqual(['p-5', 'p-1', 'p-3', 'p-4', 'p-2'])
  })

  it('does not mutate its input', () => {
    const input = [...all]
    filterAndSortProducts(input, warehouses, { ...base, sortKey: 'stock' })
    expect(input).toEqual(all)
  })
})

describe('stockAfter / statusLabelAt', () => {
  it('adds for IN and subtracts for OUT and TRANSFER', () => {
    expect(stockAfter(box, 'IN', 10)).toBe(430)
    expect(stockAfter(box, 'OUT', 10)).toBe(410)
    expect(stockAfter(box, 'TRANSFER', 20)).toBe(400)
  })

  it('labels the status at a hypothetical stock level', () => {
    expect(statusLabelAt(box, 100)).toBe('At threshold')
    expect(statusLabelAt(box, 99)).toBe('Below threshold')
    expect(statusLabelAt(box, 101)).toBe('In stock')
  })
})
