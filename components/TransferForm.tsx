'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Product, Warehouse } from '@/lib/types'

export default function TransferForm({
  products: initialProducts,
  warehouses,
}: {
  products: Product[]
  warehouses: Warehouse[]
}) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    warehouses[0]?.id ?? '',
  )
  const [destWarehouseId, setDestWarehouseId] = useState(
    warehouses[1]?.id ?? '',
  )

  const sourceProducts = useMemo(
    () => products.filter((p) => p.warehouseId === sourceWarehouseId),
    [products, sourceWarehouseId],
  )
  const [productId, setProductId] = useState(sourceProducts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleSourceChange(id: string) {
    setSourceWarehouseId(id)
    const firstAtSource = products.find((p) => p.warehouseId === id)
    setProductId(firstAtSource?.id ?? '')
    if (id === destWarehouseId) {
      const alt = warehouses.find((w) => w.id !== id)
      if (alt) setDestWarehouseId(alt.id)
    }
  }

  const selectedProduct = products.find((p) => p.id === productId)

  // Mirrors the server-side checks so mistakes are caught before a request;
  // the API re-validates everything and rejects a transfer as a whole.
  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!sourceWarehouseId || !destWarehouseId) {
      setError('Choose both a source and a destination warehouse.')
      return
    }
    if (sourceWarehouseId === destWarehouseId) {
      setError('Source and destination warehouses must be different.')
      return
    }
    if (!selectedProduct || selectedProduct.warehouseId !== sourceWarehouseId) {
      setError('Choose a product to transfer.')
      return
    }
    const parsedQuantity = Number(quantity)
    if (!quantity || !Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a whole number greater than 0.')
      return
    }
    if (parsedQuantity > selectedProduct.currentStock) {
      setError(
        `Only ${selectedProduct.currentStock} in stock at the source warehouse.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          productId,
          sourceWarehouseId,
          destWarehouseId,
          quantity: parsedQuantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      // The server's full list includes both updated rows, plus the
      // destination row if this transfer had to create it.
      setProducts(data.products)
      // Drop Next's client-side cache of already-visited pages, otherwise
      // navigating back to Inventory/History shows pre-transfer stock levels.
      router.refresh()

      const destName =
        warehouses.find((w) => w.id === data.destination.warehouseId)?.name ??
        'the destination warehouse'
      setSuccess(
        `Transferred ${parsedQuantity} unit${parsedQuantity === 1 ? '' : 's'} of ${data.source.name} to ${destName}.`,
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
      <form onSubmit={handleTransfer}>
        <div className="form-field">
          <label htmlFor="source">Source warehouse</label>
          <select
            id="source"
            value={sourceWarehouseId}
            onChange={(e) => handleSourceChange(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="t-product">Product</label>
          <select
            id="t-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={sourceProducts.length === 0}
          >
            {sourceProducts.length === 0 ? (
              <option value="">No products at this warehouse</option>
            ) : (
              sourceProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentStock} on hand)
                </option>
              ))
            )}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="dest">Destination warehouse</label>
          <select
            id="dest"
            value={destWarehouseId}
            onChange={(e) => setDestWarehouseId(e.target.value)}
          >
            {warehouses
              .filter((w) => w.id !== sourceWarehouseId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="t-quantity">Quantity</label>
          <input
            id="t-quantity"
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
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
          >
            Transfer stock
          </button>
        </div>
      </form>
    </div>
  )
}
