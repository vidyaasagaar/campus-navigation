import { describe, expect, it } from 'vitest'
import { edgeFilterFor } from '../../algorithms/accessibility'
import { dijkstra } from '../../algorithms/dijkstra'
import { campusGraph } from '../../data/campusGraph'
import { isOffRoute, judgeFix, metresBetween, type PositionFix } from './locationFilter'
import { nearestNode } from './routeProgress'

const fix = (lat: number, lng: number, accuracy: number, t: number): PositionFix => ({ lat, lng, accuracy, timestamp: t, heading: null, speed: null })

describe('location filter', () => {
  it('rejects low-accuracy fixes', () => {
    expect(judgeFix(null, fix(17.5595, 78.4592, 60, 0))).toEqual({ use: false, reason: 'low-accuracy' })
  })

  it('accepts normal walking movement', () => {
    const a = fix(17.5595, 78.4592, 8, 0)
    const b = fix(17.55955, 78.4592, 8, 5000) // ~5.5 m in 5 s
    expect(judgeFix(a, b)).toEqual({ use: true })
  })

  it('rejects an implausible jump', () => {
    const a = fix(17.5595, 78.4592, 5, 0)
    const b = fix(17.5605, 78.4592, 5, 1000) // ~110 m in 1 s
    expect(judgeFix(a, b)).toEqual({ use: false, reason: 'outlier' })
  })

  it('haversine distance is sane', () => {
    expect(metresBetween({ lat: 17.5595, lng: 78.4592 }, { lat: 17.5605, lng: 78.4592 })).toBeCloseTo(111.2, 0)
  })
})

describe('rerouting (spec §46)', () => {
  it('small drift is not off-route; leaving the path is', () => {
    expect(isOffRoute(12, 8)).toBe(false) // within 20 m
    expect(isOffRoute(30, 8)).toBe(true)
    expect(isOffRoute(30, 25)).toBe(false) // poor accuracy widens the band to 37.5 m
  })

  it('a user who wandered to the canteen while heading A → Box Cricket is rerouted from the nearest node', () => {
    // Planned route never passes the canteen.
    const planned = dijkstra(campusGraph, 'block-a', 'box-cricket').path
    expect(planned).not.toContain('canteen')
    const here = { lat: 17.55908, lng: 78.46085 } // beside the Central Kitchen
    const from = nearestNode(campusGraph, here).id
    expect(from).toBe('canteen')
    const re = dijkstra(campusGraph, from, 'box-cricket')
    expect(re.path[0]).toBe('canteen')
    expect(re.path.at(-1)).toBe('box-cricket')
    // Reroute keeps the accessibility mode: wheelchair still reaches box cricket (no recorded barriers).
    expect(dijkstra(campusGraph, from, 'box-cricket', { edgeFilter: edgeFilterFor('wheelchair') }).distance).toBeCloseTo(re.distance, 6)
  })
})
