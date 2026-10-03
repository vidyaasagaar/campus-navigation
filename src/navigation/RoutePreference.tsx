import { useRef } from 'react'
import { ROUTE_MODES, type RouteMode } from '../algorithms/accessibility'

interface Props {
  mode: RouteMode
  disabled?: boolean
  onChange: (mode: RouteMode) => void
}

/** Route preference radio group (spec §34.1) — arrow keys move between options. */
export function RoutePreference({ mode, disabled, onChange }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = ROUTE_MODES.find((m) => m.id === mode)!
  const move = (i: number) => {
    const next = (i + ROUTE_MODES.length) % ROUTE_MODES.length
    onChange(ROUTE_MODES[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div>
      <div id="route-pref-label" className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
        Route preference
      </div>
      <div role="radiogroup" aria-labelledby="route-pref-label" className="flex flex-wrap gap-1.5">
        {ROUTE_MODES.map((m, i) => {
          const active = m.id === mode
          return (
            <button
              key={m.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(m.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), move(i + 1))
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), move(i - 1))
              }}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold transition disabled:opacity-40 ${
                active ? 'border-[#f2552c] bg-[#f2552c]/15 text-white' : 'border-white/10 text-white/75 hover:bg-white/5'
              }`}
            >
              <span aria-hidden>{m.icon}</span>
              {m.label}
              {active && <span className="sr-only">(selected)</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-white/50">{current.description}</p>
    </div>
  )
}
