export type LatLng = { lat: number; lng: number }

export type NodeKind =
  | 'academic'
  | 'facility'
  | 'hostel'
  | 'parking'
  | 'sports'
  | 'junction'
  // Indoor kinds — reserved for the indoor expansion.
  | 'entrance'
  | 'lobby'
  | 'corridor'
  | 'staircase'
  | 'lift'
  | 'room'
  | 'lab'
  | 'office'
  | 'washroom'
  | 'exit'

export interface GraphNode {
  id: string
  name: string
  kind: NodeKind
  position: LatLng
  /** Parent building for indoor nodes, e.g. "block-c". */
  building?: string
  /** Floor number for indoor nodes (0 = ground). */
  floor?: number
  /** For entrance nodes: is this a verified accessible entrance? null = not surveyed. */
  accessibleEntrance?: boolean | null
  /** Free-form flags such as "position unverified". */
  notes?: string
}

/**
 * Accessibility facts about one edge. `null` / missing means NOT SURVEYED —
 * the router never treats an unknown value as accessible, it reports it as unverified.
 */
export interface Accessibility {
  accessible?: boolean | null
  stepFree?: boolean | null
  stairs?: boolean | null
  ramp?: boolean | null
  lift?: boolean | null
  surface?: 'paved' | 'unpaved' | 'gravel' | 'mixed' | null
  slope?: 'flat' | 'low' | 'moderate' | 'steep' | null
  widthMeters?: number | null
  obstacle?: string | null
  /** True once someone has checked these values on campus. */
  verified?: boolean
  source?: string | null
}

export type MeasurementSource =
  | 'google-maps-measure-distance'
  | 'google-earth'
  | 'campus-physical-measurement'
  | 'campus-floor-plan'
  | 'user-provided'
  | 'official-campus-data'

export interface GraphEdge {
  from: string
  to: string
  /** Walkable path length in metres. */
  weight: number
  source: MeasurementSource
  verified: boolean
  confidence?: 'high' | 'medium' | 'low'
  /** e.g. "walkway", "road", "forecourt", "stairs" */
  measurementType?: string
  notes?: string
  crossCheck?: string | null
  /** Polyline of the real walking path, from `from` to `to`. */
  path: LatLng[]
  accessibility?: Accessibility
  /** Temporary closure (ramp closed, lift under maintenance, walkway blocked…). */
  closed?: boolean
  closedReason?: string | null
}

/** A connection that exists on the ground but cannot be routed over yet. */
export interface DisabledEdge {
  from: string
  to: string
  reason: 'measurement_required'
  accessibility?: Accessibility
  notes?: string
}
