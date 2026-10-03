import { ROUTE_MODES, type RouteMode } from '../algorithms/accessibility'
import type { NavSource, SessionView } from './session/useNavigationSession'
import { formatMeters } from './format'

const SPEEDS = [0.5, 1, 2, 5, 10]
const TURN_ICON = { left: '↰', right: '↱', straight: '↑', arrive: '◎' } as const

interface Props {
  source: NavSource
  simSpeed: number
  mode: RouteMode
  destination: string
  view: SessionView
  paused: boolean
  following: boolean
  onSpeed: (s: number) => void
  onTogglePause: () => void
  onToggleFollow: () => void
  onExit: () => void
  onReadAloud: () => void
}

/** Live/simulation banner, progress and controls while navigating (spec §39.7, §43, §45). */
export function NavigationProgress(p: Props) {
  const { view } = p
  const m = ROUTE_MODES.find((x) => x.id === p.mode)!
  return (
    <section aria-label="Navigation progress" className="space-y-3">
      {p.source === 'simulation' ? (
        <div className="flex items-center justify-between rounded-xl bg-amber-500/15 px-3 py-2 text-[12px] font-semibold text-amber-200 ring-1 ring-amber-400/40">
          <span>
            <span aria-hidden>🟠 </span>SIMULATION — {p.simSpeed}×{p.simSpeed === 1 ? ' (real walking time)' : ''}
          </span>
          <span className="font-normal text-amber-200/80">not your real location</span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 px-3 py-2 text-[12px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40">
          <span>
            <span aria-hidden>🟢 </span>LIVE LOCATION
          </span>
          <span className="font-mono font-normal">
            {view.fix ? `Accuracy ±${Math.round(view.fix.accuracy)} m` : 'Waiting for location…'}
          </span>
        </div>
      )}

      {view.locationWarning && (
        <p role="status" className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
          ⚠ {view.locationWarning}
        </p>
      )}
      {view.notice && !view.arrived && (
        <p role="status" className="rounded-lg bg-white/10 px-3 py-2 text-xs">
          {view.notice}
        </p>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">
          {m.icon} {m.label} · to
        </div>
        <div className="text-lg font-semibold uppercase tracking-wide">{p.destination}</div>
        <div className="mt-1 flex gap-4 font-mono">
          <span>
            <span className="text-2xl">{formatMeters(view.remaining)}</span> <span className="text-xs text-white/50">remaining</span>
          </span>
          <span>
            <span className="text-2xl">{view.arrived ? 0 : `~${Math.max(1, Math.round(view.etaSeconds / 60))}`} min</span>{' '}
            <span className="text-xs text-white/50">est.</span>
          </span>
        </div>
      </div>

      {view.arrived ? (
        <div role="status" className="rounded-xl bg-[#f2552c]/20 p-3 text-center text-sm font-semibold">
          ◎ You have reached {p.destination}.
        </div>
      ) : (
        view.instruction && (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3" aria-live="polite">
            <span aria-hidden className="text-3xl leading-none text-[#f2552c]">
              {TURN_ICON[view.instruction.turn]}
            </span>
            <span>
              <span className="block text-[10px] uppercase tracking-wider text-white/45">Next</span>
              <span className="text-sm">{view.instruction.text}</span>
            </span>
          </div>
        )
      )}

      {p.source === 'simulation' && (
        <div>
          <div id="sim-speed" className="mb-1 text-[10px] uppercase tracking-wider text-white/45">
            Simulation speed
          </div>
          <div role="radiogroup" aria-labelledby="sim-speed" className="flex gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={s === p.simSpeed}
                onClick={() => p.onSpeed(s)}
                className={`ctrl flex-1 ${s === p.simSpeed ? '!bg-amber-500/30 ring-1 ring-amber-400/60' : ''}`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={p.onTogglePause} className="ctrl h-11 flex-1" disabled={view.arrived}>
          {p.paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={p.onToggleFollow} className="ctrl h-11 flex-1" aria-pressed={p.following}>
          {p.following ? 'Free camera' : 'Follow'}
        </button>
        <button onClick={p.onReadAloud} className="ctrl h-11" aria-label="Read current instruction aloud" title="Read aloud">
          🔊
        </button>
        <button onClick={p.onExit} className="ctrl h-11 flex-1 !bg-[#f2552c] text-white">
          Exit
        </button>
      </div>
    </section>
  )
}
