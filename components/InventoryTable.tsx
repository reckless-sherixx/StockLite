'use client'

import { useMemo, useState } from 'react'
import {
  Product,
  Warehouse,
  getStockStatus,
  getStockStatusLabel,
  isLowStock,
} from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

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

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const visibleProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory)
        return false
      if (lowStockOnly && !isLowStock(p)) return false
      return true
    })
  }, [products, selectedCategory, lowStockOnly])

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
      <div className="summary-strip">
        <div className="summary-tile">
          <div className="value">{products.length}</div>
          <div className="label">Total SKUs tracked</div>
        </div>
        <div className="summary-tile">
          <div className="value">{warehouses.length}</div>
          <div className="label">Warehouses</div>
        </div>
        <div className="summary-tile">
          <div className="value">{categories.length}</div>
          <div className="label">Categories</div>
        </div>
        <div className="summary-tile">
          <div className="value">
            {products.reduce((sum, p) => sum + p.currentStock, 0)}
          </div>
          <div className="label">Units on hand</div>
        </div>
      </div>

      <section
        className="low-stock-summary"
        aria-label="Products needing replenishment by warehouse"
      >
        {lowStockByWarehouse.map(({ warehouse, total, needing, below, at }) => (
          <div
            key={warehouse.id}
            className={`low-stock-card${needing > 0 ? ' has-low' : ''}`}
          >
            <div className="low-stock-card-head">
              <h3>{warehouse.name}</h3>
              <span>{warehouse.location}</span>
            </div>
            <div className="low-stock-count">
              <span className="value">{needing}</span>
              <span className="label">
                of {total} product{total === 1 ? '' : 's'} need
                {needing === 1 ? 's' : ''} replenishment
              </span>
            </div>
            {needing > 0 ? (
              <div className="low-stock-breakdown">
                {below > 0 && (
                  <StatusBadge
                    status="critical"
                    label={`${below} below threshold`}
                  />
                )}
                {at > 0 && (
                  <StatusBadge status="low" label={`${at} at threshold`} />
                )}
              </div>
            ) : (
              <p className="low-stock-ok">Everything is above its reorder threshold.</p>
            )}
          </div>
        ))}
      </section>

      <div className="filter-bar">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="panel table-panel">
        {visibleProducts.length === 0 ? (
          <div className="empty-state">
            <h3>No products match these filters</h3>
            <p>Try a different category or clear the low stock filter.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Inventory table">
            <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Warehouse</th>
                <th>Current stock</th>
                <th>Reorder threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const status = getStockStatus(product)
                return (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{warehouseName(product.warehouseId)}</td>
                    <td>{product.currentStock}</td>
                    <td>{product.reorderThreshold}</td>
                    <td>
                      <StatusBadge
                        status={status}
                        label={getStockStatusLabel(status)}
                      />
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
