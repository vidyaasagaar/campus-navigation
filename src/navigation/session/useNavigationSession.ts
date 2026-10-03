import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Graph } from '../../graph/Graph'
import { toLocal } from '../../data/geo'
import type { RouteGeometry } from '../routeGeometry'
import { isOffRoute, judgeFix, type PositionFix } from './locationFilter'
import { matchLatLng, measuredAlong, nearestNode, nextInstruction, polylineAlong, routeTotal, type Instruction } from './routeProgress'

export type NavSource = 'simulation' | 'live'

/** Shared with the 3D scene every frame (no React re-render). */
export interface NavTarget {
  /** Map-matched polyline distance the marker should move toward, or null when idle. */
  along: number | null
  /** Raw measured position (live mode) — drawn separately from the smoothed marker. */
  raw: THREE.Vector3 | null
  accuracy: number | null
}

export interface SessionView {
  travelled: number
  remaining: number
  etaSeconds: number
  instruction: Instruction | null
  fix: PositionFix | null
  /** Latest location problem to show the user (low accuracy, off campus, permission…). */
  locationWarning: string | null
  arrived: boolean
  notice: string | null
}

interface Options {
  graph: Graph
  active: boolean
  paused: boolean
  source: NavSource
  /** Simulation multiplier: 1 = real walking time (spec §45.1). */
  simSpeed: number
  walkingSpeed: number
  route: RouteGeometry | null
  destinationName: string
  onArrive: () => void
  /** Live user left the route: recalculate from this node (spec §46). */
  onReroute: (fromNode: string) => void
}

const ARRIVAL_THRESHOLD_M = 10
const OFF_CAMPUS_M = 400

const idle: SessionView = {
  travelled: 0,
  remaining: 0,
  etaSeconds: 0,
  instruction: null,
  fix: null,
  locationWarning: null,
  arrived: false,
  notice: null,
}

export function useNavigationSession(o: Options) {
  const target = useRef<NavTarget>({ along: null, raw: null, accuracy: null })
  const [view, setView] = useState<SessionView>(idle)
  const opts = useRef(o)
  opts.current = o

  // Progress in MEASURED metres; reset whenever a new route starts.
  const travelled = useRef(0)
  useEffect(() => {
    travelled.current = 0
    target.current = { along: o.active && o.route ? 0 : null, raw: null, accuracy: null }
    setView(idle)
  }, [o.route, o.active, o.source])

  const publish = (patch: Partial<SessionView>) => {
    const { route, graph, walkingSpeed } = opts.current
    if (!route) return
    const total = routeTotal(route)
    const t = Math.min(travelled.current, total)
    setView((v) => ({
      ...v,
      ...patch,
      travelled: t,
      remaining: Math.max(0, total - t),
      etaSeconds: Math.max(0, total - t) / walkingSpeed,
      instruction: nextInstruction(graph, route, polylineAlong(route, t)),
    }))
  }

  // ---- Simulation: a virtual walker on the calculated route (spec §45) ----
  useEffect(() => {
    if (!o.active || o.source !== 'simulation' || !o.route) return
    let raf = 0
    let last = performance.now()
    let lastPublish = 0
    let done = false
    const tick = (now: number) => {
      const { paused, simSpeed, walkingSpeed, route } = opts.current
      // Track wall-clock time so 1× really equals walking time, even when frames are sparse.
      const dt = Math.min(2, (now - last) / 1000)
      last = now
      if (!paused && route && !done) {
        const total = routeTotal(route)
        travelled.current = Math.min(total, travelled.current + walkingSpeed * simSpeed * dt)
        target.current.along = polylineAlong(route, travelled.current)
        // Arrival from position relative to the destination node (spec §47), not from an animation ending.
        if (total - travelled.current <= 0.5) {
          done = true
          publish({ arrived: true })
          opts.current.onArrive()
        } else if (now - lastPublish > 250) {
          lastPublish = now
          publish({})
        }
      }
      raf = requestAnimationFrame(tick)
    }
    publish({})
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.active, o.source, o.route])

  // ---- Live location (spec §43) ----
  useEffect(() => {
    if (!o.active || o.source !== 'live' || !o.route) return
    if (!('geolocation' in navigator)) {
      setView((v) => ({ ...v, locationWarning: 'Location is not available in this browser.' }))
      return
    }
    let accepted: PositionFix | null = null
    let offRouteCount = 0
    let done = false
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const { route, graph, paused } = opts.current
        if (!route || done) return
        const fix: PositionFix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp,
          heading: p.coords.heading ?? null,
          speed: p.coords.speed ?? null,
        }
        const [rx, rz] = toLocal(fix)
        target.current.raw = new THREE.Vector3(rx, 0.4, rz)
        target.current.accuracy = fix.accuracy
        const verdict = judgeFix(accepted, fix)
        if (!verdict.use) {
          publish({
            fix,
            locationWarning:
              verdict.reason === 'low-accuracy'
                ? `Location accuracy is low (±${Math.round(fix.accuracy)} m). Move to an open area for better positioning.`
                : 'Ignoring a sudden GPS jump.',
          })
          return
        }
        accepted = fix
        const match = matchLatLng(route, fix)
        if (match.offset > OFF_CAMPUS_M) {
          publish({
            fix,
            locationWarning: `You appear to be ${(match.offset / 1000).toFixed(1)} km from this route. Live navigation needs you on campus — use Simulation to preview.`,
          })
          return
        }
        if (paused) return
        if (isOffRoute(match.offset, fix.accuracy)) {
          offRouteCount++
          if (offRouteCount >= 2) {
            offRouteCount = 0
            publish({ fix, locationWarning: null, notice: 'You have left the planned route. Recalculating.' })
            opts.current.onReroute(nearestNode(graph, fix).id)
            return
          }
        } else offRouteCount = 0
        travelled.current = measuredAlong(route, match.along)
        target.current.along = match.along
        const end = route.points[route.points.length - 1]
        const toEnd = Math.hypot(end.x - rx, end.z - rz)
        if (toEnd <= ARRIVAL_THRESHOLD_M && fix.accuracy <= 25) {
          done = true
          publish({ fix, locationWarning: null, arrived: true })
          opts.current.onArrive()
          return
        }
        publish({
          fix,
          locationWarning:
            toEnd <= fix.accuracy ? `${opts.current.destinationName} is nearby, but location accuracy (±${Math.round(fix.accuracy)} m) is too low to confirm arrival.` : null,
        })
      },
      (err) =>
        setView((v) => ({
          ...v,
          locationWarning: err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : `Location unavailable: ${err.message}`,
        })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.active, o.source, o.route])

  return { view, target }
}

