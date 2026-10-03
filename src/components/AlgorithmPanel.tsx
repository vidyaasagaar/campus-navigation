import { useEffect, useMemo } from 'react'
import { bfsFewestEdges, greedyRoute } from '../algorithms/baselines'
import { formatDijkstraLog } from '../algorithms/debugLog'
import type { DijkstraResult } from '../algorithms/dijkstra'
import { describeStep, traceAt } from '../algorithms/traceState'
import { campusGraph } from '../data/campusGraph'

interface Props {
  result: DijkstraResult | null
  stepIndex: number
  playing: boolean
  onStep: (i: number) => void
  onTogglePlay: () => void
  onClose: () => void
}

const name = (id: string) => campusGraph.node(id).name

export function AlgorithmPanel({ result, stepIndex, playing, onStep, onTogglePlay, onClose }: Props) {
  const total = result?.steps.length ?? 0

  useEffect(() => {
    if (!playing || !result) return
    if (stepIndex >= total - 1) {
      onTogglePlay()
      return
    }
    const t = setTimeout(() => onStep(stepIndex + 1), 750)
    return () => clearTimeout(t)
  }, [playing, stepIndex, total, result, onStep, onTogglePlay])

  return (
    <div className="glass flex max-h-full w-[min(360px,calc(100vw-32px))] flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="font-mono text-[11px] tracking-[0.25em] text-[#f2552c]">DIJKSTRA</div>
          <div className="text-[11px] text-white/45">
            V = {campusGraph.vertexCount} · E = {campusGraph.edgeCount} · binary min-heap · O((V+E) log V)
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Close algorithm panel">
          ✕
        </button>
      </div>

      {!result ? (
        <p className="p-4 text-sm text-white/55">Calculate a route to watch the algorithm run step by step.</p>
      ) : (
        <Trace result={result} stepIndex={stepIndex} playing={playing} onStep={onStep} onTogglePlay={onTogglePlay} />
      )}
    </div>
  )
}

function Trace({ result, stepIndex, playing, onStep, onTogglePlay }: Omit<Props, 'onClose' | 'result'> & { result: DijkstraResult }) {
  const view = traceAt(result, stepIndex)
  const total = result.steps.length
  const rows = campusGraph
    .allNodes()
    .map((n) => ({ id: n.id, d: view.distances[n.id] ?? Infinity, state: view.nodeStates[n.id] ?? 'idle' }))
    .sort((a, b) => a.d - b.d)

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-sm">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Source" value={name(result.source)} />
        <Field label="Target" value={name(result.target)} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onStep(0)} className="ctrl" aria-label="First step">⏮</button>
        <button onClick={() => onStep(Math.max(0, stepIndex - 1))} className="ctrl" aria-label="Previous step">◀</button>
        <button onClick={onTogglePlay} className="ctrl flex-1 !bg-[#f2552c] text-white">
          {playing ? 'Pause' : stepIndex >= total - 1 ? 'Replay' : 'Play'}
        </button>
        <button onClick={() => onStep(Math.min(total - 1, stepIndex + 1))} className="ctrl" aria-label="Next step">▶</button>
        <button onClick={() => onStep(total - 1)} className="ctrl" aria-label="Last step">⏭</button>
      </div>
      <div className="font-mono text-[11px] text-white/45">
        step {stepIndex + 1} / {total}
      </div>
      <p className="min-h-[3.5em] rounded-xl bg-white/5 p-3 text-[13px] leading-snug text-white/85">
        {describeStep(view.step, name)}
      </p>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-white/40">
            <th className="pb-1 font-medium">Node</th>
            <th className="pb-1 text-right font-medium">Tentative dist.</th>
            <th className="pb-1 pl-3 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-t border-white/5 ${
                view.relaxed && (view.relaxed.to === r.id) ? (view.relaxed.improved ? 'bg-emerald-400/10' : 'bg-white/5') : ''
              }`}
            >
              <td className="py-1.5">{name(r.id)}</td>
              <td className="py-1.5 text-right font-mono">{Number.isFinite(r.d) ? `${r.d.toFixed(2)} m` : '∞'}</td>
              <td className="py-1.5 pl-3">
                <StateChip state={r.state} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-xs">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Visited order</div>
        <div className="font-mono text-white/80">{view.visited.length ? view.visited.map(name).join(' → ') : '—'}</div>
      </div>

      {view.step.type === 'done' && (
        <div className="rounded-xl border border-[#f2552c]/40 bg-[#f2552c]/10 p-3 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-white/50">Final distance</div>
          <div className="font-mono text-lg">{result.distance.toFixed(2)} m</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-white/50">Final path</div>
          <div className="font-mono">{result.path.map(name).join(' → ')}</div>
        </div>
      )}

      <Compare result={result} />

      <details className="text-xs">
        <summary className="cursor-pointer select-none text-white/75">Debug log</summary>
        <DebugLog result={result} />
      </details>
    </div>
  )
}

/** Same source/target with naive baselines — shows why Dijkstra is needed (guide §18, §36). */
function Compare({ result }: { result: DijkstraResult }) {
  const rows = useMemo(() => {
    const bfs = bfsFewestEdges(campusGraph, result.source, result.target)
    const greedy = greedyRoute(campusGraph, result.source, result.target)
    return [
      { label: 'Dijkstra', note: 'min total metres', r: { path: result.path, distance: result.distance } },
      { label: 'BFS', note: 'min number of edges', r: bfs },
      { label: 'Greedy', note: 'shortest next edge', r: greedy },
    ]
  }, [result])
  return (
    <div className="text-xs">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Compare (same start → target, all edges)</div>
      <table className="w-full">
        <tbody>
          {rows.map(({ label, note, r }) => {
            const extra = Number.isFinite(r.distance) && Number.isFinite(result.distance) ? r.distance - result.distance : null
            return (
              <tr key={label} className="border-t border-white/5 align-top">
                <td className="py-1.5 pr-2 font-semibold">
                  {label}
                  <div className="text-[10px] font-normal text-white/40">{note}</div>
                </td>
                <td className="py-1.5 text-right font-mono">
                  {Number.isFinite(r.distance) ? `${r.distance.toFixed(2)} m` : 'failed'}
                  <div className="text-[10px] text-white/45">
                    {'failure' in r && r.failure ? r.failure : extra && extra > 1e-9 ? `+${extra.toFixed(2)} m longer` : label === 'Dijkstra' ? 'optimal' : 'same as Dijkstra'}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1 text-[10.5px] text-white/40">Baselines ignore route-preference filters; they are for comparison only.</p>
    </div>
  )
}

function DebugLog({ result }: { result: DijkstraResult }) {
  const text = useMemo(() => formatDijkstraLog(campusGraph, result), [result])
  return (
    <div className="mt-1.5">
      <button onClick={() => navigator.clipboard?.writeText(text)} className="ctrl mb-1.5 h-7 text-[11px]">
        Copy
      </button>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[10.5px] leading-snug text-white/80">
        {text}
      </pre>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}

const CHIP: Record<string, string> = {
  idle: 'text-white/40',
  frontier: 'text-sky-300',
  visited: 'text-amber-300',
  current: 'text-[#f2552c]',
  path: 'text-[#f2552c]',
}

function StateChip({ state }: { state: string }) {
  const label = { idle: 'unseen', frontier: 'in heap', visited: 'settled', current: 'current', path: 'on path' }[state] ?? state
  return <span className={`font-mono text-[11px] ${CHIP[state]}`}>{label}</span>
}
