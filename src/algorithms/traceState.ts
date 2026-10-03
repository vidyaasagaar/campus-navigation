import type { NodeState } from '../campus/CampusLabels'
import type { DijkstraResult, DijkstraStep } from './dijkstra'

export interface TraceView {
  step: DijkstraStep
  nodeStates: Record<string, NodeState>
  distances: Record<string, number>
  visited: string[]
  current: string | null
  relaxed: { from: string; to: string; improved: boolean } | null
}

/** Reconstructs what the algorithm "knows" after `index` steps of the recorded trace. */
export function traceAt(result: DijkstraResult, index: number): TraceView {
  const steps = result.steps
  const i = Math.max(0, Math.min(index, steps.length - 1))
  let distances: Record<string, number> = {}
  let visited: string[] = []
  let current: string | null = null
  let relaxed: TraceView['relaxed'] = null
  for (let k = 0; k <= i; k++) {
    const s = steps[k]
    if (s.type === 'init') distances = s.distances
    if (s.type === 'visit') {
      distances = s.distances
      visited = s.visited
      current = s.node
      relaxed = null
    }
    if (s.type === 'relax') {
      distances = s.distances
      relaxed = { from: s.from, to: s.to, improved: s.improved }
    }
  }
  const step = steps[i]
  const nodeStates: Record<string, NodeState> = {}
  for (const [id, d] of Object.entries(distances)) {
    if (visited.includes(id)) nodeStates[id] = 'visited'
    else if (Number.isFinite(d)) nodeStates[id] = 'frontier'
  }
  if (current) nodeStates[current] = 'current'
  if (step.type === 'done') for (const id of step.path) nodeStates[id] = 'path'
  return { step, nodeStates, distances, visited, current, relaxed }
}

export function describeStep(step: DijkstraStep, name: (id: string) => string): string {
  switch (step.type) {
    case 'init':
      return `Initialise: dist(${name(step.source)}) = 0, every other node = ∞. Push source onto the min-heap.`
    case 'visit':
      return `Pop ${name(step.node)} (${step.distance.toFixed(2)} m) — the smallest tentative distance. It is now final.`
    case 'relax':
      return step.improved
        ? `Relax ${name(step.from)} → ${name(step.to)}: ${fmt(step.oldDistance)} → ${step.newDistance.toFixed(2)} m (improved, push to heap).`
        : `Relax ${name(step.from)} → ${name(step.to)}: ${fmt(step.oldDistance)} stays (no improvement).`
    case 'reject':
      return `Skip edge ${name(step.from)} → ${name(step.to)}: ${step.reason} (not allowed in this route mode).`
    case 'skip-stale':
      return `Skip stale heap entry for ${name(step.node)} (already settled).`
    case 'done':
      return step.path.length
        ? `Target settled. Shortest distance ${step.distance.toFixed(2)} m via ${step.path.map(name).join(' → ')}.`
        : 'Target unreachable from the source with the measured edges.'
  }
}

const fmt = (d: number) => (Number.isFinite(d) ? `${d.toFixed(2)} m` : '∞')
