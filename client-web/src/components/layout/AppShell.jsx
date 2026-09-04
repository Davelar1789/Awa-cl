import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Bus, GraduationCap, ScrollText, LogOut, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getSocket, disconnectSocket } from '../../services/socket'
import s from './AppShell.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/buses', label: 'Buses', icon: Bus },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/logs', label: 'Activity Log', icon: ScrollText },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [online, setOnline] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    const onConnect = () => setOnline(true)
    const onDisconnect = () => setOnline(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    setOnline(socket.connected)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  function handleLogout() {
    disconnectSocket()
    logout()
    navigate('/login', { replace: true })
  }

  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.logo}>
          <span className={s.logoMark}>A</span>
          <div>
            <span className={s.logoText}>AwaBus</span>
            <span className={s.logoSub}>Admin Portal</span>
          </div>
        </div>

        <nav className={s.nav}>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}
            >
              <Icon size={16} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={`${s.connBar} ${online ? s.connOnline : s.connOffline}`}>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? 'Live' : 'Reconnecting…'}
        </div>

        <div className={s.footer}>
          <div className={s.userRow}>
            <span className={s.avatar}>{initials}</span>
            <div className={s.userMeta}>
              <div className={s.userName}>{user?.name}</div>
              <div className={s.userRole}>{user?.role}</div>
            </div>
          </div>
          <button className={s.logoutBtn} onClick={handleLogout}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  )
}
