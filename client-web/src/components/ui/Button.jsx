import s from './ui.module.css'

const VARIANT = {
  primary: s.btnPrimary,
  ghost: s.btnGhost,
  danger: s.btnDanger,
  dark: s.btnDark,
}
const SIZE = { sm: s.btnSm, md: s.btnMd }

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }) {
  return (
    <button className={`${s.btn} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
