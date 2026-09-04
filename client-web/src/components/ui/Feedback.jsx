import s from './ui.module.css'

const COLOR_CLASS = {
  green: s.badgeGreen,
  red: s.badgeRed,
  amber: s.badgeAmber,
  blue: s.badgeBlue,
  gray: s.badgeGray,
}

export function Badge({ color = 'gray', children }) {
  return <span className={`${s.badge} ${COLOR_CLASS[color] ?? s.badgeGray}`}>{children}</span>
}

const STATUS_DOT_CLASS = {
  active: s.dotActive,
  'Active Trip': s.dotActive,
  suspended: s.dotSuspended,
  Maintenance: s.dotMaintenance,
  deleted: s.dotDeleted,
  Idle: s.dotIdle,
}

export function StatusDot({ status }) {
  return (
    <span className={s.statusDotRow}>
      <span className={`${s.dot} ${STATUS_DOT_CLASS[status] ?? s.dotGray}`} />
    </span>
  )
}

export function Spinner() {
  return (
    <div className={s.spinnerWrap}>
      <div className={s.spinner} />
    </div>
  )
}

export function Empty({ message = 'Nothing here yet.' }) {
  return <div className={s.empty}>{message}</div>
}
