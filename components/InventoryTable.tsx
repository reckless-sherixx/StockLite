'use client'

import { Fragment, useMemo, useRef, useState, type CSSProperties } from 'react'
import EmptyState from '@/components/EmptyState'
import Icon from '@/components/Icon'
import StatusBadge from '@/components/StatusBadge'
import { fmt } from '@/components/format'
import { useRowSwap } from '@/components/useRowSwap'
import { Product, Warehouse, getStockStatus, isLowStock } from '@/lib/types'

type Filters = { category: string; lowStockOnly: boolean }

function applyFilters(products: Product[], filters: Filters) {
  return products.filter((p) => {
    if (filters.category !== 'all' && p.category !== filters.category)
      return false
    if (filters.lowStockOnly && !isLowStock(p)) return false
    return true
  })
}

export default function InventoryTable({
  products,
  warehouses,
}: {
  products: Product[]
  warehouses: Warehouse[]
}) {
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  )
  const warehouseName = (id: string) =>
    warehouses.find((w) => w.id === id)?.name ?? id

  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    lowStockOnly: false,
  })
  const panelRef = useRef<HTMLDivElement>(null)
  // The count updates at once; the rows follow after the fade-out.
  const shown = useRowSwap(
    filters,
    JSON.stringify([filters.category, filters.lowStockOnly]),
    panelRef,
    { out: 0.004, in: 0.022 },
  )
  const matchCount = useMemo(
    () => applyFilters(products, filters).length,
    [products, filters],
  )
  const visibleProducts = useMemo(
    () => applyFilters(products, shown.value),
    [products, shown.value],
  )

  const lowStockByWarehouse = useMemo(
    () =>
      warehouses.map((w) => {
        const atWarehouse = products.filter((p) => p.warehouseId === w.id)
        const statuses = atWarehouse.filter(isLowStock).map(getStockStatus)
        return {
          warehouse: w,
          total: atWarehouse.length,
          needing: statuses.length,
          below: statuses.filter((s) => s === 'critical').length,
          at: statuses.filter((s) => s === 'low').length,
        }
      }),
    [products, warehouses],
  )

  return (
    <>
      <dl className="ledger-band">
        <div>
          <dt>Total SKUs tracked</dt>
          <dd>{fmt(products.length)}</dd>
        </div>
        <div>
          <dt>Warehouses</dt>
          <dd>{fmt(warehouses.length)}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{fmt(categories.length)}</dd>
        </div>
        <div>
          <dt>Units on hand</dt>
          <dd>{fmt(products.reduce((sum, p) => sum + p.currentStock, 0))}</dd>
        </div>
      </dl>

      <section
        className="replenish"
        aria-label="Products needing replenishment by warehouse"
      >
        {lowStockByWarehouse.map(({ warehouse, total, needing, below, at }) => (
          <article
            key={warehouse.id}
            className={`replenish-card${needing > 0 ? ' has-low' : ''}`}
          >
            <h2 className="replenish-name">
              <span className="dymo">{warehouse.name}</span>
            </h2>
            <p className="replenish-loc">{warehouse.location}</p>
            <p className="replenish-big">
              {fmt(needing)}
              <span>
                of {fmt(total)} product{total === 1 ? '' : 's'}
              </span>
            </p>
            <p className="replenish-sub">
              need{needing === 1 ? 's' : ''} replenishment
            </p>
            {needing > 0 ? (
              <ul className="replenish-list">
                {below > 0 && (
                  <li>
                    <StatusBadge status="critical" label={`${below} below threshold`} />
                  </li>
                )}
                {at > 0 && (
                  <li>
                    <StatusBadge status="low" label={`${at} at threshold`} />
                  </li>
                )}
              </ul>
            ) : (
              <p className="replenish-ok">
                <Icon name="check" />
                Everything is above its reorder threshold.
              </p>
            )}
          </article>
        ))}
      </section>

      <div className="toolbar">
        <fieldset className="filter-group">
          <legend className="sr-only">Filter by category</legend>
          <div className="chips">
            {['all', ...categories].map((c) => (
              <label className="chip" key={c}>
                <input
                  type="radio"
                  name="inv-cat"
                  value={c}
                  checked={filters.category === c}
                  onChange={() => setFilters((f) => ({ ...f, category: c }))}
                />
                <span>{c === 'all' ? 'All categories' : c}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="switch">
          <input
            type="checkbox"
            id="inv-low"
            role="switch"
            checked={filters.lowStockOnly}
            onChange={(e) => {
              const lowStockOnly = e.target.checked
              setFilters((f) => ({ ...f, lowStockOnly }))
            }}
          />
          <span className="switch-ui" aria-hidden="true" />
          Low stock only
        </label>
      </div>

      <p className="result-count" aria-live="polite">
        Showing {matchCount} of {products.length} products
      </p>

      <div ref={panelRef}>
        <Fragment key={shown.key}>
          {visibleProducts.length === 0 ? (
            <EmptyState
              title="No products match these filters"
              hint="Try a different category or clear the low stock filter."
            />
          ) : (
            <div className="table-scroll" tabIndex={0} aria-label="Inventory table">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Warehouse</th>
                    <th scope="col" className="num">
                      Current stock
                    </th>
                    <th scope="col" className="num">
                      Reorder threshold
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => {
                    const status = getStockStatus(product)
                    const fill = Math.min(
                      1,
                      Math.max(
                        0,
                        product.currentStock /
                          Math.max(product.reorderThreshold * 2, 1),
                      ),
                    )
                    return (
                      <tr key={product.id}>
                        <td>
                          <span className="p-name">{product.name}</span>
                        </td>
                        <td>{product.category}</td>
                        <td>{warehouseName(product.warehouseId)}</td>
                        <td className="num">
                          <span className="stock-cell">
                            <b>{product.currentStock}</b>
                            <span
                              className={`meter meter--${status}`}
                              style={{ '--v': fill } as CSSProperties}
                              aria-hidden="true"
                            >
                              <i />
                            </span>
                          </span>
                        </td>
                        <td className="num">{product.reorderThreshold}</td>
                        <td>
                          <StatusBadge status={status} />
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
