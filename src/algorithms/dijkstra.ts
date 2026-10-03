import type { Graph } from '../graph/Graph'
import type { GraphEdge } from '../graph/types'
import { MinHeap } from './MinHeap'

/** One step of the algorithm, recorded so the UI can replay it. */
export type DijkstraStep =
  | { type: 'init'; source: string; distances: Record<string, number> }
  | { type: 'visit'; node: string; distance: number; distances: Record<string, number>; visited: string[] }
  | {
      type: 'relax'
      from: string
      to: string
      weight: number
      oldDistance: number
      newDistance: number
      improved: boolean
      distances: Record<string, number>
    }
  | { type: 'reject'; from: string; to: string; reason: string }
  | { type: 'skip-stale'; node: string }
  | { type: 'done'; target: string; distance: number; path: string[] }

export interface DijkstraResult {
  source: string
  /** The target that was reached (one of the requested targets). */
  target: string
  /** Node ids from source to target, or [] if unreachable. */
  path: string[]
  distance: number
  /** Order in which nodes were settled. */
  visitedOrder: string[]
  /** Edges skipped by the eligibility check, with the reason. */
  rejected: { from: string; to: string; reason: string }[]
  steps: DijkstraStep[]
}

/** Returns null if the edge may be used, otherwise the reason it may not. */
export type EdgeFilter = (edge: GraphEdge) => string | null

export interface DijkstraOptions {
  /** Undirected edges to ignore, as "a|b" keys (sorted). Used by Yen's algorithm. */
  excludedEdges?: Set<string>
  excludedNodes?: Set<string>
  /** Route constraints (accessibility, closures) checked before relaxing an edge. */
  edgeFilter?: EdgeFilter
  /** Record a step-by-step trace (off for the inner loops of Yen's algorithm). */
  trace?: boolean
}

export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Dijkstra's single-source shortest path with a binary min-heap and
 * lazy deletion. `target` may be several nodes (e.g. every entrance of a
 * building); the search stops at the first one settled, which is the nearest.
 *
 * Time  O((V + E) log V)   Space O(V + E)
 */
export function dijkstra(
  graph: Graph,
  source: string,
  target: string | readonly string[],
  opts: DijkstraOptions = {},
): DijkstraResult {
  const { excludedEdges, excludedNodes, edgeFilter, trace = true } = opts
  const targets = new Set(typeof target === 'string' ? [target] : target)
  if (!graph.hasNode(source)) throw new Error(`Unknown source: ${source}`)
  for (const t of targets) if (!graph.hasNode(t)) throw new Error(`Unknown target: ${t}`)

  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const visited = new Set<string>()
  const visitedOrder: string[] = []
  const rejected: DijkstraResult['rejected'] = []
  const steps: DijkstraStep[] = []
  const heap = new MinHeap<string>()

  for (const n of graph.allNodes()) dist.set(n.id, Infinity)
  dist.set(source, 0)
  heap.push(source, 0)

  const snapshot = () => Object.fromEntries(dist)
  if (trace) steps.push({ type: 'init', source, distances: snapshot() })

  let reached: string | null = null
  while (heap.size > 0) {
    const { value: u, priority: d } = heap.pop()!
    if (visited.has(u) || d > dist.get(u)!) {
      if (trace) steps.push({ type: 'skip-stale', node: u })
      continue
    }
    visited.add(u)
    visitedOrder.push(u)
    if (trace) steps.push({ type: 'visit', node: u, distance: d, distances: snapshot(), visited: [...visitedOrder] })
    if (targets.has(u)) {
      reached = u
      break
    }

    for (const e of graph.neighbours(u)) {
      const v = e.to
      if (visited.has(v)) continue
      if (excludedNodes?.has(v)) continue
      if (excludedEdges?.has(edgeKey(u, v))) continue
      const reason = edgeFilter?.(e)
      if (reason) {
        rejected.push({ from: u, to: v, reason })
        if (trace) steps.push({ type: 'reject', from: u, to: v, reason })
        continue
      }
      const old = dist.get(v)!
      const candidate = d + e.weight
      const improved = candidate < old
      if (improved) {
        dist.set(v, candidate)
        prev.set(v, u)
        heap.push(v, candidate)
      }
      if (trace)
        steps.push({
          type: 'relax',
          from: u,
          to: v,
          weight: e.weight,
          oldDistance: old,
          newDistance: improved ? candidate : old,
          improved,
          distances: snapshot(),
        })
    }
  }

  const end = reached ?? [...targets][0]
  const distance = reached ? dist.get(reached)! : Infinity
  const path: string[] = []
  if (reached) {
    for (let at: string | undefined = reached; at !== undefined; at = prev.get(at)) path.unshift(at)
  }
  if (trace) steps.push({ type: 'done', target: end, distance, path })
  return { source, target: end, path, distance, visitedOrder, rejected, steps }
}
