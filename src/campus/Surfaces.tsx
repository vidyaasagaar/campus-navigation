import { useMemo } from 'react'
import * as THREE from 'three'
import { surfaceModels, type SurfaceKind, type SurfaceModel } from '../data/campusModels'
import { toLocal } from '../data/geo'

const PX_PER_M = 8
const WHITE = 'rgba(255,255,255,0.9)'

/** Draws a court of standard size (len × wid metres) centred in the surface. */
function court(ctx: CanvasRenderingContext2D, W: number, H: number, len: number, wid: number, extra?: (x: number, y: number, m: number) => void) {
  const m = PX_PER_M
  const x = (W - len * m) / 2
  const y = (H - wid * m) / 2
  ctx.strokeStyle = WHITE
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, len * m, wid * m)
  ctx.beginPath()
  ctx.moveTo(W / 2, y)
  ctx.lineTo(W / 2, y + wid * m)
  ctx.stroke()
  extra?.(x, y, m)
}

const PAINT: Record<SurfaceKind, (ctx: CanvasRenderingContext2D, W: number, H: number) => void> = {
  'running-track': (ctx, W, H) => {
    ctx.fillStyle = '#b4523a'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.5
    for (let lane = 1; lane < 6; lane++) {
      const inset = lane * 1.22 * PX_PER_M
      ctx.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset)
    }
  },
  football: (ctx, W, H) => {
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#3f8f3a' : '#47a141'
      ctx.fillRect((i * W) / 12, 0, W / 12 + 1, H)
    }
    ctx.strokeStyle = WHITE
    ctx.lineWidth = 2.5
    const pad = 4 * PX_PER_M
    ctx.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad)
    ctx.beginPath()
    ctx.moveTo(W / 2, pad)
    ctx.lineTo(W / 2, H - pad)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 9.15 * PX_PER_M, 0, Math.PI * 2)
    ctx.stroke()
    for (const side of [0, 1]) {
      const bw = 16.5 * PX_PER_M
      const bh = 40.3 * PX_PER_M
      ctx.strokeRect(side ? W - pad - bw : pad, H / 2 - bh / 2, bw, bh)
    }
  },
  'box-cricket': (ctx, W, H) => {
    ctx.fillStyle = '#1d4f3b'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#2b6a4f'
    ctx.fillRect(W / 2 - 1.5 * PX_PER_M, H / 2 - 10 * PX_PER_M, 3 * PX_PER_M, 20 * PX_PER_M)
  },
  badminton: (ctx, W, H) => {
    ctx.fillStyle = '#2d6a5d'
    ctx.fillRect(0, 0, W, H)
    // Four standard doubles courts (13.4 × 6.1 m) in a 2 × 2 grid.
    const m = PX_PER_M
    for (const [cx, cy] of [
      [0.27, 0.3],
      [0.73, 0.3],
      [0.27, 0.7],
      [0.73, 0.7],
    ]) {
      ctx.strokeStyle = WHITE
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx * W - 3.05 * m, cy * H - 6.7 * m, 6.1 * m, 13.4 * m)
      ctx.beginPath()
      ctx.moveTo(cx * W - 3.05 * m, cy * H)
      ctx.lineTo(cx * W + 3.05 * m, cy * H)
      ctx.stroke()
    }
  },
  basketball: (ctx, W, H) => {
    ctx.fillStyle = '#9a5a3a'
    ctx.fillRect(0, 0, W, H)
    court(ctx, W, H, 28, 15, (x, y, m) => {
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, 1.8 * m, 0, Math.PI * 2)
      ctx.stroke()
      for (const side of [0, 1]) {
        const cx = side ? x + 28 * m - 1.575 * m : x + 1.575 * m
        ctx.beginPath()
        ctx.arc(cx, y + 7.5 * m, 6.75 * m, side ? Math.PI / 2 : -Math.PI / 2, side ? (3 * Math.PI) / 2 : Math.PI / 2)
        ctx.stroke()
      }
    })
  },
  volleyball: (ctx, W, H) => {
    ctx.fillStyle = '#c4935a'
    ctx.fillRect(0, 0, W, H)
    court(ctx, W, H, 18, 9)
  },
  kabaddi: (ctx, W, H) => {
    ctx.fillStyle = '#b97a52'
    ctx.fillRect(0, 0, W, H)
    court(ctx, W, H, 13, 10, (_x, y, m) => {
      for (const d of [3.75, 4.75]) {
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.moveTo(W / 2 + side * d * m, y)
          ctx.lineTo(W / 2 + side * d * m, y + 10 * m)
          ctx.stroke()
        }
      }
    })
  },
  'bike-parking': (ctx, W, H) => {
    ctx.fillStyle = '#6a6e72'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    for (let x = 0; x < W; x += 1.2 * PX_PER_M) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H * 0.6)
      ctx.stroke()
    }
  },
  'car-parking': (ctx, W, H) => {
    ctx.fillStyle = '#5f6367'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    for (let x = 0; x <= W; x += 2.6 * PX_PER_M) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H * 0.55)
      ctx.stroke()
    }
  },
}

