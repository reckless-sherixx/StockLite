import { NextResponse } from 'next/server'
import { applyStockMovement, applyTransfer, products } from '@/lib/seed-data'

export async function GET() {
  return NextResponse.json({ products })
}

// Accepts a JSON number or a numeric string. Anything else (booleans, null,
// arrays, empty strings) becomes NaN so the store's validation rejects it,
// instead of Number() quietly coercing e.g. `true` to 1 or `[5]` to 5.
function toQuantity(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return NaN
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = body.action

  try {
    if (action === 'stock') {
      const { productId, direction } = body
      if (typeof productId !== 'string' || !productId) {
        return NextResponse.json(
          { error: 'productId is required' },
          { status: 400 },
        )
      }
      if (direction !== 'IN' && direction !== 'OUT') {
        return NextResponse.json(
          { error: 'direction must be IN or OUT' },
          { status: 400 },
        )
      }
      const product = applyStockMovement(
        productId,
        toQuantity(body.quantity),
        direction,
      )
      return NextResponse.json({ product, products })
    }

    if (action === 'transfer') {
      const { productId, sourceWarehouseId, destWarehouseId } = body
      if (typeof productId !== 'string' || !productId) {
        return NextResponse.json(
          { error: 'productId is required' },
          { status: 400 },
        )
      }
      if (typeof destWarehouseId !== 'string' || !destWarehouseId) {
        return NextResponse.json(
          { error: 'destWarehouseId is required' },
          { status: 400 },
        )
      }
      if (sourceWarehouseId !== undefined && typeof sourceWarehouseId !== 'string') {
        return NextResponse.json(
          { error: 'sourceWarehouseId must be a string' },
          { status: 400 },
        )
      }
      const { source, destination } = applyTransfer(
        productId,
        destWarehouseId,
        toQuantity(body.quantity),
        sourceWarehouseId,
      )
      return NextResponse.json({ source, destination, products })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
