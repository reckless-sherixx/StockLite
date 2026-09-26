import { afterEach, describe, expect, it, vi } from 'vitest'
import { postItems } from './api'

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('postItems', () => {
  it('posts JSON and returns products and recorded transactions', async () => {
    const fetchMock = respond(200, { products: [{ id: 'p-1' }], recorded: [{ id: 't-9' }], product: {} })
    vi.stubGlobal('fetch', fetchMock)
    const result = await postItems({
      action: 'stock',
      productId: 'p-1',
      quantity: 3,
      direction: 'IN',
      reason: 'Restock',
    })
    expect(result).toEqual({ products: [{ id: 'p-1' }], recorded: [{ id: 't-9' }] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/items')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      action: 'stock',
      productId: 'p-1',
      quantity: 3,
      direction: 'IN',
      reason: 'Restock',
    })
  })

  it("throws the server's error message on a failed request", async () => {
    vi.stubGlobal('fetch', respond(400, { error: 'Cannot stock out 9 — only 3 in stock' }))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 9, direction: 'OUT' }),
    ).rejects.toThrow('Cannot stock out 9 — only 3 in stock')
  })

  it('throws a generic message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 1, direction: 'IN' }),
    ).rejects.toThrow('Something went wrong.')
  })

  it('throws a connection message when the request never reaches the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      postItems({ action: 'stock', productId: 'p-1', quantity: 1, direction: 'IN' }),
    ).rejects.toThrow('Could not reach the server. Please try again.')
  })
})
