import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { applyStockMovement, applyTransfer, products } from '@/lib/seed-data'
import { logRejected } from '@/lib/transaction-log'
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

// Short label for a request in the terminal, e.g. "stock OUT p-007 × 4".
function describeRequest(body: Record<string, unknown> | null): string {
  if (!body) return 'request'
  if (body.action === 'stock') {
    return `stock ${String(body.direction)} ${String(body.productId)} × ${String(body.quantity)}`
  }
  if (body.action === 'transfer') {
    return `transfer ${String(body.productId)} → ${String(body.destWarehouseId)} × ${String(body.quantity)}`
  }
  return `action ${String(body.action)}`
}

// Every rejected request is logged, then answered with a 400.
function reject(body: Record<string, unknown> | null, message: string) {
  logRejected(describeRequest(body), message)
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reject(null, 'Invalid JSON body')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject(null, 'Invalid JSON body')
  }

  const action = body.action

  try {
    if (action === 'stock') {
      const { productId, direction } = body
      if (typeof productId !== 'string' || !productId) {
        return reject(body, 'productId is required')
      }
      if (direction !== 'IN' && direction !== 'OUT') {
        return reject(body, 'direction must be IN or OUT')
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
        return reject(body, 'productId is required')
      }
      if (typeof destWarehouseId !== 'string' || !destWarehouseId) {
        return reject(body, 'destWarehouseId is required')
      }
      if (sourceWarehouseId !== undefined && typeof sourceWarehouseId !== 'string') {
        return reject(body, 'sourceWarehouseId must be a string')
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

    return reject(body, 'Unknown action')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return reject(body, message)
  }
}
