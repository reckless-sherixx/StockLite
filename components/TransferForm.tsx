'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FormMessage from '@/components/FormMessage'
import Icon from '@/components/Icon'
import ReasonField from '@/components/ReasonField'
import Stamp from '@/components/Stamp'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { MovementReason, Product, Warehouse } from '@/lib/types'

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
  const [reason, setReason] = useState<MovementReason | ''>('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shipment, setShipment] = useState(0) // bumps to send boxes down the route
  const boxesRef = useRef<HTMLSpanElement>(null)

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
    setShipment(0)

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
          ...(reason ? { reason } : {}),
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
      setReason('')
      setShipment((n) => n + 1)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // The reference's shipping animation: five boxes run the route line
  // (downwards when the route stacks vertically on narrow screens).
  useLayoutEffect(() => {
    const boxes = boxesRef.current
    const track = boxes?.parentElement
    if (!shipment || !boxes || !track || prefersReducedMotion()) return
    const vertical = track.offsetHeight > track.offsetWidth
    const dist = vertical ? track.offsetHeight - 14 : track.offsetWidth - 22
    const axis = vertical ? 'y' : 'x'
    const ctx = gsap.context(() => {
      Array.from(boxes.children).forEach((box, i) => {
        if (vertical) gsap.set(box, { left: '50%', xPercent: -50, top: 0, marginTop: 0 })
        gsap.fromTo(
          box,
          { autoAlpha: 0, [axis]: 0 },
          { keyframes: { autoAlpha: [0, 1, 1, 0] }, [axis]: dist, duration: 1.05, delay: i * 0.12, ease: 'power2.inOut' },
        )
      })
    })
    return () => ctx.revert()
  }, [shipment])

  return (
    <form className="docket" autoComplete="off" onSubmit={handleTransfer}>
      <div className="route">
        <fieldset className="route-end">
          <legend className="field-legend">Source warehouse</legend>
          <div className="wh-cards">
            {warehouses.map((w) => (
              <label className="wh-card" key={w.id}>
                <input
                  type="radio"
                  name="source"
                  value={w.id}
                  checked={w.id === sourceWarehouseId}
                  onChange={() => handleSourceChange(w.id)}
                />
                <span className="wh-name">{w.name}</span>
                <span className="wh-loc">{w.location}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="route-line" aria-hidden="true">
          <span className="rl-track" />
          <span className="rl-head">
            <Icon name="arrow" strokeWidth={2.6} />
          </span>
          <span className="rl-boxes" ref={boxesRef}>
            {shipment > 0 &&
              [0, 1, 2, 3, 4].map((i) => <i key={`${shipment}-${i}`} />)}
          </span>
        </div>
        <fieldset className="route-end">
          <legend className="field-legend">Destination warehouse</legend>
          <div className="wh-cards">
            {warehouses
              .filter((w) => w.id !== sourceWarehouseId)
              .map((w) => (
                <label className="wh-card" key={w.id}>
                  <input
                    type="radio"
                    name="dest"
                    value={w.id}
                    checked={w.id === destWarehouseId}
                    onChange={() => setDestWarehouseId(w.id)}
                  />
                  <span className="wh-name">{w.name}</span>
                  <span className="wh-loc">{w.location}</span>
                </label>
              ))}
          </div>
        </fieldset>
      </div>

      <div className="docket-fields">
        <div className="field">
          <label htmlFor="t-product">Product</label>
          <select
            id="t-product"
            className="select"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={sourceProducts.length === 0}
          >
            {sourceProducts.length === 0 ? (
              <option value="">No products at this warehouse</option>
            ) : (
              sourceProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.name} (${p.currentStock} on hand)`}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-quantity">Quantity</label>
          <input
            id="t-quantity"
            className="input qty"
            type="number"
            min={1}
            placeholder="0"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <ReasonField id="t-reason" value={reason} onChange={setReason} />
      </div>

      <FormMessage error={error} success={success} />

      <div className="actions">
        <button
          className="btn btn-ink btn-wide"
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
        >
          <Icon name="transfer" />
          <span>Transfer stock</span>
        </button>
      </div>
      <span className="stamp-slot">
        {shipment > 0 && <Stamp key={shipment} text="Transferred" />}
      </span>
    </form>
  )
}
