import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <Link
          href="/"
          className="back-link"
          style={{ display: 'inline-block', marginBottom: 18 }}
        >
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>StockLite</h1>
        <p style={{ color: 'var(--steel)', fontSize: 13.5, marginBottom: 22 }}>
          Sign in with your staff account to manage warehouse inventory.
        </p>

        <div className="form-field">
          <label htmlFor="staff-id">Staff ID</label>
          <input
            id="staff-id"
            type="text"
            placeholder="e.g. staff-01"
            defaultValue="staff-01"
          />
        </div>

        <div className="form-field">
          <label htmlFor="pin">PIN</label>
          <input id="pin" type="text" placeholder="••••" defaultValue="••••" />
        </div>

        <Link
          href="/inventory"
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          Continue as staff
        </Link>
        <p style={{ fontSize: 12, color: 'var(--steel)', marginTop: 14 }}>
          Auth is stubbed for this exercise — this just takes you into the app.
        </p>
      </div>
    </div>
  )
}
