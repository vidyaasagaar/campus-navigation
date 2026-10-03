import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import * as THREE from 'three'

export interface Anchor {
  id: string
  position: THREE.Vector3
  /** Hide the label when the camera is farther than this (metres) — declutters zoomed-out views. */
  maxDistance?: number
  /** Keep visible regardless of distance (e.g. the selected start/destination). */
  pinned?: boolean
}

/**
 * Positions plain DOM labels over 3D points. Lives inside the <Canvas>; the
 * labels themselves are ordinary React elements in the page (marked with
 * `data-anchor`) inside `container`, so they mount and unmount with the rest
 * of the UI — no separate React roots.
 */
export function ScreenProjector({
  anchors,
  container,
  isVisible,
}: {
  anchors: Anchor[]
  container: RefObject<HTMLElement | null>
  /** Extra visibility test, e.g. "not behind the globe". */
  isVisible?: (position: THREE.Vector3, camera: THREE.Camera) => boolean
}) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const root = container.current
    if (!root) return
    for (const a of anchors) {
      const el = root.querySelector<HTMLElement>(`[data-anchor="${a.id}"]`)
      if (!el) continue
      v.copy(a.position).project(camera)
      const near = a.pinned || a.maxDistance === undefined || camera.position.distanceTo(a.position) <= a.maxDistance
      const onScreen = near && v.z > -1 && v.z < 1 && (isVisible?.(a.position, camera) ?? true)
      el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0)`
      el.style.visibility = onScreen ? 'visible' : 'hidden'
    }
  })
  return null
}
