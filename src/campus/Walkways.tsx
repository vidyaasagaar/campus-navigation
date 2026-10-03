import { useMemo } from 'react'
import * as THREE from 'three'
import { campusGraph } from '../data/campusGraph'
import { buildingModels, surfaceModels } from '../data/campusModels'
import { toLocal } from '../data/geo'

/** Flat ribbon along a polyline, with mitred joints. */
export function ribbonGeometry(points: [number, number][], width: number, y = 0): THREE.BufferGeometry {
  const pos: number[] = []
  const idx: number[] = []
  const half = width / 2
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const len = Math.hypot(dx, dz) || 1
    const nx = -dz / len
    const nz = dx / len
    const [x, z] = points[i]
    pos.push(x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half)
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function Walkways() {
  const geometries = useMemo(
    () => campusGraph.allEdges().map((e) => ribbonGeometry(e.path.map(toLocal), 7, 0.05)),
    [],
  )
  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial color="#b9b2a5" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

function applyMatrices(mesh: THREE.InstancedMesh | null, matrices: THREE.Matrix4[]) {
  if (!mesh) return
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.instanceMatrix.needsUpdate = true
}

/** Trees lining the measured walkways (decorative; kept clear of building footprints). */
export function Trees() {
  const { trunks, crowns } = useMemo(() => {
    const spots: [number, number][] = []
    const footprints = [...buildingModels, ...surfaceModels].map((b) => ({ c: toLocal(b.center), r: Math.hypot(b.width, b.depth) / 2 + 3 }))
    const clear = (p: [number, number]) =>
      footprints.every((f) => Math.hypot(p[0] - f.c[0], p[1] - f.c[1]) > f.r) &&
      spots.every((s) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 9)
    for (const e of campusGraph.allEdges()) {
      const pts = e.path.map(toLocal)
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1]
        const [bx, bz] = pts[i]
        const len = Math.hypot(bx - ax, bz - az)
        const nx = -(bz - az) / len
        const nz = (bx - ax) / len
        for (let d = 6; d < len - 6; d += 13) {
          const t = d / len
          for (const side of [-1, 1]) {
            const p: [number, number] = [ax + (bx - ax) * t + nx * side * 8, az + (bz - az) * t + nz * side * 8]
            if (clear(p)) spots.push(p)
          }
        }
      }
    }
    const m = new THREE.Matrix4()
    const trunks: THREE.Matrix4[] = []
    const crowns: THREE.Matrix4[] = []
    spots.forEach(([x, z], i) => {
      const s = 0.8 + ((i * 37) % 10) / 20
      trunks.push(m.clone().compose(new THREE.Vector3(x, 1.6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)))
      crowns.push(m.clone().compose(new THREE.Vector3(x, 4.2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.9, s)))
    })
    return { trunks, crowns }
  }, [])

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, trunks.length]}
        ref={(m) => applyMatrices(m, trunks)}
        castShadow
      >
        <cylinderGeometry args={[0.18, 0.25, 3.2, 6]} />
        <meshStandardMaterial color="#6b5440" />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, crowns.length]}
        ref={(m) => applyMatrices(m, crowns)}
        castShadow
      >
        <icosahedronGeometry args={[2.4, 1]} />
        <meshStandardMaterial color="#4f7a45" roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  )
}
