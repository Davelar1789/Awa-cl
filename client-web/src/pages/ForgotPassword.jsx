import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { apiErrorMessage } from '../services/api'
import { Button, Input } from '../components/ui'
import s from './Auth.module.css'

const STEP = { REQUEST: 'request', VERIFY: 'verify', RESET: 'reset' }

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(STEP.REQUEST)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function requestOtp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { phone: phone.trim() })
      toast.success('If that number is registered, an OTP has been sent.')
      setStep(STEP.VERIFY)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', { phone: phone.trim(), otp: otp.trim() })
      setResetToken(data.resetToken)
      setStep(STEP.RESET)
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid or expired code.'))
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { phone: phone.trim(), resetToken, newPassword })
      toast.success('Password reset. Please sign in.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
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

        {step === STEP.REQUEST && (
          <>
            <h1 className={s.heading}>Reset your password</h1>
            <p className={s.subheading}>Enter the phone number on your admin or driver account.</p>
            {error && <div className={s.error}>{error}</div>}
            <form onSubmit={requestOtp}>
              <Input
                label="Phone number"
                id="phone"
                type="tel"
                placeholder="+233201234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Button type="submit" className={s.submit} disabled={loading}>
                {loading ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          </>
        )}

        {step === STEP.VERIFY && (
          <>
            <h1 className={s.heading}>Enter the code</h1>
            <p className={s.subheading}>We sent a 6-digit code by SMS to {phone}.</p>
            {error && <div className={s.error}>{error}</div>}
            <form onSubmit={verifyOtp}>
              <Input
                label="6-digit code"
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
              <Button type="submit" className={s.submit} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify code'}
              </Button>
            </form>
          </>
        )}

        {step === STEP.RESET && (
          <>
            <h1 className={s.heading}>Choose a new password</h1>
            <p className={s.subheading}>At least 8 characters.</p>
            {error && <div className={s.error}>{error}</div>}
            <form onSubmit={resetPassword}>
              <Input
                label="New password"
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button type="submit" className={s.submit} disabled={loading}>
                {loading ? 'Saving…' : 'Reset password'}
              </Button>
            </form>
          </>
        )}

        <div className={s.linkRow}>
          <Link to="/login" className={s.link}>Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
