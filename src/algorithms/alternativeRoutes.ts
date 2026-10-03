import type { Graph } from '../graph/Graph'
import { dijkstra, edgeKey, type EdgeFilter } from './dijkstra'

export interface Route {
  path: string[]
  distance: number
}

export const pathLength = (graph: Graph, path: string[]) =>
  path.slice(1).reduce((sum, v, i) => sum + graph.edge(path[i], v)!.weight, 0)

/**
 * Yen's k-shortest loopless paths, with Dijkstra as the inner search.
 * Returns only routes that actually exist in the (filtered) graph — if there
 * is one path, the result has one entry.
 */
export function kShortestRoutes(
  graph: Graph,
  source: string,
  target: string | readonly string[],
  k = 3,
  edgeFilter?: EdgeFilter,
): Route[] {
  const first = dijkstra(graph, source, target, { trace: false, edgeFilter })
  if (first.path.length === 0) return []

  const found: Route[] = [{ path: first.path, distance: first.distance }]
  const candidates: Route[] = []
  const seen = new Set([first.path.join('>')])

  while (found.length < k) {
    const last = found[found.length - 1].path
    for (let i = 0; i < last.length - 1; i++) {
      const spur = last[i]
      const root = last.slice(0, i + 1)
      const excludedEdges = new Set<string>()
      for (const r of found) {
        if (r.path.length > i && r.path.slice(0, i + 1).join('>') === root.join('>')) {
          excludedEdges.add(edgeKey(r.path[i], r.path[i + 1]))
        }
      }
      const excludedNodes = new Set(root.slice(0, -1))
      const spurResult = dijkstra(graph, spur, target, { excludedEdges, excludedNodes, edgeFilter, trace: false })
      if (spurResult.path.length === 0) continue
      const path = [...root.slice(0, -1), ...spurResult.path]
      const id = path.join('>')
      if (seen.has(id)) continue
      seen.add(id)
      candidates.push({ path, distance: pathLength(graph, path) })
    }
    if (candidates.length === 0) break
    candidates.sort((a, b) => a.distance - b.distance)
    found.push(candidates.shift()!)
  }
  return found
}
