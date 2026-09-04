import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <h1 style={{ fontSize: 40, margin: 0 }}>404</h1>
      <p style={{ color: 'var(--text-secondary)' }}>This page doesn't exist.</p>
      <Link to="/" style={{ color: 'var(--gold-dim)', fontWeight: 600 }}>Back to dashboard</Link>
    </div>
  )
}
