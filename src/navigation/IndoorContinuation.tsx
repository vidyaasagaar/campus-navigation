import { isConstrained, type RouteMode } from '../algorithms/accessibility'
import { campusGraphWithIndoor as g, pendingIndoorChain } from '../data/indoorGraph'

/**
 * The indoor part of a room destination. Every indoor connection is still
 * unmeasured, so the steps are listed with "Measurement required" instead of
 * distances (spec §26, §36.7).
 */
export function IndoorContinuation({ building, room, mode }: { building: string; room: string; mode: RouteMode }) {
  const chain = pendingIndoorChain(g, building, room)
  if (chain.length < 2) return null
  const hasStairs = chain.slice(1).some((id, i) =>
    g.disabled.some(
      (e) => ((e.from === chain[i] && e.to === id) || (e.to === chain[i] && e.from === id)) && e.accessibility?.stairs === true,
    ),
  )
  return (
    <section aria-label="Indoor directions" className="rounded-xl border border-dashed border-white/20 p-3 text-xs">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">
        Inside {g.node(building).name} · {g.node(room).name}
      </div>
      <ol className="space-y-1">
        {chain.slice(1).map((id) => (
          <li key={id} className="flex justify-between gap-2">
            <span>{g.node(id).name}</span>
            <span className="shrink-0 font-mono text-[10.5px] text-amber-200">Measurement required</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-white/50">
        Indoor distances, door and staircase positions are not collected yet, so Dijkstra routes only to the building
        entrance.
      </p>
      {isConstrained(mode) && hasStairs && (
        <p role="alert" className="mt-1.5 text-rose-200">
          ⚠ The only known connection to this floor is a staircase. No verified step-free route is available (lift data not
          supplied).
        </p>
      )}
    </section>
  )
}
