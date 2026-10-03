import { describe, expect, it } from 'vitest'
import { Graph } from '../graph/Graph'
import { buildCampusGraph, campusGraph, measurements } from '../data/campusGraph'
import { dijkstra } from './dijkstra'
import { kShortestRoutes } from './alternativeRoutes'
import { MinHeap } from './MinHeap'

const at = { lat: 0, lng: 0 }
function makeGraph(nodes: string[], edges: [string, string, number][]) {
  const g = new Graph()
  for (const id of nodes) g.addNode({ id, name: id, kind: 'junction', position: at })
  for (const [from, to, weight] of edges)
    g.addEdge({ from, to, weight, source: 'user-provided', verified: true, path: [at, at] })
  return g
}

describe('MinHeap', () => {
  it('pops in priority order', () => {
    const h = new MinHeap<string>()
    ;[5, 1, 4, 2, 3, 0].forEach((p) => h.push(`n${p}`, p))
    const out: number[] = []
    while (h.size) out.push(h.pop()!.priority)
    expect(out).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('dijkstra', () => {
  // Spec example: A→B 80, B→C 110, C→Canteen 60, plus a longer direct A→C.
  const g = makeGraph(
    ['A', 'B', 'C', 'K', 'X'],
    [
      ['A', 'B', 80],
      ['B', 'C', 110],
      ['C', 'K', 60],
      ['A', 'C', 250],
    ],
  )

  it('finds the minimum total path', () => {
    const r = dijkstra(g, 'A', 'K')
    expect(r.path).toEqual(['A', 'B', 'C', 'K'])
    expect(r.distance).toBe(250)
  })

  it('prefers a longer hop count when it is shorter in metres', () => {
    const r = dijkstra(g, 'A', 'C')
    expect(r.path).toEqual(['A', 'B', 'C'])
    expect(r.distance).toBe(190)
  })

  it('returns an empty path for unreachable targets', () => {
    const r = dijkstra(g, 'A', 'X')
    expect(r.path).toEqual([])
    expect(r.distance).toBe(Infinity)
  })

  it('source equals target', () => {
    expect(dijkstra(g, 'B', 'B')).toMatchObject({ path: ['B'], distance: 0 })
  })

  it('is symmetric on an undirected graph', () => {
    expect(dijkstra(g, 'K', 'A').distance).toBe(dijkstra(g, 'A', 'K').distance)
  })

  it('records a trace ending in done', () => {
    const r = dijkstra(g, 'A', 'K')
    expect(r.steps[0].type).toBe('init')
    expect(r.steps.at(-1)).toMatchObject({ type: 'done', distance: 250 })
    expect(r.steps.some((s) => s.type === 'relax' && s.improved)).toBe(true)
  })

  it('matches brute-force on random graphs', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let t = 0; t < 30; t++) {
      const n = 7
      const ids = Array.from({ length: n }, (_, i) => `v${i}`)
      const edges: [string, string, number][] = []
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) if (rand() < 0.45) edges.push([ids[i], ids[j], 1 + Math.floor(rand() * 100)])
      const rg = makeGraph(ids, edges)
      // Floyd–Warshall baseline
      const d = ids.map((a) => ids.map((b) => (a === b ? 0 : Infinity)))
      for (const [a, b, w] of edges) {
        const i = ids.indexOf(a), j = ids.indexOf(b)
        d[i][j] = d[j][i] = Math.min(d[i][j], w)
      }
      for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) d[i][j] = Math.min(d[i][j], d[i][k] + d[k][j])
      for (let j = 0; j < n; j++) expect(dijkstra(rg, 'v0', ids[j]).distance).toBe(d[0][j])
    }
  })
})

describe('kShortestRoutes', () => {
  it('only returns routes that exist', () => {
    const g = makeGraph(['A', 'B', 'C'], [['A', 'B', 1], ['B', 'C', 1]])
    expect(kShortestRoutes(g, 'A', 'C', 3)).toHaveLength(1)
  })

  it('orders alternatives by distance', () => {
    const g = makeGraph(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'B', 1],
        ['B', 'D', 1],
        ['A', 'C', 2],
        ['C', 'D', 2],
        ['A', 'D', 10],
      ],
    )
    const routes = kShortestRoutes(g, 'A', 'D', 3)
    expect(routes.map((r) => r.distance)).toEqual([2, 4, 10])
  })
})

describe('campus graph', () => {
  it('loads every measured location and edge', () => {
    expect(campusGraph.vertexCount).toBe(measurements.locations.length)
    expect(campusGraph.edgeCount).toBe(measurements.connections.filter((c) => c.distanceMeters != null).length)
  })

  it('A → C prefers going past Block B (90.05 m) over the forecourt edge (96.73 m)', () => {
    const r = dijkstra(campusGraph, 'block-a', 'block-c')
    expect(r.path).toEqual(['block-a', 'block-b', 'block-c'])
    expect(r.distance).toBeCloseTo(36.67 + 53.38, 5)
    const alts = kShortestRoutes(campusGraph, 'block-a', 'block-c')
    expect(alts[0].distance).toBeCloseTo(90.05, 5)
    expect(alts[1].distance).toBeCloseTo(96.73, 5)
    // Third real option: via the parking strip (A → bike parking → car parking → B → C).
    expect(alts[2].path).toEqual(['block-a', 'bike-parking', 'car-parking', 'block-b', 'block-c'])
  })

  it('milestone route: A → B → C → Canteen', () => {
    const r = dijkstra(campusGraph, 'block-a', 'canteen')
    expect(r.path).toEqual(['block-a', 'block-b', 'block-c', 'canteen'])
    expect(r.distance).toBeCloseTo(36.67 + 53.38 + 84.78, 5)
  })

  it('Girls → Boys Hostel follows the road junctions, never a direct edge (spec §52)', () => {
    expect(campusGraph.edge('girls-hostel', 'boys-hostel')).toBeUndefined()
    const r = dijkstra(campusGraph, 'girls-hostel', 'boys-hostel')
    expect(r.path).toEqual([
      'girls-hostel',
      'jn-hostel-road',
      'jn-lane-north',
      'badminton-court',
      'jn-lane-south',
      'box-cricket',
      'boys-hostel',
    ])
    expect(r.distance).toBeCloseTo(234.23, 2)
  })

  it('every location reaches the canteen', () => {
    for (const n of campusGraph.allNodes()) expect(dijkstra(campusGraph, n.id, 'canteen').path.length).toBeGreaterThan(0)
  })

  it('never routes over an unmeasured connection', () => {
    const data = structuredClone(measurements)
    data.connections.push({ from: 'girls-hostel', to: 'canteen', distanceMeters: null, source: 'user-provided', verified: false, walkable: true })
    const g = buildCampusGraph(data)
    expect(g.disabled).toHaveLength(1)
    expect(dijkstra(g, 'girls-hostel', 'canteen').path).not.toEqual(['girls-hostel', 'canteen'])
  })
})
