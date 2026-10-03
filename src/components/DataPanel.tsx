import { campusGraph, measurements } from '../data/campusGraph'
import type { Accessibility } from '../graph/types'
import { formatMeters } from '../navigation/format'

const name = (id: string) => campusGraph.node(id).name

function accessibilityLine(a: Accessibility | undefined): string {
  const known = Object.entries(a ?? {}).filter(([k, v]) => v != null && k !== 'verified' && k !== 'source')
  if (known.length === 0) return 'Accessibility: UNKNOWN (not surveyed)'
  return `Accessibility${a?.verified ? '' : ' (unverified)'}: ${known.map(([k, v]) => `${k}=${String(v)}`).join(', ')}`
}
/** Data status vocabulary from the learning guide (§47). */
function distanceStatus(c: { distanceMeters: number | null; verified: boolean }) {
  if (c.distanceMeters == null) return { label: 'UNKNOWN', cls: 'bg-rose-500/20 text-rose-200' }
  if (c.verified) return { label: 'VERIFIED', cls: 'bg-emerald-500/20 text-emerald-200' }
  return { label: 'ESTIMATED · map-measured', cls: 'bg-amber-500/20 text-amber-200' }
}

const CONF: Record<string, string> = { high: 'text-emerald-300', medium: 'text-amber-300', low: 'text-rose-300' }

/** Provenance of every edge weight — what was measured, how, and how sure we are. */
export function DataPanel({ onClose }: { onClose: () => void }) {
  const missing = measurements.connections.filter((c) => c.distanceMeters == null)
  return (
    <div className="glass flex max-h-full w-[min(420px,calc(100vw-32px))] flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="font-mono text-[11px] tracking-[0.25em] text-[#f2552c]">MEASUREMENTS</div>
          <div className="text-[11px] text-white/45">src/data/campusMeasurements.json</div>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Close data panel">
          ✕
        </button>
      </div>
      <div className="min-h-0 space-y-2 overflow-y-auto p-4">
        {measurements.connections.map((c) => (
          <div key={`${c.from}-${c.to}`} className="rounded-xl bg-white/5 p-3 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                {name(c.from)} ↔ {name(c.to)}
              </span>
              <span className="font-mono text-sm">
                {c.distanceMeters == null ? <span className="text-rose-300">Measurement required</span> : formatMeters(c.distanceMeters)}
              </span>
            </div>
            <div className="mt-1">
              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${distanceStatus(c).cls}`}>{distanceStatus(c).label}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] text-white/50">
              <span>{c.source}</span>
              {c.confidence && <span className={CONF[c.confidence]}>confidence: {c.confidence}</span>}
              <span className={c.verified ? 'text-emerald-300' : 'text-white/50'}>{c.verified ? 'verified on ground' : 'not ground-verified'}</span>
            </div>
            {c.crossCheck && <div className="mt-1 text-[11px] text-white/55">Cross-check: {c.crossCheck}</div>}
            <div className="mt-1 text-[11px] text-amber-200/90">
              {c.closed ? `⛔ Closed${c.closedReason ? `: ${c.closedReason}` : ''} · ` : ''}
              {accessibilityLine(c.accessibility)}
            </div>
            {c.notes && <div className="mt-0.5 text-[11px] text-white/40">{c.notes}</div>}
          </div>
        ))}
        {missing.length === 0 && (
          <p className="pt-1 text-[11px] text-white/40">
            All listed connections have a measured distance. Unmeasured connections can be added with
            "distanceMeters": null — they stay disabled until measured.
          </p>
        )}
      </div>
    </div>
  )
}
