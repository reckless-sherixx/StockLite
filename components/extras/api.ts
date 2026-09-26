import type { MovementReason, Product, Transaction } from '@/lib/types'

export type ItemsRequest =
  | {
      action: 'stock'
      productId: string
      quantity: number
      direction: 'IN' | 'OUT'
      reason?: MovementReason
    }
  | {
      action: 'transfer'
      productId: string
      sourceWarehouseId: string
      destWarehouseId: string
      quantity: number
      reason?: MovementReason
    }

export type ItemsResult = { products: Product[]; recorded: Transaction[] }

// Posts a stock movement or transfer. Resolves with the full product list and
// the transactions it recorded; throws an Error carrying the server's message.
export async function postItems(request: ItemsRequest): Promise<ItemsResult> {
  let res: Response
  try {
    res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
  return { products: data.products, recorded: data.recorded }
}
