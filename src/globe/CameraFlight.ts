import * as THREE from 'three'

/** Unit vector for a lat/lng on a three.js SphereGeometry with an equirectangular texture. */
export function latLngToVector(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const polar = THREE.MathUtils.degToRad(90 - lat)
  const azimuth = THREE.MathUtils.degToRad(lng + 180)
  return new THREE.Vector3(
    -Math.cos(azimuth) * Math.sin(polar) * radius,
    Math.cos(polar) * radius,
    Math.sin(azimuth) * Math.sin(polar) * radius,
  )
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export interface FlightFrame {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  altitude: number
}

/**
 * Globe flight: rotate toward the target while pulling back slightly, then
 * dive with a logarithmic altitude curve (each second covers the same zoom
 * ratio, which reads as constant speed to the eye).
 */
export function flightFrame(
  t: number,
  startDir: THREE.Vector3,
  targetDir: THREE.Vector3,
  startAltitude: number,
  endAltitude: number,
): FlightFrame {
  const turn = easeInOutCubic(THREE.MathUtils.clamp(t / 0.55, 0, 1))
  const dir = new THREE.Vector3().copy(startDir).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(dir, targetDir.clone().normalize())
  const partial = new THREE.Quaternion().slerp(q, turn)
  dir.applyQuaternion(partial)

  const dive = easeInOutCubic(THREE.MathUtils.clamp((t - 0.3) / 0.7, 0, 1))
  const lift = Math.sin(Math.min(t / 0.55, 1) * Math.PI) * 0.35
  const altitude = (startAltitude + lift) * Math.pow(endAltitude / (startAltitude + lift), dive)

  // Ends straight down, north-up — the same pose the 3D campus camera starts in.
  const position = dir.clone().multiplyScalar(1 + altitude)
  // Look at the globe centre while turning, then at the campus itself.
  const lookAt = targetDir.clone().normalize().multiplyScalar(dive)
  return { position, lookAt, altitude }
}
