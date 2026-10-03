import type { LatLng } from '../graph/types'
import { campus } from './campusGraph'

const M_PER_DEG_LAT = 110_574
const M_PER_DEG_LNG = 111_320 * Math.cos((campus.origin.lat * Math.PI) / 180)

/**
 * Local tangent-plane projection around the campus origin.
 * Three.js frame: +x = east, +z = south, +y = up (metres).
 * Accurate to well under 1 m across a ~1 km campus.
 */
export function toLocal(p: LatLng): [number, number] {
  return [(p.lng - campus.origin.lng) * M_PER_DEG_LNG, -(p.lat - campus.origin.lat) * M_PER_DEG_LAT]
}
