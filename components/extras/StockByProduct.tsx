'use client'

import { useMemo, useState } from 'react'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import { summarizeByProduct } from '@/lib/insights'
import { getStockStatus } from '@/lib/types'
import type { ExtrasContext } from './types'

export default function StockByProduct({ products, warehouses }: ExtrasContext) {
  const [attentionOnly, setAttentionOnly] = useState(false)
  const summary = useMemo(
    () => summarizeByProduct(products, warehouses),
    [products, warehouses],
  )
  const needing = summary.rows.filter((r) => r.needsAttention).length
  const rows = attentionOnly
    ? summary.rows.filter((r) => r.needsAttention)
    : summary.rows

  return (
    <>
      <div className="toolbar">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={attentionOnly}
            onChange={(e) => setAttentionOnly(e.target.checked)}
          />
          <span className="switch-ui" aria-hidden="true" />
          Only products needing attention
        </label>
      </div>

      <p className="result-count" aria-live="polite">
        {needing} of {summary.rows.length} products need attention
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          hint="Every product is above its reorder threshold in every warehouse."
        />
      ) : (
        <div className="table-scroll" tabIndex={0} aria-label="Stock by product table">
          <table className="ledger">
            <thead>
              <tr>
                <th scope="col">Product</th>
                {warehouses.map((w) => (
                  <th scope="col" key={w.id}>
                    {w.name}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>
                    <span className="p-name">{row.name}</span>
                    <span className="tx-meta">{row.category}</span>
                  </td>
                  {warehouses.map((w) => {
                    const p = row.cells[w.id]
                    if (!p) {
                      return (
                        <td key={w.id} className="x-muted">
                          Not stocked
                        </td>
                      )
                    }
                    return (
                      <td key={w.id}>
                        <span className="x-cell">
                          <span className="tnum">
                            <b>{p.currentStock}</b>
                            <span className="x-muted"> / {p.reorderThreshold}</span>
                          </span>
                          <StatusBadge status={getStockStatus(p)} />
                        </span>
                      </td>
                    )
                  })}
                  <td className="num">
                    <b>{row.total}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>All products</td>
                {warehouses.map((w) => (
                  <td key={w.id} className="tnum">
                    {summary.totalsByWarehouse[w.id] ?? 0}
                  </td>
                ))}
                <td className="num">{summary.grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
