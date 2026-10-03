import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { ribbonGeometry } from '../campus/Walkways'
import type { Anchor } from '../components/ScreenProjector'
import { formatMeters } from './format'
import { sampleRoute, type RouteGeometry } from './routeGeometry'
import type { NavTarget } from './session/useNavigationSession'

export interface MarkerState {
  distance: number
  position: THREE.Vector3
  direction: THREE.Vector3
}

interface Props {
  route: RouteGeometry
  alternatives: RouteGeometry[]
  navigating: boolean
  reducedMotion: boolean
  marker: MutableRefObject<MarkerState>
  /** Where the navigation session says the user is (map-matched), plus the raw fix. */
  navTarget: MutableRefObject<NavTarget>
}

const ROUTE_COLOR = '#f2552c'

/** Points of the route from `along` to the end. */
function remainingPoints(route: RouteGeometry, along: number): THREE.Vector3[] {
  const start = sampleRoute(route, along).position
  const rest = route.points.filter((_, i) => route.cumulative[i] > along)
  return [start, ...rest]
}

export function RouteRenderer({ route, alternatives, navigating, reducedMotion, marker, navTarget }: Props) {
  const markerMesh = useRef<THREE.Group>(null)
  const rawMesh = useRef<THREE.Group>(null)
  const pulse = useRef<THREE.Mesh>(null)
  const glow = useMemo(() => ribbonGeometry(route.points.map((p) => [p.x, p.z]), 10, 0.25), [route])
  const end = route.points[route.points.length - 1]
  const [remaining, setRemaining] = useState<THREE.Vector3[]>(route.points)
  const lastSplit = useRef(0)

  useEffect(() => {
    marker.current = { distance: 0, ...sampleRoute(route, 0) }
    lastSplit.current = 0
    setRemaining(route.points)
  }, [route, navigating, marker])

  useFrame(({ clock }, delta) => {
    if (pulse.current) {
      const s = 1 + ((clock.elapsedTime * 0.8) % 1) * 2.2
      pulse.current.scale.setScalar(s)
      ;(pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ((clock.elapsedTime * 0.8) % 1))
    }
    if (!navigating) return
    const t = navTarget.current
    if (t.along !== null) {
      // Ease toward the matched position — never teleport (spec §39.1, §46).
      const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 5)
      marker.current.distance += (t.along - marker.current.distance) * k
      const s = sampleRoute(route, marker.current.distance)
      marker.current.position = s.position
      marker.current.direction = s.direction
      if (Math.abs(marker.current.distance - lastSplit.current) > 2) {
        lastSplit.current = marker.current.distance
        setRemaining(remainingPoints(route, marker.current.distance))
      }
    }
    if (markerMesh.current) {
      markerMesh.current.position.copy(marker.current.position)
      markerMesh.current.position.y = 1.2 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 4) * 0.25)
    }
    if (rawMesh.current) {
      rawMesh.current.visible = !!t.raw
      if (t.raw) {
        rawMesh.current.position.copy(t.raw)
        const r = Math.max(1, t.accuracy ?? 1)
        rawMesh.current.children[1].scale.setScalar(r)
      }
    }
  })

  return (
    <group>
      {alternatives.map((alt, i) => (
        <Line key={i} points={alt.points} color="#ffffff" transparent opacity={0.55} lineWidth={2} dashed dashSize={4} gapSize={3} />
      ))}
      <mesh geometry={glow}>
        <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={navigating ? 0.12 : 0.22} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Full route (faded once walking) + bright remaining part */}
      <Line points={route.points} color={navigating ? '#9a6b5e' : ROUTE_COLOR} lineWidth={navigating ? 3 : 5} />
      {navigating && remaining.length >= 2 && <Line points={remaining} color={ROUTE_COLOR} lineWidth={6} />}

      {/* Destination */}
      <group position={[end.x, 0.3, end.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.2, 32]} />
          <meshBasicMaterial color={ROUTE_COLOR} />
        </mesh>
        <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.4, 3, 48]} />
          <meshBasicMaterial color={ROUTE_COLOR} transparent depthWrite={false} />
        </mesh>
      </group>

      {navigating && (
        <group ref={markerMesh} position={route.points[0]}>
          <mesh castShadow>
            <sphereGeometry args={[1.3, 24, 24]} />
            <meshStandardMaterial color="#ffffff" emissive={ROUTE_COLOR} emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, -1.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.6, 2.2, 32]} />
            <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Raw live fix: hollow dot + accuracy circle, kept distinct from the smoothed marker (spec §43.2) */}
      <group ref={rawMesh} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1.2, 24]} />
          <meshBasicMaterial color="#2f7bff" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 48]} />
          <meshBasicMaterial color="#2f7bff" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Anchors for the per-segment distance labels (positioned by ScreenProjector). */
export const segmentAnchors = (route: RouteGeometry | null): Anchor[] =>
  route ? route.segments.map((seg, i) => ({ id: `seg:${i}`, position: seg.midpoint.clone().setY(3) })) : []

export function SegmentLabelElements({ route }: { route: RouteGeometry | null }) {
  if (!route) return null
  return (
    <>
      {route.segments.map((seg, i) => (
        <div key={`${seg.from}-${seg.to}`} data-anchor={`seg:${i}`} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
          <div className="pointer-events-none -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#0b1724]/85 px-2 py-0.5 font-mono text-[11px] text-white shadow-lg ring-1 ring-white/10">
            {formatMeters(seg.distance)}
          </div>
        </div>
      ))}
    </>
  )
}
