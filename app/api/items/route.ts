import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { applyStockMovement, applyTransfer, products } from '@/lib/seed-data'
import { isMovementReason, MovementReason } from '@/lib/types'

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

// Optional. Anything other than a listed reason is rejected rather than
// silently dropped, so a typo in a client can't lose the reason.
function toReason(value: unknown): MovementReason | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (isMovementReason(value)) return value
  throw new Error('Unknown reason')
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
      const { product, recorded } = applyStockMovement(
        productId,
        toQuantity(body.quantity),
        direction,
        { reason: toReason(body.reason), staff: getCurrentUser() },
      )
      return NextResponse.json({ product, products, recorded })
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
      const { source, destination, recorded } = applyTransfer(
        productId,
        destWarehouseId,
        toQuantity(body.quantity),
        {
          sourceWarehouseId,
          reason: toReason(body.reason),
          staff: getCurrentUser(),
        },
      )
      return NextResponse.json({ source, destination, products, recorded })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
