import { Graph } from '../graph/Graph'
import type { NodeKind } from '../graph/types'
import { buildCampusGraph, measurements } from './campusGraph'
import raw from './floorLayouts.json'

export interface FloorLayouts {
  template: {
    classrooms: { west: number; east: number }
    specialRooms: { key: string; name: string; type: string; side: 'south' }[]
    hodStaffOrder: string[] | null
    verified: boolean
    notes: string
  }
  blocks: {
    blockId: string
    letter: string
    floors: number[]
    floorsVerified: boolean
    floorsNote: string
    /** Node id → real room number, once collected (e.g. "C-F2-R04": "C-204"). */
    roomNumbers: Record<string, string>
    /** null = unknown whether the block has a lift. */
    lift: boolean | null
  }[]
  dataStillRequired: string[]
}

export const floorLayouts = raw as FloorLayouts

export interface IndoorRoom {
  id: string
  /** Real room number if known, otherwise null. */
  number: string | null
  label: string
  kind: NodeKind
  side: 'west' | 'east' | 'south'
  /** Order along its side, north → south (west/east) or as listed (south). */
  index: number
}

export interface FloorPlan {
  blockId: string
  floor: number
  code: string
  corridorId: string
  stairsId: string
  rooms: IndoorRoom[]
}

/** "C-G-…" for the ground floor, "C-F2-…" otherwise (spec §7 and §36.2). */
export const floorCode = (letter: string, floor: number) => `${letter}-${floor === 0 ? 'G' : `F${floor}`}`

export function floorPlan(blockId: string, floor: number, data: FloorLayouts = floorLayouts): FloorPlan {
  const block = data.blocks.find((b) => b.blockId === blockId)
  if (!block) throw new Error(`No floor layout for ${blockId}`)
  const code = floorCode(block.letter, floor)
  const t = data.template
  const rooms: IndoorRoom[] = []
  let n = 0
  for (const side of ['west', 'east'] as const) {
    for (let i = 0; i < t.classrooms[side]; i++) {
      n++
      const id = `${code}-R${String(n).padStart(2, '0')}`
      const number = block.roomNumbers[id] ?? null
      rooms.push({ id, number, label: number ?? `Classroom ${n}`, kind: 'room', side, index: i })
    }
  }
  t.specialRooms.forEach((s, i) => {
    const id = `${code}-${s.key}`
    rooms.push({ id, number: block.roomNumbers[id] ?? null, label: s.name, kind: 'office', side: 'south', index: i })
  })
  return { blockId, floor, code, corridorId: `${code}-CORRIDOR`, stairsId: `${code}-STAIRS`, rooms }
}

/**
 * Adds every conceptual indoor node to the graph. All indoor connections are
 * DISABLED until their distances are measured — Dijkstra never routes over them,
 * so no indoor distance is ever invented.
 */
export function addIndoor(g: Graph, data: FloorLayouts = floorLayouts): FloorPlan[] {
  const plans: FloorPlan[] = []
  const unverified = 'conceptual position — not verified'
  for (const block of data.blocks) {
    const entrance = g.node(block.blockId).position
    let prevStairs: string | null = null
    for (const floor of block.floors) {
      const plan = floorPlan(block.blockId, floor, data)
      plans.push(plan)
      const base = { position: entrance, building: block.blockId, floor, notes: unverified }
      g.addNode({ ...base, id: plan.corridorId, name: `${plan.code} corridor`, kind: 'corridor' })
      g.addNode({ ...base, id: plan.stairsId, name: `${plan.code} staircase`, kind: 'staircase' })
      for (const r of plan.rooms) g.addNode({ ...base, id: r.id, name: r.label, kind: r.kind })

      const pending = (from: string, to: string, notes?: string, stairs?: boolean) =>
        g.addDisabledEdge({
          from,
          to,
          reason: 'measurement_required',
          notes,
          accessibility: stairs ? { stairs: true, stepFree: false, verified: false } : undefined,
        })
      for (const r of plan.rooms) pending(r.id, plan.corridorId)
      pending(plan.corridorId, plan.stairsId)
      if (floor === 0) pending(block.blockId, plan.corridorId, 'building entrance to ground-floor corridor')
      if (prevStairs) pending(prevStairs, plan.stairsId, 'vertical: staircase between floors', true)
      prevStairs = plan.stairsId
    }
  }
  return plans
}

export const campusGraphWithIndoor = buildCampusGraph(measurements)
export const floorPlans = addIndoor(campusGraphWithIndoor)

/**
 * The chain of indoor connections from a building entrance to a room,
 * following the (disabled) conceptual topology. Used to tell the user which
 * measurements are still needed for that destination.
 */
export function pendingIndoorChain(g: Graph, buildingId: string, roomId: string): string[] {
  const adj = new Map<string, string[]>()
  for (const e of g.disabled) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from])
  }
  const prev = new Map<string, string>([[buildingId, '']])
  const queue = [buildingId]
  while (queue.length) {
    const u = queue.shift()!
    if (u === roomId) break
    for (const v of adj.get(u) ?? []) {
      if (prev.has(v)) continue
      prev.set(v, u)
      queue.push(v)
    }
  }
  if (!prev.has(roomId)) return []
  const chain: string[] = []
  for (let at = roomId; at; at = prev.get(at)!) chain.unshift(at)
  return chain
}
