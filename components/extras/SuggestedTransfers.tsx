'use client'

import { useMemo, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import FormMessage from '@/components/FormMessage'
import Icon from '@/components/Icon'
import {
  suggestTransfers,
  type ReorderReason,
  type TransferSuggestion,
} from '@/lib/insights'
import { postItems } from './api'
import { parseQuantityInput } from './quantity'
import type { ExtrasContext } from './types'

const REORDER_REASON_TEXT: Record<ReorderReason, string> = {
  'other-warehouse-low': 'Every other warehouse is also at or below its threshold',
  'no-spare-stock': 'No other warehouse has stock to spare',
  'not-stocked-elsewhere': 'Not stocked in any other warehouse',
}

function suggestionKey(s: TransferSuggestion) {
  return `${s.from.id}->${s.to.id}`
}

export default function SuggestedTransfers({
  products,
  warehouses,
  onResult,
}: ExtrasContext) {
  const { suggestions, reorder } = useMemo(
    () => suggestTransfers(products),
    [products],
  )
  // Edited quantities by suggestion; absent means "use the suggested amount".
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [success, setSuccess] = useState('')

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  async function transfer(s: TransferSuggestion) {
    const key = suggestionKey(s)
    const check = parseQuantityInput(
      quantities[key] ?? String(s.quantity),
      s.from.currentStock,
    )
    setSuccess('')
    if (!check.ok) {
      setErrors((e) => ({ ...e, [key]: check.error }))
      return
    }
    setErrors((e) => ({ ...e, [key]: '' }))
    setPendingKey(key)
    try {
      const result = await postItems({
        action: 'transfer',
        productId: s.from.id,
        sourceWarehouseId: s.from.warehouseId,
        destWarehouseId: s.to.warehouseId,
        quantity: check.quantity,
        reason: 'Rebalancing',
      })
      onResult(result)
      setQuantities((q) => {
        const next = { ...q }
        delete next[key]
        return next
      })
      setSuccess(
        `Moved ${check.quantity} × ${s.productName} to ${warehouseName(s.to.warehouseId)}.`,
      )
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [key]: err instanceof Error ? err.message : 'Something went wrong.',
      }))
    } finally {
      setPendingKey(null)
    }
  }

  if (suggestions.length === 0 && reorder.length === 0) {
    return (
      <>
        <FormMessage error="" success={success} />
        <EmptyState
          title="Nothing needs attention"
          hint="Every product is above its reorder threshold in every warehouse."
        />
      </>
    )
  }

  return (
    <>
      <FormMessage error="" success={success} />

      <h2 className="x-section">
        <span className="dymo">Suggested transfers</span>
      </h2>
      {suggestions.length === 0 ? (
        <p className="x-note">
          No transfers to suggest — no warehouse has stock to spare for a low one.
        </p>
      ) : (
        <div className="x-cards">
          {suggestions.map((s) => {
            const key = suggestionKey(s)
            const text = quantities[key] ?? String(s.quantity)
            const check = parseQuantityInput(text, s.from.currentStock)
            const qty = check.ok ? check.quantity : 0
            const fromName = warehouseName(s.from.warehouseId)
            const toName = warehouseName(s.to.warehouseId)
            const donorGoesLow =
              check.ok && s.from.currentStock - qty <= s.from.reorderThreshold
            const inputId = `x-sq-${key}`
            return (
              <article
                key={key}
                className={`x-card${s.fullyCovers ? '' : ' is-partial'}`}
              >
                <h3 className="x-card-title">{s.productName}</h3>
                <p className="x-route">
                  {fromName}
                  <Icon name="arrow" className="ic ic-sm" />
                  {toName}
                </p>
                <p className="x-note">
                  Suggested {s.quantity}
                  {s.fullyCovers ? '' : ` of ${s.need} needed (partly covers the shortfall)`}
                </p>
                <p className="x-preview tnum">
                  {check.ok
                    ? `${toName}: ${s.to.currentStock} → ${s.to.currentStock + qty} (threshold ${s.to.reorderThreshold}) · ${fromName}: ${s.from.currentStock} → ${s.from.currentStock - qty} (threshold ${s.from.reorderThreshold})`
                    : 'Enter a quantity to preview the result.'}
                </p>
                {donorGoesLow && (
                  <p className="x-warn">
                    <Icon name="alert" className="ic ic-sm" />
                    This would leave {fromName} at or below its reorder threshold.
                  </p>
                )}
                <form
                  className="x-inline"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    void transfer(s)
                  }}
                >
                  <label className="sr-only" htmlFor={inputId}>
                    Quantity of {s.productName} to move
                  </label>
                  <input
                    id={inputId}
                    className="input x-qty"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={text}
                    onChange={(e) =>
                      setQuantities((q) => ({ ...q, [key]: e.target.value }))
                    }
                  />
                  <button
                    type="submit"
                    className="btn btn-ink btn-sm"
                    disabled={pendingKey !== null}
                    aria-busy={pendingKey === key}
                  >
                    {pendingKey === key ? 'Moving…' : 'Transfer'}
                  </button>
                </form>
                <FormMessage error={errors[key] ?? ''} success="" />
              </article>
            )
          })}
        </div>
      )}

      <h2 className="x-section">
        <span className="dymo">Needs reordering</span>
      </h2>
      {reorder.length === 0 ? (
        <p className="x-note">Nothing needs reordering — transfers cover every shortfall.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Needs reordering table">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Warehouse</th>
                <th scope="col" className="num">
                  Stock / threshold
                </th>
                <th scope="col">Why a transfer can&apos;t fix it</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map(({ product, reason }) => (
                <tr key={product.id}>
                  <td>
                    <span className="p-name">{product.name}</span>
                  </td>
                  <td>{warehouseName(product.warehouseId)}</td>
                  <td className="num">
                    <b>{product.currentStock}</b> / {product.reorderThreshold}
                  </td>
                  <td>{REORDER_REASON_TEXT[reason]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
