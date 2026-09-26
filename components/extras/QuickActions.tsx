'use client'

import { Fragment, useMemo, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import FormMessage from '@/components/FormMessage'
import ReasonField from '@/components/ReasonField'
import StatusBadge from '@/components/StatusBadge'
import { getStockStatus, type MovementReason, type Product } from '@/lib/types'
import ChipGroup from './ChipGroup'
import { postItems } from './api'
import { parseQuantityInput } from './quantity'
import {
  coverage,
  filterAndSortProducts,
  statusLabelAt,
  stockAfter,
  type QuickAction,
  type SortDir,
  type SortKey,
} from './quick-actions'
import type { ExtrasContext } from './types'

const ACTION_LABELS: Record<QuickAction, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER: 'Transfer',
}

const BUTTON_LABELS: Record<QuickAction, string> = {
  IN: 'In',
  OUT: 'Out',
  TRANSFER: 'Transfer',
}

const COLUMNS: { sortKey: SortKey | null; label: string; num?: boolean }[] = [
  { sortKey: 'name', label: 'Product' },
  { sortKey: 'warehouse', label: 'Warehouse' },
  { sortKey: 'stock', label: 'Stock', num: true },
  { sortKey: 'threshold', label: 'Threshold', num: true },
  { sortKey: 'coverage', label: 'Coverage', num: true },
  { sortKey: null, label: 'Status' },
  { sortKey: null, label: 'Actions' },
]

type OpenAction = { productId: string; action: QuickAction }

