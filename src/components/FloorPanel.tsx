import { useState } from 'react'
import { campusGraph } from '../data/campusGraph'
import { floorLayouts, floorPlan, type IndoorRoom } from '../data/indoorGraph'

interface Props {
  initialBlock?: string
  selectedRoom: string | null
  onRouteToRoom: (blockId: string, roomId: string) => void
  onClose: () => void
}

/**
 * Conceptual classroom-floor plan (spec §36), generated from floorLayouts.json.
 * Only the side of each room is known; positions, doors and stairs are not.
 */
export function FloorPanel({ initialBlock = 'block-c', selectedRoom, onRouteToRoom, onClose }: Props) {
  const [blockId, setBlockId] = useState(initialBlock)
  const block = floorLayouts.blocks.find((b) => b.blockId === blockId)!
  const [floor, setFloor] = useState(block.floors.includes(2) ? 2 : block.floors[0])
  const [picked, setPicked] = useState<string | null>(selectedRoom)
  const plan = floorPlan(blockId, block.floors.includes(floor) ? floor : block.floors[0])
  const room = plan.rooms.find((r) => r.id === picked) ?? null

  return (
    <div className="glass flex max-h-full w-[min(400px,calc(100vw-32px))] flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="font-mono text-[11px] tracking-[0.25em] text-[#f2552c]">FLOORS</div>
          <div className="text-[11px] text-white/45">Standard classroom floor · conceptual layout</div>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10" aria-label="Close floors panel">
          ✕
        </button>
      </div>

      <div className="min-h-0 space-y-3 overflow-y-auto p-4 text-sm">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Block</span>
            <select
              value={blockId}
              onChange={(e) => {
                setBlockId(e.target.value)
                setPicked(null)
              }}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-2"
            >
              {floorLayouts.blocks.map((b) => (
                <option key={b.blockId} value={b.blockId}>
                  {campusGraph.node(b.blockId).name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/45">Floor</span>
            <select
              value={plan.floor}
              onChange={(e) => {
                setFloor(Number(e.target.value))
                setPicked(null)
              }}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-2"
            >
              {block.floors.map((f) => (
                <option key={f} value={f}>
                  {f === 0 ? 'Ground' : `Floor ${f}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <FloorSvg rooms={plan.rooms} picked={picked} onPick={setPicked} />

        {room ? (
          <div className="rounded-xl bg-white/5 p-3 text-xs">
            <div className="text-sm font-semibold">{room.label}</div>
            <div className="mt-0.5 font-mono text-white/60">graph node {room.id}</div>
            <div className="mt-1 text-white/55">
              Side: {room.side} · Room number: {room.number ?? <span className="text-amber-200">not yet supplied</span>}
            </div>
            <button
              onClick={() => onRouteToRoom(blockId, room.id)}
              className="mt-2 h-9 w-full rounded-lg bg-[#f2552c] font-semibold text-white hover:brightness-110"
            >
              Set as destination
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/50">Select a room to see its graph node.</p>
        )}

        <ul className="space-y-1 text-[11.5px] text-amber-200">
          <li>⚠ Layout is conceptual: positions, door locations and corridor shape are unverified.</li>
          {floorLayouts.template.hodStaffOrder === null && <li>⚠ HOD Room / Staff Room left–right order not yet supplied.</li>}
          <li>⚠ Staircase location unknown{block.lift === null ? '; lift availability unknown' : ''}.</li>
          {!block.floorsVerified && <li>⚠ {block.floorsNote}</li>}
        </ul>

        <details className="text-xs text-white/60">
          <summary className="cursor-pointer select-none text-white/75">Data still required ({floorLayouts.dataStillRequired.length})</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {floorLayouts.dataStillRequired.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}

function FloorSvg({ rooms, picked, onPick }: { rooms: IndoorRoom[]; picked: string | null; onPick: (id: string) => void }) {
  const west = rooms.filter((r) => r.side === 'west')
  const east = rooms.filter((r) => r.side === 'east')
  const south = rooms.filter((r) => r.side === 'south')
  const W = 340
  const colW = 120
  const top = 30
  const colH = 210
  const box = (r: IndoorRoom, x: number, y: number, w: number, h: number, dashed = false) => {
    const active = r.id === picked
    return (
      <g
        key={r.id}
        role="button"
        tabIndex={0}
        aria-label={`${r.label}, ${r.side} side${active ? ', selected' : ''}`}
        aria-pressed={active}
        onClick={() => onPick(r.id)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(r.id))}
        className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-white [&:focus-visible>rect]:stroke-[3]"
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={6}
          fill={active ? 'rgba(242,85,44,0.25)' : 'rgba(255,255,255,0.06)'}
          stroke={active ? '#f2552c' : 'rgba(255,255,255,0.35)'}
          strokeWidth={active ? 2 : 1}
          strokeDasharray={dashed ? '5 4' : undefined}
        />
        <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fill="white" fontSize={12} fontWeight={600}>
          {r.label}
        </text>
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily="JetBrains Mono, monospace">
          {r.id}
        </text>
      </g>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} 330`} className="w-full" role="group" aria-label="Conceptual floor plan, north at top">
      <text x={W / 2} y={16} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10} letterSpacing={2}>
        ▲ NORTH / REAR
      </text>
      <text x={8} y={top + colH / 2} fill="rgba(255,255,255,0.35)" fontSize={9} transform={`rotate(-90 8 ${top + colH / 2})`} textAnchor="middle">
        WEST
      </text>
      <text x={W - 6} y={top + colH / 2} fill="rgba(255,255,255,0.35)" fontSize={9} transform={`rotate(90 ${W - 6} ${top + colH / 2})`} textAnchor="middle">
        EAST
      </text>
      {/* corridor (shape unverified) */}
      <rect x={20 + colW + 8} y={top} width={W - 2 * (20 + colW + 8)} height={colH + 20} rx={4} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" />
      <text x={W / 2} y={top + colH / 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} transform={`rotate(-90 ${W / 2} ${top + colH / 2})`}>
        CORRIDOR (shape unverified)
      </text>
      {west.map((r, i) => box(r, 20, top + i * (colH / 2 + 4), colW, colH / 2 - 4))}
      {east.map((r, i) => box(r, W - 20 - colW, top + i * (colH / 3 + 3), colW, colH / 3 - 3))}
      {/* HOD / Staff — order not supplied, so drawn dashed */}
      {south.map((r, i) => box(r, 40 + i * ((W - 80) / 2 + 4), top + colH + 30, (W - 80) / 2 - 4, 46, true))}
      <text x={W / 2} y={324} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10} letterSpacing={2}>
        ▼ SOUTH / FRONT
      </text>
    </svg>
  )
}
