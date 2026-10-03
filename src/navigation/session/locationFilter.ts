export interface PositionFix {
  lat: number
  lng: number
  /** Reported accuracy radius in metres. The W3C spec does not fix a confidence level (MDN describes 95%; Android reports 68%), so treat it as approximate. */
  accuracy: number
  timestamp: number
  heading: number | null
  speed: number | null
}

/** Fixes worse than this are shown as a warning and not used for progress (spec §43.3). */
export const MAX_USABLE_ACCURACY_M = 35
/** Faster than a sprint between two fixes means a GPS jump, not movement. */
const MAX_PLAUSIBLE_SPEED_M_S = 7

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type FixVerdict = { use: true } | { use: false; reason: 'low-accuracy' | 'outlier' }

/** Accuracy validation + outlier rejection (spec §39.1, §43.2). The raw fix is always kept for display. */
export function judgeFix(prev: PositionFix | null, fix: PositionFix): FixVerdict {
  if (!(fix.accuracy <= MAX_USABLE_ACCURACY_M)) return { use: false, reason: 'low-accuracy' }
  if (prev) {
    const dt = Math.max(0.5, (fix.timestamp - prev.timestamp) / 1000)
    const jump = metresBetween(prev, fix)
    // Allow for both fixes' uncertainty before calling it an outlier.
    if (jump - fix.accuracy - prev.accuracy > MAX_PLAUSIBLE_SPEED_M_S * dt) return { use: false, reason: 'outlier' }
  }
  return { use: true }
}

export { metresBetween }

/** Distance from the route beyond which a fix counts as off-route (metres). */
export const OFF_ROUTE_M = 20

/**
 * Off-route test (spec §46). The threshold grows with GPS uncertainty so
 * ordinary drift is not mistaken for leaving the path.
 */
export const isOffRoute = (offsetM: number, accuracyM: number) => offsetM > Math.max(OFF_ROUTE_M, accuracyM * 1.5)
