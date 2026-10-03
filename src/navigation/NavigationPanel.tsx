import { motion } from 'framer-motion'
import { useState } from 'react'
import type { RouteAssessment, RouteMode } from '../algorithms/accessibility'
import { LocationSelector } from '../components/LocationSelector'
import { campusGraphWithIndoor } from '../data/indoorGraph'
import type { NavState } from '../state/navigationState'
import { formatMeters, walkingMinutes } from './format'
import { AccessibilitySummary, NoAccessibleRoute } from './AccessibilitySummary'
import { IndoorContinuation } from './IndoorContinuation'
import { NavigationInstructions } from './NavigationInstructions'
import { NavigationProgress } from './NavigationProgress'
import type { NavSource, SessionView } from './session/useNavigationSession'
import { RoutePreference } from './RoutePreference'
import { RouteOptions } from './RouteOptions'

interface Props {
  state: NavState
  assessment: RouteAssessment | null
  rejectedCount: number
  onMode: (mode: RouteMode) => void
  onEndpoints: (from: string | null, to: string | null) => void
  onCalculate: () => void
  onSelectRoute: (i: number) => void
  onStart: (follow: boolean, source?: NavSource) => void
  session: SessionView
  walkingSpeed: number
  onSpeed: (speed: number) => void
  onReadAloud: () => void
  onTogglePause: () => void
  onExit: () => void
}

export function NavigationPanel({
  state,
  assessment,
  rejectedCount,
  onMode,
  onEndpoints,
  onCalculate,
  onSelectRoute,
  onStart,
  onTogglePause,
  onExit,
  session,
  walkingSpeed,
  onSpeed,
  onReadAloud,
}: Props) {
  const [follow, setFollow] = useState(true)
  const route = state.routes[state.selectedRoute]
  const navigating = state.phase === 'NAVIGATING'
  const calculated = state.phase === 'ROUTE_CALCULATED' || navigating
  const noRoute = state.phase === 'ROUTE_CALCULATED' && state.routes.length === 0
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex max-h-full w-[min(380px,calc(100vw-32px))] flex-col rounded-2xl"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/90">Where do you want to go?</h2>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-lg px-2 py-1 text-xs text-white/60 hover:bg-white/10"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '▾' : '▴'}
        </button>
      </div>
      {collapsed ? (
        <div className="px-4 pb-4 pt-1 text-xs text-white/60">
          {route ? `${formatMeters(route.distance)} · ~${walkingMinutes(route.distance)} min` : 'Select a start and destination'}
        </div>
      ) : (
      <>
      <div className="space-y-3 border-b border-white/10 p-4 pt-3">
        <LocationSelector label="From" value={state.from} exclude={state.to} onChange={(id) => onEndpoints(id, state.to)} />
        <div className="relative">
          <button
            onClick={() => onEndpoints(state.to, state.from)}
            className="absolute -top-3 right-2 z-10 rounded-full bg-[#13243a] px-2 py-0.5 text-xs text-white/70 ring-1 ring-white/15 hover:text-white"
            aria-label="Swap from and to"
            title="Swap"
          >
            ⇅
          </button>
          <LocationSelector label="To" value={state.to} exclude={state.from} onChange={(id) => onEndpoints(state.from, id)} />
        </div>
        {state.room && (
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs">
            <span>
              Room: <span className="font-semibold">{campusGraphWithIndoor.node(state.room).name}</span>{' '}
              <span className="font-mono text-white/50">{state.room}</span>
            </span>
            <button
              onClick={() => onEndpoints(state.from, state.to)}
              className="rounded px-1.5 text-white/60 hover:bg-white/10"
              aria-label="Clear room destination"
            >
              ✕
            </button>
          </div>
        )}
        <RoutePreference mode={state.mode} disabled={navigating} onChange={onMode} />
        <button
          onClick={onCalculate}
          disabled={!state.from || !state.to || navigating}
          className="h-11 w-full rounded-xl bg-[#f2552c] text-sm font-semibold text-white transition enabled:hover:brightness-110 enabled:active:scale-[0.99] disabled:opacity-40"
        >
          Calculate Route
        </button>
      </div>

      {noRoute && <NoAccessibleRoute mode={state.mode} blocker={state.blocker} />}

      {calculated && route && navigating && (
        <div className="min-h-0 overflow-y-auto p-4">
          <NavigationProgress
            source={state.source}
            simSpeed={state.simSpeed}
            mode={state.mode}
            destination={campusGraphWithIndoor.node(route.path[route.path.length - 1]).name}
            view={session}
            paused={state.paused}
            following={state.following}
            onSpeed={onSpeed}
            onTogglePause={onTogglePause}
            onToggleFollow={() => onStart(!state.following)}
            onExit={onExit}
            onReadAloud={onReadAloud}
          />
          {state.room && state.to && (
            <div className="mt-3">
              <IndoorContinuation building={state.to} room={state.room} mode={state.mode} />
            </div>
          )}
        </div>
      )}

      {calculated && route && !navigating && (
        <div className="min-h-0 space-y-4 overflow-y-auto p-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">Total distance</div>
              <div className="font-mono text-2xl">{formatMeters(route.distance)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">Walk (est.)</div>
              <div className="font-mono text-2xl">~{walkingMinutes(route.distance, walkingSpeed)} min</div>
            </div>
          </div>

          <button onClick={onReadAloud} className="ctrl h-9 w-full">
            <span aria-hidden>🔊 </span>Read Aloud
          </button>

          {assessment && <AccessibilitySummary mode={state.mode} assessment={assessment} rejectedCount={rejectedCount} />}

          <RouteOptions routes={state.routes} selected={state.selectedRoute} onSelect={onSelectRoute} walkingSpeed={walkingSpeed} />

          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/50">Directions</h3>
            <NavigationInstructions path={route.path} />
          </div>

          {state.room && state.to && <IndoorContinuation building={state.to} room={state.room} mode={state.mode} />}

          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => onStart(follow, 'simulation')} className="ctrl h-11 flex-1 !bg-amber-400/90 !text-[#0b1724]">
                <span aria-hidden>🟠 </span>Simulate
              </button>
              <button onClick={() => onStart(follow, 'live')} className="ctrl h-11 flex-1 !bg-emerald-400/90 !text-[#0b1724]">
                <span aria-hidden>🟢 </span>Live location
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-[#f2552c]" />
              Camera follows the route
            </label>
            <p className="text-[10.5px] leading-snug text-white/45">
              Simulation moves a virtual walker along this route at real walking speed (adjustable). Live uses your
              device location and only works on campus.
            </p>
          </div>
          <p className="text-[10.5px] leading-snug text-white/40">
            Distances: Google Maps measurements (not yet ground-verified). Times are estimates at an assumed {walkingSpeed} m/s
            walking speed.
          </p>
        </div>
      )}
      </>
      )}
    </motion.div>
  )
}
