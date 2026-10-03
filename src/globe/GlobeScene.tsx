import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ScreenProjector } from '../components/ScreenProjector'
import { campus } from '../data/campusGraph'
import { flightFrame, latLngToVector } from './CameraFlight'
import { createCampusPlanTexture, PLAN_SIZE_M } from './campusPlanTexture'
import { createEarthTexture } from './earthTexture'

const TARGET = latLngToVector(campus.googlePlaceCoordinate.lat, campus.googlePlaceCoordinate.lng)
const START_ALTITUDE = 2.4
// Matches the 3D campus camera's starting height (2.6 km) so the crossfade has no zoom jump.
const END_ALTITUDE = 2600 / 6_371_000
const ORIGIN = latLngToVector(campus.origin.lat, campus.origin.lng)

interface Props {
  flying: boolean
  reducedMotion: boolean
  onProgress: (t: number) => void
  onArrive: () => void
  /** Show the "MRTC" label next to the marker. */
  showLabel: boolean
}

const LABEL_ANCHORS = [{ id: 'mrtc', position: TARGET.clone().multiplyScalar(1.0002) }]
// A point on the sphere faces the camera when the camera lies above its tangent plane.
const facesCamera = (p: THREE.Vector3, camera: THREE.Camera) => p.dot(camera.position.clone().sub(p)) > 0

export default function GlobeScene(props: Props) {
  const overlay = useRef<HTMLDivElement>(null)
  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 45, near: 0.0002, far: 100, position: latLngToVector(18, 20, 1 + START_ALTITUDE).toArray() }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#050a12']} />
        <Stars />
        <Earth />
        <Atmosphere />
        <CampusMarker />
        <CampusPlan />
        <FlightController {...props} />
        <ScreenProjector anchors={LABEL_ANCHORS} container={overlay} isVisible={facesCamera} />
      </Canvas>
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {props.showLabel && (
          <div data-anchor="mrtc" className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
            <div className="-translate-x-1/2 translate-y-4 whitespace-nowrap font-mono text-[11px] tracking-[0.2em] text-white/90">MRTC</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Earth() {
  const texture = useMemo(() => createEarthTexture(4096), [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh>
      <sphereGeometry args={[1, 128, 128]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
            gl_FragColor = vec4(0.35, 0.6, 0.95, 1.0) * rim * 0.9;
          }`,
      }),
    [],
  )
  return (
    <mesh scale={1.06} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  )
}

function Stars() {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts: number[] = []
    let seed = 42
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 2500; i++) {
      const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(40)
      pts.push(v.x, v.y, v.z)
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.06} color="#9fb3c8" transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

/** The campus plan, laid on the globe surface; fades in during the last part of the dive. */
function CampusPlan() {
  const mesh = useRef<THREE.Mesh>(null)
  const { texture, quaternion } = useMemo(() => {
    const d = 1e-4
    const east = latLngToVector(campus.origin.lat, campus.origin.lng + d).sub(ORIGIN).normalize()
    const north = latLngToVector(campus.origin.lat + d, campus.origin.lng).sub(ORIGIN).normalize()
    const normal = ORIGIN.clone().normalize()
    // Plane local +x = east, +y = north, +z = outward normal.
    const basis = new THREE.Matrix4().makeBasis(east, north, normal)
    return { texture: createCampusPlanTexture(), quaternion: new THREE.Quaternion().setFromRotationMatrix(basis) }
  }, [])
  const size = PLAN_SIZE_M / 6_371_000
  useFrame(({ camera }) => {
    if (!mesh.current) return
    const altitude = camera.position.length() - 1
    const m = mesh.current.material as THREE.MeshBasicMaterial
    m.opacity = THREE.MathUtils.clamp((0.004 - altitude) / 0.003, 0, 1)
    mesh.current.visible = m.opacity > 0
  })
  return (
    <mesh ref={mesh} position={ORIGIN.clone().multiplyScalar(1.000001)} quaternion={quaternion} renderOrder={5}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} opacity={0} />
    </mesh>
  )
}

function CampusMarker() {
  const ring = useRef<THREE.Mesh>(null)
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), TARGET.clone().normalize()),
    [],
  )
  useFrame(({ clock, camera }) => {
    if (!ring.current) return
    // Keep the marker a constant size on screen while the camera dives.
    const d = camera.position.distanceTo(TARGET)
    const pulse = 1 + 0.35 * Math.sin(clock.elapsedTime * 3)
    ring.current.scale.setScalar(d * 0.018 * pulse)
  })
  return (
    <group position={TARGET.clone().multiplyScalar(1.0002)} quaternion={quaternion}>
      <mesh ref={ring}>
        <ringGeometry args={[0.6, 1, 48]} />
        <meshBasicMaterial color="#f2552c" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

function FlightController({ flying, reducedMotion, onProgress, onArrive }: Props) {
  const { camera } = useThree()
  const start = useRef<{ time: number; dir: THREE.Vector3; altitude: number } | null>(null)
  const arrived = useRef(false)
  const duration = reducedMotion ? 0.6 : 7.5

  useFrame(({ clock }, delta) => {
    if (!flying) {
      // Slow orbital idle.
      const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), delta * 0.04)
      camera.position.applyQuaternion(spin)
      camera.lookAt(0, 0, 0)
      return
    }
    if (!start.current) {
      start.current = {
        time: clock.elapsedTime,
        dir: camera.position.clone().normalize(),
        altitude: camera.position.length() - 1,
      }
    }
    const t = Math.min((clock.elapsedTime - start.current.time) / duration, 1)
    const frame = flightFrame(t, start.current.dir, ORIGIN, start.current.altitude, END_ALTITUDE)
    camera.position.copy(frame.position)
    camera.up.set(0, 1, 0)
    camera.lookAt(frame.lookAt)
    onProgress(t)
    if (t >= 1 && !arrived.current) {
      arrived.current = true
      onArrive()
    }
  })
  return null
}
