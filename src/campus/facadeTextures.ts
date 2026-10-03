import * as THREE from 'three'

const PX_PER_M = 12
const cache = new Map<string, THREE.CanvasTexture>()

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void) {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(64, Math.round(w * PX_PER_M))
  canvas.height = Math.max(64, Math.round(h * PX_PER_M))
  draw(canvas.getContext('2d')!, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

/**
 * Academic block facade (photo 1): blue cladding, cream window bands,
 * a brown frame around a dark-green glass core.
 */
export function academicFacade(width: number, floors: number, floorH: number, withCore: boolean) {
  const height = floors * floorH + 1.6
  return make(`academic-${width}-${floors}-${withCore}`, width, height, (ctx, W, H) => {
    const m = W / width
    ctx.fillStyle = '#2b66c9'
    ctx.fillRect(0, 0, W, H)
    // parapet
    ctx.fillStyle = '#ece4d3'
    ctx.fillRect(0, 0, W, 1.6 * m)
    const coreW = withCore ? 6 * m : 0
    const coreX = W / 2 - coreW / 2
    const bays = Math.max(2, Math.round(width / 3.2))
    for (let f = 0; f < floors; f++) {
      const y = H - (f + 1) * floorH * m
      for (let b = 0; b < bays; b++) {
        const x = (b + 0.5) * (W / bays)
        if (withCore && Math.abs(x - W / 2) < coreW * 0.75) continue
        // cream window surround + glass
        ctx.fillStyle = '#efe7d6'
        ctx.fillRect(x - 0.95 * m, y + 0.7 * m, 1.9 * m, 2.1 * m)
        ctx.fillStyle = '#2d3c4a'
        ctx.fillRect(x - 0.6 * m, y + 0.95 * m, 1.2 * m, 1.6 * m)
      }
    }
    if (withCore) {
      ctx.fillStyle = '#8f4a2e'
      ctx.fillRect(coreX - 0.9 * m, 1.6 * m, coreW + 1.8 * m, H)
      const glass = ctx.createLinearGradient(coreX, 0, coreX + coreW, 0)
      glass.addColorStop(0, '#1d4a46')
      glass.addColorStop(0.5, '#2f6a63')
      glass.addColorStop(1, '#1d4a46')
      ctx.fillStyle = glass
      ctx.fillRect(coreX, 2.2 * m, coreW, H - 2.2 * m - 3.6 * m)
      ctx.strokeStyle = 'rgba(200,230,225,0.25)'
      ctx.lineWidth = 1
      for (let f = 1; f < floors; f++) {
        const y = H - f * floorH * m
        ctx.beginPath()
        ctx.moveTo(coreX, y)
        ctx.lineTo(coreX + coreW, y)
        ctx.stroke()
      }
      // entrance canopy + sign
      ctx.fillStyle = '#f4efe6'
      ctx.fillRect(coreX - 1.6 * m, H - 3.6 * m, coreW + 3.2 * m, 0.7 * m)
      ctx.fillStyle = '#20313f'
      ctx.fillRect(coreX + 0.4 * m, H - 2.9 * m, coreW - 0.8 * m, 2.9 * m)
    }
  })
}

/** Hostel facade (photo 2): cream walls with terracotta balcony bands. */
export function hostelFacade(width: number, floors: number, floorH: number) {
  const height = floors * floorH + 1.2
  return make(`hostel-${width}-${floors}`, width, height, (ctx, W, H) => {
    const m = W / width
    ctx.fillStyle = '#ece3d1'
    ctx.fillRect(0, 0, W, H)
    const bays = Math.max(3, Math.round(width / 3.4))
    for (let f = 0; f < floors; f++) {
      const y = H - (f + 1) * floorH * m
      ctx.fillStyle = '#b8693f'
      ctx.fillRect(0, y + floorH * m - 0.55 * m, W, 0.55 * m)
      for (let b = 0; b < bays; b++) {
        const x = (b + 0.5) * (W / bays)
        ctx.fillStyle = '#3a3f45'
        ctx.fillRect(x - 0.7 * m, y + 0.8 * m, 1.4 * m, 1.6 * m)
      }
    }
    // stair core
    ctx.fillStyle = '#d7c9ad'
    ctx.fillRect(W * 0.48, 0, W * 0.04, H)
  })
}

export function canteenFacade(width: number, floors: number, floorH: number) {
  const height = floors * floorH + 0.8
  return make(`canteen-${width}-${floors}`, width, height, (ctx, W, H) => {
    const m = W / width
    ctx.fillStyle = '#e9e1cf'
    ctx.fillRect(0, 0, W, H)
    for (let f = 0; f < floors; f++) {
      const y = H - (f + 1) * floorH * m
      ctx.fillStyle = '#2f3a42'
      for (let x = 1.5 * m; x < W - 2 * m; x += 4 * m) ctx.fillRect(x, y + 0.9 * m, 2.6 * m, 1.8 * m)
    }
  })
}

export function roofTexture(kind: 'plain' | 'solar') {
  return make(`roof-${kind}`, 20, 20, (ctx, W, H) => {
    ctx.fillStyle = '#dcd6cb'
    ctx.fillRect(0, 0, W, H)
    if (kind === 'solar') {
      ctx.fillStyle = '#2a3d5c'
      for (let y = 20; y < H - 20; y += 44) for (let x = 16; x < W - 16; x += 30) ctx.fillRect(x, y, 24, 30)
    }
  })
}
