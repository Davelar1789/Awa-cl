import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import s from './ui.module.css'

/**
 * Row-level kebab menu. `items` is an array of
 * { label, onClick, danger? } — pass an empty array for nothing to render.
 * Closes on outside click and on Escape.
 */
export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={s.menuWrap} ref={ref}>
      <button
        className={s.menuBtn}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label="Row actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className={s.dropdown} onClick={(e) => e.stopPropagation()}>
          {items.map((item) => (
            <button
              key={item.label}
              className={item.danger ? s.dropdownDanger : undefined}
              onClick={() => { item.onClick(); setOpen(false) }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
