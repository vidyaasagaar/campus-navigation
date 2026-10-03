import { describe, expect, it } from 'vitest'
import { Graph } from '../graph/Graph'
import type { Accessibility, NodeKind } from '../graph/types'
import { campusGraph } from '../data/campusGraph'
import { destinationNodes, edgeFilterFor, entranceBlocker, evaluateRoute, type RouteMode } from './accessibility'
import { dijkstra } from './dijkstra'

const at = { lat: 0, lng: 0 }
type E = [string, string, number, Accessibility?, { closed?: boolean }?]

function makeGraph(nodes: (string | { id: string; kind: NodeKind; building?: string; accessibleEntrance?: boolean | null })[], edges: E[]) {
  const g = new Graph()
  for (const n of nodes) {
    if (typeof n === 'string') g.addNode({ id: n, name: n, kind: 'junction', position: at })
    else g.addNode({ name: n.id, position: at, ...n })
  }
  for (const [from, to, weight, accessibility, extra] of edges)
    g.addEdge({ from, to, weight, source: 'user-provided', verified: true, path: [at, at], accessibility, ...extra })
  return g
}

const STAIRS: Accessibility = { stairs: true, stepFree: false, accessible: false, verified: true }
const RAMP: Accessibility = { stairs: false, stepFree: true, accessible: true, ramp: true, verified: true }
const LIFT: Accessibility = { stairs: false, stepFree: true, accessible: true, lift: true, verified: true }
const PAVED: Accessibility = { stairs: false, stepFree: true, accessible: true, surface: 'paved', verified: true }

const route = (g: Graph, from: string, to: string, mode: RouteMode) =>
  dijkstra(g, from, destinationNodes(g, to, mode), { edgeFilter: edgeFilterFor(mode) })

describe('accessibility-aware Dijkstra (spec §34.12)', () => {
  // A ──stairs 50── C
  // A ──paved 40── R ──ramp 40── C
  const g = makeGraph(['A', 'R', 'C'], [
    ['A', 'C', 50, STAIRS],
    ['A', 'R', 40, PAVED],
    ['R', 'C', 40, RAMP],
  ])

  it('1. normal shortest route takes the minimum distance (stairs allowed)', () => {
    const r = route(g, 'A', 'C', 'shortest')
    expect(r.path).toEqual(['A', 'C'])
    expect(r.distance).toBe(50)
  })

  it('2. wheelchair route avoids the stairs and uses the ramp', () => {
    const r = route(g, 'A', 'C', 'wheelchair')
    expect(r.path).toEqual(['A', 'R', 'C'])
    expect(r.distance).toBe(80)
    expect(r.rejected.some((x) => x.reason === 'stairs')).toBe(true)
    const a = evaluateRoute(g, r.path, 'wheelchair')
    expect(a.checks).toContain('Step-free (recorded)')
    expect(a.checks).toContain('Ramp on route')
    expect(a.unverifiedSegments).toBe(0)
  })

  it('3. lift unavailable → recalculates; with no other step-free link there is no route', () => {
    // Ground ──stairs 10── F2,  Ground ──lift 12── LIFT-F2 ──corridor 3── F2
    const build = (liftClosed: boolean) =>
      makeGraph(['G', 'F2', 'LIFT-F2'], [
        ['G', 'F2', 10, STAIRS],
        ['G', 'LIFT-F2', 12, LIFT, { closed: liftClosed }],
        ['LIFT-F2', 'F2', 3, PAVED],
      ])
    expect(route(build(false), 'G', 'F2', 'wheelchair')).toMatchObject({ path: ['G', 'LIFT-F2', 'F2'], distance: 15 })
    expect(evaluateRoute(build(false), ['G', 'LIFT-F2', 'F2'], 'wheelchair').warnings.map((w) => w.text)).toContain(
      'Verify lift availability before travel',
    )
    const liftDown = build(true)
    const r = route(liftDown, 'G', 'F2', 'wheelchair')
    expect(r.path).toEqual([])
    expect(r.rejected.map((x) => x.reason)).toEqual(expect.arrayContaining(['stairs', 'closed']))
    // Walking users still get the stairs.
    expect(route(liftDown, 'G', 'F2', 'shortest').distance).toBe(10)
  })

  it('4. ramp closed → another accessible route is considered', () => {
    const g2 = makeGraph(['A', 'R1', 'R2', 'C'], [
      ['A', 'C', 50, STAIRS],
      ['A', 'R1', 30, PAVED],
      ['R1', 'C', 30, RAMP, { closed: true }],
      ['A', 'R2', 50, PAVED],
      ['R2', 'C', 50, RAMP],
    ])
    const r = route(g2, 'A', 'C', 'wheelchair')
    expect(r.path).toEqual(['A', 'R2', 'C'])
    expect(r.distance).toBe(100)
  })

  it('5. no accessible route → empty result, never a stairs route', () => {
    const g3 = makeGraph(['A', 'C'], [['A', 'C', 50, STAIRS]])
    const r = route(g3, 'A', 'C', 'step-free')
    expect(r.path).toEqual([])
    expect(r.distance).toBe(Infinity)
  })

  it('6. accessibility mode selects the accessible entrance', () => {
    // C's own node is its (non-accessible) front entrance; C-side is a verified accessible entrance.
    const g4 = makeGraph(
      [
        'A',
        { id: 'C', kind: 'academic', accessibleEntrance: false },
        { id: 'C-side', kind: 'entrance', building: 'C', accessibleEntrance: true },
      ],
      [
        ['A', 'C', 30, PAVED],
        ['A', 'C-side', 60, PAVED],
      ],
    )
    expect(route(g4, 'A', 'C', 'shortest').path).toEqual(['A', 'C'])
    expect(route(g4, 'A', 'C', 'wheelchair').path).toEqual(['A', 'C-side'])
  })

  it('avoid-stairs only rejects recorded stairs', () => {
    const g5 = makeGraph(['A', 'B'], [['A', 'B', 10, { stairs: false, stepFree: false }]])
    expect(route(g5, 'A', 'B', 'avoid-stairs').path).toEqual(['A', 'B'])
    expect(route(g5, 'A', 'B', 'step-free').path).toEqual([])
  })
})

describe('real campus data', () => {
  it('Block C front is not wheelchair accessible → no substitute route, explicit reason (spec §40.6)', () => {
    expect(destinationNodes(campusGraph, 'block-c', 'wheelchair')).toEqual([])
    expect(entranceBlocker(campusGraph, 'block-c', 'wheelchair')).toMatch(/not wheelchair accessible/)
    // Walking users and avoid-stairs mode still reach it.
    expect(destinationNodes(campusGraph, 'block-c', 'avoid-stairs')).toEqual(['block-c'])
  })

  it('Blocks A and B have verified accessible front entrances', () => {
    expect(destinationNodes(campusGraph, 'block-a', 'wheelchair')).toEqual(['block-a'])
    const r = route(campusGraph, 'block-a', 'block-b', 'wheelchair')
    expect(evaluateRoute(campusGraph, r.path, 'wheelchair').checks).toContain('Accessible entrance at destination (user-verified)')
  })

  it('unsurveyed edges are allowed but always reported as unverified', () => {
    const r = route(campusGraph, 'block-a', 'canteen', 'wheelchair')
    expect(r.path).toEqual(['block-a', 'block-b', 'block-c', 'canteen'])
    const a = evaluateRoute(campusGraph, r.path, 'wheelchair')
    expect(a.unverifiedSegments).toBe(3)
    expect(a.checks).toEqual([])
    expect(a.warnings.map((w) => w.text).join()).toMatch(/not verified/)
  })
})
