import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { BG, SURFACE, BORDER, TEXT, MUTED, GOLD } from '../theme'

export default function Layout() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = search.trim().toUpperCase()
    if (code) {
      navigate(`/area/${code}`)
      setSearch('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          background: SURFACE,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}
          onClick={() => navigate('/')}
        >
          <span style={{ fontSize: '1.25rem' }}>🏠</span>
          <h1 style={{ fontSize: '1.2rem', color: TEXT, fontWeight: 400 }}>
            UK Housing Data Pipeline
          </h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Postcode area (BS, M, SW…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              background: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: TEXT,
              fontFamily: 'DM Sans',
              fontSize: '0.85rem',
              width: 200,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.4rem 1rem',
              background: GOLD,
              color: BG,
              border: 'none',
              borderRadius: 6,
              fontFamily: 'DM Sans',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Go
          </button>
        </form>
      </header>

      {/* Page content */}
      <Outlet />

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '1rem',
          color: MUTED,
          fontSize: '0.7rem',
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        Source: HM Land Registry Price Paid Data · ONS Open Geography Portal · Not financial advice
      </footer>
    </div>
  )
}
