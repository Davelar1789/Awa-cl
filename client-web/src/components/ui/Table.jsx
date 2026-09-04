import s from './ui.module.css'

export function Table({ children }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>{children}</table>
    </div>
  )
}

export function Th({ children, width }) {
  return <th className={s.th} style={width ? { width } : undefined}>{children}</th>
}

export function Tr({ children, ...rest }) {
  return <tr className={s.tr} {...rest}>{children}</tr>
}

export function Td({ children, muted, ...rest }) {
  return (
    <td className={`${s.td} ${muted ? s.tdMuted : ''}`} {...rest}>
      {children}
    </td>
  )
}