function surfaceTexture(s: SurfaceModel) {
  const c = document.createElement('canvas')
  c.width = Math.round(s.width * PX_PER_M)
  c.height = Math.round(s.depth * PX_PER_M)
  PAINT[s.kind](c.getContext('2d')!, c.width, c.height)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const LAYER: Partial<Record<SurfaceKind, number>> = { 'running-track': 0.04, football: 0.07 }

/** Sports grounds and parking, generated from `surfaceModels`. */
export function Surfaces() {
  const items = useMemo(() => surfaceModels.map((s) => ({ s, tex: surfaceTexture(s), at: toLocal(s.center) })), [])
  return (
    <group>
      {items.map(({ s, tex, at: [x, z] }) => (
        <group key={s.id} position={[x, 0, z]} rotation={[0, s.rotation, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, LAYER[s.kind] ?? 0.06, 0]} receiveShadow>
            <planeGeometry args={[s.width, s.depth]} />
            <meshStandardMaterial map={tex} roughness={0.9} />
          </mesh>
          <Fixtures s={s} />
        </group>
      ))}
    </group>
  )
}

/** Simple 3D props so each facility reads at a glance. */
function Fixtures({ s }: { s: SurfaceModel }) {
  const post = (x: number, z: number, h: number, key: string) => (
    <mesh key={key} position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[0.08, 0.08, h, 6]} />
      <meshStandardMaterial color="#d9d9d9" />
    </mesh>
  )
  switch (s.kind) {
    case 'box-cricket':
      // Netted enclosure.
      return (
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[s.width, 7, s.depth]} />
          <meshStandardMaterial color="#0f2a20" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )
    case 'volleyball':
      return (
        <group>
          {post(0, -4.5, 2.4, 'a')}
          {post(0, 4.5, 2.4, 'b')}
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[0.04, 0.9, 9]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
        </group>
      )
    case 'basketball':
      return (
        <group>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 14.6, 0, 0]}>
              {post(0, 0, 3.4, 'p')}
              <mesh position={[-side * 0.4, 3.3, 0]}>
                <boxGeometry args={[0.05, 1.05, 1.8]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'football':
      return (
        <group>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (s.width / 2 - 4), 1.2, 0]}>
              <boxGeometry args={[0.15, 2.44, 7.32]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      )
    case 'car-parking':
      return <ParkedVehicles count={11} spacing={2.6} size={[1.8, 1.4, 4.2]} colors={['#2d3a4a', '#c9ccd1', '#7d1f1f', '#1e1e22']} width={s.width} />
    case 'bike-parking':
      return <ParkedVehicles count={22} spacing={1.2} size={[0.5, 1.0, 1.8]} colors={['#222', '#3a3f48', '#7a2020']} width={s.width} />
    default:
      return null
  }
}

/** Decorative parked vehicles — illustrative, not a count of real vehicles. */
function ParkedVehicles({ count, spacing, size, colors, width }: { count: number; spacing: number; size: [number, number, number]; colors: string[]; width: number }) {
  return (
    <group>
      {Array.from({ length: Math.min(count, Math.floor(width / spacing)) }, (_, i) => (
        <mesh key={i} position={[-width / 2 + spacing * (i + 0.5), size[1] / 2 + 0.05, -1 + ((i * 7) % 3) * 0.15]} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.5} metalness={0.2} />
        </mesh>
      ))}
    </group>
  )
}
