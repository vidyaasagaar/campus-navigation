import { geoEquirectangular, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import * as THREE from 'three'
import countries50m from 'world-atlas/countries-50m.json'

const INDIA_ID = '356'

/**
 * Original, data-driven Earth texture: Natural Earth country shapes
 * (public domain, via world-atlas) drawn onto an equirectangular canvas.
 */
export function createEarthTexture(width = 4096): THREE.CanvasTexture {
  const height = width / 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const projection = geoEquirectangular()
    .scale(width / (2 * Math.PI))
    .translate([width / 2, height / 2])
  const path = geoPath(projection, ctx)

  // Ocean with a soft latitude gradient
  const ocean = ctx.createLinearGradient(0, 0, 0, height)
  ocean.addColorStop(0, '#0a1a2b')
  ocean.addColorStop(0.5, '#0d2236')
  ocean.addColorStop(1, '#0a1a2b')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, width, height)

  ctx.beginPath()
  path(geoGraticule10())
  ctx.strokeStyle = 'rgba(140, 180, 220, 0.07)'
  ctx.lineWidth = 1
  ctx.stroke()

  const topo = countries50m as unknown as Topology<{ countries: GeometryCollection }>
  const fc = feature(topo, topo.objects.countries)

  ctx.beginPath()
  for (const f of fc.features) path(f)
  ctx.fillStyle = '#25394a'
  ctx.fill()

  ctx.beginPath()
  for (const f of fc.features) path(f)
  ctx.strokeStyle = 'rgba(190, 210, 230, 0.22)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  const india = fc.features.find((f) => String(f.id) === INDIA_ID)
  if (india) {
    ctx.beginPath()
    path(india)
    ctx.fillStyle = '#35566f'
    ctx.fill()
    ctx.strokeStyle = 'rgba(242, 85, 44, 0.65)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
