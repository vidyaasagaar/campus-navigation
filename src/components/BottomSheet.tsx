import { useRef, useState, type ReactNode } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'

const ORDER: SheetSnap[] = ['peek', 'half', 'full']
const height = (snap: SheetSnap) =>
  snap === 'peek' ? 'calc(150px + env(safe-area-inset-bottom))' : snap === 'half' ? '52dvh' : 'calc(100dvh - 76px)'

interface Props {
  snap: SheetSnap
  onSnap: (s: SheetSnap) => void
  children: ReactNode
}

/**
 * Map-app style bottom sheet for phones: drag the handle (or tap it) to move
 * between peek, half and full height. The map stays usable above it.
 */
export function BottomSheet({ snap, onSnap, children }: Props) {
  const start = useRef<{ y: number; t: number } | null>(null)
  const [drag, setDrag] = useState(0)

  const end = (y: number) => {
    if (!start.current) return
    const dy = y - start.current.y
    const fast = Math.abs(dy) / Math.max(1, performance.now() - start.current.t) > 0.5
    start.current = null
    setDrag(0)
    const i = ORDER.indexOf(snap)
    if (Math.abs(dy) < 8) onSnap(ORDER[(i + 1) % ORDER.length]) // tap cycles
    else if (dy < 0) onSnap(ORDER[Math.min(ORDER.length - 1, i + (fast && Math.abs(dy) > 120 ? 2 : 1))])
    else onSnap(ORDER[Math.max(0, i - (fast && Math.abs(dy) > 120 ? 2 : 1))])
  }

  return (
    <section
      aria-label="Directions"
      className="glass fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl !border-b-0 transition-[height] duration-300 ease-out"
      style={{
        height: drag ? `calc(${height(snap)} - ${drag}px)` : height(snap),
        transitionDuration: drag ? '0ms' : undefined,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button
        aria-label={`Resize panel (currently ${snap})`}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center"
        onPointerDown={(e) => {
          start.current = { y: e.clientY, t: performance.now() }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => start.current && setDrag(e.clientY - start.current.y)}
        onPointerUp={(e) => end(e.clientY)}
        onPointerCancel={() => {
          start.current = null
          setDrag(0)
        }}
        onKeyDown={(e) => {
          const i = ORDER.indexOf(snap)
          if (e.key === 'ArrowUp') onSnap(ORDER[Math.min(2, i + 1)])
          if (e.key === 'ArrowDown') onSnap(ORDER[Math.max(0, i - 1)])
        }}
      >
        <span className="h-1.5 w-10 rounded-full bg-white/35" />
      </button>
      <div className={`min-h-0 flex-1 ${snap === 'peek' ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}>{children}</div>
    </section>
  )
}