export default function QuickActions({
  products,
  warehouses,
  staff,
  onResult,
}: ExtrasContext) {
  const [query, setQuery] = useState('')
  const [warehouseId, setWarehouseId] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('coverage')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [open, setOpen] = useState<OpenAction | null>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<MovementReason | ''>('')
  const [destId, setDestId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState('')

  const rows = useMemo(
    () =>
      filterAndSortProducts(products, warehouses, {
        query,
        warehouseId,
        sortKey,
        sortDir,
      }),
    [products, warehouses, query, warehouseId, sortKey, sortDir],
  )

  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function openAction(product: Product, action: QuickAction) {
    setOpen({ productId: product.id, action })
    setQuantity('')
    setReason('')
    setError('')
    setSuccess('')
    setDestId(warehouses.find((w) => w.id !== product.warehouseId)?.id ?? '')
  }

  async function submit(product: Product, action: QuickAction) {
    const check = parseQuantityInput(
      quantity,
      action === 'IN' ? undefined : product.currentStock,
    )
    if (!check.ok) {
      setError(check.error)
      return
    }
    if (action === 'TRANSFER' && (!destId || destId === product.warehouseId)) {
      setError('Choose a destination warehouse.')
      return
    }
    setError('')
    setPending(true)
    try {
      const reasonValue = reason || undefined
      const result = await postItems(
        action === 'TRANSFER'
          ? {
              action: 'transfer',
              productId: product.id,
              sourceWarehouseId: product.warehouseId,
              destWarehouseId: destId,
              quantity: check.quantity,
              reason: reasonValue,
            }
          : {
              action: 'stock',
              productId: product.id,
              quantity: check.quantity,
              direction: action,
              reason: reasonValue,
            },
      )
      onResult(result)
      setOpen(null)
      setSuccess(
        action === 'TRANSFER'
          ? `Transferred ${check.quantity} × ${product.name} to ${warehouseName(destId)}.`
          : `${ACTION_LABELS[action]}: ${check.quantity} × ${product.name} at ${warehouseName(product.warehouseId)}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  function preview(product: Product, action: QuickAction): string {
    if (!quantity.trim()) return 'Enter a quantity to see the result.'
    const check = parseQuantityInput(
      quantity,
      action === 'IN' ? undefined : product.currentStock,
    )
    if (!check.ok) return check.error
    const after = stockAfter(product, action, check.quantity)
    if (action !== 'TRANSFER') {
      return `After: ${product.currentStock} → ${after} · ${statusLabelAt(product, after)}`
    }
    const dest = products.find(
      (p) => p.name === product.name && p.warehouseId === destId,
    )
    const destBefore = dest?.currentStock ?? 0
    return `${warehouseName(product.warehouseId)}: ${product.currentStock} → ${after} · ${warehouseName(destId)}: ${destBefore} → ${destBefore + check.quantity}${dest ? '' : ' (new row)'}`
  }

  return (
    <>
      <div className="toolbar">
        <div className="x-search">
          <label className="sr-only" htmlFor="x-search">
            Search products
          </label>
          <input
            id="x-search"
            type="search"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or category"
          />
        </div>
        <ChipGroup
          name="x-wh"
          label="Warehouse"
          options={[
            ['all', 'All warehouses'],
            ...warehouses.map((w): [string, string] => [w.id, w.name]),
          ]}
          value={warehouseId}
          onChange={setWarehouseId}
        />
      </div>

      <p className="result-count" aria-live="polite">
        Showing {rows.length} of {products.length} rows
      </p>

      <FormMessage error="" success={success} />

      {rows.length === 0 ? (
        <EmptyState
          title="No products match your search"
          hint="Try a different name, category or warehouse."
        />
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Quick actions table">
          <table className="ledger">
            <thead>
              <tr>
                {COLUMNS.map(({ sortKey: key, label, num }) =>
                  key === null ? (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ) : (
                    <th
                      scope="col"
                      key={label}
                      className={num ? 'num' : undefined}
                      aria-sort={
                        sortKey === key
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        type="button"
                        className={`x-sort${sortKey === key ? ' is-active' : ''}`}
                        onClick={() => toggleSort(key)}
                      >
                        {label}
                        <span aria-hidden="true">
                          {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </span>
                      </button>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const status = getStockStatus(product)
                const cov = coverage(product)
                const openHere = open?.productId === product.id ? open : null
                return (
                  <Fragment key={product.id}>
                    <tr className={openHere ? 'x-row-open' : undefined}>
                      <td>
                        <span className="p-name">{product.name}</span>
                        <span className="tx-meta">{product.category}</span>
                      </td>
                      <td>{warehouseName(product.warehouseId)}</td>
                      <td className="num">
                        <b>{product.currentStock}</b>
                      </td>
                      <td className="num">{product.reorderThreshold}</td>
                      <td className="num">
                        {cov === null ? '—' : `${Math.round(cov * 100)}%`}
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td>
                        <div className="x-row-actions">
                          {(['IN', 'OUT', 'TRANSFER'] as const).map((action) => {
                            const active = openHere?.action === action
                            return (
                              <button
                                key={action}
                                type="button"
                                className={`btn btn-sm ${active ? 'btn-ink' : 'btn-outline'}`}
                                aria-expanded={active}
                                disabled={
                                  pending ||
                                  (action !== 'IN' && product.currentStock === 0)
                                }
                                onClick={() =>
                                  active ? setOpen(null) : openAction(product, action)
                                }
                              >
                                {BUTTON_LABELS[action]}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                    {openHere && (
                      <tr className="x-panel-row">
                        <td colSpan={COLUMNS.length}>
                          <form
                            className="x-panel"
                            noValidate
                            onSubmit={(e) => {
                              e.preventDefault()
                              void submit(product, openHere.action)
                            }}
                          >
                            <p className="x-panel-title">
                              <span className="dymo">{ACTION_LABELS[openHere.action]}</span>
                              <span>
                                {product.name} @ {warehouseName(product.warehouseId)}
                              </span>
                            </p>
                            <div className="x-panel-fields">
                              <div className="field">
                                <label htmlFor="x-qa-quantity">Quantity</label>
                                <input
                                  id="x-qa-quantity"
                                  className="input"
                                  type="number"
                                  min={1}
                                  step={1}
                                  inputMode="numeric"
                                  autoFocus
                                  value={quantity}
                                  onChange={(e) => setQuantity(e.target.value)}
                                />
                              </div>
                              {openHere.action === 'TRANSFER' && (
                                <div className="field">
                                  <label htmlFor="x-qa-dest">To warehouse</label>
                                  <select
                                    id="x-qa-dest"
                                    className="select"
                                    value={destId}
                                    onChange={(e) => setDestId(e.target.value)}
                                  >
                                    {warehouses
                                      .filter((w) => w.id !== product.warehouseId)
                                      .map((w) => (
                                        <option key={w.id} value={w.id}>
                                          {w.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                              <ReasonField
                                id="x-qa-reason"
                                value={reason}
                                onChange={setReason}
                              />
                            </div>
                            <p className="x-preview tnum">
                              {preview(product, openHere.action)}
                            </p>
                            <p className="x-note">Recording as {staff.name}</p>
                            <FormMessage error={error} success="" />
                            <div className="actions">
                              <button
                                type="submit"
                                className="btn btn-ink btn-sm"
                                disabled={pending}
                                aria-busy={pending}
                              >
                                {pending ? 'Saving…' : ACTION_LABELS[openHere.action]}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                disabled={pending}
                                onClick={() => setOpen(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
