import type { Metadata } from 'next'
import Link from 'next/link'
import Icon from '@/components/Icon'
import InteriorLink from '@/components/InteriorLink'
import { LOGIN } from '@/components/sections'

export const metadata: Metadata = { title: LOGIN.title }

// Stubbed sign-in: a staff badge on a lanyard; "Continue" just goes in.
export default function LoginPage() {
  return (
    <div className="badge-wrap">
      <div className="badge-hang">
        <span className="lanyard" aria-hidden="true" />
        <section className="badge" aria-labelledby="login-title">
          <div className="badge-top">
            <span className="badge-slot" aria-hidden="true" />
            <span className="brand-mark">SL</span>
            <span className="badge-kind">Staff</span>
          </div>
          <div className="badge-body">
            <Link href="/" className="back-link">
              <Icon name="back" className="ic ic-sm" />
              Back to home
            </Link>
            <h1 id="login-title" className="badge-title" tabIndex={-1}>
              StockLite
            </h1>
            <p className="badge-sub">
              Sign in with your staff account to manage warehouse inventory.
            </p>
            <div className="field">
              <label htmlFor="staff-id">Staff ID</label>
              <input
                id="staff-id"
                className="input"
                type="text"
                placeholder="e.g. staff-01"
                defaultValue="staff-01"
              />
            </div>
            <div className="field">
              <label htmlFor="pin">PIN</label>
              <input
                id="pin"
                className="input"
                type="text"
                placeholder="••••"
                defaultValue="••••"
              />
            </div>
            <InteriorLink href="/inventory" className="btn btn-ink btn-block">
              Continue as staff
            </InteriorLink>
            <p className="badge-note">
              Auth is stubbed for this exercise — this just takes you into the
              app.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
