import { describe, expect, it } from 'vitest'
import { suggestTransfers, summarizeByProduct } from './insights'
import type { Product, Warehouse } from './types'

let seq = 0
function row(
  name: string,
  warehouseId: string,
  currentStock: number,
  reorderThreshold: number,
  category = 'Safety',
): Product {
  seq += 1
  return { id: `p-${seq}`, name, category, warehouseId, currentStock, reorderThreshold }
}

const warehouses: Warehouse[] = [
  { id: 'wh-north', name: 'North', location: 'MD' },
  { id: 'wh-south', name: 'South', location: 'TX' },
]

describe('summarizeByProduct', () => {
  it('groups rows by product name with per-warehouse cells and totals', () => {
    const gN = row('Gloves', 'wh-north', 110, 50)
    const gS = row('Gloves', 'wh-south', 39, 50)
    const kit = row('First Aid Kit', 'wh-south', 20, 8)
    const s = summarizeByProduct([gN, gS, kit], warehouses)

    expect(s.rows.map((r) => r.name)).toEqual(['Gloves', 'First Aid Kit'])
    expect(s.rows[0]).toMatchObject({ category: 'Safety', total: 149, needsAttention: true })
    expect(s.rows[0].cells['wh-north']).toBe(gN)
    expect(s.rows[0].cells['wh-south']).toBe(gS)
    expect(s.rows[1].cells['wh-north']).toBeUndefined()
    expect(s.rows[1].needsAttention).toBe(false)
    expect(s.totalsByWarehouse).toEqual({ 'wh-north': 110, 'wh-south': 59 })
    expect(s.grandTotal).toBe(169)
  })

  it('puts products needing attention first (at threshold counts), then by name', () => {
    const s = summarizeByProduct(
      [
        row('Alpha', 'wh-north', 10, 5),
        row('Zeta', 'wh-north', 5, 5),
        row('Beta', 'wh-north', 1, 5),
      ],
      warehouses,
    )
    expect(s.rows.map((r) => r.name)).toEqual(['Beta', 'Zeta', 'Alpha'])
  })

  it('reports zero totals when there are no products', () => {
    expect(summarizeByProduct([], warehouses)).toEqual({
      rows: [],
      totalsByWarehouse: { 'wh-north': 0, 'wh-south': 0 },
      grandTotal: 0,
    })
  })
})

describe('suggestTransfers', () => {
  it('suggests lifting the low warehouse just above its threshold', () => {
    const north = row('Gloves', 'wh-north', 110, 50)
    const south = row('Gloves', 'wh-south', 39, 50)
    expect(suggestTransfers([north, south])).toEqual({
      suggestions: [
        { productName: 'Gloves', from: north, to: south, quantity: 12, need: 12, fullyCovers: true },
      ],
      reorder: [],
    })
  })

  it('caps the move so the donor stays above its own threshold', () => {
    const donor = row('Wrap', 'wh-north', 60, 50)
    const receiver = row('Wrap', 'wh-south', 10, 50)
    const { suggestions } = suggestTransfers([donor, receiver])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ quantity: 9, need: 41, fullyCovers: false })
  })

  it('sends a low row to reordering when the donor has nothing to spare', () => {
    const donor = row('Jack', 'wh-south', 51, 50)
    const receiver = row('Jack', 'wh-north', 49, 50)
    expect(suggestTransfers([donor, receiver])).toEqual({
      suggestions: [],
      reorder: [{ product: receiver, reason: 'no-spare-stock' }],
    })
  })

  it('never takes stock from a warehouse that is itself at its threshold', () => {
    const atThreshold = row('Vest', 'wh-south', 50, 50)
    const receiver = row('Vest', 'wh-north', 10, 50)
    const { suggestions, reorder } = suggestTransfers([atThreshold, receiver])
    expect(suggestions).toEqual([])
    expect(reorder).toEqual([
      { product: receiver, reason: 'other-warehouse-low' },
      { product: atThreshold, reason: 'other-warehouse-low' },
    ])
  })

  it('sends products stocked in only one warehouse to reordering', () => {
    const kit = row('Kit', 'wh-south', 8, 8)
    expect(suggestTransfers([kit]).reorder).toEqual([
      { product: kit, reason: 'not-stocked-elsewhere' },
    ])
  })

  it('handles a zero threshold', () => {
    const receiver = row('Tag', 'wh-north', 0, 0)
    const donor = row('Tag', 'wh-south', 5, 0)
    expect(suggestTransfers([receiver, donor]).suggestions).toEqual([
      { productName: 'Tag', from: donor, to: receiver, quantity: 1, need: 1, fullyCovers: true },
    ])
  })

  it('picks the donor with the most to spare when several could give', () => {
    const receiver = row('Tape', 'wh-north', 0, 10)
    const small = row('Tape', 'wh-south', 15, 10)
    const big = row('Tape', 'wh-west', 90, 10)
    expect(suggestTransfers([receiver, small, big]).suggestions[0].from).toBe(big)
  })

  it('orders suggestions and reorder items most urgent first', () => {
    const mild = row('Mild', 'wh-north', 45, 50)
    const mildDonor = row('Mild', 'wh-south', 200, 50)
    const severe = row('Severe', 'wh-north', 5, 50)
    const severeDonor = row('Severe', 'wh-south', 200, 50)
    const onlyA = row('OnlyA', 'wh-north', 4, 10)
    const onlyB = row('OnlyB', 'wh-north', 1, 10)
    const { suggestions, reorder } = suggestTransfers([
      mild, mildDonor, severe, severeDonor, onlyA, onlyB,
    ])
    expect(suggestions.map((s) => s.productName)).toEqual(['Severe', 'Mild'])
    expect(reorder.map((r) => r.product.name)).toEqual(['OnlyB', 'OnlyA'])
  })

  it('returns nothing when no row is low', () => {
    expect(
      suggestTransfers([row('Ok', 'wh-north', 20, 5), row('Ok', 'wh-south', 30, 5)]),
    ).toEqual({ suggestions: [], reorder: [] })
  })
})
