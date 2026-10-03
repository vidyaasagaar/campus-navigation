import { Graph } from '../graph/Graph'
import type { Accessibility, LatLng, MeasurementSource, NodeKind } from '../graph/types'
import raw from './campusMeasurements.json'

export interface MeasurementConnection {
  from: string
  to: string
  distanceMeters: number | null
  source: MeasurementSource
  measurementType?: string
  verified: boolean
  walkable: boolean
  confidence?: 'high' | 'medium' | 'low'
  crossCheck?: string | null
  notes?: string
  status?: string
  path?: [number, number][]
  accessibility?: Accessibility
  closed?: boolean
  closedReason?: string | null
}

export interface MeasurementLocation {
  id: string
  name: string
  type: NodeKind
  entrance: LatLng
  identification?: string
  /** Verified accessibility of the front entrance (spec v2 §40.1); absent = unknown. */
  accessibleFrontEntrance?: boolean
  accessibilitySource?: string
}

export interface CampusMeasurements {
  campus: {
    id: string
    name: string
    fullName: string
    address: string
    googlePlaceCoordinate: LatLng
    origin: LatLng
  }
  locations: MeasurementLocation[]
  connections: MeasurementConnection[]
}

export const measurements = raw as unknown as CampusMeasurements
export const campus = measurements.campus

/**
 * Builds the navigation graph from campusMeasurements.json.
 * Edges without a measured distance are kept as "disabled" (shown as
 * "Measurement required") and never used for routing — no distance is invented.
 */
export function buildCampusGraph(data: CampusMeasurements = measurements): Graph {
  const g = new Graph()
  for (const loc of data.locations) {
    g.addNode({
      id: loc.id,
      name: loc.name,
      kind: loc.type,
      position: loc.entrance,
      accessibleEntrance: loc.accessibleFrontEntrance ?? null,
    })
  }
  for (const c of data.connections) {
    if (!c.walkable) continue
    if (c.distanceMeters == null || !(c.distanceMeters > 0)) {
      g.addDisabledEdge({ from: c.from, to: c.to, reason: 'measurement_required', accessibility: c.accessibility, notes: c.notes })
      continue
    }
    const path = (c.path ?? []).map(([lat, lng]) => ({ lat, lng }))
    g.addEdge({
      from: c.from,
      to: c.to,
      weight: c.distanceMeters,
      source: c.source,
      verified: c.verified,
      confidence: c.confidence,
      measurementType: c.measurementType,
      notes: c.notes,
      crossCheck: c.crossCheck,
      accessibility: c.accessibility,
      closed: c.closed,
      closedReason: c.closedReason,
      path: path.length >= 2 ? path : [g.node(c.from).position, g.node(c.to).position],
    })
  }
  return g
}

export const campusGraph = buildCampusGraph()
