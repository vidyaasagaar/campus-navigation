import type { LatLng } from '../graph/types'

/**
 * 3D visualization dataset — kept separate from the navigation dataset and
 * linked to it by `id`.
 *
 * Footprints, rotations and floor counts are APPROXIMATE, read off Google
 * satellite imagery and the two reference photos. They only affect how the
 * buildings look; route distances come from campusMeasurements.json.
 */
export type BuildingStyle = 'academic' | 'hostel' | 'canteen'

export interface BuildingModel {
  id: string
  style: BuildingStyle
  center: LatLng
  /** Facade length (m), along the rotated x axis. */
  width: number
  /** Depth (m). */
  depth: number
  floors: number
  /** Rotation about the vertical axis in radians (campus grid runs ~17° south of east). */
  rotation: number
}

const GRID = -0.3

export const buildingModels: BuildingModel[] = [
  { id: 'block-a', style: 'academic', center: { lat: 17.559624, lng: 78.459306 }, width: 38, depth: 28, floors: 6, rotation: GRID },
  { id: 'block-b', style: 'academic', center: { lat: 17.55952, lng: 78.459658 }, width: 38, depth: 28, floors: 6, rotation: GRID },
  { id: 'block-c', style: 'academic', center: { lat: 17.559427, lng: 78.460198 }, width: 32, depth: 28, floors: 6, rotation: GRID },
  { id: 'girls-hostel', style: 'hostel', center: { lat: 17.5599, lng: 78.45868 }, width: 66, depth: 20, floors: 6, rotation: GRID },
  // NIAT Boys Hostel — same structure as the Girls Hostel (approved by the user).
  { id: 'boys-hostel', style: 'hostel', center: { lat: 17.558476, lng: 78.45728 }, width: 66, depth: 20, floors: 6, rotation: GRID },
  // Central Kitchen: single-storey shed with a green roof.
  { id: 'canteen', style: 'canteen', center: { lat: 17.559073, lng: 78.460977 }, width: 30, depth: 26, floors: 1, rotation: GRID },
]

export const FLOOR_HEIGHT = 3.6

export type SurfaceKind =
  | 'running-track'
  | 'football'
  | 'box-cricket'
  | 'badminton'
  | 'basketball'
  | 'volleyball'
  | 'kabaddi'
  | 'bike-parking'
  | 'car-parking'

export interface SurfaceModel {
  /** Graph node this surface belongs to. */
  id: string
  kind: SurfaceKind
  center: LatLng
  width: number
  depth: number
  rotation: number
}

/**
 * Sports grounds and parking (spec v2 §52–53). Outlines of the track/football
 * ground and box cricket are read off satellite imagery; the courts' split of the
 * bare ground and the parking extents follow the user's description and are
 * APPROXIMATE. Court markings use standard dimensions.
 */
export const surfaceModels: SurfaceModel[] = [
  { id: 'running-track', kind: 'running-track', center: { lat: 17.558301, lng: 78.460094 }, width: 126, depth: 118, rotation: -0.293 },
  { id: 'football-court', kind: 'football', center: { lat: 17.558301, lng: 78.460094 }, width: 104, depth: 96, rotation: -0.293 },
  { id: 'box-cricket', kind: 'box-cricket', center: { lat: 17.55884, lng: 78.45764 }, width: 55, depth: 60, rotation: GRID },
  { id: 'badminton-court', kind: 'badminton', center: { lat: 17.559499, lng: 78.458309 }, width: 40, depth: 42, rotation: GRID },
  { id: 'basketball-court', kind: 'basketball', center: { lat: 17.559315, lng: 78.458704 }, width: 40, depth: 42, rotation: GRID },
  { id: 'volleyball-court', kind: 'volleyball', center: { lat: 17.559027, lng: 78.459053 }, width: 38, depth: 40, rotation: GRID },
  { id: 'kabaddi-court', kind: 'kabaddi', center: { lat: 17.558925, lng: 78.459418 }, width: 38, depth: 40, rotation: GRID },
  { id: 'bike-parking', kind: 'bike-parking', center: { lat: 17.55924, lng: 78.459225 }, width: 30, depth: 7, rotation: GRID },
  { id: 'car-parking', kind: 'car-parking', center: { lat: 17.559138, lng: 78.459547 }, width: 34, depth: 10, rotation: GRID },
]
