import s from './PageHeader.module.css'

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className={s.header}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
