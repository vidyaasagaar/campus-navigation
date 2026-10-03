import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { FLOOR_HEIGHT, type BuildingModel } from '../data/campusModels'
import { toLocal } from '../data/geo'
import { academicFacade, canteenFacade, hostelFacade, roofTexture } from './facadeTextures'

export type Highlight = 'source' | 'destination' | null

interface Props {
  model: BuildingModel
  highlight: Highlight
}

const HIGHLIGHT_COLOR = { source: '#ffffff', destination: '#f2552c' } as const

function Box({ model, highlight, faces, height }: Props & { faces: THREE.Material[]; height: number }) {
  const [x, z] = toLocal(model.center)
  return (
    <group position={[x, 0, z]} rotation={[0, model.rotation, 0]}>
      <mesh position={[0, height / 2, 0]} material={faces} castShadow receiveShadow>
        <boxGeometry args={[model.width, height, model.depth]} />
        {highlight && <Edges color={HIGHLIGHT_COLOR[highlight]} lineWidth={2.5} threshold={15} />}
      </mesh>
    </group>
  )
}

const mat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.02 })

export function AcademicBlock(props: Props) {
  const { width, depth, floors } = props.model
  const height = floors * FLOOR_HEIGHT + 1.6
  const faces = useMemo(() => {
    const front = mat(academicFacade(width, floors, FLOOR_HEIGHT, true))
    const side = mat(academicFacade(depth, floors, FLOOR_HEIGHT, false))
    const roof = mat(roofTexture('plain'))
    return [side, side, roof, roof, front, front]
  }, [width, depth, floors])
  return <Box {...props} faces={faces} height={height} />
}

export function HostelBlock(props: Props) {
  const { width, depth, floors } = props.model
  const height = floors * FLOOR_HEIGHT + 1.2
  const faces = useMemo(() => {
    const front = mat(hostelFacade(width, floors, FLOOR_HEIGHT))
    const side = mat(hostelFacade(depth, floors, FLOOR_HEIGHT))
    const roof = mat(roofTexture('solar'))
    return [side, side, roof, roof, front, front]
  }, [width, depth, floors])
  return <Box {...props} faces={faces} height={height} />
}

export function Canteen(props: Props) {
  const { width, depth, floors } = props.model
  const height = floors * FLOOR_HEIGHT + 0.8
  const faces = useMemo(() => {
    const front = mat(canteenFacade(width, floors, FLOOR_HEIGHT))
    const side = mat(canteenFacade(depth, floors, FLOOR_HEIGHT))
    const roof = new THREE.MeshStandardMaterial({ color: '#3f8a63', roughness: 0.6 })
    return [side, side, roof, roof, front, front]
  }, [width, depth, floors])
  return <Box {...props} faces={faces} height={height} />
}

export function Building(props: Props) {
  if (props.model.style === 'academic') return <AcademicBlock {...props} />
  if (props.model.style === 'hostel') return <HostelBlock {...props} />
  return <Canteen {...props} />
}
