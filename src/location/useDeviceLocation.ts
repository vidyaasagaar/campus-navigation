import { useCallback, useEffect, useRef, useState } from 'react'
import { campusGraph } from '../data/campusGraph'
import { MAX_USABLE_ACCURACY_M, type PositionFix } from '../navigation/session/locationFilter'
import { nearestNode } from '../navigation/session/routeProgress'

export type LocationStatus =
  | 'idle' // not asked yet
  | 'locating' // permission granted / waiting for the first fix
  | 'live' // receiving fixes
  | 'denied'
  | 'unavailable'
  | 'insecure' // page not served over HTTPS — browsers block location

/** Farther than this from every campus node = not on campus (metres). */
export const ON_CAMPUS_M = 150

export interface DeviceLocation {
  status: LocationStatus
  fix: PositionFix | null
  /** Nearest named place or junction, with straight-line distance to it. */
  nearest: { id: string; distance: number } | null
  onCampus: boolean
  /** Good enough to use as a route start: on campus and accuracy within the usable limit. */
  usable: boolean
  error: string | null
  request: () => void
}

/**
 * The phone's live position for the map's blue dot and "Your location" start.
 * Uses the browser Geolocation API (watchPosition). Location is only available
 * on secure pages (HTTPS or localhost) and after the user allows it.
 */
export function useDeviceLocation(autoStart: boolean): DeviceLocation {
  const [status, setStatus] = useState<LocationStatus>(() =>
    typeof window !== 'undefined' && !window.isSecureContext ? 'insecure' : 'idle',
  )
  const [fix, setFix] = useState<PositionFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)

  const request = useCallback(() => {
    if (!window.isSecureContext) {
      setStatus('insecure')
      setError('Location needs a secure (https://) page. Open the HTTPS link on your phone.')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      setError('This browser does not provide location.')
      return
    }
    if (watchId.current !== null) return
    setStatus('locating')
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
          heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          speed: p.coords.speed ?? null,
        })
        setStatus('live')
        setError(null)
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setStatus('denied')
          setError('Location permission was denied. Allow it in your browser settings to use your position.')
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
          watchId.current = null
        } else {
          setStatus((s) => (s === 'live' ? s : 'unavailable'))
          setError(e.code === e.TIMEOUT ? 'Still waiting for a GPS fix…' : `Location unavailable: ${e.message}`)
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
  }, [])

  useEffect(() => {
    if (autoStart) request()
  }, [autoStart, request])

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    },
    [],
  )

  const nearest = fix ? nearestNode(campusGraph, fix) : null
  const onCampus = !!nearest && nearest.distance <= ON_CAMPUS_M
  const usable = !!fix && onCampus && fix.accuracy <= MAX_USABLE_ACCURACY_M
  return { status, fix, nearest, onCampus, usable, error, request }
}
