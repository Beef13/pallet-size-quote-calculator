import { useState, useRef, useEffect, useId } from 'react'
import Flag from './Flag'
import { REGIONS, regionFor } from '../utils/region'

// A country dropdown that shows each country's flag beside its name. A plain <select> can't
// show pictures in its options, so this is a button that opens a list, with the same keyboard
// controls: arrows to move, Enter or Space to choose, Escape to close.
export default function CountrySelect({ value, onChange, disabled = false, showRate = false, large = false, autoFocus = false, labelledBy, dataField = 'biz-country' }) {
  const options = Object.values(REGIONS)
  const current = regionFor(value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(current.code)
  const root = useRef(null)
  const trigger = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const outside = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  const show = () => { setActive(current.code); setOpen(true) }
  const choose = (code) => {
    setOpen(false)
    trigger.current?.focus()
    if (code !== current.code) onChange(code)
  }
  const move = (step) => {
    const i = options.findIndex(o => o.code === active)
    setActive(options[(i + step + options.length) % options.length].code)
  }
  const onKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className={`country-select${large ? ' is-large' : ''}${open ? ' is-open' : ''}`} ref={root}>
      <button type="button" ref={trigger} className="country-select-trigger" disabled={disabled} autoFocus={autoFocus}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        data-field={dataField} data-value={current.code}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKeyDown}>
        <Flag country={current.code} />
        <span className="country-select-name" id={`${id}-value`}>{current.name}</span>
        {showRate && <span className="country-select-rate">GST {current.gstRate}%</span>}
        <svg className="country-select-chevron" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 1.5l5 5 5-5" /></svg>
      </button>
      {open && (
        <ul className="country-select-list" role="listbox" id={`${id}-list`} aria-labelledby={labelledBy}>
          {options.map(o => (
            <li key={o.code} id={`${id}-${o.code}`} role="option" aria-selected={o.code === current.code}
              className={o.code === active ? 'is-active' : ''} data-country={o.code}
              onPointerEnter={() => setActive(o.code)} onClick={() => choose(o.code)}>
              <Flag country={o.code} />
              <span className="country-select-name">{o.name}</span>
              <span className="country-select-rate">GST {o.gstRate}%</span>
              {/* The tick's space is always kept, so the GST rates line up whichever row is ticked */}
              <svg className="country-select-tick" width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                style={o.code === current.code ? undefined : { visibility: 'hidden' }}><path d="M1.5 5.5l3.5 3.5 7.5-7.5" /></svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
