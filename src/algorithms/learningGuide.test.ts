/**
 * Test cases from the Build + Learn guide (§12, §23, §44) and the baseline
 * comparisons used to answer "why not BFS / greedy?" (§18, §36).
 * Each test states the expected result and why.
 */
import { describe, expect, it } from 'vitest'
import { Graph } from '../graph/Graph'
import type { Accessibility } from '../graph/types'
import { campusGraph } from '../data/campusGraph'
import { edgeFilterFor } from './accessibility'
import { bfsFewestEdges, greedyRoute } from './baselines'
import { formatDijkstraLog } from './debugLog'
import { dijkstra } from './dijkstra'

const at = { lat: 0, lng: 0 }
function g(nodes: string[], edges: [string, string, number, Accessibility?][]) {
  const graph = new Graph()
  for (const id of nodes) graph.addNode({ id, name: id, kind: 'junction', position: at })
  for (const [from, to, weight, accessibility] of edges)
    graph.addEdge({ from, to, weight, source: 'user-provided', verified: true, path: [at, at], accessibility })
  return graph
}

describe('guide §44 — basic cases', () => {
  // A→B 10, A→C 3, C→B 2: the direct edge is NOT the shortest route.
  const g44 = g(['A', 'B', 'C'], [['A', 'B', 10], ['A', 'C', 3], ['C', 'B', 2]])

  it('takes A → C → B (5) instead of the direct A → B (10)', () => {
    expect(dijkstra(g44, 'A', 'B')).toMatchObject({ path: ['A', 'C', 'B'], distance: 5 })
  })

  it('same start and destination → zero-length route', () => {
    expect(dijkstra(g44, 'A', 'A')).toMatchObject({ path: ['A'], distance: 0 })
  })

  it('unreachable destination → empty path, infinite distance', () => {
    const iso = g(['A', 'B', 'Z'], [['A', 'B', 1]])
    expect(dijkstra(iso, 'A', 'Z')).toMatchObject({ path: [], distance: Infinity })
  })

  it('invalid node → clear error, not a silent wrong answer', () => {
    expect(() => dijkstra(g44, 'A', 'NOPE')).toThrow(/Unknown target/)
    expect(() => dijkstra(g44, 'NOPE', 'A')).toThrow(/Unknown source/)
  })

  it('equal-cost routes → one of them, with the correct distance', () => {
    const tie = g(['A', 'B', 'C', 'D'], [['A', 'B', 5], ['B', 'D', 5], ['A', 'C', 5], ['C', 'D', 5]])
    const r = dijkstra(tie, 'A', 'D')
    expect(r.distance).toBe(10)
    expect([['A', 'B', 'D'], ['A', 'C', 'D']]).toContainEqual(r.path)
  })

  it('negative weights are rejected (Dijkstra requires non-negative weights)', () => {
    expect(() => g(['A', 'B'], [['A', 'B', -3]])).toThrow(/positive distance/)
  })
})

describe('guide §12 — worked example', () => {
  // A–B 100, A–C 40, B–D 30, C–D 50  →  B is reached more cheaply? A→B = 100 vs A→C→D→B = 120.
  const g12 = g(['A', 'B', 'C', 'D'], [['A', 'B', 100], ['A', 'C', 40], ['B', 'D', 30], ['C', 'D', 50]])
  it('D = 40 + 50 = 90 via C', () => expect(dijkstra(g12, 'A', 'D')).toMatchObject({ path: ['A', 'C', 'D'], distance: 90 }))
  it('B stays 100 (A→C→D→B would be 120)', () => expect(dijkstra(g12, 'A', 'B')).toMatchObject({ path: ['A', 'B'], distance: 100 }))
})

describe('guide §23 — accessibility makes the route longer', () => {
  const STAIRS: Accessibility = { stairs: true, accessible: false, stepFree: false, verified: true }
  const g23 = g(['A', 'B', 'C'], [['A', 'B', 100, STAIRS], ['A', 'C', 60], ['C', 'B', 80]])
  it('normal: A → B (100 m)', () => expect(dijkstra(g23, 'A', 'B')).toMatchObject({ path: ['A', 'B'], distance: 100 }))
  it('wheelchair: A → C → B (140 m) — the stairs edge is filtered out', () => {
    const r = dijkstra(g23, 'A', 'B', { edgeFilter: edgeFilterFor('wheelchair') })
    expect(r).toMatchObject({ path: ['A', 'C', 'B'], distance: 140 })
    expect(r.rejected).toEqual([{ from: 'A', to: 'B', reason: 'stairs' }])
  })
})

describe('why not BFS or greedy? (real MRTC data)', () => {
  it('BFS picks the fewest edges, not the fewest metres: A → C', () => {
    const bfs = bfsFewestEdges(campusGraph, 'block-a', 'block-c')
    const dij = dijkstra(campusGraph, 'block-a', 'block-c')
    expect(bfs.path).toEqual(['block-a', 'block-c']) // 1 edge, 96.73 m
    expect(dij.path).toEqual(['block-a', 'block-b', 'block-c']) // 2 edges, 90.05 m
    expect(bfs.distance - dij.distance).toBeCloseTo(6.68, 2)
  })

  it('greedy (always take the shortest next edge) walks into a dead end: A → Canteen', () => {
    const gr = greedyRoute(campusGraph, 'block-a', 'canteen')
    expect(gr.distance).toBe(Infinity)
    expect(gr.path[1]).toBe('bike-parking') // locally shortest first step (31.79 m)…
    expect(gr.failure).toMatch(/dead end/) // …that never reaches the canteen
  })

  it('across all 210 ordered pairs, Dijkstra is never beaten', () => {
    const places = campusGraph.allNodes().filter((n) => n.kind !== 'junction').map((n) => n.id)
    let bfsWorse = 0
    let greedyWrong = 0
    for (const a of places)
      for (const b of places) {
        if (a === b) continue
        const d = dijkstra(campusGraph, a, b, { trace: false }).distance
        const bfs = bfsFewestEdges(campusGraph, a, b).distance
        const gr = greedyRoute(campusGraph, a, b).distance
        expect(bfs).toBeGreaterThanOrEqual(d - 1e-9)
        expect(gr).toBeGreaterThanOrEqual(d - 1e-9)
        if (bfs > d + 1e-9) bfsWorse++
        if (gr > d + 1e-9) greedyWrong++
      }
    expect(bfsWorse).toBe(70)
    expect(greedyWrong).toBe(173) // 136 dead ends + 37 longer routes
  })
})

describe('debug log (§45)', () => {
  it('narrates the real run, including lazy-deletion skips', () => {
    const log = formatDijkstraLog(campusGraph, dijkstra(campusGraph, 'block-a', 'canteen'))
    expect(log).toMatch(/Start: Block A/)
    expect(log).toMatch(/Relax Block B → Block C: 96\.73 m → 90\.05 m/)
    expect(log).toMatch(/stale heap entry/)
    expect(log).toMatch(/Total distance:\n174\.83 m/)
  })
})
