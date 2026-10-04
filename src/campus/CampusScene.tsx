import { MapControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { buildingModels } from '../data/campusModels'
import { toLocal } from '../data/geo'
import { easeInOutCubic, easeOutCubic } from '../globe/CameraFlight'
import { ScreenProjector, type Anchor } from '../components/ScreenProjector'
import { RouteRenderer, SegmentLabelElements, segmentAnchors, type MarkerState } from '../navigation/RouteRenderer'
import type { RouteGeometry } from '../navigation/routeGeometry'
import type { PositionFix } from '../navigation/session/locationFilter'
import type { NavTarget } from '../navigation/session/useNavigationSession'
import { Building } from './Buildings'
import { CampusLabelElements, NodeMarkers, nodeLabelAnchors, type NodeState } from './CampusLabels'
import { MyLocationMarker } from './MyLocationMarker'
import { Surfaces } from './Surfaces'
import { Trees, Walkways } from './Walkways'

// Frame that shows every mapped location.
const bounds = (() => {
  const pts = buildingModels.map((b) => toLocal(b.center))
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  return {
    center: new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2),
    width: Math.max(...xs) - Math.min(...xs) + 120,
    depth: Math.max(...zs) - Math.min(...zs) + 120,
  }
})()
const LANDING = { target: bounds.center.clone() }

/** Camera pose that fits a width × depth area on screen, viewed from the south at ~50°. */
function frameArea(camera: THREE.Camera, center: THREE.Vector3, width: number, depth: number) {
  const cam = camera as THREE.PerspectiveCamera
  const vfov = THREE.MathUtils.degToRad(cam.fov)
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect)
  const elevation = THREE.MathUtils.degToRad(50)
  const dist = Math.max(width / 2 / Math.tan(hfov / 2), (depth * Math.sin(elevation)) / 2 / Math.tan(vfov / 2)) * 1.1
  const offset = new THREE.Vector3(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(dist)
  return { position: center.clone().add(offset), target: center.clone() }
}

export interface CampusSceneProps {
  intro: boolean
  reducedMotion: boolean
  from: string | null
  to: string | null
  nodeStates: Record<string, NodeState>
  distances?: Record<string, number>
  route: RouteGeometry | null
  alternatives: RouteGeometry[]
  navigating: boolean
  following: boolean
  navTarget: MutableRefObject<NavTarget>
  resetSignal: number
  onPick: (id: string) => void
  /** The device's real GPS position (blue dot), if available. */
  myLocation?: PositionFix | null
  /** Increment to fly the camera to `myLocation` ("my location" button). */
  locateSignal?: number
  /** Phones: lighter shadows and pixel ratio. */
  lowPower?: boolean
  /** Phones open zoomed in on this point (your location or Block B) instead of the whole campus. */
  home?: { lat: number; lng: number } | null
}

export default function CampusScene(props: CampusSceneProps) {
  const overlay = useRef<HTMLDivElement>(null)
  // Start/destination labels stay visible at any zoom.
  const anchors = useMemo(
    () => [
      ...nodeLabelAnchors.map((a) => (a.id === `node:${props.from}` || a.id === `node:${props.to}` ? { ...a, pinned: true } : a)),
      ...segmentAnchors(props.route),
    ],
    [props.route, props.from, props.to],
  )
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={props.lowPower ? [1, 1.5] : [1, 2]}
        camera={{ fov: 45, near: 1, far: 12000, position: [LANDING.target.x, 2600, LANDING.target.z + 1] }}
        gl={{ antialias: true }}
      >
        <SceneContents {...props} anchors={anchors} overlay={overlay} />
      </Canvas>
      {/* DOM labels, positioned every frame by ScreenProjector */}
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden">
        <SegmentLabelElements route={props.route} />
        <CampusLabelElements
          from={props.from}
          to={props.to}
          nodeStates={props.nodeStates}
          distances={props.distances}
          onPick={props.onPick}
        />
      </div>
    </div>
  )
}

function SceneContents(props: CampusSceneProps & { anchors: Anchor[]; overlay: RefObject<HTMLDivElement | null> }) {
  const marker = useRef<MarkerState>({ distance: 0, position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1) })
  const highlight = (id: string) => (id === props.to ? 'destination' : id === props.from ? 'source' : null)

  return (
    <>
      <color attach="background" args={['#cfe0ec']} />
      <fog attach="fog" args={['#cfe0ec', 2800, 9000]} />
      <hemisphereLight args={['#eaf3ff', '#9c8f78', 0.9]} />
      <directionalLight
        position={[-300, 420, 200]}
        intensity={2.1}
        color="#fff4e2"
        castShadow
        shadow-mapSize={props.lowPower ? [2048, 2048] : [4096, 4096]}
        shadow-camera-left={-600}
        shadow-camera-right={600}
        shadow-camera-top={600}
        shadow-camera-bottom={-600}
        shadow-camera-far={1500}
        shadow-bias={-0.0004}
      />

      <Ground />
      <Surfaces />
      <Walkways />
      <Trees />
      {buildingModels.map((m) => (
        <Building key={m.id} model={m} highlight={highlight(m.id)} />
      ))}
      <NodeMarkers nodeStates={props.nodeStates} />
      {props.myLocation && <MyLocationMarker fix={props.myLocation} />}
      <ScreenProjector anchors={props.anchors} container={props.overlay} />
      {props.route && (
        <RouteRenderer
          route={props.route}
          alternatives={props.alternatives}
          navigating={props.navigating}
          reducedMotion={props.reducedMotion}
          marker={marker}
          navTarget={props.navTarget}
        />
      )}
      <CameraRig {...props} marker={marker} />
    </>
  )
}

