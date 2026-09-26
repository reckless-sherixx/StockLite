import Link from 'next/link'
import Icon from '@/components/Icon'

// Minimal landing page in the new design language. Part B replaces it with
// the reference's exterior (WebGL scene, descent, ENTER).
export default function HomePage() {
  return (
    <div className="interior home-lite">
      <header className="int-bar">
        <Link href="/" className="brand" aria-label="StockLite home">
          <span className="brand-mark">SL</span>
          <span className="brand-text">
            <b>StockLite</b>
            <small>Warehouse Inventory</small>
          </span>
        </Link>
        <span />
        <nav className="bar-right" aria-label="Account">
          <Link href="/login" className="bar-link">
            Sign in
          </Link>
          <Link href="/inventory" className="pill">
            Open dashboard <Icon name="arrow" className="ic ic-sm" strokeWidth={2.6} />
          </Link>
        </nav>
      </header>

      <main className="lobby">
        <h1 className="hero-title">Warehouse stock, tracked the moment it moves.</h1>
        <p className="hero-lede">
          StockLite gives your team one place to see inventory, move stock
          between warehouses, and catch reorder points before shelves run dry.
        </p>
        <div className="actions home-actions">
          <Link href="/archive" className="btn btn-ink">
            Enter <Icon name="arrow" strokeWidth={2.6} />
          </Link>
          <Link href="/inventory" className="btn btn-outline">
            View live inventory
          </Link>
          <Link href="/transfer" className="btn btn-outline">
            Try a transfer
          </Link>
        </div>
      </main>
    </div>
  )
}
