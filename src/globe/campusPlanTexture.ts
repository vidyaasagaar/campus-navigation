import * as THREE from 'three'
import { campusGraph } from '../data/campusGraph'
import { buildingModels } from '../data/campusModels'
import { toLocal } from '../data/geo'

/** Side length (m) of the plan drawn onto the globe surface. */
export const PLAN_SIZE_M = 2400

const FILL = { academic: '#2b66c9', hostel: '#ece3d1', canteen: '#3f8a63' } as const

/**
 * Top-down campus plan drawn from the same datasets as the 3D scene,
 * centred on the campus origin. Shown on the globe at the end of the dive so
 * the hand-off to the 3D campus is continuous.
 */
export function createCampusPlanTexture(px = 2048): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')!
  const s = px / PLAN_SIZE_M
  const X = (m: number) => px / 2 + m * s
  const Z = (m: number) => px / 2 + m * s

  const ground = ctx.createRadialGradient(px / 2, px / 2, px * 0.15, px / 2, px / 2, px / 2)
  ground.addColorStop(0, 'rgba(214,204,184,1)')
  ground.addColorStop(0.75, 'rgba(214,204,184,0.85)')
  ground.addColorStop(1, 'rgba(214,204,184,0)')
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, px, px)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#b9b2a5'
  ctx.lineWidth = 7 * s
  for (const e of campusGraph.allEdges()) {
    ctx.beginPath()
    e.path.map(toLocal).forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))))
    ctx.stroke()
  }

  for (const b of buildingModels) {
    const [x, z] = toLocal(b.center)
    ctx.save()
    ctx.translate(X(x), Z(z))
    // three.js rotation.y = θ maps local +x to (cos θ, −sin θ) in (x, z).
    ctx.rotate(-b.rotation)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect((-b.width / 2 + 3) * s, (-b.depth / 2 + 3) * s, b.width * s, b.depth * s)
    ctx.fillStyle = b.style === 'academic' ? '#dcd6cb' : b.style === 'hostel' ? '#dcd6cb' : FILL.canteen
    ctx.fillRect((-b.width / 2) * s, (-b.depth / 2) * s, b.width * s, b.depth * s)
    ctx.restore()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
