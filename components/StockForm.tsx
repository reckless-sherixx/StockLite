'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product } from '@/lib/types'

export default function StockForm({
  products: initialProducts,
}: {
  products: Product[]
}) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [productId, setProductId] = useState(initialProducts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)

  async function submitMovement(direction: 'IN' | 'OUT') {
    setError('')
    setSuccess('')

    if (!selectedProduct) {
      setError('Choose a product.')
      return
    }
    const parsedQuantity = Number(quantity)
    if (!quantity || !Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a whole number greater than 0.')
      return
    }
    if (
      direction === 'OUT' &&
      selectedProduct &&
      parsedQuantity > selectedProduct.currentStock
    ) {
      setError(
        `Only ${selectedProduct.currentStock} in stock — cannot stock out more than that.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          productId,
          quantity: parsedQuantity,
          direction,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      // Take the server's full list so every row (not just this one) is current.
      setProducts(data.products)
      // Drop Next's client-side cache of already-visited pages, otherwise
      // navigating back to Inventory/History shows pre-change stock levels.
      router.refresh()
      setSuccess(
        `${direction === 'IN' ? 'Stocked in' : 'Stocked out'} ${parsedQuantity} unit${parsedQuantity === 1 ? '' : 's'} of ${data.product.name}.`,
      )
      setQuantity('')
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="panel form-panel">
      {/* Stock in/out are explicit button choices, so Enter must not submit
          (and reload) the form. */}
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="form-field">
          <label htmlFor="product">Product</label>
          <select
            id="product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.warehouseId} ({p.currentStock} on hand)
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            min={1}
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <div className="form-error">{error}</div>
        {!error && success && (
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--moss-dark)',
              margin: '-10px 0 12px',
            }}
          >
            {success}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={submitting}
            onClick={() => submitMovement('IN')}
          >
            Stock in
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={submitting}
            onClick={() => submitMovement('OUT')}
          >
            Stock out
          </button>
        </div>
      </form>
    </div>
  )
}
