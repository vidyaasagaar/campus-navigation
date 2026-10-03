import * as THREE from 'three'
import type { Anchor } from '../components/ScreenProjector'
import { campusGraph } from '../data/campusGraph'
import { FLOOR_HEIGHT, buildingModels } from '../data/campusModels'
import { toLocal } from '../data/geo'

export type NodeState = 'idle' | 'frontier' | 'visited' | 'current' | 'path'

const DOT: Record<NodeState, string> = {
  idle: '#ffffff',
  frontier: '#7cc4ff',
  visited: '#f5b942',
  current: '#f2552c',
  path: '#f2552c',
}

/** Named places (junctions are routing-only and never labelled). */
export const placeNodes = campusGraph.allNodes().filter((n) => n.kind !== 'junction')
const isMinor = (kind: string) => kind === 'sports' || kind === 'parking'

/** One anchor per location, above its building — linked to graph nodes by id. */
export const nodeLabelAnchors: Anchor[] = placeNodes.map((node) => {
  const model = buildingModels.find((b) => b.id === node.id)
  const [x, z] = toLocal(model?.center ?? node.position)
  const height = model ? model.floors * FLOOR_HEIGHT + 4 : 5
  return {
    id: `node:${node.id}`,
    position: new THREE.Vector3(x, height, z),
    maxDistance: isMinor(node.kind) ? 520 : undefined,
  }
})

interface Props {
  from: string | null
  to: string | null
  nodeStates: Record<string, NodeState>
  distances?: Record<string, number>
  onPick: (id: string) => void
}

/** Screen-space labels (constant size while zooming); positioned by ScreenProjector. */
export function CampusLabelElements({ from, to, nodeStates, distances, onPick }: Props) {
  return (
    <>
      {placeNodes.map((node) => {
        const role = node.id === to ? 'to' : node.id === from ? 'from' : null
        const d = distances?.[node.id]
        const state = nodeStates[node.id] ?? 'idle'
        return (
          <div key={node.id} data-anchor={`node:${node.id}`} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
            <button
              onClick={() => onPick(node.id)}
              aria-label={`${node.name}${role === 'to' ? ', destination' : role === 'from' ? ', start' : ''}`}
              className={`label-pill pointer-events-auto flex items-center gap-1.5 rounded-full shadow-lg ring-1 transition ${
                isMinor(node.kind) && !role ? 'px-2 py-0.5 text-[10.5px] font-medium opacity-90' : 'px-2.5 py-1 text-[12px] font-semibold tracking-wide'
              } ${
                role === 'to'
                  ? 'bg-[#f2552c] text-white ring-white/30'
                  : role === 'from'
                    ? 'bg-white text-[#0b1724] ring-black/10'
                    : 'bg-[#0b1724]/85 text-white ring-white/10 hover:bg-[#13243a]'
              }`}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[state] }} />
              {node.kind === 'parking' && <span aria-hidden>P</span>}
              {node.name}
              {d !== undefined && (
                <span className="font-mono text-[10px] font-normal opacity-75">{Number.isFinite(d) ? `${d.toFixed(1)} m` : '∞'}</span>
              )}
            </button>
          </div>
        )
      })}
    </>
  )
}

/** Entrance nodes on the ground, coloured by Dijkstra state. */
export function NodeMarkers({ nodeStates }: { nodeStates: Record<string, NodeState> }) {
  return (
    <group>
      {placeNodes.map((n) => {
        const [x, z] = toLocal(n.position)
        const state = nodeStates[n.id] ?? 'idle'
        return (
          <mesh key={n.id} position={[x, 0.2, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[state === 'idle' ? 1.6 : 2.4, 32]} />
            <meshBasicMaterial color={DOT[state]} />
          </mesh>
        )
      })}
    </group>
  )
}
