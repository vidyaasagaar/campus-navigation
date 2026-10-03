import { describe, expect, it } from 'vitest'
import { dijkstra } from '../../algorithms/dijkstra'
import { campusGraph } from '../../data/campusGraph'
import { buildRouteGeometry } from '../routeGeometry'
import { matchLatLng, matchToRoute, measuredAlong, nearestNode, nextInstruction, polylineAlong, routeTotal } from './routeProgress'

const path = dijkstra(campusGraph, 'block-a', 'canteen').path
const route = buildRouteGeometry(campusGraph, path)

describe('route progress', () => {
  it('measured total equals the Dijkstra distance', () => {
    expect(routeTotal(route)).toBeCloseTo(174.83, 5)
    expect(measuredAlong(route, route.length)).toBeCloseTo(174.83, 5)
    expect(measuredAlong(route, 0)).toBe(0)
  })

  it('polylineAlong inverts measuredAlong', () => {
    for (const m of [0, 10, 36.67, 90, 150, 174.83]) expect(measuredAlong(route, polylineAlong(route, m))).toBeCloseTo(m, 6)
  })

  it('progress is monotonic along the polyline', () => {
    let prev = -1
    for (let d = 0; d <= route.length; d += route.length / 50) {
      const m = measuredAlong(route, d)
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
  })

  it('map matching snaps an off-route point back to the route', () => {
    const mid = route.points[Math.floor(route.points.length / 2)]
    const m = matchToRoute(route, mid.x + 4, mid.z - 3)
    expect(m.offset).toBeLessThan(5.1)
    expect(m.along).toBeGreaterThan(0)
  })

  it('a point far from campus is reported as far off-route', () => {
    expect(matchLatLng(route, { lat: 17.45, lng: 78.38 }).offset).toBeGreaterThan(5000)
  })

  it('instructions name the next waypoint and end with arrival', () => {
    expect(nextInstruction(campusGraph, route, 0).nextNode).toBe('block-b')
    const end = nextInstruction(campusGraph, route, route.length)
    expect(end.turn).toBe('arrive')
    expect(end.text).toMatch(/Canteen/)
  })

  it('finds the nearest graph node for rerouting', () => {
    expect(nearestNode(campusGraph, { lat: 17.55952, lng: 78.45928 }).id).toBe('block-a')
  })
})
