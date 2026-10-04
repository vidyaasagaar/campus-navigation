import { useMemo, useState } from 'react'
import { campusGraph } from '../data/campusGraph'

export type MenuItem = 'algorithm' | 'floors' | 'data' | 'voice' | 'settings' | 'reset'

const MENU: { id: MenuItem; label: string }[] = [
  { id: 'algorithm', label: 'Algorithm (Dijkstra)' },
  { id: 'floors', label: 'Floors' },
  { id: 'data', label: 'Data sources' },
  { id: 'voice', label: 'Voice commands' },
  { id: 'settings', label: 'Accessibility & settings' },
  { id: 'reset', label: 'Reset map view' },
]

const places = campusGraph.allNodes().filter((n) => n.kind !== 'junction')

/** Phone search bar: type a place, tap a suggestion to get directions there. */
export function MobileTopBar({ onPick, onMenu }: { onPick: (id: string) => void; onMenu: (item: MenuItem) => void }) {
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [menu, setMenu] = useState(false)
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (t ? places.filter((p) => p.name.toLowerCase().includes(t)) : places).slice(0, 8)
  }, [q])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
      <div className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white pl-4 pr-1.5 text-[#0b1724] shadow-[0_4px_18px_rgba(0,0,0,0.25)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[#f2552c]" aria-hidden>
          <path d="M12 3l5 15-5-3.4L7 18z" fill="currentColor" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search MRTC campus"
          aria-label="Search a campus place"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-[#5f6b78] focus:outline-none"
        />
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Menu"
          aria-expanded={menu}
          className="grid h-9 w-9 place-items-center rounded-full text-xl text-[#3c4650] hover:bg-black/5"
        >
          ☰
        </button>
      </div>

      {focused && (
        <ul role="listbox" aria-label="Places" className="pointer-events-auto mt-2 overflow-hidden rounded-2xl bg-white text-[#0b1724] shadow-xl">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-[#5f6b78]">No matching place</li>}
          {results.map((p) => (
            <li key={p.id}>
              <button
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQ('')
                  setFocused(false)
                  ;(document.activeElement as HTMLElement | null)?.blur()
                  onPick(p.id)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/5"
              >
                <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[#eef1f4] text-sm">
                  {p.kind === 'parking' ? 'P' : p.kind === 'sports' ? '⚽' : p.kind === 'hostel' ? '🛏' : p.kind === 'facility' ? '🍽' : '🏫'}
                </span>
                <span className="text-[15px]">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {menu && (
        <ul className="pointer-events-auto ml-auto mt-2 w-60 overflow-hidden rounded-2xl bg-white text-[#0b1724] shadow-xl">
          {MENU.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => {
                  setMenu(false)
                  onMenu(m.id)
                }}
                className="w-full px-4 py-3 text-left text-[15px] hover:bg-black/5"
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