function Ground() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#d6ccb8'
    ctx.fillRect(0, 0, 512, 512)
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 9000; i++) {
      const v = 190 + rand() * 40
      ctx.fillStyle = `rgba(${v},${v - 12},${v - 34},0.35)`
      ctx.fillRect(rand() * 512, rand() * 512, 2, 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(60, 60)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.center.x, 0, bounds.center.z]} receiveShadow>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <gridHelper
        args={[2000, 40, '#b9ae98', '#c8bea9']}
        position={[bounds.center.x, 0.02, bounds.center.z]}
        material-transparent
        material-opacity={0.35}
      />
    </group>
  )
}

interface Tween {
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toPos: THREE.Vector3
  toTarget: THREE.Vector3
  start: number
  duration: number
  ease: (t: number) => number
}

function CameraRig({
  intro,
  reducedMotion,
  route,
  navigating,
  following,
  resetSignal,
  marker,
  myLocation,
  locateSignal = 0,
  home,
}: CampusSceneProps & { marker: MutableRefObject<MarkerState> }) {
  const { camera, clock } = useThree()
  const controls = useRef<MapControlsImpl>(null)
  const tween = useRef<Tween | null>(null)
  const target = useRef(LANDING.target.clone())

  const animateTo = (toPos: THREE.Vector3, toTarget: THREE.Vector3, duration: number, ease = easeInOutCubic) => {
    tween.current = {
      fromPos: camera.position.clone(),
      fromTarget: target.current.clone(),
      toPos,
      toTarget,
      start: clock.elapsedTime,
      duration: reducedMotion ? 0.001 : duration,
      ease,
    }
  }

  const landing = () => {
    if (home) {
      const [x, z] = toLocal(home)
      return frameArea(camera, new THREE.Vector3(x, 0, z), 300, 300)
    }
    return frameArea(camera, bounds.center, bounds.width, bounds.depth)
  }

  // Arrival: descend from high altitude into the landing perspective.
  useEffect(() => {
    if (intro) {
      camera.position.set(LANDING.target.x, 2600, LANDING.target.z + 1)
      target.current.copy(LANDING.target)
      const l = landing()
      animateTo(l.position, l.target, 3.4, easeOutCubic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro])

  useEffect(() => {
    if (resetSignal === 0) return
    const l = landing()
    animateTo(l.position, l.target, 1.4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  // "My location" button: fly to the blue dot, like a map app.
  useEffect(() => {
    if (locateSignal === 0 || !myLocation) return
    const [x, z] = toLocal(myLocation)
    const center = new THREE.Vector3(x, 0, z)
    const f = frameArea(camera, center, 220, 220)
    animateTo(f.position, f.target, 1.2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateSignal])

  // Frame a newly calculated route.
  useEffect(() => {
    if (!route || route.points.length < 2) return
    const box = new THREE.Box3().setFromPoints(route.points)
    const center = box.getCenter(new THREE.Vector3()).setY(0)
    const f = frameArea(camera, center, Math.max(box.max.x - box.min.x, 60) + 80, Math.max(box.max.z - box.min.z, 60) + 80)
    animateTo(f.position, f.target, 1.6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  // Leaving follow mode: hand the current view back to the orbit controls.
  useEffect(() => {
    if (!following && navigating === false && controls.current) controls.current.target.copy(target.current)
  }, [following, navigating])

  useFrame((_, delta) => {
    const c = controls.current
    if (following && navigating) {
      const { position, direction } = marker.current
      const desired = position.clone().addScaledVector(direction, -48).add(new THREE.Vector3(0, 30, 0))
      const look = position.clone().addScaledVector(direction, 25)
      const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 3)
      camera.position.lerp(desired, k)
      target.current.lerp(look, k)
      camera.lookAt(target.current)
      if (c) {
        c.enabled = false
        c.target.copy(target.current)
      }
      return
    }
    if (tween.current) {
      const tw = tween.current
      const t = Math.min((clock.elapsedTime - tw.start) / tw.duration, 1)
      const e = tw.ease(t)
      camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
      target.current.lerpVectors(tw.fromTarget, tw.toTarget, e)
      camera.lookAt(target.current)
      if (c) {
        c.enabled = false
        c.target.copy(target.current)
      }
      if (t >= 1) tween.current = null
      return
    }
    if (c) {
      c.enabled = true
      target.current.copy(c.target)
    }
  })

  return (
    // Map-style controls: drag / one finger pans, pinch zooms, two fingers (or right-drag) rotate and tilt.
    <MapControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
      maxPolarAngle={Math.PI * 0.47}
      minDistance={25}
      maxDistance={2400}
      zoomToCursor
      target={LANDING.target}
    />
  )
}
