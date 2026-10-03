import type { Route } from '../algorithms/alternativeRoutes'
import { campusGraph } from '../data/campusGraph'
import { formatMeters, walkingMinutes } from './format'

interface Props {
  routes: Route[]
  selected: number
  onSelect: (i: number) => void
  walkingSpeed: number
}

export function RouteOptions({ routes, selected, onSelect, walkingSpeed }: Props) {
  if (routes.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
        {routes.length === 1 ? 'Route' : 'Available routes'}
      </h3>
      <div className="space-y-1.5">
        {routes.map((r, i) => (
          <button
            key={r.path.join('>')}
            onClick={() => onSelect(i)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
              i === selected ? 'border-[#f2552c] bg-[#f2552c]/10' : 'border-white/10 hover:bg-white/5'
            }`}
          >
            <span className="w-14 shrink-0">
              <span className="block text-sm font-semibold">Route {i + 1}</span>
              {i === 0 && <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#f2552c]">Shortest</span>}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-white/60">
              {r.path.filter((id) => campusGraph.node(id).kind !== 'junction').map((id) => campusGraph.node(id).name).join(' → ')}
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-sm">{formatMeters(r.distance)}</span>
              <span className="block font-mono text-[11px] text-white/50">~{walkingMinutes(r.distance, walkingSpeed)} min</span>
            </span>
          </button>
        ))}
      </div>
      {routes.length === 1 && (
        <p className="mt-2 text-[11px] text-white/45">The measured graph has only one path between these places.</p>
      )}
    </div>
  )
}
