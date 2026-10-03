import * as THREE from 'three'
import type { Graph } from '../../graph/Graph'
import { toLocal } from '../../data/geo'
import type { LatLng } from '../../graph/types'
import type { RouteGeometry } from '../routeGeometry'

export interface RouteMatch {
  /** Polyline distance of the closest point on the route. */
  along: number
  /** Perpendicular distance from the position to the route (metres). */
  offset: number
  point: THREE.Vector3
}

/** Map matching: snaps a local (x, z) position to the closest point on the route polyline. */
export function matchToRoute(route: RouteGeometry, x: number, z: number): RouteMatch {
  const { points, cumulative } = route
  let best: RouteMatch = { along: 0, offset: Infinity, point: points[0].clone() }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1)
    const px = a.x + dx * t
    const pz = a.z + dz * t
    const offset = Math.hypot(x - px, z - pz)
    if (offset < best.offset) best = { along: cumulative[i - 1] + Math.sqrt(len2) * t, offset, point: new THREE.Vector3(px, a.y, pz) }
  }
  return best
}

export const matchLatLng = (route: RouteGeometry, p: LatLng) => {
  const [x, z] = toLocal(p)
  return matchToRoute(route, x, z)
}

/**
 * Converts a polyline position into MEASURED metres travelled, segment by
 * segment, so progress agrees with the Google Maps distances on each edge.
 */
export function measuredAlong(route: RouteGeometry, along: number): number {
  let total = 0
  for (const s of route.segments) {
    if (along >= s.endAlong) {
      total += s.distance
      continue
    }
    const span = s.endAlong - s.startAlong || 1
    total += (THREE.MathUtils.clamp(along - s.startAlong, 0, span) / span) * s.distance
    break
  }
  return total
}

/** Inverse of `measuredAlong`: measured metres travelled → polyline distance. */
export function polylineAlong(route: RouteGeometry, measured: number): number {
  let left = measured
  for (const s of route.segments) {
    if (left <= s.distance) return s.startAlong + (s.distance ? left / s.distance : 0) * (s.endAlong - s.startAlong)
    left -= s.distance
  }
  return route.length
}

export const routeTotal = (route: RouteGeometry) => route.segments.reduce((sum, s) => sum + s.distance, 0)

export type Turn = 'left' | 'right' | 'straight' | 'arrive'

export interface Instruction {
  /** Node the user is heading to. */
  nextNode: string
  /** Measured metres until that node. */
  distanceToNext: number
  turn: Turn
  text: string
}

/** Turn direction at a waypoint, from the polyline directions just before and after it. */
function turnAt(route: RouteGeometry, along: number): Turn {
  const { points, cumulative } = route
  let i = cumulative.findIndex((c) => c >= along - 1e-6)
  if (i <= 0 || i >= points.length - 1) return 'straight'
  const inc = points[i].clone().sub(points[i - 1])
  const out = points[i + 1].clone().sub(points[i])
  // Screen-like frame (x east, z south): positive cross = clockwise = right turn.
  const cross = inc.x * out.z - inc.z * out.x
  const angle = Math.atan2(cross, inc.x * out.x + inc.z * out.z)
  if (Math.abs(angle) < THREE.MathUtils.degToRad(30)) return 'straight'
  return angle > 0 ? 'right' : 'left'
}

const roundTo5 = (m: number) => Math.max(5, Math.round(m / 5) * 5)

/** The next instruction, generated from the route's graph segments and geometry (spec §42). */
export function nextInstruction(graph: Graph, route: RouteGeometry, along: number): Instruction {
  const segIndex = route.segments.findIndex((s) => along < s.endAlong - 0.5)
  const last = route.segments.length - 1
  const i = segIndex === -1 ? last : segIndex
  const seg = route.segments[i]
  const nextNode = route.nodePath[i + 1]
  const distanceToNext = Math.max(0, measuredAlong(route, seg.endAlong) - measuredAlong(route, along))
  const name = graph.node(nextNode).name
  if (i === last) {
    return {
      nextNode,
      distanceToNext,
      turn: 'arrive',
      text: distanceToNext < 8 ? `${name} is just ahead.` : `Continue ${roundTo5(distanceToNext)} metres to ${name}.`,
    }
  }
  const turn = turnAt(route, seg.endAlong)
  const action = turn === 'straight' ? 'continue straight' : `turn ${turn}`
  const at = graph.node(nextNode).kind === 'junction' ? `at the ${name.toLowerCase()}` : `at ${name}`
  return {
    nextNode,
    distanceToNext,
    turn,
    text:
      distanceToNext < 12
        ? `${action[0].toUpperCase()}${action.slice(1)} ${at}.`
        : `In ${roundTo5(distanceToNext)} metres, ${action} ${at}.`,
  }
}

/** Closest named or junction node to a position — the restart point for rerouting. */
export function nearestNode(graph: Graph, p: LatLng): { id: string; distance: number } {
  const [x, z] = toLocal(p)
  let best = { id: '', distance: Infinity }
  for (const n of graph.allNodes()) {
    const [nx, nz] = toLocal(n.position)
    const d = Math.hypot(x - nx, z - nz)
    if (d < best.distance) best = { id: n.id, distance: d }
  }
  return best
}
