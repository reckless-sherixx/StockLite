'use client'

import { useEffect, useMemo, useState } from 'react'
import { Transaction } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  TRANSFER_OUT: 'Transfer out',
  TRANSFER_IN: 'Transfer in',
}

// Locale-independent, e.g. "2026-09-17 11:20 UTC".
function formatUtc(iso: string) {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`
}

export default function TransactionTable({
  transactions,
}: {
  transactions: Transaction[]
}) {
  // The server and the browser can differ in locale and time zone, so
  // rendering toLocaleString() on both breaks hydration. Render a fixed UTC
  // string first, then switch to the viewer's local time once mounted.
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => setIsMounted(true), [])

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

  const [typeFilter, setTypeFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  const visibleTransactions = useMemo(() => {
    return transactions
      .filter((t) => typeFilter === 'all' || t.type === typeFilter)
      .filter(
        (t) => warehouseFilter === 'all' || t.warehouseName === warehouseFilter,
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
  }, [transactions, typeFilter, warehouseFilter])

  return (
    <>
      <div className="filter-bar">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="IN">Stock in</option>
          <option value="OUT">Stock out</option>
          <option value="TRANSFER_OUT">Transfer out</option>
          <option value="TRANSFER_IN">Transfer in</option>
        </select>

        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          aria-label="Filter by warehouse"
        >
          <option value="all">All warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div className="panel table-panel">
        {visibleTransactions.length === 0 ? (
          <div className="empty-state">
            <h3>No transactions match these filters</h3>
            <p>Try a different type or warehouse.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Transaction history table">
            <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Warehouse</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((t) => {
                const linked = t.linkedTransactionId
                  ? byId.get(t.linkedTransactionId)
                  : undefined
                return (
                  <tr key={t.id}>
                    <td>{t.productName}</td>
                    <td>{t.warehouseName}</td>
                    <td>
                      {TYPE_LABELS[t.type] ?? t.type}
                      {linked && (
                        <span className="linked-transfer">
                          {t.type === 'TRANSFER_OUT' ? 'to' : 'from'}{' '}
                          {linked.warehouseName}
                        </span>
                      )}
                    </td>
                    <td>{t.quantity}</td>
                    <td>
                      <time dateTime={t.timestamp}>
                        {isMounted
                          ? new Date(t.timestamp).toLocaleString()
                          : formatUtc(t.timestamp)}
                      </time>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
