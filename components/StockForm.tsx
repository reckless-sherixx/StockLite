'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CountUp, { type CountStart } from '@/components/CountUp'
import FormMessage from '@/components/FormMessage'
import Icon from '@/components/Icon'
import ReasonField from '@/components/ReasonField'
import Stamp from '@/components/Stamp'
import StatusBadge from '@/components/StatusBadge'
import { fmt } from '@/components/format'
import {
  MovementReason,
  Product,
  Warehouse,
  getStockStatus,
} from '@/lib/types'

type Direction = 'IN' | 'OUT'

export default function StockForm({
  products: initialProducts,
  warehouses,
}: {
  products: Product[]
  warehouses: Warehouse[]
}) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [productId, setProductId] = useState(initialProducts[0]?.id ?? '')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<MovementReason | ''>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState<Direction | null>(null)
  const [stamp, setStamp] = useState<{ id: number; text: string } | null>(null)
  const [countStart, setCountStart] = useState<CountStart | null>(null)
  const seq = useRef(0)

  const selectedProduct = products.find((p) => p.id === productId)
  const warehouseOf = (id: string) => warehouses.find((w) => w.id === id)
  const selectedWarehouse = selectedProduct
    ? warehouseOf(selectedProduct.warehouseId)
    : undefined

  async function submitMovement(direction: Direction) {
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
    if (direction === 'OUT' && parsedQuantity > selectedProduct.currentStock) {
      setError(
        `Only ${selectedProduct.currentStock} in stock — cannot stock out more than that.`,
      )
      return
    }

    setSubmitting(direction)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock',
          productId,
          quantity: parsedQuantity,
          direction,
          ...(reason ? { reason } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      const before = products.find((p) => p.id === data.product.id)?.currentStock
      // Take the server's full list so every row (not just this one) is current.
      setProducts(data.products)
      // Drop Next's client-side cache of already-visited pages, otherwise
      // navigating back to Inventory/History shows pre-change stock levels.
      router.refresh()
      setSuccess(
        `${direction === 'IN' ? 'Stocked in' : 'Stocked out'} ${parsedQuantity} unit${parsedQuantity === 1 ? '' : 's'} of ${data.product.name}.`,
      )
      setQuantity('')
      setReason('')
      seq.current += 1
      if (before !== undefined) setCountStart({ id: seq.current, from: before })
      setStamp({
        id: seq.current,
        text: direction === 'IN' ? 'Stocked in' : 'Stocked out',
      })
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="slip-grid">
      {/* Stock in/out are explicit button choices, so Enter must not submit
          (and reload) the form. */}
      <form className="slip" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="product">Product</label>
          <select
            id="product"
            className="select"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              setStamp(null)
              setCountStart(null)
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.name} — ${warehouseOf(p.warehouseId)?.name ?? p.warehouseId} (${p.currentStock} on hand)`}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            className="input qty"
            type="number"
            min={1}
            placeholder="0"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>

        <ReasonField id="reason" value={reason} onChange={setReason} />

        <FormMessage error={error} success={success} />

        <div className="actions">
          <button
            type="button"
            className="btn btn-ink"
            disabled={submitting !== null}
            aria-busy={submitting === 'IN' || undefined}
            onClick={() => submitMovement('IN')}
          >
            <Icon name="in" />
            <span>Stock in</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={submitting !== null}
            aria-busy={submitting === 'OUT' || undefined}
            onClick={() => submitMovement('OUT')}
          >
            <Icon name="out" />
            <span>Stock out</span>
          </button>
        </div>
      </form>

      <aside className="readout" aria-label="Selected product">
        <span className="dymo">On hand</span>
        <span className="stamp-slot">
          {stamp && <Stamp key={stamp.id} text={stamp.text} />}
        </span>
        {selectedProduct && (
          <>
            <p className="ro-name">{selectedProduct.name}</p>
            <p className="ro-wh">
              {selectedWarehouse
                ? `${selectedWarehouse.name} · ${selectedWarehouse.location}`
                : selectedProduct.warehouseId}
            </p>
            <p className="ro-big">
              <CountUp
                key={selectedProduct.id}
                value={selectedProduct.currentStock}
                start={countStart}
              />
              <small>units</small>
            </p>
            <dl className="ro-meta">
              <div>
                <dt>Reorder threshold</dt>
                <dd>{fmt(selectedProduct.reorderThreshold)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={getStockStatus(selectedProduct)} />
                </dd>
              </div>
            </dl>
          </>
        )}
      </aside>
    </div>
  )
}
