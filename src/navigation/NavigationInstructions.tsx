import { campusGraph } from '../data/campusGraph'
import { formatMeters } from './format'

const VIA: Record<string, string> = {
  forecourt: 'across the forecourt',
  walkway: 'along the walkway',
  road: 'along the campus road',
}

export function NavigationInstructions({ path }: { path: string[] }) {
  return (
    <ol className="relative space-y-0">
      {path.map((id, i) => {
        const node = campusGraph.node(id)
        const next = path[i + 1]
        const edge = next ? campusGraph.edge(id, next) : undefined
        const last = i === path.length - 1
        return (
          <li key={id} className="relative pl-6">
            <span
              className={`absolute left-0 top-1 h-3 w-3 rounded-full ring-2 ${
                last ? 'bg-[#f2552c] ring-[#f2552c]/30' : i === 0 ? 'bg-white ring-white/30' : 'bg-[#13243a] ring-white/40'
              }`}
            />
            {!last && <span className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-white/15" />}
            <div className="text-[13px] font-semibold uppercase tracking-wide">{node.name}</div>
            {edge && (
              <div className="pb-3 pt-0.5 text-xs text-white/60">
                Walk <span className="font-mono text-white">{formatMeters(edge.weight)}</span>{' '}
                {VIA[edge.measurementType ?? ''] ?? ''} to {campusGraph.node(next).name}
              </div>
            )}
            {last && <div className="pt-0.5 text-xs text-[#f2552c]">Arrive at destination</div>}
          </li>
        )
      })}
    </ol>
  )
}
