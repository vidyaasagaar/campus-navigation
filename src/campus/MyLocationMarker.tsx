import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { toLocal } from '../data/geo'
import type { PositionFix } from '../navigation/session/locationFilter'

const BLUE = '#1a73e8'

/**
 * The user's real position: blue dot, accuracy circle (radius = reported
 * accuracy in metres) and, when the device reports one, a heading cone.
 * Drawn exactly where the GPS says — never snapped or smoothed onto a path.
 */
export function MyLocationMarker({ fix }: { fix: PositionFix }) {
  const group = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const [x, z] = toLocal(fix)
  const cone = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.absarc(0, 0, 9, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45, false)
    s.lineTo(0, 0)
    return new THREE.ShapeGeometry(s, 16)
  }, [])

  useFrame(({ clock }, delta) => {
    if (group.current) {
      // Ease toward the newest fix so the dot glides instead of jumping.
      group.current.position.x += (x - group.current.position.x) * Math.min(1, delta * 6)
      group.current.position.z += (z - group.current.position.z) * Math.min(1, delta * 6)
    }
    if (halo.current) {
      const t = (clock.elapsedTime % 2) / 2
      halo.current.scale.setScalar(1 + t * 1.6)
      ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t)
    }
  })

  // Heading: degrees clockwise from north. In our frame north = −z, east = +x.
  const heading = fix.heading != null ? THREE.MathUtils.degToRad(fix.heading) : null

  return (
    <group ref={group} position={[x, 0, z]}>
      {/* accuracy circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} renderOrder={2}>
        <circleGeometry args={[Math.max(2, fix.accuracy), 64]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.13} depthWrite={false} />
      </mesh>
      {heading !== null && (
        <mesh rotation={[-Math.PI / 2, 0, -heading]} position={[0, 0.35, 0]} renderOrder={3}>
          <primitive object={cone} attach="geometry" />
          <meshBasicMaterial color={BLUE} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]} renderOrder={3}>
        <ringGeometry args={[2.6, 3.4, 40]} />
        <meshBasicMaterial color={BLUE} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} renderOrder={4}>
        <circleGeometry args={[2.7, 40]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.55, 0]} renderOrder={5}>
        <circleGeometry args={[2.0, 40]} />
        <meshBasicMaterial color={BLUE} />
      </mesh>
    </group>
  )
}
