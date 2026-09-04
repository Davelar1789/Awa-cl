import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'
import s from './Auth.module.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(phone.trim(), password)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.logo}>
          <span className={s.logoMark}>A</span>
          <div>
            <span className={s.logoText}>AwaBus</span>
            <span className={s.logoSub}>Admin Portal</span>
          </div>
        </div>

        <h1 className={s.heading}>Sign in</h1>
        <p className={s.subheading}>Admins and drivers only. Parents connect via the AwaBus phone line.</p>

        {error && <div className={s.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <Input
            label="Phone number"
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+233201234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className={s.submit} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className={s.linkRow}>
          <Link to="/forgot-password" className={s.link}>Forgot password?</Link>
        </div>
      </div>
      <p className={s.footNote}>AwaBus — Keeping Ghanaian children safe, one proximity alert at a time.</p>
    </div>
  )
}
