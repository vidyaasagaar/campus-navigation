import * as THREE from 'three'
import type { Graph } from '../graph/Graph'
import { toLocal } from '../data/geo'

export interface RouteSegment {
  from: string
  to: string
  /** Measured distance of this edge (metres). */
  distance: number
  midpoint: THREE.Vector3
  /** Polyline distance where the segment starts / ends. */
  startAlong: number
  endAlong: number
}

export interface RouteGeometry {
  points: THREE.Vector3[]
  /** Cumulative polyline length at each point. */
  cumulative: number[]
  length: number
  segments: RouteSegment[]
  nodePath: string[]
}

/** Turns a node path from Dijkstra into the real walkway polylines stored on each edge. */
export function buildRouteGeometry(graph: Graph, nodePath: string[], y = 0.6): RouteGeometry {
  const points: THREE.Vector3[] = []
  const segments: RouteSegment[] = []
  const ends: number[] = []
  for (let i = 1; i < nodePath.length; i++) {
    const edge = graph.edge(nodePath[i - 1], nodePath[i])
    if (!edge) throw new Error(`No edge ${nodePath[i - 1]} → ${nodePath[i]}`)
    const pts = edge.path.map((p) => {
      const [x, z] = toLocal(p)
      return new THREE.Vector3(x, y, z)
    })
    const segStart = points.length
    points.push(...(segStart === 0 ? pts : pts.slice(1)))
    const segPts = points.slice(Math.max(0, segStart - 1))
    segments.push({ from: edge.from, to: edge.to, distance: edge.weight, midpoint: pointAlong(segPts, 0.5), startAlong: 0, endAlong: 0 })
    ends.push(points.length - 1)
  }
  if (points.length === 0 && nodePath.length === 1) {
    const [x, z] = toLocal(graph.node(nodePath[0]).position)
    points.push(new THREE.Vector3(x, y, z))
  }
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + points[i].distanceTo(points[i - 1]))
  segments.forEach((seg, i) => {
    seg.startAlong = i === 0 ? 0 : cumulative[ends[i - 1]]
    seg.endAlong = cumulative[ends[i]]
  })
  return { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0, segments, nodePath }
}

function pointAlong(pts: THREE.Vector3[], fraction: number): THREE.Vector3 {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1])
  let target = total * fraction
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].distanceTo(pts[i - 1])
    if (target <= d) return pts[i - 1].clone().lerp(pts[i], d === 0 ? 0 : target / d)
    target -= d
  }
  return pts[pts.length - 1].clone()
}

/** Position and heading at a given distance along the route. */
export function sampleRoute(route: RouteGeometry, distance: number): { position: THREE.Vector3; direction: THREE.Vector3 } {
  const { points, cumulative } = route
  if (points.length === 1) return { position: points[0].clone(), direction: new THREE.Vector3(0, 0, -1) }
  const d = THREE.MathUtils.clamp(distance, 0, route.length)
  let i = 1
  while (i < cumulative.length - 1 && cumulative[i] < d) i++
  const segLen = cumulative[i] - cumulative[i - 1] || 1
  const t = (d - cumulative[i - 1]) / segLen
  return {
    position: points[i - 1].clone().lerp(points[i], t),
    direction: points[i].clone().sub(points[i - 1]).normalize(),
  }
}
