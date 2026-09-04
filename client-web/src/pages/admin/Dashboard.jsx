import { useEffect, useState, useCallback } from 'react'
import { Bus, Users, GraduationCap, Radio, PhoneCall, MessageSquare } from 'lucide-react'
import api from '../../services/api'
import { getSocket } from '../../services/socket'
import PageHeader from '../../components/layout/PageHeader'
import { Spinner } from '../../components/ui'
import styles from './Dashboard.module.css'

const STAT_DEFS = [
  { key: 'totalBuses', label: 'Buses registered', icon: Bus },
  { key: 'activeTrips', label: 'Active trips now', icon: Radio, gold: true, pulse: true },
  { key: 'totalStudents', label: 'Students enrolled', icon: GraduationCap },
  { key: 'totalUsers', label: 'Users in system', icon: Users },
  { key: 'alertsToday', label: 'Voice alerts today', icon: PhoneCall },
  { key: 'smsToday', label: 'SMS sent today', icon: MessageSquare },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/stats')
      setStats(data)
    } catch {
      // Leave stale stats on screen rather than blanking the dashboard.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Live-refresh whenever a trip starts/ends or a new comms event lands.
  useEffect(() => {
    const socket = getSocket()
    const refresh = () => load()
    socket.on('trip:started', refresh)
    socket.on('trip:ended', refresh)
    socket.on('log:new', refresh)
    return () => {
      socket.off('trip:started', refresh)
      socket.off('trip:ended', refresh)
      socket.off('log:new', refresh)
    }
  }, [load])

  return (
    <div className={styles.page}>
      <PageHeader title="Dashboard" subtitle="Live overview of the AwaBus system" />

      <div className={styles.body}>
        {loading || !stats ? (
          <Spinner />
        ) : (
          <>
            <div className={styles.statsGrid}>
              {STAT_DEFS.map(({ key, label, icon: Icon, gold, pulse }) => (
                <div key={key} className={`${styles.statCard} ${gold ? styles.statCardGold : ''}`}>
                  <div className={styles.statTop}>
                    <span className={styles.statLabel}>{label}</span>
                    <span className={`${styles.statIcon} ${pulse ? styles.statIconPulse : ''}`}>
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                  </div>
                  <div className={styles.statValue}>{stats[key] ?? 0}</div>
                </div>
              ))}
            </div>

            <div className={styles.notice}>
              <span className={styles.noticeDot} />
              <p>
                Real-time trip tracking and live alerts appear here and on the Activity Log as they happen.
                Bus drivers stream GPS coordinates every {import.meta.env.VITE_GPS_INTERVAL || '10'} seconds during active trips.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
