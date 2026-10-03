/**
 * ASSUMED average walking speed used for time estimates. This is not
 * measured campus data — the UI labels times as estimates.
 */
export const WALKING_SPEED_M_PER_S = 1.4

export const formatMeters = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 100 ? 1 : 0)} m`)

export const walkingMinutes = (m: number, speed = WALKING_SPEED_M_PER_S) => Math.max(1, Math.round(m / speed / 60))
