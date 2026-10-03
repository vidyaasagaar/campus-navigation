import type { Graph } from '../graph/Graph'
import type { Accessibility, GraphEdge } from '../graph/types'
import type { EdgeFilter } from './dijkstra'

export type RouteMode = 'shortest' | 'fastest' | 'wheelchair' | 'step-free' | 'avoid-stairs'

export const ROUTE_MODES: { id: RouteMode; label: string; icon: string; description: string }[] = [
  { id: 'shortest', label: 'Shortest', icon: '↦', description: 'Minimum walking distance over every open path.' },
  {
    id: 'fastest',
    label: 'Fastest',
    icon: '⏱',
    description:
      'Same as Shortest for now: time is estimated with one assumed walking speed for every path, so the shortest path is also the fastest.',
  },
  {
    id: 'wheelchair',
    label: 'Wheelchair',
    icon: '♿',
    description: 'Excludes paths recorded as having stairs, steps, or as not accessible.',
  },
  { id: 'step-free', label: 'Step-free', icon: '⎍', description: 'Excludes paths recorded as having stairs or steps.' },
  { id: 'avoid-stairs', label: 'Avoid stairs', icon: '⤳', description: 'Excludes paths recorded as having stairs.' },
]

export const isConstrained = (mode: RouteMode) => mode === 'wheelchair' || mode === 'step-free' || mode === 'avoid-stairs'

/**
 * Edge eligibility for a route mode (spec §34.4). Only RECORDED barriers
 * exclude an edge; unknown values are allowed but reported as unverified by
 * `evaluateRoute`, never presented as accessible.
 */
export function edgeFilterFor(mode: RouteMode): EdgeFilter {
  return (e: GraphEdge) => {
    if (e.closed) return `closed${e.closedReason ? `: ${e.closedReason}` : ''}`
    const a = e.accessibility ?? {}
    if (mode === 'avoid-stairs' || mode === 'step-free' || mode === 'wheelchair') {
      if (a.stairs === true) return 'stairs'
    }
    if (mode === 'step-free' || mode === 'wheelchair') {
      if (a.stepFree === false) return 'not step-free'
    }
    if (mode === 'wheelchair') {
      if (a.accessible === false) return 'not accessible'
    }
    return null
  }
}

/**
 * The node(s) a route should end at for a destination place (spec §34.7, §40.6).
 * A place's own node is its front entrance; buildings may also have extra
 * entrance nodes (`kind: 'entrance'`, `building: id`). In wheelchair / step-free
 * mode, entrances recorded as NOT accessible are dropped and verified accessible
 * ones are preferred. An empty result means no usable entrance is known — the
 * caller must say so instead of substituting a standard route.
 */
export function destinationNodes(graph: Graph, place: string, mode: RouteMode): string[] {
  const extra = graph.allNodes().filter((n) => n.kind === 'entrance' && n.building === place)
  const candidates = [graph.node(place), ...extra]
  if (mode !== 'wheelchair' && mode !== 'step-free') return candidates.map((n) => n.id)
  const verified = candidates.filter((n) => n.accessibleEntrance === true)
  if (verified.length) return verified.map((n) => n.id)
  return candidates.filter((n) => n.accessibleEntrance !== false).map((n) => n.id)
}

/** Why a place has no usable destination node in this mode, if that is the case. */
export function entranceBlocker(graph: Graph, place: string, mode: RouteMode): string | null {
  if (destinationNodes(graph, place, mode).length) return null
  return `${graph.node(place).name}: the front entrance is recorded as not wheelchair accessible, and no other verified accessible entrance is known.`
}

export interface RouteAssessment {
  /** Segments whose relevant accessibility facts were never surveyed. */
  unverifiedSegments: number
  totalSegments: number
  checks: string[]
  warnings: { icon: string; text: string }[]
}

const RELEVANT: Record<RouteMode, (keyof Accessibility)[]> = {
  shortest: [],
  fastest: [],
  'avoid-stairs': ['stairs'],
  'step-free': ['stairs', 'stepFree'],
  wheelchair: ['stairs', 'stepFree', 'accessible'],
}

/** Checks and warnings for a calculated route, derived only from recorded data (spec §34.8–34.9). */
export function evaluateRoute(graph: Graph, path: string[], mode: RouteMode): RouteAssessment {
  const edges = path.slice(1).map((v, i) => graph.edge(path[i], v)!)
  const warnings: RouteAssessment['warnings'] = []
  const add = (icon: string, text: string) => {
    if (!warnings.some((w) => w.text === text)) warnings.push({ icon, text })
  }
  let unverified = 0
  for (const e of edges) {
    const a = e.accessibility ?? {}
    if (RELEVANT[mode].some((k) => a[k] == null) || (isConstrained(mode) && !a.verified)) unverified++
    if (a.stairs === true) add('⚠', 'Stairs ahead')
    if (a.slope === 'steep') add('⚠', 'Steep slope')
    if (a.surface === 'unpaved' || a.surface === 'gravel' || a.surface === 'mixed') add('⚠', 'Uneven surface')
    if (a.widthMeters != null && a.widthMeters < 1.2) add('⚠', 'Narrow passage')
    if (a.obstacle) add('⚠', a.obstacle)
    if (a.lift === true) add('ⓘ', 'Verify lift availability before travel')
  }
  const all = (k: keyof Accessibility) => edges.length > 0 && edges.every((e) => e.accessibility?.[k] === true)
  const any = (k: keyof Accessibility) => edges.some((e) => e.accessibility?.[k] === true)
  const checks: string[] = []
  if (all('stepFree') && edges.every((e) => e.accessibility?.stairs === false)) checks.push('Step-free (recorded)')
  if (edges.length > 0 && edges.every((e) => e.accessibility?.stairs === false)) checks.push('No stairs (recorded)')
  if (any('ramp')) checks.push('Ramp on route')
  if (any('lift')) checks.push('Lift on route')
  if (isConstrained(mode) && path.length && graph.node(path[path.length - 1]).accessibleEntrance === true)
    checks.push('Accessible entrance at destination (user-verified)')
  if (unverified > 0 && (isConstrained(mode) || edges.some((e) => !e.accessibility?.verified)))
    add('⚠', `Accessibility data not verified for ${unverified} of ${edges.length} segment${edges.length === 1 ? '' : 's'}`)
  return { unverifiedSegments: unverified, totalSegments: edges.length, checks, warnings }
}
