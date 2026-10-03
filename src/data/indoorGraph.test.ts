import { describe, expect, it } from 'vitest'
import { dijkstra } from '../algorithms/dijkstra'
import { campusGraphWithIndoor as g, floorPlan, pendingIndoorChain } from './indoorGraph'

describe('standard classroom floor (spec §36)', () => {
  const plan = floorPlan('block-c', 2)

  it('has 2 west + 3 east classrooms and HOD/Staff to the south, with stable ids', () => {
    expect(plan.rooms.filter((r) => r.side === 'west').map((r) => r.id)).toEqual(['C-F2-R01', 'C-F2-R02'])
    expect(plan.rooms.filter((r) => r.side === 'east').map((r) => r.id)).toEqual(['C-F2-R03', 'C-F2-R04', 'C-F2-R05'])
    expect(plan.rooms.filter((r) => r.side === 'south').map((r) => r.id)).toEqual(['C-F2-HOD', 'C-F2-STAFF'])
  })

  it('does not invent room numbers', () => {
    expect(plan.rooms.every((r) => r.number === null)).toBe(true)
  })

  it('uses C-G-… for the ground floor', () => {
    expect(floorPlan('block-c', 0).stairsId).toBe('C-G-STAIRS')
  })

  it('indoor nodes exist but are unreachable until distances are measured', () => {
    expect(g.hasNode('C-F2-R04')).toBe(true)
    expect(dijkstra(g, 'block-a', 'C-F2-R04', { trace: false }).path).toEqual([])
    // Outdoor routing is unaffected.
    expect(dijkstra(g, 'block-a', 'canteen', { trace: false }).distance).toBeCloseTo(174.83, 5)
  })

  it('lists the pending indoor chain, with vertical movement as edges', () => {
    expect(pendingIndoorChain(g, 'block-c', 'C-F2-R04')).toEqual([
      'block-c',
      'C-G-CORRIDOR',
      'C-G-STAIRS',
      'C-F1-STAIRS',
      'C-F2-STAIRS',
      'C-F2-CORRIDOR',
      'C-F2-R04',
    ])
    const vertical = g.disabled.find((e) => e.from === 'C-F1-STAIRS' && e.to === 'C-F2-STAIRS')
    expect(vertical?.accessibility?.stairs).toBe(true)
  })
})
