import type { Graph } from '../graph/Graph'
import { pathLength } from './alternativeRoutes'

/**
 * Baselines for comparison with Dijkstra (learning guide §18, §36).
 * They are NOT used for navigation — they exist to show, on real campus data,
 * why a weighted shortest-path algorithm is needed.
 */
export interface BaselineResult {
  path: string[]
  /** Real walking distance of the path, or Infinity if it failed. */
  distance: number
  /** Why it stopped, when it did not reach the target. */
  failure?: string
}

/**
 * GREEDY: at every node, take the shortest edge to a node not yet visited.
 * A purely local choice — it never reconsiders. Time O(V · deg).
 */
export function greedyRoute(graph: Graph, source: string, target: string): BaselineResult {
  const path = [source]
  const visited = new Set([source])
  let at = source
  while (at !== target) {
    const options = graph.neighbours(at).filter((e) => !visited.has(e.to))
    if (options.length === 0) return { path, distance: Infinity, failure: `dead end at ${graph.node(at).name}` }
    const next = options.reduce((a, b) => (b.weight < a.weight ? b : a))
    at = next.to
    visited.add(at)
    path.push(at)
  }
  return { path, distance: pathLength(graph, path) }
}

/**
 * BFS: fewest EDGES, ignoring their lengths — correct only when every edge
 * costs the same. Queue (FIFO) + visited set + parent map. Time O(V + E).
 */
export function bfsFewestEdges(graph: Graph, source: string, target: string): BaselineResult {
  const parent = new Map<string, string | null>([[source, null]])
  const queue = [source]
  while (queue.length) {
    const u = queue.shift()!
    if (u === target) break
    for (const e of graph.neighbours(u)) {
      if (parent.has(e.to)) continue
      parent.set(e.to, u)
      queue.push(e.to)
    }
  }
  if (!parent.has(target)) return { path: [], distance: Infinity, failure: 'unreachable' }
  const path: string[] = []
  for (let at: string | null = target; at !== null; at = parent.get(at) ?? null) path.unshift(at)
  return { path, distance: pathLength(graph, path) }
}
