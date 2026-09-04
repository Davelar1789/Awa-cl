import { Search } from 'lucide-react'
import s from './ui.module.css'

export function Input({ label, id, className = '', ...rest }) {
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={id}>{label}</label>}
      <input id={id} className={`${s.input} ${className}`} {...rest} />
    </div>
  )
}

export function Select({ label, id, children, className = '', ...rest }) {
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={id}>{label}</label>}
      <select id={id} className={`${s.select} ${className}`} {...rest}>
        {children}
      </select>
    </div>
  )
}

export function SearchInput({ className = '', ...rest }) {
  return (
    <div className={s.searchWrap}>
      <Search size={15} className={s.searchIcon} />
      <input className={`${s.searchInput} ${className}`} {...rest} />
    </div>
  )
}
