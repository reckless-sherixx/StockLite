'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import Icon, { type IconName } from '@/components/Icon'
import LocalTime from '@/components/LocalTime'
import { useRowSwap } from '@/components/useRowSwap'
import { Transaction, TransactionType } from '@/lib/types'

const TYPE_LABELS: Record<TransactionType, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}

const TYPE_ICON: Record<TransactionType, IconName> = {
  IN: 'in',
  OUT: 'out',
  TRANSFER_OUT: 'tout',
  TRANSFER_IN: 'tin',
}

type Filters = { type: string; warehouse: string }

function applyFilters(transactions: Transaction[], filters: Filters) {
  return transactions
    .filter((t) => filters.type === 'all' || t.type === filters.type)
    .filter((t) => filters.warehouse === 'all' || t.warehouseName === filters.warehouse)
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
}

function ChipGroup({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string
  label: string
  options: [string, string][]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <fieldset className="filter-group">
      <legend className="filter-label">{label}</legend>
      <div className="chips">
        {options.map(([v, text]) => (
          <label className="chip" key={v}>
            <input
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function TransactionTable({
  transactions,
}: {
  transactions: Transaction[]
}) {
  const warehouseOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.warehouseName))).sort(),
    [transactions],
  )

  // Looked up across all transactions (not just the filtered ones) so a
  // transfer row can still name its counterpart warehouse when filtered.
  const byId = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  )

  const [filters, setFilters] = useState<Filters>({ type: 'all', warehouse: 'all' })
  const panelRef = useRef<HTMLDivElement>(null)
  const shown = useRowSwap(
    filters,
    JSON.stringify([filters.type, filters.warehouse]),
    panelRef,
    { out: 0, in: 0.03 },
  )
  const matchCount = useMemo(
    () => applyFilters(transactions, filters).length,
    [transactions, filters],
  )
  const visibleTransactions = useMemo(
    () => applyFilters(transactions, shown.value),
    [transactions, shown.value],
  )

  return (
    <>
      <div className="history-filters">
        <ChipGroup
          name="h-type"
          label="Type"
          options={[
            ['all', 'All types'],
            ...(Object.entries(TYPE_LABELS) as [string, string][]),
          ]}
          value={filters.type}
          onChange={(type) => setFilters((f) => ({ ...f, type }))}
        />
        <ChipGroup
          name="h-wh"
          label="Warehouse"
          options={[
            ['all', 'All warehouses'],
            ...warehouseOptions.map((w): [string, string] => [w, w]),
          ]}
          value={filters.warehouse}
          onChange={(warehouse) => setFilters((f) => ({ ...f, warehouse }))}
        />
      </div>

      <p className="result-count" aria-live="polite">
        Showing {matchCount} of {transactions.length} entries
      </p>

      <div ref={panelRef}>
        <Fragment key={shown.key}>
          {visibleTransactions.length === 0 ? (
            <EmptyState
              title="No transactions match these filters"
              hint="Try a different type or warehouse."
            />
          ) : (
            <div
              className="table-scroll"
              tabIndex={0}
              aria-label="Transaction history table"
            >
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Warehouse</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Quantity
                    </th>
                    <th scope="col">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((t) => {
                    const linked = t.linkedTransactionId
                      ? byId.get(t.linkedTransactionId)
                      : undefined
                    const meta = [t.reason, t.staffName && `by ${t.staffName}`]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <tr key={t.id}>
                        <td>
                          <span className="p-name">{t.productName}</span>
                          {linked && (
                            <span className="linked">
                              <Icon name="link" className="ic ic-xs" />
                              {t.type === 'TRANSFER_OUT' ? 'to' : 'from'}{' '}
                              {linked.warehouseName}
                            </span>
                          )}
                          {meta && <span className="tx-meta">{meta}</span>}
                        </td>
                        <td>{t.warehouseName}</td>
                        <td>
                          <span
                            className={`tx-type tx-type--${t.type === 'OUT' ? 'out' : t.type}`}
                          >
                            <Icon name={TYPE_ICON[t.type] ?? 'history'} />
                            {TYPE_LABELS[t.type] ?? t.type}
                          </span>
                        </td>
                        <td className="num">
                          <b>{t.quantity}</b>
                        </td>
                        <td className="tnum">
                          <LocalTime iso={t.timestamp} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Fragment>
      </div>
    </>
  )
}
