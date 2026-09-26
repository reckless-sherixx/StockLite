'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product, StaffUser, Transaction, Warehouse } from '@/lib/types'
import ActivityLog from './ActivityLog'
import QuickActions from './QuickActions'
import StockByProduct from './StockByProduct'
import SuggestedTransfers from './SuggestedTransfers'
import type { ItemsResult } from './api'
import { EXTRAS_TABS, type ExtrasTabId } from './tabs'
import type { ExtrasContext } from './types'

export default function ExtrasWorkspace({
  products: initialProducts,
  warehouses,
  transactions: initialTransactions,
  staff,
  initialTab,
}: {
  products: Product[]
  warehouses: Warehouse[]
  transactions: Transaction[]
  staff: StaffUser
  initialTab: ExtrasTabId
}) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [tab, setTab] = useState<ExtrasTabId>(initialTab)

  const onResult = useCallback(
    (result: ItemsResult) => {
      setProducts(result.products)
      setTransactions((prev) => [...prev, ...result.recorded])
      // Drop Next's client-side cache so other pages and the drawer counts
      // show the new levels.
      router.refresh()
    },
    [router],
  )

  function selectTab(id: ExtrasTabId) {
    setTab(id)
    // Keep the tab in the URL (shareable, survives reload) without a
    // server round trip.
    window.history.replaceState(null, '', `?tab=${id}`)
  }

  const context: ExtrasContext = {
    products,
    warehouses,
    transactions,
    staff,
    onResult,
  }

  return (
    <>
      <div className="x-tabs" role="tablist" aria-label="Extra features">
        {EXTRAS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`extras-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`extras-panel-${t.id}`}
            className="x-tab"
            onClick={() => selectTab(t.id)}
          >
            <span className={tab === t.id ? 'dymo' : 'dymo dymo--ok'}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`extras-panel-${tab}`}
        aria-labelledby={`extras-tab-${tab}`}
      >
        {tab === 'stock-by-product' && <StockByProduct {...context} />}
        {tab === 'suggested-transfers' && <SuggestedTransfers {...context} />}
        {tab === 'quick-actions' && <QuickActions {...context} />}
        {tab === 'activity' && <ActivityLog {...context} />}
      </div>
    </>
  )
}
